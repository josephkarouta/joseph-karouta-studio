import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError, withCreditReservation, type CreditReservation } from "@/lib/credits/server";
import { GUIDED_STUDIOS, type GuidedStudioId } from "@/lib/studio/generic-config";

export const runtime = "nodejs";
export const maxDuration = 120;

function extractOutputText(data: any): string | null {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  for (const output of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(output?.content) ? output.content : []) {
      if (typeof content?.text === "string" && content.text.trim()) return content.text.trim();
    }
  }
  return null;
}

function parseJson(text: string | null) {
  if (!text) throw new Error("AI returned an empty response.");
  try { return JSON.parse(text); } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response could not be read.");
    return JSON.parse(match[0]);
  }
}

export async function POST(request: Request, context: { params: Promise<{ studio: string }> }) {
  let admin: any = null;
  let reservationId: string | null = null;
  try {
    const { studio: rawStudio } = await context.params;
    const studio = rawStudio as GuidedStudioId;
    const config = GUIDED_STUDIOS[studio];
    if (!config) return NextResponse.json({ error: "Unknown Studio." }, { status: 404 });

    const auth = await requireApiUser(request);
    admin = auth.admin;
    const body = await request.json();
    const input = body?.input && typeof body.input === "object" ? body.input : {};
    const workMode = input.workMode === "professional" && Boolean(config.professionalSteps?.length) ? "professional" : "guided";
    const projectName = String(input[config.projectNameField] || "").trim();
    if (!projectName) return NextResponse.json({ error: "Project name is required." }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY is missing." }, { status: 503 });

    const activeSteps = workMode === "professional" && config.professionalSteps?.length
      ? config.professionalSteps
      : config.steps;
    const required = activeSteps.flatMap((step) => step.fields).filter((field) => field.required);
    const missing = required.filter((field) => Array.isArray(input[field.id]) ? !input[field.id].length : !String(input[field.id] || "").trim());
    if (missing.length) return NextResponse.json({ error: `Complete ${missing.map((field) => field.label.toLowerCase()).join(", ")}.` }, { status: 400 });

    const creditAction = workMode === "professional" && config.professionalCreditAction
      ? config.professionalCreditAction
      : config.creditAction;

    const { result, reservation } = await withCreditReservation({
      admin,
      userId: auth.user.id,
      action: creditAction,
      metadata: {
        studio: config.databaseId,
        project_id: body?.projectId || null,
        project_name: projectName,
        work_mode: workMode,
      },
      work: async (creditReservation: CreditReservation) => {
        reservationId = creditReservation.id;
        let promptInput: Record<string, unknown> = input;
        let connectedBrandContext: Record<string, unknown> | null = null;
        let connectedArchitectureContext: Record<string, unknown> | null = null;

        if (studio === "marketing" && String(input.brandProjectId || "").trim()) {
          const brandProjectId = String(input.brandProjectId || "").trim();
          const connectedBrand = await loadOwnedBrandProject({
            admin,
            token: auth.token,
            userId: auth.user.id,
            brandProjectId,
          });
          if (!connectedBrand) {
            throw new Error("The selected Brand Studio project could not be loaded. Choose another saved brand and try again.");
          }

          const { data: brandAssets, error: brandAssetsError } = await admin
            .from("project_assets")
            .select("id,title,asset_type,file_url,thumbnail_url,metadata,created_at")
            .eq("project_id", brandProjectId)
            .eq("user_id", auth.user.id)
            .order("created_at", { ascending: false })
            .limit(40);
          if (brandAssetsError) {
            console.warn("Marketing connected Brand assets could not be loaded:", brandAssetsError.message);
          }

          connectedBrandContext = {
            id: connectedBrand.id,
            name: connectedBrand.business_name || connectedBrand.project_name || connectedBrand.name || null,
            industry: connectedBrand.industry || null,
            audience: connectedBrand.audience || null,
            style: connectedBrand.style || null,
            description: connectedBrand.description || null,
            brandSystem: compactPromptValue(
              connectedBrand.brand_system_json || connectedBrand.brand_system || connectedBrand.output || null,
              16000,
            ),
            assets: (brandAssets || []).map((asset: any) => ({
              id: asset.id,
              title: asset.title,
              assetType: asset.asset_type,
              metadata: compactPromptValue(asset.metadata, 1200),
            })),
          };
          promptInput = { ...input, connectedBrand: connectedBrandContext };
        }

        if (studio === "interior" && String(input.architectureProjectId || "").trim()) {
          const architectureProjectId = String(input.architectureProjectId);
          const [
            projectResult,
            siteResult,
            programResult,
            materialsResult,
            directionsResult,
            conceptResult,
            planSetResult,
            visualsResult,
          ] = await Promise.all([
            admin.from("architecture_projects").select("*").eq("id", architectureProjectId).eq("user_id", auth.user.id).maybeSingle(),
            admin.from("architecture_sites").select("*").eq("project_id", architectureProjectId).eq("user_id", auth.user.id).maybeSingle(),
            admin.from("architecture_space_programs").select("*").eq("project_id", architectureProjectId).eq("user_id", auth.user.id).order("sort_order", { ascending: true }),
            admin.from("architecture_materials").select("*").eq("project_id", architectureProjectId).eq("user_id", auth.user.id).eq("is_selected", true).order("sort_order", { ascending: true }),
            admin.from("architecture_directions").select("*").eq("project_id", architectureProjectId).eq("user_id", auth.user.id).order("direction_number", { ascending: true }),
            admin.from("architecture_concepts").select("*").eq("project_id", architectureProjectId).eq("user_id", auth.user.id).maybeSingle(),
            admin.from("architecture_plan_sets").select("*").eq("project_id", architectureProjectId).eq("user_id", auth.user.id).maybeSingle(),
            admin.from("architecture_visuals").select("id,visual_type,title,image_url,storage_path,is_approved,metadata,created_at").eq("project_id", architectureProjectId).eq("user_id", auth.user.id).order("created_at", { ascending: true }),
          ]);
          const architectureProject = projectResult.data;
          if (!architectureProject) {
            throw new Error("The selected Architecture Studio project could not be loaded. Choose another Architecture project and try again.");
          }
          const directions = directionsResult.data || [];
          const selectedDirection = directions.find((direction: any) => direction.is_selected || direction.id === architectureProject.selected_direction_id) || null;
          connectedArchitectureContext = {
            id: architectureProject.id,
              projectName: architectureProject.project_name,
              projectType: architectureProject.project_type,
              location: [architectureProject.city, architectureProject.region, architectureProject.country].filter(Boolean).join(", "),
              architecturalStyle: architectureProject.architectural_style,
              workingMode: architectureProject.working_mode,
              selectedSpaces: architectureProject.selected_spaces,
              notes: architectureProject.notes,
              professionalBrief: architectureProject.professional_brief,
              site: siteResult.data || null,
              spaceProgram: programResult.data || [],
              selectedMaterials: materialsResult.data || [],
              selectedDirection,
              concept: conceptResult.data || null,
              planSet: planSetResult.data || null,
              approvedVisuals: (visualsResult.data || []).filter((visual: any) => visual.is_approved),
            allVisuals: visualsResult.data || [],
          };
          promptInput = { ...input, connectedArchitecture: connectedArchitectureContext };
        }

        const prompt = studio === "interior"
          ? workMode === "professional"
            ? professionalInteriorPrompt(promptInput)
            : guidedInteriorPrompt(promptInput)
          : workMode === "professional"
            ? professionalMarketingPrompt(promptInput)
            : marketingPrompt(promptInput);

        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.STUDIO_TEXT_MODEL || process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
            input: prompt,
            max_output_tokens: workMode === "professional" ? 12000 : 6500,
            text: { format: { type: "json_object" } },
          }),
        });
        const providerData = await response.json();
        if (!response.ok) throw new Error(providerData?.error?.message || "AI generation failed.");
        const output = parseJson(extractOutputText(providerData));

        const projectPayload = {
          user_id: auth.user.id,
          studio: config.databaseId,
          project_name: projectName,
          project_type: String(input[config.projectTypeField] || ""),
          status: "active",
          progress: workMode === "professional" ? 78 : 75,
          input: {
            ...input,
            workMode,
            ...(connectedBrandContext ? { connectedBrand: connectedBrandContext } : {}),
            ...(connectedArchitectureContext ? { connectedArchitecture: connectedArchitectureContext } : {}),
          },
          output,
          summary: String(output?.conceptSummary || output?.campaignSummary || ""),
          current_step: workMode === "professional" ? "professional_concept_ready" : "concept_ready",
        };
        const projectQuery = body?.projectId
          ? admin.from("studio_projects").update(projectPayload).eq("id", body.projectId).eq("user_id", auth.user.id).select().single()
          : admin.from("studio_projects").insert(projectPayload).select().single();
        const { data: project, error: projectError } = await projectQuery;
        if (projectError || !project) throw new Error(projectError?.message || "Project could not be saved.");

        const { error: assetError } = await admin.from("project_assets").insert({
          user_id: auth.user.id,
          project_id: String(project.id),
          studio: config.databaseId,
          asset_type: `${studio}_${workMode}_concept`,
          title: studio === "marketing"
            ? `${projectName} — ${workMode === "professional" ? "Professional Campaign System" : "Campaign Concept"}`
            : `${projectName} — ${workMode === "professional" ? "Professional Interior Package" : "Concept Plan"}`,
          payload: output,
          metadata: {
            source: "guided_studio",
            work_mode: workMode,
            credit_reservation_id: creditReservation.id,
            connected_brand_id: connectedBrandContext?.id || null,
            connected_architecture_id: connectedArchitectureContext?.id || null,
          },
        });
        if (assetError) throw new Error(assetError.message || "Generated concept could not be added to project assets.");

        return { output, project, workMode, model: providerData?.model || null, usage: providerData?.usage || null };
      },
    });

    return NextResponse.json({ success: true, ...result, creditsUsed: reservation.amount });
  } catch (error) {
    console.error("Guided Studio generation error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CreditError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation failed.", reservationId }, { status: 500 });
  }
}

