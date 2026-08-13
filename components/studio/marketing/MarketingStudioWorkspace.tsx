"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  FlaskConical,
  ImageIcon,
  Layers3,
  Loader2,
  Maximize2,
  Megaphone,
  Palette,
  RefreshCcw,
  Rocket,
  Sparkles,
  Target,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import StudioAccessGate from "@/components/studio-access-gate";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import ProductionPanel from "@/components/studio/production/ProductionPanel";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { GUIDED_STUDIOS, type StudioField } from "@/lib/studio/generic-config";
import {
  Button,
  CreditPill,
  Eyebrow,
  GlassCard,
  PageContainer,
  StatusPill,
  cx,
} from "@/components/ui/heyy";
import HeyySelect, { type HeyySelectOption } from "@/components/ui/heyy-select";
import StudioModeToggle from "@/components/ui/StudioModeToggle";
import StudioLoader from "@/components/ui/StudioLoader";
import { exportMarketingCampaignPackPdf } from "@/lib/marketing/export-campaign-pack";

const config = GUIDED_STUDIOS.marketing;

type FormState = Record<string, string | string[]>;
type WorkMode = "guided" | "professional";
type WorkspaceTab =
  | "overview"
  | "brief"
  | "audience"
  | "strategy"
  | "messaging"
  | "channels"
  | "calendar"
  | "visuals"
  | "testing"
  | "campaign-pack"
  | "measurement"
  | "production";
type MarketingVisualType =
  | "key_visual"
  | "social_feed"
  | "story_cover"
  | "carousel_cover"
  | "landing_hero"
  | "email_header"
  | "display_ad"
  | "outdoor_poster";
type GenerationStage = "preview" | "final";
type GenerationTarget = { viewType: MarketingVisualType; stage: GenerationStage } | null;

type ResultData = Record<string, unknown> & {
  campaignSummary?: string;
  strategy?: Record<string, unknown>;
  audienceSegments?: unknown[];
  bigIdea?: Record<string, unknown>;
  keyMessage?: Record<string, unknown>;
  campaignAngles?: unknown[];
  channelPlan?: unknown[];
  contentPillars?: unknown[];
  calendar?: unknown[];
  copyBank?: Record<string, unknown>;
  creativeBrief?: Record<string, unknown>;
  visualPrompts?: Record<string, unknown>;
  testingPlan?: unknown[];
  measurementPlan?: unknown[];
  launchChecklist?: unknown[];
  expertNotes?: unknown[];
  professionalPackage?: Record<string, unknown>;
  selectedCampaignAngle?: number;
};

type ProjectRecord = {
  id: string;
  project_name?: string | null;
  project_type?: string | null;
  input?: FormState | null;
  output?: ResultData | null;
  progress?: number | null;
  current_step?: string | null;
};

type ProjectAsset = {
  id: string;
  title?: string | null;
  file_url?: string | null;
  thumbnail_url?: string | null;
  asset_type?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

type BrandRecord = {
  id: string;
  business_name?: string | null;
  project_name?: string | null;
  name?: string | null;
  industry?: string | null;
};

type LightboxImage = { url: string; title: string } | null;

const TABS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "brief", label: "Campaign Brief" },
  { id: "audience", label: "Audience" },
  { id: "strategy", label: "Strategy" },
  { id: "messaging", label: "Messaging" },
  { id: "channels", label: "Channels" },
  { id: "calendar", label: "Content Calendar" },
  { id: "visuals", label: "Creative Visuals" },
  { id: "testing", label: "Testing" },
  { id: "campaign-pack", label: "Campaign Pack" },
  { id: "measurement", label: "Measurement" },
  { id: "production", label: "Production" },
];

const VISUALS: Array<{
  id: MarketingVisualType;
  title: string;
  description: string;
  formats: string[];
  channelMatches: string[];
}> = [
  {
    id: "key_visual",
    title: "Campaign Key Visual",
    description: "The master creative image that establishes the campaign world for every other asset.",
    formats: ["Landscape master", "Creative source"],
    channelMatches: [],
  },
  {
    id: "social_feed",
    title: "Social Feed Ad",
    description: "A square performance-ready visual for feed placements and organic campaign posts.",
    formats: ["1:1", "Social feed"],
    channelMatches: ["Instagram", "Facebook", "LinkedIn"],
  },
  {
    id: "story_cover",
    title: "Story / Reel Cover",
    description: "A vertical cover designed for mobile-first stories, reels and short-form video openings.",
    formats: ["9:16", "Mobile"],
    channelMatches: ["Instagram", "Facebook", "TikTok", "YouTube"],
  },
  {
    id: "carousel_cover",
    title: "Carousel Cover",
    description: "A strong opening card for educational, proof-led or product storytelling sequences.",
    formats: ["1:1", "Carousel"],
    channelMatches: ["Instagram", "Facebook", "LinkedIn"],
  },
  {
    id: "landing_hero",
    title: "Landing-Page Hero",
    description: "A wide campaign hero that connects the ad promise to the conversion destination.",
    formats: ["Landscape", "Website"],
    channelMatches: ["Website / landing page", "Google Ads"],
  },
  {
    id: "email_header",
    title: "Email Header",
    description: "A campaign header for launch, offer, nurture or retention email sequences.",
    formats: ["Wide", "Email"],
    channelMatches: ["Email"],
  },
  {
    id: "display_ad",
    title: "Display Ad",
    description: "A clean adaptable visual direction for digital display and retargeting placements.",
    formats: ["Landscape", "Display"],
    channelMatches: ["Google Ads"],
  },
  {
    id: "outdoor_poster",
    title: "Outdoor / Poster",
    description: "A bold vertical composition suitable for poster, outdoor and in-store adaptation.",
    formats: ["Portrait", "High impact"],
    channelMatches: ["Outdoor", "In-store", "PR"],
  },
];

// HEYY_STUDIO_ASYNC_INTERIOR_MARKETING_V1
async function readStudioAsyncPayload(response: Response, fallback: string): Promise<any> {
  const text = await response.text();
  if (!text) {
    if (!response.ok) throw new Error(fallback);
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    if (response.status === 504 || /inactivity timeout|<!doctype|<html|<head|<body/i.test(text)) {
      throw new Error("Heyy Studio could not start the background generation request. Please try again.");
    }
    throw new Error(fallback);
  }
}

async function waitForStudioAsyncJob(
  studio: "interior" | "marketing",
  kind: "concept" | "image",
  jobId: string,
  accessToken: string,
): Promise<any> {
  if (!jobId) throw new Error("The generation job could not be started.");
  const statusPath = kind === "image"
    ? `/api/studios/${studio}/images/status?job=${encodeURIComponent(jobId)}`
    : `/api/studios/${studio}/status?job=${encodeURIComponent(jobId)}`;

  for (let attempt = 0; attempt < 360; attempt += 1) {
    if (attempt > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 2000));
    const response = await fetch(statusPath, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload = await readStudioAsyncPayload(response, "Unable to check generation status.");
    if (!response.ok || payload.success === false) throw new Error(payload.error || "Unable to check generation status.");
    if (payload.status === "failed") throw new Error(payload.error || "Generation failed. Your credits were returned.");
    if (payload.status === "succeeded") return payload;
  }

  throw new Error("Generation is still processing safely in the background. Refresh this project shortly to load the completed result.");
}

export default function MarketingStudioWorkspace() {
  return (
    <StudioAccessGate path="/marketing-studio">
      <SiteHeader />
      <WorkspaceShell>
        <MarketingExperience />
        <SiteFooter />
      </WorkspaceShell>
    </StudioAccessGate>
  );
}

