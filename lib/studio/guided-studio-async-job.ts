import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { completeGenerationJob, failGenerationJob } from "@/lib/credits/lifecycle";

type StudioId = "interior" | "marketing";
type WorkMode = "guided" | "professional";

type GuidedStudioJobInput = {
  studio?: StudioId;
  databaseId?: string;
  projectTypeField?: string;
  projectId?: string | null;
  projectName?: string;
  workMode?: WorkMode;
  input?: Record<string, unknown>;
  credits?: number;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Studio background generation is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function processGuidedStudioJob(jobId: string) {
  const admin = adminClient();
  const { data: existing, error: loadError } = await admin.from("generation_jobs").select("*").eq("id", jobId).eq("tool", "guided_studio").maybeSingle();
  if (loadError) throw new Error(loadError.message || "Studio generation job could not be loaded.");
  if (!existing) throw new Error("Studio generation job not found.");
  if (["succeeded", "failed", "cancelled"].includes(String(existing.status || ""))) return;
  if (String(existing.status || "") !== "queued") return;

  const { data: claimed, error: claimError } = await admin.from("generation_jobs").update({ status: "processing", error: null }).eq("id", jobId).eq("status", "queued").select("*").maybeSingle();
  if (claimError) throw new Error(claimError.message || "Studio generation job could not be started.");
  if (!claimed) return;

  const job = (claimed.input || {}) as GuidedStudioJobInput;
  const studio = job.studio;
  const userId = String(claimed.user_id || "").trim();
  const projectName = String(job.projectName || "").trim();
  const workMode: WorkMode = job.workMode === "professional" ? "professional" : "guided";
  const sourceInput = job.input && typeof job.input === "object" ? job.input : {};
  const databaseId = studio === "interior" ? "interior_studio" : "marketing_studio";
  let creditsCommitted = false;

  try {
    if (!(studio === "interior" || studio === "marketing") || !userId || !projectName) throw new Error("Studio generation job data is incomplete.");
    if (!process.env.OPENAI_API_KEY) throw new Error("AI generation is not configured.");

    const enriched = studio === "marketing"
      ? await enrichMarketingInput(admin, userId, sourceInput)
      : await enrichInteriorInput(admin, userId, sourceInput);

    const prompt = buildPrompt(studio, workMode, enriched);
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
    const providerData = await readProviderJson(response);
    if (!response.ok) throw new Error(String(providerData?.error?.message || providerData?.message || "AI generation failed."));
    const output = parseJson(extractOutputText(providerData));

    const projectPayload = {
      user_id: userId,
      studio: databaseId,
      project_name: projectName,
      project_type: String(sourceInput[String(job.projectTypeField || "projectType")] || ""),
      status: "active",
      progress: workMode === "professional" ? 78 : 75,
      input: { ...sourceInput, workMode, ...(enriched.connectedBrand ? { connectedBrand: enriched.connectedBrand } : {}), ...(enriched.connectedArchitecture ? { connectedArchitecture: enriched.connectedArchitecture } : {}) },
      output,
      summary: String(output?.conceptSummary || output?.campaignSummary || ""),
      current_step: workMode === "professional" ? "professional_concept_ready" : "concept_ready",
    };

    const existingProjectId = String(job.projectId || claimed.project_id || "").trim();
    const projectQuery = existingProjectId
      ? admin.from("studio_projects").update(projectPayload).eq("id", existingProjectId).eq("user_id", userId).eq("studio", databaseId).select().single()
      : admin.from("studio_projects").insert(projectPayload).select().single();
    const { data: project, error: projectError } = await projectQuery;
    if (projectError || !project) throw new Error(projectError?.message || "Project could not be saved.");

    const { error: assetError } = await admin.from("project_assets").insert({
      user_id: userId,
      project_id: String(project.id),
      studio: databaseId,
      asset_type: `${studio}_${workMode}_concept`,
      title: studio === "marketing"
        ? `${projectName} — ${workMode === "professional" ? "Professional Campaign System" : "Campaign Concept"}`
        : `${projectName} — ${workMode === "professional" ? "Professional Interior Package" : "Concept Plan"}`,
      payload: output,
      metadata: {
        source: "guided_studio",
        work_mode: workMode,
        generation_job_id: jobId,
        credit_reservation_id: claimed.credit_reservation_id || null,
        connected_brand_id: enriched.connectedBrand?.id || null,
        connected_architecture_id: enriched.connectedArchitecture?.id || null,
      },
    });
    if (assetError) throw new Error(assetError.message || "Generated concept could not be added to project assets.");

    const finalOutput = {
      project_id: String(project.id),
      work_mode: workMode,
      credits_used: Number(job.credits || 0),
      model: providerData?.model || process.env.STUDIO_TEXT_MODEL || process.env.OPENAI_TEXT_MODEL || null,
      usage: providerData?.usage || null,
    };
    await completeGenerationJob(admin, jobId, finalOutput, {
      studio: databaseId,
      project_id: String(project.id),
      tool: "guided_studio",
      work_mode: workMode,
    });
    creditsCommitted = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Studio generation failed.";
    if (!creditsCommitted) {
      await failGenerationJob(admin, {
        jobId,
        expectedStatus: "processing",
        reason: message,
        publicError: publicError(studio, message),
      });
    } else {
      // The provider output/project already exists and the credit reservation was committed.
      // Never refund a completed paid generation only because the final job-status write had a transient failure.
      console.error("Guided Studio generation completed but job finalization needs retry:", { jobId, studio, message });
    }
    console.error("Guided Studio background error:", { jobId, studio, message });
  }
}

function publicError(studio: StudioId | undefined, message: string) {
  if (/credit|balance|insufficient/i.test(message)) return message;
  return studio === "marketing"
    ? "Campaign generation could not be completed. Your credits were returned."
    : "Interior project generation could not be completed. Your credits were returned.";
}

async function enrichMarketingInput(admin: SupabaseClient, userId: string, input: Record<string, unknown>) {
  const brandProjectId = String(input.brandProjectId || "").trim();
  if (!brandProjectId) return { promptInput: input, connectedBrand: null as Record<string, any> | null, connectedArchitecture: null as Record<string, any> | null };

  const { data: brand, error } = await admin.from("brand_projects").select("*").eq("id", brandProjectId).eq("user_id", userId).maybeSingle();
  if (error || !brand) throw new Error("The selected Brand Studio project could not be loaded. Choose another saved brand and try again.");
  const { data: assets } = await admin.from("project_assets").select("id,title,asset_type,metadata,created_at").eq("project_id", brandProjectId).eq("user_id", userId).order("created_at", { ascending: false }).limit(40);
  const connectedBrand = {
    id: brand.id,
    name: brand.business_name || brand.project_name || brand.name || null,
    industry: brand.industry || null,
    audience: brand.audience || null,
    style: brand.style || null,
    description: brand.description || null,
    brandSystem: compactPromptValue(brand.brand_system_json || brand.brand_system || brand.output || null, 16000),
    assets: (assets || []).map((asset: any) => ({ id: asset.id, title: asset.title, assetType: asset.asset_type, metadata: compactPromptValue(asset.metadata, 1200) })),
  };
  return { promptInput: { ...input, connectedBrand }, connectedBrand, connectedArchitecture: null };
}

async function enrichInteriorInput(admin: SupabaseClient, userId: string, input: Record<string, unknown>) {
  const architectureProjectId = String(input.architectureProjectId || "").trim();
  if (!architectureProjectId) return { promptInput: input, connectedArchitecture: null as Record<string, any> | null, connectedBrand: null as Record<string, any> | null };

  const [projectResult, siteResult, programResult, materialsResult, directionsResult, conceptResult, planSetResult, visualsResult] = await Promise.all([
    admin.from("architecture_projects").select("*").eq("id", architectureProjectId).eq("user_id", userId).maybeSingle(),
    admin.from("architecture_sites").select("*").eq("project_id", architectureProjectId).eq("user_id", userId).maybeSingle(),
    admin.from("architecture_space_programs").select("*").eq("project_id", architectureProjectId).eq("user_id", userId).order("sort_order", { ascending: true }),
    admin.from("architecture_materials").select("*").eq("project_id", architectureProjectId).eq("user_id", userId).eq("is_selected", true).order("sort_order", { ascending: true }),
    admin.from("architecture_directions").select("*").eq("project_id", architectureProjectId).eq("user_id", userId).order("direction_number", { ascending: true }),
    admin.from("architecture_concepts").select("*").eq("project_id", architectureProjectId).eq("user_id", userId).maybeSingle(),
    admin.from("architecture_plan_sets").select("*").eq("project_id", architectureProjectId).eq("user_id", userId).maybeSingle(),
    admin.from("architecture_visuals").select("id,visual_type,title,image_url,storage_path,is_approved,metadata,created_at").eq("project_id", architectureProjectId).eq("user_id", userId).order("created_at", { ascending: true }),
  ]);
  const project = projectResult.data;
  if (!project) throw new Error("The selected Architecture Studio project could not be loaded. Choose another Architecture project and try again.");
  const directions = directionsResult.data || [];
  const selectedDirection = directions.find((direction: any) => direction.is_selected || direction.id === project.selected_direction_id) || null;
  const connectedArchitecture = {
    id: project.id,
    projectName: project.project_name,
    projectType: project.project_type,
    location: [project.city, project.region, project.country].filter(Boolean).join(", "),
    architecturalStyle: project.architectural_style,
    workingMode: project.working_mode,
    selectedSpaces: project.selected_spaces,
    notes: project.notes,
    professionalBrief: project.professional_brief,
    site: siteResult.data || null,
    spaceProgram: programResult.data || [],
    selectedMaterials: materialsResult.data || [],
    selectedDirection,
    concept: conceptResult.data || null,
    planSet: planSetResult.data || null,
    approvedVisuals: (visualsResult.data || []).filter((visual: any) => visual.is_approved),
    allVisuals: visualsResult.data || [],
  };
  return { promptInput: { ...input, connectedArchitecture }, connectedArchitecture, connectedBrand: null };
}

function buildPrompt(studio: StudioId, workMode: WorkMode, enriched: any) {
  const input = enriched.promptInput || {};
  if (studio === "interior") return workMode === "professional" ? professionalInteriorPrompt(input) : guidedInteriorPrompt(input);
  return workMode === "professional" ? professionalMarketingPrompt(input) : marketingPrompt(input);
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
  return encoded.length <= maxChars ? compacted : { summary: encoded.slice(0, maxChars), truncated: true };
}

async function readProviderJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text.slice(0, 800) }; }
}

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