async function loadOwnedBrandProject({
  admin,
  token,
  userId,
  brandProjectId,
}: {
  admin: any;
  token: string;
  userId: string;
  brandProjectId: string;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // First use the same authenticated/RLS path as the Marketing UI. This keeps the
  // server lookup consistent with the saved Brand list the client can actually see.
  if (url && anonKey && token) {
    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: scopedBrand, error: scopedError } = await userClient
      .from("brand_projects")
      .select("*")
      .eq("id", brandProjectId)
      .maybeSingle();
    if (scopedBrand) return scopedBrand;
    if (scopedError) {
      console.warn("Authenticated Marketing Brand lookup failed:", scopedError.message);
    }
  }

  // Service-role fallback handles legacy/RLS edge cases, but ownership is checked
  // explicitly before any Brand context is allowed into the Marketing project.
  const { data: adminBrand, error: adminError } = await admin
    .from("brand_projects")
    .select("*")
    .eq("id", brandProjectId)
    .maybeSingle();
  if (adminError) {
    console.warn("Admin Marketing Brand lookup failed:", adminError.message);
    return null;
  }
  if (!adminBrand || String(adminBrand.user_id || "") !== userId) return null;
  return adminBrand;
}

function compactPromptValue(value: unknown, maxChars = 12000): unknown {
  if (value == null) return value;
  const seen = new WeakSet<object>();

  function compact(current: unknown, depth: number): unknown {
    if (current == null || typeof current === "number" || typeof current === "boolean") return current;
    if (typeof current === "string") {
      const trimmed = current.trim();
      if (/^data:/i.test(trimmed)) return "[embedded asset omitted]";
      return trimmed.length > 1800 ? `${trimmed.slice(0, 1800)}…` : trimmed;
    }
    if (depth > 5) return "[nested detail omitted]";
    if (Array.isArray(current)) return current.slice(0, 20).map((item) => compact(item, depth + 1));
    if (typeof current === "object") {
      if (seen.has(current as object)) return "[circular detail omitted]";
      seen.add(current as object);
      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(current as Record<string, unknown>)) {
        const lower = key.toLowerCase();
        if (lower.includes("base64") || lower.includes("storage_path") || lower === "file_url" || lower === "thumbnail_url" || lower === "image_url") continue;
        result[key] = compact(item, depth + 1);
      }
      return result;
    }
    return String(current);
  }

  const compacted = compact(value, 0);
  const encoded = JSON.stringify(compacted);
  if (encoded.length <= maxChars) return compacted;
  return { summary: encoded.slice(0, maxChars), truncated: true };
}