function MarketingExperience() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, refreshAccount } = useAuth();
  const [form, setForm] = useState<FormState>(() => initialState());
  const [step, setStep] = useState(0);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [result, setResult] = useState<ResultData | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [brandProjects, setBrandProjects] = useState<BrandRecord[]>([]);
  const [generatingConcept, setGeneratingConcept] = useState(false);
  const [generatingVisual, setGeneratingVisual] = useState<GenerationTarget>(null);
  const [approvingAssetId, setApprovingAssetId] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [exportingCampaignPack, setExportingCampaignPack] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxImage>(null);
  const [error, setError] = useState("");

  const workMode: WorkMode = form.workMode === "professional" ? "professional" : "guided";
  const activeSteps = useMemo(
    () => workMode === "professional" && config.professionalSteps?.length ? config.professionalSteps : config.steps,
    [workMode],
  );
  const allFields = useMemo(() => activeSteps.flatMap((item) => item.fields), [activeSteps]);
  const requiredMissing = activeSteps[step]?.fields.filter((field) => field.required && isEmpty(form[field.id])) || [];
  const completedInputs = allFields.filter((field) => !isEmpty(form[field.id])).length;
  const progress = result
    ? Math.max(76, Math.min(100, Number(project?.progress || 76)))
    : Math.round(((step + completedInputs / Math.max(1, allFields.length)) / (activeSteps.length + 1)) * 100);

  const studioStyle = {
    "--accent": config.accent,
    "--accent-strong": config.accent,
    "--accent-soft": config.soft,
    "--accent-border": `color-mix(in srgb, ${config.accent} 58%, transparent)`,
    "--button-primary": config.accent,
    "--button-primary-hover": `color-mix(in srgb, ${config.accent} 82%, black)`,
    "--focus-ring": `color-mix(in srgb, ${config.accent} 28%, transparent)`,
  } as CSSProperties;

  useEffect(() => {
    if (!user) return;
    void loadBrandProjects();
    const projectId = new URLSearchParams(window.location.search).get("project");
    if (projectId) void loadProject(projectId);
  }, [user]);

  async function loadBrandProjects() {
    const { data } = await supabase
      .from("brand_projects")
      .select("*")
      .eq("user_id", user?.id || "")
      .order("updated_at", { ascending: false })
      .limit(40);
    setBrandProjects((data || []) as BrandRecord[]);
  }

  async function loadProject(projectId: string) {
    const { data, error: projectError } = await supabase
      .from("studio_projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", user?.id || "")
      .eq("studio", config.databaseId)
      .maybeSingle();

    if (projectError) {
      setError(projectError.message);
      return;
    }
    if (!data) return;

    const record = data as ProjectRecord;
    const savedForm = { ...initialState(), ...((record.input || {}) as FormState) };
    const savedMode: WorkMode = savedForm.workMode === "professional" ? "professional" : "guided";
    const savedSteps = savedMode === "professional" && config.professionalSteps?.length ? config.professionalSteps : config.steps;
    const savedResult = (record.output || null) as ResultData | null;
    setProject(record);
    setForm(savedForm);
    setResult(savedResult);
    setStep(savedResult ? savedSteps.length : 0);
    setActiveTab(savedResult ? readMarketingWorkspaceTab(projectId) : "brief");
    await loadAssets(projectId);
  }

  async function loadAssets(projectId: string) {
    const { data } = await supabase
      .from("project_assets")
      .select("id,title,file_url,thumbnail_url,asset_type,metadata,created_at")
      .eq("project_id", projectId)
      .eq("studio", config.databaseId)
      .order("created_at", { ascending: false });
    setAssets((data || []) as ProjectAsset[]);
  }

  function updateField(id: string, value: string | string[]) {
    setForm((current) => ({ ...current, [id]: value }));
    setError("");
  }

  function changeWorkMode(nextMode: WorkMode) {
    if (generatingConcept) return;
    setForm((current) => ({ ...current, workMode: nextMode }));
    setStep(0);
    setError("");
  }

  function nextStep() {
    if (requiredMissing.length) {
      setError(`Complete ${requiredMissing.map((field) => field.label.toLowerCase()).join(", ")} before continuing.`);
      return;
    }
    if (step === 0 && form.brandSource === "Use an existing Heyy Studio brand" && !String(form.brandProjectId || "")) {
      setError("Choose the saved Brand System you want this campaign to use.");
      return;
    }
    setStep((current) => Math.min(activeSteps.length, current + 1));
  }

  async function generateConcept() {
    const missing = allFields.filter((field) => field.required && isEmpty(form[field.id]));
    if (missing.length) {
      setError(`Complete ${missing.map((field) => field.label.toLowerCase()).join(", ")} before generating.`);
      const missingStep = activeSteps.findIndex((section) => section.fields.some((field) => missing.some((item) => item.id === field.id)));
      setStep(Math.max(0, missingStep));
      return;
    }
    if (form.brandSource === "Use an existing Heyy Studio brand" && !String(form.brandProjectId || "")) {
      setError("Choose the saved Brand System you want this campaign to use.");
      setStep(0);
      return;
    }

    setGeneratingConcept(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/studios/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input: { ...form, workMode }, projectId: project?.id || null }),
      });
      const started = await readStudioAsyncPayload(response, "Campaign generation could not start.");
      if (!response.ok || started.success === false) throw new Error(started.error || "Campaign generation could not start.");
      const data = started.status === "succeeded"
        ? started
        : await waitForStudioAsyncJob("marketing", "concept", String(started.jobId || ""), token);
      const savedProject = data.project as ProjectRecord;
      const savedOutput = data.output as ResultData;
      if (!savedProject?.id || !savedOutput) throw new Error("Campaign generation finished without a saved project.");
      setProject(savedProject);
      setResult(savedOutput);
      setStep(activeSteps.length);
      setActiveTab("overview");
      await Promise.all([loadAssets(String(savedProject.id)), refreshAccount()]);
      const url = new URL(window.location.href);
      url.searchParams.set("project", String(savedProject.id));
      url.searchParams.set("tab", "overview");
      window.history.replaceState({}, "", url);
      rememberMarketingWorkspaceTab(String(savedProject.id), "overview");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Campaign generation failed.");
    } finally {
      setGeneratingConcept(false);
    }
  }

  async function generateVisual(viewType: MarketingVisualType, stage: GenerationStage, tweak = "") {
    if (!project?.id) return;
    setGeneratingVisual({ viewType, stage });
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/studios/marketing/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: project.id, viewType, stage, tweak: tweak.trim() || null }),
      });
      const started = await readStudioAsyncPayload(response, "Campaign visual generation could not start.");
      if (!response.ok || started.success === false) throw new Error(started.error || "Campaign visual generation could not start.");
      if (started.status !== "succeeded") {
        await waitForStudioAsyncJob("marketing", "image", String(started.jobId || ""), token);
      }
      await Promise.all([loadAssets(project.id), refreshAccount()]);
      selectWorkspaceTab("visuals");
    } catch (visualError) {
      setError(visualError instanceof Error ? visualError.message : "Campaign visual generation failed.");
    } finally {
      setGeneratingVisual(null);
    }
  }

  async function saveOutputPatch(patch: Record<string, unknown>) {
    if (!project?.id || !result) return;
    setSavingProject(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/studios/marketing/project/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: project.id, patch }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Campaign changes could not be saved.");
      setResult(data.output as ResultData);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Campaign changes could not be saved.");
    } finally {
      setSavingProject(false);
    }
  }

  async function approveAsset(asset: ProjectAsset) {
    if (!project?.id || !asset.id) return;
    setApprovingAssetId(asset.id);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/studios/marketing/assets/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: project.id, assetId: asset.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Approval failed.");
      await loadAssets(project.id);
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Approval failed.");
    } finally {
      setApprovingAssetId(null);
    }
  }

  function selectWorkspaceTab(tab: WorkspaceTab) {
    setActiveTab(tab);
    const projectId = project?.id || new URLSearchParams(window.location.search).get("project");
    if (!projectId) return;
    rememberMarketingWorkspaceTab(projectId, tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url);
  }

  async function downloadCampaignPack() {
    if (!result || exportingCampaignPack) return;
    setExportingCampaignPack(true);
    setError("");
    try {
      await exportMarketingCampaignPackPdf({
        projectName: String(project?.project_name || form.campaignName || "Marketing campaign"),
        workMode,
        brief: form,
        campaign: result,
        visuals: assets
          .filter((asset) => String(asset.asset_type || "").startsWith("marketing_visual_"))
          .map((asset) => ({
            title: asset.title,
            url: asset.file_url,
            type: asset.metadata?.view_type,
            stage: asset.metadata?.stage,
            approved: isApproved(asset),
          })),
        disclaimer: config.disclaimer,
      });
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Campaign Pack export failed.");
    } finally {
      setExportingCampaignPack(false);
    }
  }

  const selectedChannels = Array.isArray(form.channels) ? form.channels : [];
  const approvedVisuals = assets.filter((asset) => String(asset.asset_type || "").startsWith("marketing_visual_") && isApproved(asset));
  const previewImage = approvedVisuals[0]?.file_url || assets.find((asset) => String(asset.asset_type || "").startsWith("marketing_visual_key_visual"))?.file_url || undefined;

  return (
    <main className="heyy-page min-h-screen py-8 sm:py-10" style={studioStyle}>
      {generatingConcept && <FullScreenCampaignLoader workMode={workMode} />}
      {lightbox && <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />}

      <PageContainer>
        <section
          className="relative overflow-hidden rounded-[2rem] border p-6 shadow-[var(--shadow-card)] sm:p-9"
          style={{
            borderColor: `${config.accent}66`,
            background: `linear-gradient(120deg,${config.soft},var(--surface-strong),${config.soft})`,
          }}
        >
          <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full border-[34px] border-white/20" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <Eyebrow style={{ color: config.accent }}>{config.eyebrow}</Eyebrow>
              <h1 className="mt-4 text-4xl font-black leading-[.94] tracking-[-.06em] sm:text-6xl">{config.title}</h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)] sm:text-base">{config.description}</p>
            </div>
            <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 backdrop-blur-xl">
              <StudioModeToggle
                value={workMode}
                onChange={(mode) => void changeWorkMode(mode)}
                tone="marketing"
                compact
              />
              <div className="mt-3 flex items-center justify-between gap-3 px-1">
                <span className="text-xs font-bold text-[var(--text-secondary)]">{workMode === "guided" ? "Simple campaign questions and a complete direction" : "Integrated strategy, media, testing and launch system"}</span>
                <CreditPill credits={workMode === "professional" ? config.professionalCreditCost || 12 : config.creditCost} />
              </div>
            </div>
          </div>
        </section>

        {result ? (
          <WorkspaceNavigation activeTab={activeTab} onChange={selectWorkspaceTab} />
        ) : (
          <OnboardingNavigation step={step} steps={activeSteps} onChange={setStep} disabled={generatingConcept} />
        )}

        {error && <ErrorBanner message={error} />}

        {!result ? (
          <OnboardingWorkspace
            form={form}
            steps={activeSteps}
            brands={brandProjects}
            workMode={workMode}
            step={step}
            progress={progress}
            generating={generatingConcept}
            onFieldChange={updateField}
            onBack={() => setStep((current) => Math.max(0, current - 1))}
            onContinue={nextStep}
            onGenerate={() => void generateConcept()}
          />
        ) : (
          <div className="mt-5 space-y-5">
            {activeTab === "overview" && <OverviewSection result={result} assets={assets} onOpenTab={selectWorkspaceTab} onRegenerate={() => void generateConcept()} />}
            {activeTab === "brief" && <BriefSection form={form} fields={allFields} brands={brandProjects} />}
            {activeTab === "audience" && <AudienceSection result={result} />}
            {activeTab === "strategy" && <StrategySection result={result} saving={savingProject} onSelectAngle={(index) => void saveOutputPatch({ selectedCampaignAngle: index })} />}
            {activeTab === "messaging" && <MessagingSection result={result} />}
            {activeTab === "channels" && <ChannelsSection result={result} />}
            {activeTab === "calendar" && <CalendarSection result={result} saving={savingProject} onSave={(calendar) => void saveOutputPatch({ calendar })} />}
            {activeTab === "visuals" && (
              <VisualsSection
                assets={assets}
                selectedChannels={selectedChannels}
                generating={generatingVisual}
                approvingAssetId={approvingAssetId}
                onGenerate={(viewType, stage, tweak) => void generateVisual(viewType, stage, tweak)}
                onApprove={(asset) => void approveAsset(asset)}
                onEnlarge={(image) => setLightbox(image)}
              />
            )}
            {activeTab === "testing" && <TestingSection result={result} />}
            {activeTab === "campaign-pack" && <CampaignPackSection result={result} assets={assets} workMode={workMode} exporting={exportingCampaignPack} onDownload={() => void downloadCampaignPack()} />}
            {activeTab === "measurement" && <MeasurementSection result={result} />}
            {activeTab === "production" && (
              <ProductionPanel
                project={project}
                brand={{
                  project_brief: form,
                  campaign_summary: result.campaignSummary,
                  strategy: result.strategy,
                  audience_segments: result.audienceSegments,
                  big_idea: result.bigIdea,
                  key_message: result.keyMessage,
                  campaign_angles: result.campaignAngles,
                  channel_plan: result.channelPlan,
                  content_calendar: result.calendar,
                  copy_bank: result.copyBank,
                  creative_brief: result.creativeBrief,
                  testing_plan: result.testingPlan,
                  measurement_plan: result.measurementPlan,
                  professional_package: result.professionalPackage,
                  approved_visuals: approvedVisuals,
                  all_generated_outputs: assets.filter((asset) => String(asset.asset_type || "").startsWith("marketing_")),
                }}
                studio={config.databaseId}
                service={config.productionService}
                serviceId={config.productionServiceId}
                previewImage={previewImage}
                description={String(result.campaignSummary || "Marketing campaign concept and creative system")}
                usage="Campaign strategy, messaging, channel planning, content production, paid-ad creative, email, landing-page and launch assets."
                expertNote={config.disclaimer}
                buttonLabel="Request Marketing Production →"
              />
            )}
            <ProjectJourney activeTab={activeTab} onChange={selectWorkspaceTab} />
          </div>
        )}
      </PageContainer>
    </main>
  );
}