function guidedInteriorPrompt(input: Record<string, unknown>) {
  return `You are Heyy Studio's senior interior designer. Create a clear, cohesive and realistic interior concept from a deliberately simple client brief. Make the output feel professional without asking the client to understand technical terminology. Use the stated style and investment level consistently. Every recommended material, furniture item and light must be distinct and visually appropriate to the project quality level. Return ONLY valid JSON.\n\nPROJECT BRIEF\n${JSON.stringify(input, null, 2)}\n\nJSON SHAPE\n{\n  "conceptSummary": "2 concise paragraphs",\n  "designDirection": {"name":"direction name","idea":"central idea","mood":"experience","styleLogic":"how selected styles combine","qualityLevel":"smart/mid-range/premium/luxury"},\n  "layoutPlan": ["6 to 9 concrete zoning, circulation and placement recommendations"],\n  "materialPalette": [{"material":"specific material name","category":"stone/timber/metal/fabric/glass/tile/paint/other","use":"where","reason":"why","finish":"finish or tone","searchQuery":"specific product search phrase","imageSearchQuery":"specific photographic reference phrase"}],\n  "furniturePlan": [{"item":"specific furniture type","category":"seating/table/storage/bed/joinery/other","placement":"location","proportion":"size/proportion guidance","notes":"selection notes","quantity":"quantity","searchQuery":"specific shopping phrase including style and finish","imageSearchQuery":"specific product photograph phrase"}],\n  "lightingPlan": [{"layer":"ambient/task/accent/decorative","item":"specific fixture type","recommendation":"specific approach","temperature":"Kelvin range where useful","quantity":"quantity or set","searchQuery":"specific fixture shopping phrase","imageSearchQuery":"specific fixture photograph phrase"}],\n  "colorPalette": [{"name":"color name","hex":"concept HEX","role":"where to use"}],\n  "stylingNotes": ["5 to 8 finishing details"],\n  "procurementPriorities": ["ordered decision or purchase priorities"],\n  "expertNotes": ["technical items to verify with qualified professionals"],\n  "visualPrompt": "one highly specific image-generation prompt for the main space, no fake text"\n}`;
}

function professionalInteriorPrompt(input: Record<string, unknown>) {
  return `You are Heyy Studio's senior interior architect, fit-out planner and procurement lead. Prepare a professional interior project package comparable in scope to a client fit-out proposal: design direction, coordinated plans, execution logic, procurement registers, schedules, indicative dimensions, finish quantities and close-out controls. Use the project brief as the source of truth. Where exact measured information is missing, state a clear assumption and mark it for site verification. Do not invent named suppliers, confirmed prices, permit approval or construction certification. Every furniture, material and lighting recommendation must be distinct, suitable for the selected quality level and include a useful product-search phrase. Return ONLY valid JSON.\n\nPROFESSIONAL PROJECT BRIEF\n${JSON.stringify(input, null, 2)}\n\nJSON SHAPE\n{\n  "conceptSummary": "2 concise executive paragraphs",\n  "designDirection": {"name":"direction name","idea":"central idea","mood":"experience","styleLogic":"how styles combine","qualityLevel":"premium/luxury/bespoke","visualIntent":["5 concise material and atmosphere keywords"]},\n  "layoutPlan": [{"area":"room or zone","recommendation":"specific zoning/circulation recommendation","dependencies":"connected rooms or services","verification":"what must be site checked"}],\n  "materialPalette": [{"material":"specific material name","category":"stone/timber/metal/fabric/glass/tile/paint/other","use":"where","reason":"why","finish":"finish/tone","performance":"maintenance or technical note","quantityBasis":"how quantity will be calculated","searchQuery":"specific sourcing phrase","imageSearchQuery":"specific luxury product photograph phrase"}],\n  "furniturePlan": [{"item":"specific item","category":"seating/table/storage/bed/joinery/other","area":"room","placement":"location","quantity":"quantity","proportion":"indicative W x D x H or size guidance","notes":"finish and selection criteria","searchQuery":"specific shopping phrase","imageSearchQuery":"specific luxury product photograph phrase"}],\n  "lightingPlan": [{"layer":"ambient/task/accent/decorative","item":"specific fixture","area":"room or zone","recommendation":"fixture position and intent","temperature":"Kelvin range","quantity":"quantity or set","coordination":"ceiling/switching/joinery coordination","searchQuery":"specific fixture shopping phrase","imageSearchQuery":"specific premium fixture photograph phrase"}],\n  "colorPalette": [{"name":"colour name","hex":"concept HEX","role":"where to use"}],\n  "stylingNotes": ["finishing and styling details"],\n  "procurementPriorities": ["ordered release priorities"],\n  "expertNotes": ["technical, site, code and professional verification items"],\n  "visualPrompt": "specific hero interior image prompt",\n  "professionalPackage": {\n    "proposalOverview": {"projectDuration":"indicative duration","floorsCovered":"count or description","keyTrades":["trade names"],"procurementTracks":["contracting","fixed built-ins","market sourcing"],"intent":["3 concise proposal goals"],"assumptions":["assumptions and site-verification notes"]},\n    "executionLogic": [{"stage":1,"name":"stage name","description":"specific works and dependency"}],\n    "masterTimeline": [{"trade":"trade/package","week1":"activity","week2":"activity","week3":"activity","week4":"activity","week5":"activity","lead":"role rather than invented person"}],\n    "deliveryMilestones": [{"period":"Week or phase","milestone":"control point","approvalRequired":"client/site/professional approval"}],\n    "procurementStrategy": [{"track":"A/B/C","name":"track name","items":["scope items"],"releaseRule":"when to release"}],\n    "procurementRegisters": [{"floor":"floor or level","area":"room/zone","items":"fixtures, furniture and fit-outs","quantity":"quantity or TBC","priority":"high/medium/low"}],\n    "laborAndFixedWorks": [{"scope":"trade/package","worksIncluded":"specific scope","coordination":"dependency","lead":"specialist role"}],\n    "finishQuantitySummary": [{"package":"tile/wood/paint/other","areasIncluded":"areas","baseQuantity":"m² or TBC","wastage":"percentage","orderQuantity":"m² or TBC","assumption":"calculation basis"}],\n    "areaSchedule": [{"floor":"level","area":"room","finish":"finish","baseArea":"m² or TBC","orderArea":"m² or TBC"}],\n    "wetAreaTakeoff": [{"bathroom":"room","floorArea":"m² or TBC","wallArea":"m² or TBC","orderQuantity":"m² or TBC","assumption":"height/opening/waste basis"}],\n    "woodFlooringQuantities": [{"zone":"area","baseArea":"m² or TBC","orderArea":"m² or TBC","package":"flooring/underlay/trims"}],\n    "furnitureSchedule": [{"floor":"level","area":"room","item":"item","quantity":"quantity","indicativeDimensions":"W x D x H mm or appropriate size","finish":"finish","procurementRoute":"market/custom"}],\n    "lightingSchedule": [{"area":"room","fixture":"fixture","quantity":"quantity","specification":"type/output/CCT","coordination":"ceiling/switch/control note"}],\n    "sanitarySchedule": [{"area":"bathroom","item":"sanitary item","quantity":"quantity","finish":"finish","roughIn":"verification note"}],\n    "applianceSchedule": [{"area":"room","item":"appliance","quantity":"quantity","indicativeSize":"size/TBC","coordination":"power/water/joinery note"}],\n    "joinerySchedule": [{"area":"room","item":"built-in","quantity":"set or linear metres","indicativeDimensions":"dimensions/TBC","finish":"finish","coordination":"site measure/services/hardware"}],\n    "closeoutPlan": [{"action":"site verification/client approval/procurement/quality/handover","requirement":"specific checklist requirement"}]\n  }\n}`;
}