function OnboardingNavigation({ step, steps, onChange, disabled }: { step: number; steps: Array<{ title: string }>; onChange: (step: number) => void; disabled: boolean }) {
  return (
    <GlassCard className="mt-5 p-3 sm:p-4">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length + 1}, minmax(0,1fr))` }}>
        {[...steps.map((item) => item.title), "Campaign system"].map((title, index) => {
          const active = index === step;
          const complete = index < step;
          return (
            <button
              key={`${title}-${index}`}
              type="button"
              disabled={disabled || index > step}
              onClick={() => onChange(index)}
              className={cx("flex min-h-14 items-center gap-3 rounded-2xl border px-3 text-left transition", active ? "border-[var(--accent-border)] bg-[var(--accent-soft)]" : "border-transparent hover:bg-[var(--surface-hover)]", index > step && "cursor-default opacity-50")}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black" style={{ background: complete || active ? config.accent : "var(--surface-hover)", color: complete || active ? "white" : "var(--text-muted)" }}>{complete ? <Check size={14} /> : index + 1}</span>
              <span className="hidden min-w-0 text-xs font-black lg:block">{title}</span>
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}

function OnboardingWorkspace({
  form,
  steps,
  brands,
  workMode,
  step,
  progress,
  generating,
  onFieldChange,
  onBack,
  onContinue,
  onGenerate,
}: {
  form: FormState;
  steps: Array<{ title: string; description: string; fields: StudioField[] }>;
  brands: BrandRecord[];
  workMode: WorkMode;
  step: number;
  progress: number;
  generating: boolean;
  onFieldChange: (id: string, value: string | string[]) => void;
  onBack: () => void;
  onContinue: () => void;
  onGenerate: () => void;
}) {
  const section = steps[Math.min(step, steps.length - 1)];
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <GlassCard className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow>Step {Math.min(step + 1, steps.length)} of {steps.length}</Eyebrow>
            <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">{section.title}</h2>
            <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">{section.description}</p>
          </div>
          <StatusPill tone="info">{progress}% complete</StatusPill>
        </div>

        {step === 0 && <BrandConnection form={form} brands={brands} onChange={onFieldChange} />}

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {section.fields.map((field) => <FieldControl key={field.id} field={field} value={form[field.id]} onChange={(value) => onFieldChange(field.id, value)} />)}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
          <Button type="button" variant="secondary" disabled={step === 0 || generating} onClick={onBack}><ArrowLeft size={15} /> Back</Button>
          {step === steps.length - 1 ? (
            <Button type="button" disabled={generating} onClick={onGenerate}><Sparkles size={15} /> Generate {workMode === "professional" ? "professional campaign" : "campaign system"} · {workMode === "professional" ? config.professionalCreditCost || 12 : config.creditCost} credits</Button>
          ) : (
            <Button type="button" disabled={generating} onClick={onContinue}>Continue <ArrowRight size={15} /></Button>
          )}
        </div>
      </GlassCard>

      <aside className="space-y-4">
        <GlassCard className="p-5">
          <Eyebrow>Campaign summary</Eyebrow>
          <h3 className="mt-3 text-xl font-black">{String(form.campaignName || "Untitled campaign")}</h3>
          <div className="mt-4 grid gap-2">
            <SummaryLine label="Mode" value={workMode === "professional" ? "Professional" : "Guided"} />
            <SummaryLine label="Objective" value={String(form.objective || "Not selected")} />
            <SummaryLine label="Business" value={String(form.business || "Not added")} />
            <SummaryLine label="Channels" value={Array.isArray(form.channels) && form.channels.length ? `${form.channels.length} selected` : "Not selected"} />
            <SummaryLine label="Brand" value={form.brandSource === "Use an existing Heyy Studio brand" ? "Connected Brand System" : String(form.brandSource || "Independent campaign")} />
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-[.6rem] font-black uppercase tracking-[.16em] text-pink-600">Performance note</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{config.disclaimer}</p>
        </GlassCard>
      </aside>
    </div>
  );
}

function BrandConnection({ form, brands, onChange }: { form: FormState; brands: BrandRecord[]; onChange: (id: string, value: string | string[]) => void }) {
  const options: HeyySelectOption[] = brands.map((brand) => ({
    value: brand.id,
    label: `${brand.business_name || brand.project_name || brand.name || "Untitled brand"}${brand.industry ? ` · ${brand.industry}` : ""}`,
  }));
  return (
    <div className="mt-7 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-strong)] text-[var(--accent-strong)]"><Palette size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[var(--text-primary)]">Connect the campaign to the right brand</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">A connected Brand System gives the campaign its saved voice, positioning and visual language.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <HeyySelect
              value={String(form.brandSource || "Start without a saved brand")}
              tone="marketing"
              ariaLabel="Brand source"
              options={["Use an existing Heyy Studio brand", "Start without a saved brand", "Upload brand assets later"]}
              onChange={(value: string) => {
                onChange("brandSource", value);
                if (value !== "Use an existing Heyy Studio brand") onChange("brandProjectId", "");
              }}
            />
            {form.brandSource === "Use an existing Heyy Studio brand" ? (
              <HeyySelect
                value={String(form.brandProjectId || "")}
                tone="marketing"
                ariaLabel="Saved Brand System"
                placeholder={brands.length ? "Choose a saved Brand System" : "No saved brands found"}
                options={options}
                disabled={!brands.length}
                onChange={(value: string) => onChange("brandProjectId", value)}
              />
            ) : (
              <div className="flex min-h-12 items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--text-muted)]">Campaign can be connected to a brand later.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldControl({ field, value, onChange }: { field: StudioField; value: string | string[] | undefined; onChange: (value: string | string[]) => void }) {
  const fullWidth = field.type === "textarea" || field.type === "multiselect";
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}>
      <label className="text-[.65rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">{field.label}{field.required && <span className="ml-1 text-[var(--accent-strong)]">*</span>}</label>
      {field.helper && <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">{field.helper}</p>}
      {field.type === "textarea" ? (
        <textarea value={String(value || "")} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)} placeholder={field.placeholder} rows={4} className="heyy-form-field mt-2 resize-y" />
      ) : field.type === "select" ? (
        <div className="mt-2"><HeyySelect value={String(value || "")} tone="marketing" ariaLabel={field.label} placeholder="Select an option" options={field.options || []} onChange={onChange} /></div>
      ) : field.type === "multiselect" ? (
        <div className="mt-3 flex flex-wrap gap-2">{field.options?.map((option) => { const current = Array.isArray(value) ? value : []; const active = current.includes(option); return <button key={option} type="button" onClick={() => onChange(active ? current.filter((item) => item !== option) : [...current, option])} className={cx("rounded-full border px-3.5 py-2 text-xs font-black transition", active ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_0_0_3px_var(--accent-soft)]" : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]")}>{active && <Check size={12} className="mr-1 inline" />}{option}</button>; })}</div>
      ) : <input value={String(value || "")} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} placeholder={field.placeholder} className="heyy-form-field mt-2" />}
    </div>
  );
}

function WorkspaceNavigation({ activeTab, onChange }: { activeTab: WorkspaceTab; onChange: (tab: WorkspaceTab) => void }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Partial<Record<WorkspaceTab, HTMLButtonElement | null>>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setCanScrollLeft(scroller.scrollLeft > 6);
    setCanScrollRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 6);
  }

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    updateScrollState();
    const activeButton = tabRefs.current[activeTab];
    activeButton?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    const timer = window.setTimeout(updateScrollState, 280);
    window.addEventListener("resize", updateScrollState);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [activeTab]);

  function scrollTabs(direction: -1 | 1) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * Math.max(260, scroller.clientWidth * 0.72), behavior: "smooth" });
    window.setTimeout(updateScrollState, 300);
  }

  return (
    <GlassCard className="mt-5 p-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Scroll campaign sections left"
          onClick={() => scrollTabs(-1)}
          disabled={!canScrollLeft}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)] disabled:cursor-default disabled:opacity-30"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            ref={scrollerRef}
            onScroll={updateScrollState}
            className="flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                ref={(node) => { tabRefs.current[tab.id] = node; }}
                type="button"
                onClick={() => onChange(tab.id)}
                className={cx(
                  "shrink-0 rounded-xl border px-4 py-3 text-xs font-black transition",
                  activeTab === tab.id
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_0_0_3px_var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          aria-label="Scroll campaign sections right"
          onClick={() => scrollTabs(1)}
          disabled={!canScrollRight}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)] disabled:cursor-default disabled:opacity-30"
        >
          <ArrowRight size={15} />
        </button>
      </div>
    </GlassCard>
  );
}

function OverviewSection({ result, assets, onOpenTab, onRegenerate }: { result: ResultData; assets: ProjectAsset[]; onOpenTab: (tab: WorkspaceTab) => void; onRegenerate: () => void }) {
  const approved = assets.filter(isApproved).length;
  return (
    <>
      <GlassCard className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <Eyebrow>Campaign overview</Eyebrow>
            <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">A connected campaign system, not a random set of posts</h2>
            <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-7 text-[var(--text-secondary)]">{String(result.campaignSummary || "Campaign summary ready.")}</p>
          </div>
          <Button type="button" variant="secondary" onClick={onRegenerate}><RefreshCcw size={15} /> Regenerate strategy · {config.creditCost} credits</Button>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-4">
          <MetricCard icon={<Users size={18} />} label="Audience segments" value={Array.isArray(result.audienceSegments) ? result.audienceSegments.length : 0} />
          <MetricCard icon={<Layers3 size={18} />} label="Campaign angles" value={Array.isArray(result.campaignAngles) ? result.campaignAngles.length : 0} />
          <MetricCard icon={<CalendarDays size={18} />} label="Calendar items" value={Array.isArray(result.calendar) ? result.calendar.length : 0} />
          <MetricCard icon={<CheckCircle2 size={18} />} label="Approved visuals" value={approved} />
        </div>
      </GlassCard>
      <div className="grid gap-5 lg:grid-cols-3">
        <ActionCard icon={<Target size={19} />} title="Review the strategy" description="Confirm the audience insight, big idea and campaign message before producing assets." button="Open Strategy" onClick={() => onOpenTab("strategy")} />
        <ActionCard icon={<ImageIcon size={19} />} title="Create campaign visuals" description="Generate the key visual and channel-specific campaign formats inside Marketing Studio." button="Open Visuals" onClick={() => onOpenTab("visuals")} />
        <ActionCard icon={<Rocket size={19} />} title="Prepare the launch" description="Review testing, measurement and production requirements before the campaign goes live." button="Open Measurement" onClick={() => onOpenTab("measurement")} />
      </div>
    </>
  );
}

function BriefSection({ form, fields, brands }: { form: FormState; fields: StudioField[]; brands: BrandRecord[] }) {
  const brand = brands.find((item) => item.id === form.brandProjectId);
  return (
    <GlassCard className="p-6 sm:p-8">
      <Eyebrow>Saved campaign brief</Eyebrow>
      <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">The source behind every strategy, message and visual</h2>
      <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <BriefItem label="Brand connection" value={brand ? `${brand.business_name || brand.project_name || brand.name || "Saved brand"}${brand.industry ? ` · ${brand.industry}` : ""}` : String(form.brandSource || "Independent campaign")} />
        {fields.filter((field, index, all) => all.findIndex((item) => item.id === field.id) === index).map((field) => <BriefItem key={field.id} label={field.label} value={Array.isArray(form[field.id]) ? (form[field.id] as string[]).join(", ") : String(form[field.id] || "Not added")} />)}
      </div>
    </GlassCard>
  );
}

function AudienceSection({ result }: { result: ResultData }) {
  const segments = arrayOfRecords(result.audienceSegments);
  const strategy = recordOf(result.strategy);
  return (
    <>
      <GlassCard className="p-6 sm:p-8">
        <Eyebrow>Audience intelligence</Eyebrow>
        <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Know who must respond and what is stopping them</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <InsightCard label="Audience insight" value={strategy.audienceInsight} />
          <InsightCard label="Main barrier" value={strategy.barrier} />
          <InsightCard label="Strategic opportunity" value={strategy.opportunity} />
        </div>
      </GlassCard>
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {segments.length ? segments.map((segment, index) => (
          <GlassCard key={`${String(segment.name || "segment")}-${index}`} className="p-5">
            <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Users size={18} /></span><StatusPill tone="info">{String(segment.priority || (index === 0 ? "Primary" : "Segment"))}</StatusPill></div>
            <h3 className="mt-4 text-xl font-black">{String(segment.name || `Audience ${index + 1}`)}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{String(segment.description || "")}</p>
            <div className="mt-4 space-y-2">
              <MiniRow label="Motivation" value={segment.motivation || segment.needState} />
              <MiniRow label="Objection" value={segment.objection || segment.objections} />
              <MiniRow label="Trigger" value={segment.trigger || segment.triggerMoments} />
              <MiniRow label="Message angle" value={segment.messageAngle} />
              <MiniRow label="Channels" value={segment.channels} />
            </div>
          </GlassCard>
        )) : <EmptySection message="Audience segments were not generated." />}
      </div>
    </>
  );
}

function StrategySection({
  result,
  saving,
  onSelectAngle,
}: {
  result: ResultData;
  saving: boolean;
  onSelectAngle: (index: number) => void;
}) {
  const strategy = recordOf(result.strategy);
  const bigIdea = recordOf(result.bigIdea);
  const angles = arrayOfRecords(result.campaignAngles);
  const rawSelected = Number(result.selectedCampaignAngle);
  const selectedIndex = Number.isInteger(rawSelected) && rawSelected >= 0 ? rawSelected : -1;

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <GlassCard className="p-6 sm:p-8">
          <Eyebrow>Campaign strategy</Eyebrow>
          <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">The strategic response</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {Object.entries(strategy)
              .filter(([, value]) => !isEmpty(value))
              .map(([key, value]) => (
                <KeyValueBlock key={key} label={humanize(key)} value={value} />
              ))}
          </div>
        </GlassCard>

        <GlassCard className="border-[var(--accent-border)] bg-[var(--accent-soft)] p-6 sm:p-8">
          <Eyebrow>Big idea</Eyebrow>
          <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">
            {String(bigIdea.name || "Campaign platform")}
          </h2>
          <p className="mt-3 text-xl font-black text-[var(--accent-strong)]">
            {String(bigIdea.line || "")}
          </p>
          <p className="mt-4 text-sm font-semibold leading-7 text-[var(--text-secondary)]">
            {String(bigIdea.rationale || "")}
          </p>
          <div className="mt-5 space-y-3">
            <MiniRow label="Creative device" value={bigIdea.creativeDevice} />
            <MiniRow label="Experience" value={bigIdea.experience} />
            <MiniRow label="Extension logic" value={bigIdea.extensionLogic} />
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow>Campaign angles</Eyebrow>
            <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">
              Choose the master route for creative development
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">
              The selected route becomes the preferred message and art-direction context for campaign visuals.
              The other angles remain available for A/B testing.
            </p>
          </div>
          {selectedIndex >= 0 && <StatusPill tone="success">Master angle selected</StatusPill>}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {angles.map((angle, index) => {
            const selected = selectedIndex === index;
            return (
              <article
                key={`${String(angle.title || "angle")}-${index}`}
                className={cx(
                  "rounded-2xl border bg-[var(--surface)] p-5 transition",
                  selected
                    ? "border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]"
                    : "border-[var(--border)] hover:border-[var(--accent-border)]",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[.62rem] font-black uppercase tracking-[.16em] text-[var(--accent-strong)]">
                    Angle {index + 1}
                  </span>
                  {selected && <StatusPill tone="success">Selected</StatusPill>}
                </div>
                <h3 className="mt-2 text-xl font-black">{String(angle.title || "Campaign angle")}</h3>
                <p className="mt-3 text-lg font-black text-[var(--text-primary)]">{String(angle.hook || "")}</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                  {String(angle.message || angle.strategicRole || "")}
                </p>
                <div className="mt-4 space-y-2">
                  <MiniRow label="Proof" value={angle.proof} />
                  <MiniRow label="Best for" value={angle.bestFor} />
                  <MiniRow label="Audience" value={angle.audience} />
                </div>
                <Button
                  type="button"
                  variant={selected ? "secondary" : "primary"}
                  className="mt-5 w-full"
                  disabled={saving || selected}
                  onClick={() => onSelectAngle(index)}
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : selected ? <Check size={15} /> : <Target size={15} />}
                  {selected ? "Master angle selected" : "Use as master angle"}
                </Button>
              </article>
            );
          })}
        </div>
      </GlassCard>
    </>
  );
}

function MessagingSection({ result }: { result: ResultData }) {
  const keyMessage = recordOf(result.keyMessage);
  const copyBank = recordOf(result.copyBank);
  return (
    <>
      <GlassCard className="p-6 sm:p-8">
        <Eyebrow>Message hierarchy</Eyebrow>
        <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">One clear proposition, supported by proof and action</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-6"><p className="text-[.62rem] font-black uppercase tracking-[.16em] text-[var(--accent-strong)]">Primary message</p><p className="mt-3 text-2xl font-black leading-tight">{String(keyMessage.primary || "")}</p><div className="mt-5 flex flex-wrap gap-2">{toStringArray(keyMessage.supporting).map((item) => <span key={item} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold">{item}</span>)}</div></div>
          <div className="space-y-3"><KeyValueBlock label="Call to action" value={keyMessage.callToAction} /><KeyValueBlock label="Secondary CTA" value={keyMessage.secondaryCTA} /><KeyValueBlock label="Proof points" value={keyMessage.proofPoints} /></div>
        </div>
      </GlassCard>
      <div className="grid gap-5 lg:grid-cols-2">
        {Object.entries(copyBank).filter(([, value]) => !isEmpty(value)).map(([key, value]) => <CopyBankCard key={key} title={humanize(key)} value={value} />)}
      </div>
    </>
  );
}

function ChannelsSection({ result }: { result: ResultData }) {
  const channels = arrayOfRecords(result.channelPlan);
  const pillars = arrayOfRecords(result.contentPillars);
  return (
    <>
      <GlassCard className="p-6 sm:p-8"><Eyebrow>Channel plan</Eyebrow><h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Every channel has a job in the customer journey</h2><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{channels.map((channel, index) => <div key={`${String(channel.channel || "channel")}-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Megaphone size={18} /></span><StatusPill tone="info">{String(channel.funnelStage || "Channel")}</StatusPill></div><h3 className="mt-4 text-xl font-black">{String(channel.channel || `Channel ${index + 1}`)}</h3><p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{String(channel.role || "")}</p><div className="mt-4 space-y-2"><MiniRow label="Formats" value={channel.formats} /><MiniRow label="Cadence" value={channel.cadence} /><MiniRow label="Message style" value={channel.messageStyle} /><MiniRow label="Required assets" value={channel.requiredAssets || channel.creativeRequirements} /></div></div>)}</div></GlassCard>
      <GlassCard className="p-6 sm:p-8"><Eyebrow>Content system</Eyebrow><h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Repeatable pillars instead of random posting</h2><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{pillars.map((pillar, index) => <div key={`${String(pillar.pillar || "pillar")}-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><span className="text-[.62rem] font-black uppercase tracking-[.16em] text-[var(--accent-strong)]">Pillar {index + 1}</span><h3 className="mt-2 text-xl font-black">{String(pillar.pillar || "Content pillar")}</h3><p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{String(pillar.purpose || "")}</p><ValueList value={pillar.examples} /></div>)}</div></GlassCard>
    </>
  );
}

function CalendarSection({
  result,
  saving,
  onSave,
}: {
  result: ResultData;
  saving: boolean;
  onSave: (calendar: Array<Record<string, unknown>>) => void;
}) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>(() => arrayOfRecords(result.calendar));

  useEffect(() => {
    setItems(arrayOfRecords(result.calendar));
  }, [result.calendar]);

  function updateItem(index: number, key: string, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  }

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-5 p-6 sm:p-8">
        <div className="max-w-3xl">
          <Eyebrow>Content calendar</Eyebrow>
          <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">
            A usable campaign sequence, not a static AI answer
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
            Edit the timing, hook, CTA and status before production. The saved calendar is included in the Campaign Pack
            and the production request.
          </p>
        </div>
        <Button type="button" disabled={saving || !items.length} onClick={() => onSave(items)}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {saving ? "Saving…" : "Save calendar"}
        </Button>
      </div>

      <div className="overflow-x-auto border-t border-[var(--border)]">
        <table className="w-full min-w-[1280px] border-collapse text-left">
          <thead className="bg-[var(--surface-hover)]">
            <tr>
              {["Phase / timing", "Channel", "Format", "Topic", "Hook", "CTA", "Visual", "Status"].map((heading) => (
                <th
                  key={heading}
                  className="border-b border-[var(--border)] px-4 py-3 text-[.62rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${String(item.phase || "phase")}-${index}`} className="border-b border-[var(--border)] last:border-0">
                <td className="min-w-[170px] px-3 py-3 align-top">
                  <input
                    value={String(item.phase || "")}
                    onChange={(event) => updateItem(index, "phase", event.target.value)}
                    aria-label={`Calendar item ${index + 1} phase`}
                    className="heyy-form-field"
                    placeholder="Launch"
                  />
                  <input
                    value={String(item.week || "")}
                    onChange={(event) => updateItem(index, "week", event.target.value)}
                    aria-label={`Calendar item ${index + 1} timing`}
                    className="heyy-form-field mt-2"
                    placeholder="Week 1"
                  />
                </td>
                <td className="min-w-[150px] px-3 py-3 align-top">
                  <input value={String(item.channel || "")} onChange={(event) => updateItem(index, "channel", event.target.value)} className="heyy-form-field" aria-label={`Calendar item ${index + 1} channel`} />
                </td>
                <td className="min-w-[145px] px-3 py-3 align-top">
                  <input value={String(item.format || "")} onChange={(event) => updateItem(index, "format", event.target.value)} className="heyy-form-field" aria-label={`Calendar item ${index + 1} format`} />
                </td>
                <td className="min-w-[210px] px-3 py-3 align-top">
                  <textarea value={String(item.topic || item.content || "")} onChange={(event) => updateItem(index, "topic", event.target.value)} rows={3} className="heyy-form-field resize-y" aria-label={`Calendar item ${index + 1} topic`} />
                </td>
                <td className="min-w-[210px] px-3 py-3 align-top">
                  <textarea value={String(item.hook || "")} onChange={(event) => updateItem(index, "hook", event.target.value)} rows={3} className="heyy-form-field resize-y" aria-label={`Calendar item ${index + 1} hook`} />
                </td>
                <td className="min-w-[175px] px-3 py-3 align-top">
                  <input value={String(item.callToAction || "")} onChange={(event) => updateItem(index, "callToAction", event.target.value)} className="heyy-form-field" aria-label={`Calendar item ${index + 1} call to action`} />
                </td>
                <td className="min-w-[190px] px-3 py-3 align-top">
                  <input value={String(item.visualRequired || "")} onChange={(event) => updateItem(index, "visualRequired", event.target.value)} className="heyy-form-field" aria-label={`Calendar item ${index + 1} visual`} />
                </td>
                <td className="min-w-[145px] px-3 py-3 align-top">
                  <HeyySelect
                    value={String(item.status || "Draft")}
                    tone="marketing"
                    ariaLabel={`Calendar item ${index + 1} status`}
                    options={["Draft", "Ready for review", "Approved", "Scheduled", "Published"]}
                    onChange={(value) => updateItem(index, "status", value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

function VisualsSection({
  assets,
  selectedChannels,
  generating,
  approvingAssetId,
  onGenerate,
  onApprove,
  onEnlarge,
}: {
  assets: ProjectAsset[];
  selectedChannels: string[];
  generating: GenerationTarget;
  approvingAssetId: string | null;
  onGenerate: (viewType: MarketingVisualType, stage: GenerationStage, tweak?: string) => void;
  onApprove: (asset: ProjectAsset) => void;
  onEnlarge: (image: { url: string; title: string }) => void;
}) {
  const [stages, setStages] = useState<Record<MarketingVisualType, GenerationStage>>(() => Object.fromEntries(VISUALS.map((item) => [item.id, "preview"])) as Record<MarketingVisualType, GenerationStage>);
  const [tweaks, setTweaks] = useState<Partial<Record<MarketingVisualType, string>>>({});
  return (
    <GlassCard className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><Eyebrow>Creative visuals</Eyebrow><h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Generate the campaign creative without leaving Marketing Studio</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">Start with the Campaign Key Visual. Other formats use it as a consistency reference when it is available.</p></div><div className="flex gap-2"><CreditPill credits={12} label="preview" /><CreditPill credits={24} label="final" /></div></div>
      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        {VISUALS.map((definition) => {
          const stage = stages[definition.id];
          const previewAsset = getMarketingAsset(assets, definition.id, "preview");
          const asset = getMarketingAsset(assets, definition.id, stage);
          const approved = asset ? isApproved(asset) : false;
          const recommended = !definition.channelMatches.length || definition.channelMatches.some((channel) => selectedChannels.includes(channel));
          const isGenerating = generating?.viewType === definition.id && generating.stage === stage;
          const finalLocked = stage === "final" && !previewAsset?.file_url;
          return (
            <section key={definition.id} className={cx("overflow-hidden rounded-2xl border bg-[var(--surface)]", recommended ? "border-[var(--accent-border)]" : "border-[var(--border)]")}> 
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-3">
                <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-1">{(["preview", "final"] as GenerationStage[]).map((item) => <button key={item} type="button" onClick={() => setStages((current) => ({ ...current, [definition.id]: item }))} className={cx("rounded-lg px-4 py-2 text-xs font-black capitalize transition", stage === item ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]")}>{item === "final" ? "Professional Final" : "Preview"}</button>)}</div>
                <div className="flex items-center gap-2">{recommended && <StatusPill tone="info">Recommended</StatusPill>}{approved && <StatusPill tone="success"><CheckCircle2 size={11} className="mr-1" /> Approved</StatusPill>}</div>
              </div>
              <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(135deg,var(--accent-soft),var(--surface-hover))]">
                {asset?.file_url ? <img src={asset.file_url} alt={definition.title} className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center p-7 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface)] text-[var(--accent-strong)]"><ImageIcon size={22} /></span><p className="mt-4 text-sm font-black">{stage === "final" ? "Professional Final not generated" : "Preview not generated"}</p><p className="mt-2 text-xs font-semibold text-[var(--text-muted)]">The generated visual will appear here.</p></div></div>}
                {asset?.file_url && <button type="button" onClick={() => onEnlarge({ url: asset.file_url as string, title: definition.title })} className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/75 px-3 py-2 text-xs font-black text-white backdrop-blur"><Maximize2 size={13} /> Enlarge</button>}
                {isGenerating && <CardLoader title={`Generating ${stage === "final" ? "Professional Final" : "Preview"}`} />}
              </div>
              <div className="p-5">
                <div className="max-w-xl">
                  <p className="text-[.62rem] font-black uppercase tracking-[.16em] text-[var(--accent-strong)]">{definition.formats.join(" · ")}</p>
                  <h3 className="mt-2 text-xl font-black">{definition.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{definition.description}</p>
                  {finalLocked && (
                    <p className="mt-3 rounded-xl border border-amber-300/60 bg-amber-500/10 p-3 text-xs font-bold text-amber-800 dark:text-amber-200">
                      Generate the Preview first. The Professional Final will preserve and refine that selected campaign direction.
                    </p>
                  )}
                </div>
                <div className="mt-4">
                  <label className="text-[.6rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">
                    Small tweak or extra direction
                  </label>
                  <input
                    value={tweaks[definition.id] || ""}
                    onChange={(event) => setTweaks((current) => ({ ...current, [definition.id]: event.target.value }))}
                    className="heyy-form-field mt-2"
                    placeholder="e.g. Make the composition more premium, keep the product unchanged and create more copy space on the left"
                  />
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => onGenerate(definition.id, stage, tweaks[definition.id] || "")}
                    disabled={Boolean(generating) || finalLocked}
                  >
                    {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <WandSparkles size={15} />}
                    {asset ? "Regenerate" : "Generate"} {stage === "final" ? "Professional Final · 24 credits" : "Preview · 12 credits"}
                  </Button>
                  {stage === "final" && asset && !approved && (
                    <Button type="button" variant="secondary" disabled={approvingAssetId === asset.id} onClick={() => onApprove(asset)}>
                      {approvingAssetId === asset.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                      Approve final
                    </Button>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </GlassCard>
  );
}

function TestingSection({ result }: { result: ResultData }) {
  const tests = arrayOfRecords(result.testingPlan);
  return (
    <GlassCard className="p-6 sm:p-8"><Eyebrow>A/B testing matrix</Eyebrow><h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Use testing to learn, not to pretend we know what will win</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">These are hypotheses. Real campaign data should decide which audience, offer, message, visual or CTA is scaled.</p><div className="mt-6 grid gap-4 lg:grid-cols-2">{tests.map((test, index) => <div key={`${String(test.test || test.hypothesis || "test")}-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><FlaskConical size={18} /></span><div><p className="text-[.6rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">Test {index + 1}</p><h3 className="text-lg font-black">{String(test.test || test.hypothesis || "Campaign test")}</h3></div></div><div className="mt-4 grid gap-3 md:grid-cols-2"><KeyValueBlock label="Variant A" value={test.variantA} /><KeyValueBlock label="Variant B" value={test.variantB} /></div><div className="mt-3 space-y-2"><MiniRow label="Variable" value={test.variable} /><MiniRow label="Audience" value={test.audience} /><MiniRow label="Success signal" value={test.successSignal} /><MiniRow label="Decision rule" value={test.decisionRule} /></div></div>)}</div></GlassCard>
  );
}

function CampaignPackSection({
  result,
  assets,
  workMode,
  exporting,
  onDownload,
}: {
  result: ResultData;
  assets: ProjectAsset[];
  workMode: WorkMode;
  exporting: boolean;
  onDownload: () => void;
}) {
  const approved = assets.filter((asset) => String(asset.asset_type || "").startsWith("marketing_visual_") && isApproved(asset)).length;
  const generated = assets.filter((asset) => String(asset.asset_type || "").startsWith("marketing_visual_")).length;
  return (
    <GlassCard className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <Eyebrow>Campaign pack</Eyebrow>
          <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">One handoff for strategy, messaging, content, testing and creative</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-[var(--text-secondary)]">The Campaign Pack carries the decisions into production instead of leaving them scattered across separate generators.</p>
        </div>
        <Button type="button" onClick={onDownload} disabled={exporting}>
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {exporting ? "Preparing PDF..." : "Download Campaign Pack"}
        </Button>
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-4">
        <MetricCard icon={<FileText size={18} />} label="Mode" value={workMode === "professional" ? "Professional" : "Guided"} />
        <MetricCard icon={<CalendarDays size={18} />} label="Calendar items" value={Array.isArray(result.calendar) ? result.calendar.length : 0} />
        <MetricCard icon={<ImageIcon size={18} />} label="Generated visuals" value={generated} />
        <MetricCard icon={<CheckCircle2 size={18} />} label="Approved visuals" value={approved} />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {["Executive campaign overview", "Audience profiles", "Strategy and big idea", "Message hierarchy and copy bank", "Campaign angles", "Channel plan", "Content calendar", "Creative brief", "Campaign visuals", "Testing matrix", "Measurement framework", "Launch checklist"].map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <Check size={15} className="text-[var(--accent-strong)]" />
            <span className="text-xs font-bold">{item}</span>
          </div>
        ))}
      </div>
      {result.professionalPackage && (
        <div className="mt-6 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5">
          <p className="text-sm font-black">Professional operations package included</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]">Includes funnel, asset register, production schedule, media framework, tracking framework, governance and handover controls.</p>
        </div>
      )}
    </GlassCard>
  );
}

function MeasurementSection({ result }: { result: ResultData }) {
  const measurements = arrayOfRecords(result.measurementPlan);
  const checklist = Array.isArray(result.launchChecklist) ? result.launchChecklist : [];
  const professional = recordOf(result.professionalPackage);
  return (
    <>
      <GlassCard className="p-6 sm:p-8"><Eyebrow>Measurement framework</Eyebrow><h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Know what each signal means and what action follows</h2><div className="mt-6 grid gap-4 lg:grid-cols-2">{measurements.map((item, index) => <div key={`${String(item.stage || item.funnelStage || "stage")}-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black">{String(item.stage || item.funnelStage || `Stage ${index + 1}`)}</h3><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><BarChart3 size={17} /></span></div><div className="mt-4 space-y-2"><MiniRow label="Objective" value={item.objective} /><MiniRow label="Signals" value={item.signal || item.primarySignals} /><MiniRow label="Why it matters" value={item.why} /><MiniRow label="Optimisation action" value={item.action || item.optimisationAction} /></div></div>)}</div></GlassCard>
      <div className="grid gap-5 lg:grid-cols-2"><GlassCard className="p-6"><Eyebrow>Launch checklist</Eyebrow><div className="mt-5 space-y-3">{checklist.map((item, index) => <div key={index} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"><ClipboardCheck size={14} /></span><span className="text-xs font-semibold leading-5">{typeof item === "string" ? item : formatObject(item)}</span></div>)}</div></GlassCard><GlassCard className="p-6"><Eyebrow>Professional tracking & governance</Eyebrow><div className="mt-5 space-y-3"><MiniRow label="Tracking framework" value={professional.trackingFramework} /><MiniRow label="Media framework" value={professional.mediaFramework} /><MiniRow label="Governance" value={professional.governance} /><MiniRow label="Handover" value={professional.handoverChecklist} /></div></GlassCard></div>
    </>
  );
}

function ProjectJourney({ activeTab, onChange }: { activeTab: WorkspaceTab; onChange: (tab: WorkspaceTab) => void }) {
  const currentIndex = TABS.findIndex((tab) => tab.id === activeTab);
  const previous = TABS[currentIndex - 1];
  const next = TABS[currentIndex + 1];
  return <GlassCard className="flex flex-wrap items-center justify-between gap-4 p-4"><div><Eyebrow>Project journey</Eyebrow><p className="mt-1 text-sm font-bold text-[var(--text-secondary)]">Continue through the campaign one connected section at a time.</p></div><div className="flex flex-wrap gap-3">{previous && <Button type="button" variant="secondary" onClick={() => onChange(previous.id)}><ArrowLeft size={14} /> Back · {previous.label}</Button>}{next && <Button type="button" onClick={() => onChange(next.id)}>Next · {next.label} <ArrowRight size={14} /></Button>}</div></GlassCard>;
}

function FullScreenCampaignLoader({ workMode }: { workMode: WorkMode }) {
  const stages = workMode === "professional"
    ? ["Analysing audience and market context", "Building strategy, funnel and message hierarchy", "Planning channels, content and testing", "Preparing the professional campaign package"]
    : ["Understanding the campaign goal", "Finding the strongest audience insight", "Building the big idea and messages", "Preparing channels, content and creative direction"];
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    setActiveStep(0);
    const timer = window.setInterval(() => setActiveStep((current) => Math.min(stages.length - 1, current + 1)), 3200);
    return () => window.clearInterval(timer);
  }, [workMode, stages.length]);

  return (
    <StudioLoader
      tone="marketing"
      eyebrow="Marketing Studio is preparing"
      title={stages[activeStep]}
      detail="Generation continues safely in the background if you leave this page. Credits are refunded automatically if generation fails."
      steps={stages}
      activeStep={activeStep}
      variant="fullscreen"
    />
  );
}

function CardLoader({ title }: { title: string }) {
  return (
    <StudioLoader
      tone="marketing"
      title={title}
      detail="Applying the campaign strategy, message and selected creative format."
      variant="overlay"
    />
  );
}

function ImageLightbox({ image, onClose }: { image: { url: string; title: string }; onClose: () => void }) {
  return <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/90 p-4" onClick={onClose}><button type="button" className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white" onClick={onClose}><X size={22} /></button><div className="max-h-[92vh] max-w-[94vw]" onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}><img src={image.url} alt={image.title} className="max-h-[84vh] max-w-full rounded-2xl object-contain" /><p className="mt-3 text-center text-sm font-black text-white">{image.title}</p></div></div>;
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">{icon}</span><p className="mt-4 text-2xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{label}</p></div>;
}

function ActionCard({ icon, title, description, button, onClick }: { icon: ReactNode; title: string; description: string; button: string; onClick: () => void }) {
  return <GlassCard className="p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">{icon}</span><h3 className="mt-4 text-lg font-black">{title}</h3><p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{description}</p><Button type="button" variant="secondary" className="mt-5" onClick={onClick}>{button} <ArrowRight size={14} /></Button></GlassCard>;
}

function SummaryLine({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"><p className="text-[.56rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">{label}</p><p className="mt-1 text-xs font-black text-[var(--text-primary)]">{value}</p></div>; }
function BriefItem({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-[.58rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">{label}</p><p className="mt-2 whitespace-pre-line text-xs font-semibold leading-5 text-[var(--text-primary)]">{value}</p></div>; }
function InsightCard({ label, value }: { label: string; value: unknown }) { return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><p className="text-[.6rem] font-black uppercase tracking-[.14em] text-[var(--accent-strong)]">{label}</p><p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{formatValue(value)}</p></div>; }
function KeyValueBlock({ label, value }: { label: string; value: unknown }) { return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-[.58rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">{label}</p><p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-primary)]">{formatValue(value)}</p></div>; }
function MiniRow({ label, value }: { label: string; value: unknown }) { if (isEmpty(value)) return null; return <div className="rounded-lg bg-[var(--surface-hover)] px-3 py-2"><span className="text-[.55rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">{label}</span><p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-primary)]">{formatValue(value)}</p></div>; }
function ValueList({ value }: { value: unknown }) { const items = toStringArray(value); return items.length ? <ul className="mt-4 space-y-2">{items.map((item) => <li key={item} className="flex items-start gap-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />{item}</li>)}</ul> : null; }

function CopyBankCard({ title, value }: { title: string; value: unknown }) {
  const items = Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : [value];
  async function copy() { await navigator.clipboard.writeText(items.map((item) => typeof item === "string" ? item : formatObject(item)).join("\n\n")); }
  return <GlassCard className="p-5"><div className="flex items-center justify-between gap-3"><div><Eyebrow>{title}</Eyebrow><h3 className="mt-2 text-xl font-black">{items.length} options</h3></div><button type="button" onClick={() => void copy()} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"><Copy size={16} /></button></div><div className="mt-4 space-y-2">{items.slice(0, 12).map((item, index) => <div key={index} className="rounded-xl bg-[var(--surface-hover)] p-3 text-xs font-semibold leading-5">{typeof item === "string" ? item : formatObject(item)}</div>)}</div></GlassCard>;
}

function EmptySection({ message }: { message: string }) { return <GlassCard className="p-7 text-center text-sm font-bold text-[var(--text-muted)]">{message}</GlassCard>; }
function ErrorBanner({ message }: { message: string }) { return <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-300/60 bg-red-500/10 p-4 text-sm font-bold text-red-700 dark:text-red-200"><AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{message}</span></div>; }

function initialState(): FormState {
  const state: FormState = { workMode: "guided", brandSource: "Start without a saved brand", brandProjectId: "" };
  const fields = [...config.steps, ...(config.professionalSteps || [])].flatMap((item) => item.fields);
  for (const field of fields) if (!(field.id in state)) state[field.id] = field.type === "multiselect" ? [] : "";
  return state;
}

function readMarketingWorkspaceTab(projectId: string): WorkspaceTab {
  const query = new URLSearchParams(window.location.search).get("tab");
  if (query && TABS.some((tab) => tab.id === query)) return query as WorkspaceTab;
  const stored = window.localStorage.getItem(`heyy-marketing-tab:${projectId}`);
  return stored && TABS.some((tab) => tab.id === stored) ? stored as WorkspaceTab : "overview";
}
function rememberMarketingWorkspaceTab(projectId: string, tab: WorkspaceTab) { window.localStorage.setItem(`heyy-marketing-tab:${projectId}`, tab); }
function getMarketingAsset(assets: ProjectAsset[], viewType: MarketingVisualType, stage: GenerationStage) { return assets.find((asset) => String(asset.metadata?.view_type || "") === viewType && String(asset.metadata?.stage || "") === stage) || null; }
function isApproved(asset: ProjectAsset) { return asset.metadata?.approved === true || asset.metadata?.approved === "true"; }
function recordOf(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function arrayOfRecords(value: unknown): Array<Record<string, unknown>> { return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : []; }
function toStringArray(value: unknown): string[] { if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : formatObject(item)).filter(Boolean); if (value === null || value === undefined || value === "") return []; return [String(value)]; }
function formatValue(value: unknown): string { if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : formatObject(item)).join(" · "); if (value && typeof value === "object") return formatObject(value); return String(value || "Not generated"); }
function formatObject(value: unknown): string { if (!value || typeof value !== "object") return String(value || ""); return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${humanize(key)}: ${Array.isArray(item) ? item.join(", ") : typeof item === "object" && item ? JSON.stringify(item) : String(item || "")}`).join(" · "); }
function humanize(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, (letter) => letter.toUpperCase()); }
function isEmpty(value: unknown) { return Array.isArray(value) ? value.length === 0 : !String(value || "").trim(); }