function marketingPrompt(input: Record<string, unknown>) {
  return `You are Heyy Studio's senior marketing strategist, campaign planner and creative director. Turn the simple brief below into a focused campaign system that a small business or founder can understand and use. Avoid generic marketing language. Connect audience tension, offer, proof, message, channels and creative execution. Use any connected Heyy Studio brand system as the source for brand voice, visual language and positioning. Do not guarantee results. Return ONLY valid JSON.\n\nCAMPAIGN BRIEF\n${JSON.stringify(input, null, 2)}\n\nJSON SHAPE\n{\n  "campaignSummary": "2 concise paragraphs",\n  "strategy": {"objective":"clear objective","audienceInsight":"specific insight","barrier":"main barrier","opportunity":"why this campaign matters now","response":"strategic response","funnelRole":"awareness/consideration/conversion/retention"},\n  "audienceSegments": [{"name":"segment name","description":"who they are","motivation":"what they want","objection":"what stops them","trigger":"moment that makes the offer relevant","messageAngle":"best message route","channels":["best channels"]}],\n  "bigIdea": {"name":"campaign platform","line":"main campaign line","rationale":"why it connects","creativeDevice":"repeatable visual/verbal device"},\n  "keyMessage": {"primary":"main message","supporting":["3 supporting messages"],"proofPoints":["reasons to believe"],"callToAction":"exact CTA"},\n  "campaignAngles": [{"title":"angle","hook":"short hook","message":"message","proof":"proof point","bestFor":"channel or audience segment"}],\n  "channelPlan": [{"channel":"selected channel","role":"role in journey","funnelStage":"stage","formats":["recommended formats"],"cadence":"practical cadence","messageStyle":"how copy should behave","requiredAssets":["assets"]}],\n  "contentPillars": [{"pillar":"name","purpose":"why","examples":["3 content examples"]}],\n  "calendar": [{"phase":"tease/launch/sustain/retarget","week":"week or timing","channel":"channel","format":"format","topic":"content topic","hook":"opening hook","caption":"short caption direction","callToAction":"CTA","visualRequired":"visual format","status":"Draft"}],\n  "copyBank": {"headlines":["6 headlines"],"hooks":["8 short hooks"],"captions":["4 concise captions"],"callsToAction":["5 CTA variants"],"emailSubjects":["5 subject lines"],"landingMessages":["hero headline and supporting line options"]},\n  "creativeBrief": {"visualDirection":"specific art direction","composition":"composition system","imagery":"subject and photography/illustration direction","colourAndType":"brand-aligned colour and type behaviour","copyDirection":"voice and structure","mustInclude":["requirements"],"avoid":["things to avoid"]},\n  "visualPrompts": {"key_visual":"specific campaign key visual prompt, no fake text","social_feed":"square social ad prompt","story_cover":"vertical story/reel cover prompt","carousel_cover":"square carousel cover prompt","landing_hero":"wide website hero prompt","email_header":"wide email header prompt","display_ad":"clean digital display ad prompt","outdoor_poster":"vertical outdoor/poster prompt"},\n  "testingPlan": [{"test":"what changes","variantA":"A","variantB":"B","audience":"segment","successSignal":"what to watch","decisionRule":"how to decide"}],\n  "measurementPlan": [{"stage":"funnel stage","signal":"metric or qualitative signal","why":"what it indicates","action":"what to change based on it"}],\n  "launchChecklist": ["practical launch checks"],\n  "expertNotes": ["claims, media, legal or platform items to verify"]\n}`;
}

function professionalMarketingPrompt(input: Record<string, unknown>) {
  return `You are Heyy Studio's senior integrated marketing strategist, creative director, media planner and campaign operations lead. Build a professional campaign system suitable for an agency or in-house marketing team. The output must be specific, commercially useful, production-aware and internally consistent. Use any connected Heyy Studio brand system as the source for positioning, tone, colours, typography and visual behaviour. Never promise performance or invent legal approval, media results or confirmed benchmarks. Return ONLY valid JSON.\n\nPROFESSIONAL CAMPAIGN BRIEF\n${JSON.stringify(input, null, 2)}\n\nJSON SHAPE\n{\n  "campaignSummary": "executive campaign overview in 2 concise paragraphs",\n  "strategy": {"businessObjective":"commercial objective","communicationObjective":"what perception or action must change","marketContext":"category and competitive context","audienceInsight":"specific human insight","barrier":"main barrier","opportunity":"strategic opportunity","campaignResponse":"integrated response","funnelRole":"role across funnel","successDefinition":"what success would mean without guaranteeing it"},\n  "audienceSegments": [{"name":"segment","priority":"primary/secondary/retargeting","description":"who they are","needState":"need or job","motivation":"motivation","objections":["objections"],"triggerMoments":["moments"],"messageAngle":"best route","proofRequired":["proof"],"channels":["channels"]}],\n  "bigIdea": {"name":"campaign platform","line":"campaign line","rationale":"strategic rationale","creativeDevice":"repeatable device","experience":"how the campaign should feel","extensionLogic":"how the idea scales across channels"},\n  "keyMessage": {"primary":"main proposition","supporting":["supporting messages"],"proofPoints":["proof hierarchy"],"callToAction":"primary CTA","secondaryCTA":"secondary CTA","mandatoryCopy":["mandatory text or placeholders"]},\n  "campaignAngles": [{"title":"angle","strategicRole":"why it exists","hook":"hook","message":"message","proof":"proof","audience":"segment","funnelStage":"stage","bestFor":["formats/channels"]}],\n  "channelPlan": [{"channel":"channel","role":"role","funnelStage":"stage","audience":"segment","formats":["formats"],"cadence":"cadence","messageStyle":"message behaviour","creativeRequirements":["assets"],"mediaNote":"organic/paid/retargeting note"}],\n  "contentPillars": [{"pillar":"pillar","purpose":"purpose","audienceNeed":"need served","formats":["formats"],"examples":["examples"],"callToAction":"CTA"}],\n  "calendar": [{"phase":"phase","week":"timing","channel":"channel","format":"format","audience":"segment","pillar":"pillar","topic":"topic","hook":"hook","caption":"caption direction","callToAction":"CTA","visualRequired":"asset","owner":"role","status":"Draft"}],\n  "copyBank": {"messageHierarchy":["ordered messages"],"headlines":["10 headlines"],"hooks":["12 hooks"],"socialCaptions":["6 captions"],"adCopy":[{"primaryText":"copy","headline":"headline","description":"description","cta":"CTA"}],"emailSubjects":["8 subjects"],"emailPreheaders":["5 preheaders"],"landingMessages":[{"section":"hero/problem/proof/CTA","headline":"headline","support":"support"}],"doSay":["approved language"],"doNotSay":["language to avoid"]},\n  "creativeBrief": {"creativeObjective":"objective","singleMindedProposition":"one proposition","visualDirection":"art direction","compositionSystem":"layout behaviour","imageryDirection":"photography/illustration/3D direction","colourAndType":"brand application","motionDirection":"motion behaviour where relevant","copyDirection":"copy behaviour","formatRules":["format rules"],"mustInclude":["requirements"],"avoid":["avoid"],"productionNotes":["production notes"]},\n  "visualPrompts": {"key_visual":"professional key visual prompt, no logos or fake text","social_feed":"square feed ad prompt","story_cover":"vertical story/reel cover prompt","carousel_cover":"square carousel system cover prompt","landing_hero":"wide landing-page hero prompt","email_header":"wide email header prompt","display_ad":"digital display creative prompt","outdoor_poster":"vertical outdoor/poster prompt"},\n  "testingPlan": [{"hypothesis":"hypothesis","variable":"audience/message/offer/visual/CTA","variantA":"A","variantB":"B","audience":"segment","placement":"channel","successSignal":"signal","minimumLearning":"what must be learned","decisionRule":"decision rule"}],\n  "measurementPlan": [{"funnelStage":"stage","objective":"objective","primarySignals":["signals"],"secondarySignals":["signals"],"diagnosticQuestions":["questions"],"optimisationAction":"action"}],\n  "launchChecklist": [{"area":"strategy/tracking/creative/media/legal/operations","check":"check","owner":"role","status":"Open"}],\n  "professionalPackage": {\n    "executiveOverview":{"objective":"objective","audience":"audience","offer":"offer","duration":"duration","markets":"markets","channels":["channels"],"deliverables":["deliverables"]},\n    "funnelPlan":[{"stage":"stage","audience":"audience","message":"message","channelRole":"role","conversionEvent":"event"}],\n    "assetRegister":[{"asset":"asset","channel":"channel","format":"format","dimensions":"platform-appropriate dimensions or TBC","quantity":"quantity","stage":"preview/final","owner":"role"}],\n    "productionSchedule":[{"phase":"phase","timing":"timing","work":"work","dependency":"dependency","approval":"approval"}],\n    "mediaFramework":[{"channel":"channel","objective":"objective","audience":"audience","budgetRole":"test/core/scale","buyingNote":"media note","creativeRotation":"rotation"}],\n    "trackingFramework":[{"event":"event","platform":"platform","implementation":"pixel/analytics/CRM/UTM","validation":"how to test"}],\n    "governance":[{"topic":"claims/brand/legal/privacy/platform","requirement":"requirement","owner":"role"}],\n    "handoverChecklist":[{"deliverable":"deliverable","format":"format","naming":"naming convention","status":"Open"}]\n  },\n  "expertNotes": ["claims, media, legal, privacy, tracking and platform-policy items to verify"]\n}`;
}

