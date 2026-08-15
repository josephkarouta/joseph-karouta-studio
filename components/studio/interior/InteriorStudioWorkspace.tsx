"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Armchair,
  BriefcaseBusiness,
  Building2,
  CalendarRange,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  LampFloor,
  LayoutDashboard,
  Layers3,
  Loader2,
  MapPin,
  Maximize2,
  PackageCheck,
  Palette,
  RefreshCcw,
  Ruler,
  ShoppingBag,
  Sofa,
  Sparkles,
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
import HeyySelect from "@/components/ui/heyy-select";
import StudioModeToggle from "@/components/ui/StudioModeToggle";
import StudioLoader from "@/components/ui/StudioLoader";

const config = GUIDED_STUDIOS.interior;

type FormState = Record<string, string | string[]>;
type ResultData = Record<string, unknown> & {
  conceptSummary?: string;
  designDirection?: Record<string, unknown>;
  layoutPlan?: unknown[];
  materialPalette?: unknown[];
  furniturePlan?: unknown[];
  lightingPlan?: unknown[];
  colorPalette?: unknown[];
  stylingNotes?: unknown[];
  procurementPriorities?: unknown[];
  expertNotes?: unknown[];
  visualPrompt?: string;
  professionalPackage?: Record<string, unknown>;
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

type ArchitectureRecord = {
  id: string;
  project_name?: string | null;
  project_type?: string | null;
  city?: string | null;
  country?: string | null;
  architectural_style?: string | null;
  status?: string | null;
};

type WorkspaceTab =
  | "overview"
  | "brief"
  | "layout"
  | "materials"
  | "furniture"
  | "lighting"
  | "plans"
  | "visuals"
  | "professional-pack"
  | "design-pack"
  | "production";

type PlanType = "space_plan" | "furniture_plan" | "lighting_plan";
type VisualType = "main_space" | "alternate_angle" | "focal_point" | "material_detail" | "day_view" | "evening_view";
type InteriorImageType = PlanType | VisualType;
type GenerationStage = "technical" | "preview" | "final";
type WorkMode = "guided" | "professional";
type GenerationTarget = { viewType: InteriorImageType; stage: GenerationStage } | null;

type LightboxImage = { url: string; title: string } | null;

const BASE_WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "brief", label: "Project Brief" },
  { id: "layout", label: "Layout" },
  { id: "materials", label: "Materials" },
  { id: "furniture", label: "Furniture" },
  { id: "lighting", label: "Lighting" },
  { id: "plans", label: "Plans" },
  { id: "visuals", label: "Visuals" },
  { id: "design-pack", label: "Design Pack" },
  { id: "production", label: "Production" },
];

function workspaceTabs(workMode: WorkMode, result: ResultData | null) {
  if (workMode !== "professional" && !result?.professionalPackage) return BASE_WORKSPACE_TABS;
  const tabs = [...BASE_WORKSPACE_TABS];
  tabs.splice(tabs.findIndex((tab) => tab.id === "design-pack"), 0, { id: "professional-pack", label: "Professional Pack" });
  return tabs;
}

const PLAN_VIEWS: Array<{ id: PlanType; title: string; description: string; credits: number }> = [
  {
    id: "space_plan",
    title: "Furniture & Space Plan",
    description: "A complete top-down plan showing walls, openings, circulation, furniture and key dimensions.",
    credits: 8,
  },
  {
    id: "furniture_plan",
    title: "Furniture Placement Plan",
    description: "A coordinated placement and clearance plan based on the approved space geometry.",
    credits: 8,
  },
  {
    id: "lighting_plan",
    title: "Lighting & Ceiling Plan",
    description: "A reflected ceiling concept with fixture positions, lighting layers and switching groups.",
    credits: 8,
  },
];

const VISUALS: Array<{ id: VisualType; title: string; description: string }> = [
  {
    id: "main_space",
    title: "Main Space Perspective",
    description: "The complete room direction translated into the primary hero view.",
  },
  {
    id: "alternate_angle",
    title: "Alternative Angle",
    description: "The opposite useful angle while preserving the same layout and design system.",
  },
  {
    id: "focal_point",
    title: "Feature Wall & Joinery View",
    description: "A focused view of the principal architectural or custom-joinery moment.",
  },
  {
    id: "material_detail",
    title: "Materials & Lighting Detail",
    description: "A closer composition showing finishes, joinery, furniture texture and layered lighting.",
  },
  {
    id: "day_view",
    title: "Daylight Atmosphere",
    description: "A natural-light version of the approved room and furniture arrangement.",
  },
  {
    id: "evening_view",
    title: "Evening Atmosphere",
    description: "The same room at night with the approved layered lighting strategy.",
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

export default function InteriorStudioWorkspace() {
  return (
    <StudioAccessGate path="/interior-studio">
      <SiteHeader />
      <WorkspaceShell>
        <InteriorExperience />
        <SiteFooter />
      </WorkspaceShell>
    </StudioAccessGate>
  );
}

function InteriorExperience() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, refreshAccount } = useAuth();
  const [form, setForm] = useState<FormState>(() => initialState());
  const [step, setStep] = useState(0);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [result, setResult] = useState<ResultData | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [architectureProjects, setArchitectureProjects] = useState<ArchitectureRecord[]>([]);
  const [generatingConcept, setGeneratingConcept] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<GenerationTarget>(null);
  const [approvingAssetId, setApprovingAssetId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxImage>(null);
  const [error, setError] = useState("");

  const workMode: WorkMode = form.workMode === "professional" ? "professional" : "guided";
  const activeSteps = useMemo(
    () => workMode === "professional" && config.professionalSteps?.length ? config.professionalSteps : config.steps,
    [workMode],
  );

  const studioStyle = {
    "--accent": config.accent,
    "--accent-strong": config.accent,
    "--accent-soft": config.soft,
    "--accent-border": `color-mix(in srgb, ${config.accent} 58%, transparent)`,
    "--button-primary": config.accent,
    "--button-primary-hover": `color-mix(in srgb, ${config.accent} 82%, black)`,
    "--focus-ring": `color-mix(in srgb, ${config.accent} 28%, transparent)`,
  } as CSSProperties;

  const allFields = useMemo(() => activeSteps.flatMap((item) => item.fields), [activeSteps]);
  const requiredMissing = activeSteps[step]?.fields.filter((field) => field.required && isEmpty(form[field.id])) || [];
  const completedInputs = allFields.filter((field) => !isEmpty(form[field.id])).length;
  const progress = result
    ? Math.max(75, Math.min(100, Number(project?.progress || 75)))
    : Math.round(((step + completedInputs / Math.max(1, allFields.length)) / (activeSteps.length + 1)) * 100);

  useEffect(() => {
    if (!user) return;
    void loadArchitectureProjects();
    const projectId = new URLSearchParams(window.location.search).get("project");
    if (projectId) void loadProject(projectId);
  }, [user]);

  async function loadArchitectureProjects() {
    const { data } = await supabase
      .from("architecture_projects")
      .select("id,project_name,project_type,city,country,architectural_style,status,updated_at")
      .eq("user_id", user?.id || "")
      .order("updated_at", { ascending: false })
      .limit(40);
    setArchitectureProjects((data || []) as ArchitectureRecord[]);
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
    setStep(record.output ? savedSteps.length : 0);
    setActiveTab(savedResult ? readInteriorWorkspaceTab(projectId, savedMode, savedResult) : "brief");
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
    if (step === 0 && form.architectureSource === "Use an existing Architecture project" && !String(form.architectureProjectId || "")) {
      setError("Choose the Architecture project this interior should follow.");
      return;
    }
    setStep((current) => Math.min(activeSteps.length - 1, current + 1));
  }

  async function generateConcept() {
    const missing = allFields.filter((field) => field.required && isEmpty(form[field.id]));
    if (missing.length) {
      setError(`Complete ${missing.map((field) => field.label.toLowerCase()).join(", ")} before generating.`);
      setStep(Math.max(0, activeSteps.findIndex((section) => section.fields.some((field) => missing.some((item) => item.id === field.id)))));
      return;
    }
    if (form.architectureSource === "Use an existing Architecture project" && !String(form.architectureProjectId || "")) {
      setError("Choose the Architecture project this interior should follow.");
      setStep(0);
      return;
    }

    setGeneratingConcept(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const response = await fetch("/api/studios/interior/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input: { ...form, workMode }, projectId: project?.id || null }),
      });
      const started = await readStudioAsyncPayload(response, "Interior project generation could not start.");
      if (!response.ok || started.success === false) throw new Error(started.error || "Interior project generation could not start.");
      const data = started.status === "succeeded"
        ? started
        : await waitForStudioAsyncJob("interior", "concept", String(started.jobId || ""), token);

      const nextProject = data.project as ProjectRecord;
      const nextResult = data.output as ResultData;
      if (!nextProject?.id || !nextResult) throw new Error("Interior project generation finished without a saved project.");
      setResult(nextResult);
      setProject(nextProject);
      setStep(activeSteps.length);
      setActiveTab("overview");
      await refreshAccount();
      rememberInteriorWorkspaceTab(nextProject.id, "overview");
      const url = new URL(window.location.href);
      url.searchParams.set("project", nextProject.id);
      url.searchParams.set("tab", "overview");
      window.history.replaceState({}, "", url);
      await loadAssets(nextProject.id);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Generation failed.");
    } finally {
      setGeneratingConcept(false);
    }
  }

  async function generateImage(viewType: InteriorImageType, stage: GenerationStage) {
    if (!project?.id || !result) {
      setError("Generate the interior concept first.");
      return;
    }
    setGeneratingImage({ viewType, stage });
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const response = await fetch("/api/studios/interior/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: project.id, viewType, stage }),
      });
      const started = await readStudioAsyncPayload(response, "Interior image generation could not start.");
      if (!response.ok || started.success === false) throw new Error(started.error || "Interior image generation could not start.");
      if (started.status !== "succeeded") {
        await waitForStudioAsyncJob("interior", "image", String(started.jobId || ""), token);
      }

      await Promise.all([loadAssets(project.id), refreshAccount()]);
      selectWorkspaceTab(viewType.endsWith("_plan") ? "plans" : "visuals");
    } catch (visualError) {
      setError(visualError instanceof Error ? visualError.message : "Image generation failed.");
    } finally {
      setGeneratingImage(null);
    }
  }

 async function approveAsset(asset: ProjectAsset) {
  if (!project?.id || !asset.id || !user?.id) return;

  setApprovingAssetId(asset.id);
  setError("");

  try {
    const nextMetadata = {
      ...(asset.metadata || {}),
      approved: true,
      approved_at: new Date().toISOString(),
    };

    const { error: approvalError } = await supabase
      .from("project_assets")
      .update({ metadata: nextMetadata })
      .eq("id", asset.id)
      .eq("project_id", project.id)
      .eq("user_id", user.id)
      .eq("studio", config.databaseId);

    if (approvalError) {
      throw new Error(approvalError.message || "Approval failed.");
    }

    await loadAssets(project.id);
  } catch (approvalError) {
    setError(
      approvalError instanceof Error
        ? approvalError.message
        : "Approval failed.",
    );
  } finally {
    setApprovingAssetId(null);
  }
}

  function selectWorkspaceTab(tab: WorkspaceTab) {
    setActiveTab(tab);
    const projectId = project?.id || new URLSearchParams(window.location.search).get("project");
    if (!projectId) return;
    rememberInteriorWorkspaceTab(projectId, tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url);
  }

  function downloadDesignPack() {
    if (!result) return;
    const payload = {
      project: project?.project_name || form.projectName || "Interior project",
      workMode,
      generatedAt: new Date().toISOString(),
      brief: form,
      concept: result,
      professionalPackage: result.professionalPackage || null,
      plans: assets
        .filter((asset) => String(asset.asset_type || "").startsWith("interior_plan_"))
        .map((asset) => ({ title: asset.title, url: asset.file_url, type: asset.metadata?.view_type, stage: asset.metadata?.stage, approved: asset.metadata?.approved })),
      visuals: assets
        .filter((asset) => String(asset.asset_type || "").startsWith("interior_visual_"))
        .map((asset) => ({ title: asset.title, url: asset.file_url, type: asset.metadata?.view_type, stage: asset.metadata?.stage, approved: asset.metadata?.approved })),
      disclaimer: config.disclaimer,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(String(form.projectName || "interior-project"))}-design-pack.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const mainVisual = getInteriorAsset(assets, "main_space", "final") || getInteriorAsset(assets, "main_space", "preview");
  const loading = generatingConcept;
  const spacePlanReady = isAnyStageApproved(assets, "space_plan");
  const mainSpaceReady = isAnyStageApproved(assets, "main_space");
  const sourcingMarket = String(form.procurementMarket || form.location || "");

  return (
    <main className="heyy-page min-h-screen py-8 sm:py-10" style={studioStyle}>
      {generatingConcept && <FullScreenGenerationOverlay workMode={workMode} />}
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
                tone="interior"
                compact
              />
              <div className="mt-3 flex items-center justify-between gap-3 px-1">
                <span className="text-xs font-bold text-[var(--text-secondary)]">{workMode === "guided" ? "Simple questions and a clear concept" : "Full fit-out, schedules and procurement package"}</span>
                <CreditPill credits={workMode === "professional" ? config.professionalCreditCost || 16 : config.creditCost} />
              </div>
            </div>
          </div>
        </section>

        {result ? (
          <InteriorWorkspaceNavigation activeTab={activeTab} workMode={workMode} result={result} onChange={selectWorkspaceTab} />
        ) : (
          <OnboardingNavigation step={step} steps={activeSteps} onChange={setStep} disabled={loading} />
        )}

        {error && <ErrorBanner message={error} />}

        {!result ? (
          <OnboardingWorkspace
            form={form}
            steps={activeSteps}
            architectureProjects={architectureProjects}
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
          <div className="mt-5">
            {activeTab === "overview" && (
              <OverviewSection result={result} assets={assets} workMode={workMode} onOpenTab={selectWorkspaceTab} onRegenerate={() => void generateConcept()} />
            )}
            {activeTab === "brief" && <BriefSection form={form} fields={allFields} architectureProjects={architectureProjects} />}
            {activeTab === "layout" && <LayoutSection value={result.layoutPlan} />}
            {activeTab === "materials" && <MaterialsSection result={result} location={sourcingMarket} />}
            {activeTab === "furniture" && <ProductDirectionSection domain="furniture" eyebrow="Furniture direction" title="Choose pieces by proportion, placement and function" icon={<Sofa size={21} />} value={result.furniturePlan} location={sourcingMarket} />}
            {activeTab === "lighting" && <ProductDirectionSection domain="lighting" eyebrow="Lighting strategy" title="Build ambient, task and accent lighting as one system" icon={<LampFloor size={21} />} value={result.lightingPlan} location={sourcingMarket} />}
            {activeTab === "plans" && (
              <PlansSection assets={assets} generating={generatingImage} approvingAssetId={approvingAssetId} onGenerate={(viewType, stage) => void generateImage(viewType, stage)} onApprove={(asset) => void approveAsset(asset)} onEnlarge={(image) => setLightbox(image)} onOpenProduction={() => selectWorkspaceTab("production")} />
            )}
            {activeTab === "visuals" && (
              <VisualsSection assets={assets} generating={generatingImage} approvingAssetId={approvingAssetId} spacePlanReady={spacePlanReady} mainSpaceReady={mainSpaceReady} onGenerate={(viewType, stage) => void generateImage(viewType, stage)} onApprove={(asset) => void approveAsset(asset)} onEnlarge={(image) => setLightbox(image)} onOpenPlans={() => selectWorkspaceTab("plans")} />
            )}
            {activeTab === "professional-pack" && <ProfessionalPackageSection value={result.professionalPackage} />}
            {activeTab === "design-pack" && (
              <DesignPackSection result={result} assets={assets} workMode={workMode} onDownload={downloadDesignPack} />
            )}
            {activeTab === "production" && (
              <ProductionPanel
                project={project}
                brand={{
                  project_brief: form,
                  connected_architecture: architectureProjects.find((item) => item.id === form.architectureProjectId) || null,
                  layout_plan: result.layoutPlan,
                  concept_plans: assets.filter((asset) => String(asset.asset_type || "").startsWith("interior_plan_")),
                  material_palette: result.materialPalette,
                  furniture_schedule: result.furniturePlan,
                  lighting_strategy: result.lightingPlan,
                  professional_package: result.professionalPackage,
                  approved_visuals: assets.filter((asset) => String(asset.asset_type || "").startsWith("interior_visual_") && isApprovedAsset(asset)),
                  all_generated_outputs: assets.filter((asset) => {
                    const type = String(asset.asset_type || "");
                    return type.startsWith("interior_plan_") || type.startsWith("interior_visual_");
                  }),
                  design_pack: { concept: result.conceptSummary, procurement: result.procurementPriorities, professional: result.professionalPackage },
                }}
                studio={config.databaseId}
                service={workMode === "professional" ? "Professional Interior Fit-Out Package" : config.productionService}
                serviceId={workMode === "professional" ? config.professionalProductionServiceId : config.productionServiceId}
                previewImage={mainVisual?.file_url || undefined}
                description={String(result.conceptSummary || "Interior concept package")}
                usage="Interior layout, material, furniture, lighting, procurement and visual development."
                expertNote={config.disclaimer}
                buttonLabel="Request Interior Production →"
              />
            )}
          </div>
        )}
      </PageContainer>
    </main>
  );
}

function OnboardingNavigation({
  step,
  steps,
  onChange,
  disabled,
}: {
  step: number;
  steps: Array<{ title: string; description: string; fields: StudioField[] }>;
  onChange: (step: number) => void;
  disabled: boolean;
}) {
  return (
    <GlassCard className="mt-5 p-3 sm:p-4">
      <div className={cx("grid gap-2", steps.length <= 2 ? "sm:grid-cols-3" : "sm:grid-cols-5")}>
        {[...steps.map((item) => item.title), "Your concept"].map((title, index) => {
          const active = index === step;
          const complete = index < step;
          return (
            <button
              key={title}
              type="button"
              onClick={() => {
                if (!disabled && index <= step && index < steps.length) onChange(index);
              }}
              className={cx(
                "flex min-h-14 items-center gap-3 rounded-2xl border px-3 text-left transition",
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_0_1px_var(--accent)]"
                  : "border-transparent hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]",
                index > step && "cursor-default opacity-55",
              )}
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black"
                style={{
                  background: complete || active ? config.accent : "var(--surface-hover)",
                  color: complete || active ? "white" : "var(--text-muted)",
                }}
              >
                {complete ? <Check size={14} /> : index + 1}
              </span>
              <span className="hidden min-w-0 text-xs font-black sm:block">{title}</span>
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}

function InteriorWorkspaceNavigation({
  activeTab,
  workMode,
  result,
  onChange,
}: {
  activeTab: WorkspaceTab;
  workMode: WorkMode;
  result: ResultData;
  onChange: (tab: WorkspaceTab) => void;
}) {
  const tabs = workspaceTabs(workMode, result);
  return (
    <GlassCard className="mt-5 overflow-x-auto p-2">
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cx(
              "rounded-2xl border px-4 py-3 text-xs font-black transition",
              activeTab === tab.id
                ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_22px_var(--accent-soft)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

function OnboardingWorkspace({
  form,
  steps,
  architectureProjects,
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
  architectureProjects: ArchitectureRecord[];
  workMode: WorkMode;
  step: number;
  progress: number;
  generating: boolean;
  onFieldChange: (id: string, value: string | string[]) => void;
  onBack: () => void;
  onContinue: () => void;
  onGenerate: () => void;
}) {
  const section = steps[step];
  const allFields = steps.flatMap((item) => item.fields);
  const conceptCredits = workMode === "professional" ? config.professionalCreditCost || 16 : config.creditCost;

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <GlassCard className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow>{workMode === "professional" ? "Professional mode" : "Guided mode"} · Step {step + 1} of {steps.length}</Eyebrow>
            <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">{section.title}</h2>
            <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">{section.description}</p>
          </div>
          <StatusPill tone="info">{progress}% complete</StatusPill>
        </div>

        {step === 0 && (
          <ArchitectureConnection
            form={form}
            projects={architectureProjects}
            onChange={onFieldChange}
          />
        )}

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {section.fields.map((field) => (
            <FieldControl
              key={field.id}
              field={field}
              value={form[field.id]}
              onChange={(value) => onFieldChange(field.id, value)}
            />
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
          <Button type="button" variant="secondary" disabled={step === 0 || generating} onClick={onBack}>
            <ArrowLeft size={15} /> Back
          </Button>
          {step === steps.length - 1 ? (
            <Button type="button" onClick={onGenerate} disabled={generating}>
              <Sparkles size={15} /> Generate {workMode === "professional" ? "professional package" : "concept"} · {conceptCredits} credits
            </Button>
          ) : (
            <Button type="button" onClick={onContinue} disabled={generating}>
              Continue <ArrowRight size={15} />
            </Button>
          )}
        </div>
      </GlassCard>

      <aside className="space-y-5 xl:sticky xl:top-[calc(var(--header-height)+20px)] xl:self-start">
        <GlassCard className="overflow-hidden p-0">
          <div className="p-5 text-white" style={{ background: `linear-gradient(135deg,${config.accent},#8c3d07)` }}>
            <p className="text-[.6rem] font-black uppercase tracking-[.17em] text-white/70">Project summary</p>
            <h3 className="mt-2 truncate text-xl font-black">{String(form.projectName || "Untitled project")}</h3>
            <p className="mt-1 text-xs font-semibold text-white/70">{workMode === "professional" ? "Professional fit-out package" : String(form.roomType || config.title)}</p>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between text-xs font-black">
              <span>Brief progress</span>
              <span style={{ color: config.accent }}>{progress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: config.accent }} />
            </div>
            <div className="mt-5 space-y-2">
              {allFields
                .filter((field) => !isEmpty(form[field.id]))
                .slice(0, 8)
                .map((field) => (
                  <div key={field.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <p className="text-[.55rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">{field.label}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-bold text-[var(--text-primary)]">
                      {Array.isArray(form[field.id]) ? (form[field.id] as string[]).join(", ") : String(form[field.id])}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-[.6rem] font-black uppercase tracking-[.16em] text-amber-600">Verification note</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{config.disclaimer}</p>
        </GlassCard>
      </aside>
    </div>
  );
}

function OverviewSection({
  result,
  assets,
  workMode,
  onOpenTab,
  onRegenerate,
}: {
  result: ResultData;
  assets: ProjectAsset[];
  workMode: WorkMode;
  onOpenTab: (tab: WorkspaceTab) => void;
  onRegenerate: () => void;
}) {
  const planCount = assets.filter((asset) => String(asset.asset_type || "").startsWith("interior_plan_")).length;
  const visualCount = assets.filter((asset) => String(asset.asset_type || "").startsWith("interior_visual_")).length;
  const approvedCount = assets.filter(isApprovedAsset).length;
  const conceptCredits = workMode === "professional" ? config.professionalCreditCost || 16 : config.creditCost;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.6fr)]">
      <GlassCard className="p-6 sm:p-8">
        <Eyebrow>{workMode === "professional" ? "Professional interior package" : "Interior concept"}</Eyebrow>
        <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">A connected interior workspace, not a disconnected prompt</h2>
        <div className="mt-5 text-sm font-semibold leading-7 text-[var(--text-secondary)]">
          <RenderValue value={result.conceptSummary} />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <MetricCard label="Plans" value={`${planCount} versions`} />
          <MetricCard label="Products" value={`${(Array.isArray(result.materialPalette) ? result.materialPalette.length : 0) + (Array.isArray(result.furniturePlan) ? result.furniturePlan.length : 0) + (Array.isArray(result.lightingPlan) ? result.lightingPlan.length : 0)} suggestions`} />
          <MetricCard label="Visuals" value={`${visualCount} versions`} />
          <MetricCard label="Approved" value={`${approvedCount} outputs`} />
        </div>
        <div className="mt-7 flex flex-wrap gap-3 border-t border-[var(--border)] pt-5">
          <Button onClick={() => onOpenTab("plans")}>
            <Ruler size={15} /> Open plans
          </Button>
          <Button variant="secondary" onClick={() => onOpenTab("visuals")}>
            <ImageIcon size={15} /> Open visuals
          </Button>
          {workMode === "professional" && result.professionalPackage && (
            <Button variant="secondary" onClick={() => onOpenTab("professional-pack")}>
              <BriefcaseBusiness size={15} /> Open professional pack
            </Button>
          )}
          <Button variant="secondary" onClick={onRegenerate}>
            <RefreshCcw size={15} /> Regenerate {workMode === "professional" ? "package" : "concept"} · {conceptCredits} credits
          </Button>
        </div>
      </GlassCard>
      <GlassCard className="p-6">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          <WandSparkles size={22} />
        </div>
        <h3 className="mt-5 text-xl font-black">Design direction</h3>
        <div className="mt-4 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
          <RenderValue value={result.designDirection} />
        </div>
      </GlassCard>
    </div>
  );
}

function BriefSection({
  form,
  fields,
  architectureProjects,
}: {
  form: FormState;
  fields: StudioField[];
  architectureProjects: ArchitectureRecord[];
}) {
  const connectedArchitecture = architectureProjects.find((item) => item.id === form.architectureProjectId);
  return (
    <GlassCard className="p-6 sm:p-8">
      <Eyebrow>Saved project brief</Eyebrow>
      <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">The source used by every interior section</h2>
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5 md:col-span-2">
          <p className="text-[.6rem] font-black uppercase tracking-[.15em] text-[var(--accent-strong)]">Architecture connection</p>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--text-primary)]">
            {connectedArchitecture
              ? `${connectedArchitecture.project_name || "Architecture project"}${connectedArchitecture.architectural_style ? ` · ${connectedArchitecture.architectural_style}` : ""}${connectedArchitecture.city || connectedArchitecture.country ? ` · ${[connectedArchitecture.city, connectedArchitecture.country].filter(Boolean).join(", ")}` : ""}`
              : String(form.architectureSource || "Standalone interior project")}
          </p>
        </div>
        {fields.map((field) => (
          <div key={field.id} className={cx("rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5", (field.type === "textarea" || field.type === "multiselect") && "md:col-span-2")}>
            <p className="text-[.6rem] font-black uppercase tracking-[.15em] text-[var(--text-muted)]">{field.label}</p>
            <p className="mt-2 text-sm font-bold leading-6 text-[var(--text-primary)]">
              {Array.isArray(form[field.id]) ? (form[field.id] as string[]).join(", ") : String(form[field.id] || "Not added")}
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function ContentSection({ eyebrow, title, icon, value }: { eyebrow: string; title: string; icon: ReactNode; value: unknown }) {
  return (
    <GlassCard className="p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">{icon}</span>
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">{title}</h2>
        </div>
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <RenderCards value={value} />
      </div>
    </GlassCard>
  );
}

function LayoutSection({ value }: { value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const items = normaliseLayoutPriorities(value);
  const visibleItems = expanded ? items : items.slice(0, 6);

  return (
    <GlassCard className="p-6 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><LayoutDashboard size={21} /></span>
          <div>
            <Eyebrow>Layout & zoning</Eyebrow>
            <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">The plan in a few clear decisions</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">
              Review the key room relationships first. Expand the full strategy only when you need the detailed reasoning.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3 text-right">
          <p className="text-2xl font-black text-[var(--accent-strong)]">{items.length}</p>
          <p className="text-[.6rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">Spatial priorities</p>
        </div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((item, index) => (
          <article key={`${item}-${index}`} title={item} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[.65rem] font-black text-[var(--accent-strong)]">{String(index + 1).padStart(2, "0")}</span>
              <p className="text-sm font-bold leading-6 text-[var(--text-primary)]">{compactLayoutPriority(item)}</p>
            </div>
          </article>
        ))}
      </div>

      {items.length > 6 && (
        <div className="mt-5 flex justify-center">
          <button type="button" onClick={() => setExpanded((current) => !current)} className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-2.5 text-xs font-black text-[var(--accent-strong)] transition hover:border-[var(--accent)]">
            {expanded ? "Show less" : `Show all ${items.length} priorities`}
          </button>
        </div>
      )}
    </GlassCard>
  );
}

function MaterialsSection({ result, location }: { result: ResultData; location: string }) {
  return (
    <div className="space-y-5">
      <ContentSection eyebrow="Materials & finishes" title="Coordinate finishes by use, tone and performance" icon={<Palette size={21} />} value={result.materialPalette} />
      <ProductRecommendationGrid domain="materials" value={result.materialPalette} location={location} />
      <GlassCard className="p-6 sm:p-8">
        <Eyebrow>Colour palette</Eyebrow>
        <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Use colour as part of the material system</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Array.isArray(result.colorPalette) ? result.colorPalette : []).map((item, index) => {
            const entry = item && typeof item === "object" ? (item as Record<string, unknown>) : { name: String(item) };
            const hex = String(entry.hex || "#d8c1a2");
            return (
              <div key={index} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="h-28" style={{ background: hex }} />
                <div className="p-4">
                  <p className="text-sm font-black">{String(entry.name || "Colour")}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">{hex}</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{String(entry.role || "Project accent")}</p>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

function ProductDirectionSection({
  domain,
  eyebrow,
  title,
  icon,
  value,
  location,
}: {
  domain: "furniture" | "lighting";
  eyebrow: string;
  title: string;
  icon: ReactNode;
  value: unknown;
  location: string;
}) {
  return (
    <div className="space-y-5">
      <ContentSection eyebrow={eyebrow} title={title} icon={icon} value={value} />
      <ProductRecommendationGrid domain={domain} value={value} location={location} />
    </div>
  );
}

function ProductRecommendationGrid({
  domain,
  value,
  location,
}: {
  domain: "materials" | "furniture" | "lighting";
  value: unknown;
  location: string;
}) {
  const items = normaliseProductRecommendations(value, domain);
  const [market, setMarket] = useState(location || "");
  useEffect(() => { if (location) setMarket(location); }, [location]);
  const label = domain === "materials" ? "Material sourcing" : domain === "furniture" ? "Furniture sourcing" : "Lighting sourcing";
  const title = domain === "materials"
    ? "Finish sourcing schedule"
    : domain === "furniture"
      ? "Furniture sourcing schedule"
      : "Lighting sourcing schedule";

  return (
    <GlassCard className="p-6 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            {domain === "materials" ? <Layers3 size={21} /> : domain === "furniture" ? <Armchair size={21} /> : <LampFloor size={21} />}
          </span>
          <div>
            <Eyebrow>{label}</Eyebrow>
            <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">
              Heyy Studio now builds each sourcing link from the exact item, finish/specification and selected market instead of sending a broad generic search. Live stock and retailer pricing are still supplier-controlled, so verify dimensions, finish, availability and delivery before purchase.
            </p>
          </div>
        </div>
        <label className="min-w-[240px] text-[.62rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">
          <span className="flex items-center gap-2"><MapPin size={13} /> Sourcing market</span>
          <input
            value={market}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setMarket(event.target.value)}
            placeholder="e.g. New York, United States"
            className="heyy-form-field mt-2"
          />
        </label>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {items.map((item, index) => {
          const query = preciseSourcingQuery(item, domain, market);
          const DomainIcon = domain === "materials" ? Layers3 : domain === "furniture" ? Armchair : LampFloor;
          return (
            <article key={`${item.name}-${index}`} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <DomainIcon size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[.6rem] font-black uppercase tracking-[.15em] text-[var(--accent-strong)]">{item.category}</p>
                    {item.quantity && <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[.6rem] font-black text-[var(--accent-strong)]">Qty {item.quantity}</span>}
                  </div>
                  <h3 className="mt-2 text-lg font-black text-[var(--text-primary)]">{item.name}</h3>
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{item.description}</p>
              {item.specification && <p className="mt-3 rounded-xl bg-[var(--surface-hover)] p-3 text-xs font-bold text-[var(--text-primary)]">{item.specification}</p>}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a href={shoppingSearchUrl(query, market)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-xs font-black text-white transition hover:-translate-y-0.5 hover:brightness-95">
                  <ExternalLink size={13} /> Search exact spec
                </a>
                <a href={retailerSearchUrl(query, market)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-xs font-black text-[var(--text-primary)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
                  Local suppliers
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </GlassCard>
  );
}

function PlansSection({
  assets,
  generating,
  approvingAssetId,
  onGenerate,
  onApprove,
  onEnlarge,
  onOpenProduction,
}: {
  assets: ProjectAsset[];
  generating: GenerationTarget;
  approvingAssetId: string | null;
  onGenerate: (viewType: PlanType, stage: GenerationStage) => void;
  onApprove: (asset: ProjectAsset) => void;
  onEnlarge: (image: { url: string; title: string }) => void;
  onOpenProduction: () => void;
}) {
  const spacePlanApproved = isAnyStageApproved(assets, "space_plan");
  return (
    <GlassCard className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>Interior plans</Eyebrow>
          <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Generate, approve, then keep developing</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">
            Generate the Furniture & Space Plan, approve it as the project source, then continue to the connected furniture plan, lighting plan and visuals. If you need dimensioned drawings, CAD or editable technical files, send the approved concept to Production.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreditPill credits={12} label="preview" />
          <CreditPill credits={24} label="final" />
        </div>
      </div>

      {spacePlanApproved && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
          <div>
            <p className="text-sm font-black text-[var(--text-primary)]">Need real technical files?</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">Send the approved plan to Heyy Studio Production for dimensioned drawings, CAD/editable files and professionally verified documentation.</p>
          </div>
          <Button type="button" variant="secondary" onClick={onOpenProduction}><PackageCheck size={15} /> Prepare technical files</Button>
        </div>
      )}

      <div className="mt-7 grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {PLAN_VIEWS.map((plan) => {
          const dependency = plan.id !== "space_plan" && !spacePlanApproved
            ? "Generate and approve the Furniture & Space Plan first."
            : undefined;
          return (
            <InteriorWorkflowCard
              key={plan.id}
              viewType={plan.id}
              kind="plan"
              title={plan.title}
              description={plan.description}
              assets={assets}
              generating={generating}
              approvingAssetId={approvingAssetId}
              dependencyMessage={dependency}
              onGenerate={(stage) => onGenerate(plan.id, stage)}
              onApprove={onApprove}
              onEnlarge={onEnlarge}
            />
          );
        })}
      </div>
    </GlassCard>
  );
}

function VisualsSection({
  assets,
  generating,
  approvingAssetId,
  spacePlanReady,
  mainSpaceReady,
  onGenerate,
  onApprove,
  onEnlarge,
  onOpenPlans,
}: {
  assets: ProjectAsset[];
  generating: GenerationTarget;
  approvingAssetId: string | null;
  spacePlanReady: boolean;
  mainSpaceReady: boolean;
  onGenerate: (viewType: VisualType, stage: GenerationStage) => void;
  onApprove: (asset: ProjectAsset) => void;
  onEnlarge: (image: { url: string; title: string }) => void;
  onOpenPlans: () => void;
}) {
  return (
    <GlassCard className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>Interior visuals</Eyebrow>
          <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Create visuals from the approved space plan</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">
            As soon as the Furniture & Space Plan is approved, the connected interior visuals unlock. Professional Final remains an optional higher-quality output rather than a required step.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreditPill credits={12} label="preview" />
          <CreditPill credits={24} label="final" />
        </div>
      </div>

      {!spacePlanReady ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300/60 bg-amber-500/10 p-4">
          <div>
            <p className="text-sm font-black text-amber-800 dark:text-amber-200">Approve the Furniture & Space Plan first</p>
            <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">The approved plan becomes the fixed geometry source for the visual project.</p>
          </div>
          <Button type="button" variant="secondary" onClick={onOpenPlans}><Ruler size={15} /> Open plans</Button>
        </div>
      ) : !mainSpaceReady ? (
        <div className="mt-6 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
          <p className="text-sm font-black text-[var(--text-primary)]">Create and approve the Main Space Perspective next</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">
            This first approved render becomes the project&apos;s visual anchor. Every other angle, detail, daylight and evening view will preserve its furniture, joinery, materials and lighting system.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-emerald-300/60 bg-emerald-500/10 p-4">
          <p className="text-sm font-black text-emerald-800 dark:text-emerald-200">Project visual anchor locked</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-emerald-700 dark:text-emerald-300">
            New views are generated from the approved plan and approved Main Space Perspective so the project stays visually consistent.
          </p>
        </div>
      )}

      <div className="mt-7 grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {VISUALS.map((visual) => {
          const dependency = !spacePlanReady
            ? "Generate and approve the Furniture & Space Plan first."
            : visual.id !== "main_space" && !mainSpaceReady
              ? "Generate and approve the Main Space Perspective first. It becomes the visual anchor for every other view."
              : undefined;
          return (
            <InteriorWorkflowCard
              key={visual.id}
              viewType={visual.id}
              kind="visual"
              title={visual.title}
              description={visual.description}
              assets={assets}
              generating={generating}
              approvingAssetId={approvingAssetId}
              dependencyMessage={dependency}
              onGenerate={(stage) => onGenerate(visual.id, stage)}
              onApprove={onApprove}
              onEnlarge={onEnlarge}
            />
          );
        })}
      </div>
    </GlassCard>
  );
}

function InteriorWorkflowCard({
  viewType,
  kind,
  title,
  description,
  assets,
  generating,
  approvingAssetId,
  dependencyMessage,
  onGenerate,
  onApprove,
  onEnlarge,
}: {
  viewType: InteriorImageType;
  kind: "plan" | "visual";
  title: string;
  description: string;
  assets: ProjectAsset[];
  generating: GenerationTarget;
  approvingAssetId: string | null;
  dependencyMessage?: string;
  onGenerate: (stage: GenerationStage) => void;
  onApprove: (asset: ProjectAsset) => void;
  onEnlarge: (image: { url: string; title: string }) => void;
}) {
  const stages: GenerationStage[] = ["preview", "final"];
  const initialStage = [...stages].reverse().find((stage) => Boolean(getInteriorAsset(assets, viewType, stage))) || stages[0];
  const [selectedStage, setSelectedStage] = useState<GenerationStage>(initialStage);
  useEffect(() => {
    const best = [...stages].reverse().find((stage) => Boolean(getInteriorAsset(assets, viewType, stage)));
    if (best && !getInteriorAsset(assets, viewType, selectedStage)) setSelectedStage(best);
  }, [assets, viewType]);

  const asset = getInteriorAsset(assets, viewType, selectedStage);
  const imageUrl = asset?.file_url || asset?.thumbnail_url || "";
  const approvedAsset = stages
    .map((stage) => getInteriorAsset(assets, viewType, stage))
    .find((candidate): candidate is ProjectAsset => Boolean(candidate && isApprovedAsset(candidate)));
  const selectedStageApproved = Boolean(asset && isApprovedAsset(asset));
  const isMainVisualAnchor = kind === "visual" && viewType === "main_space";
  const stageDependency = dependencyMessage;
  const isGenerating = generating?.viewType === viewType && generating.stage === selectedStage;
  const disabled = Boolean(generating) || Boolean(stageDependency);
  const cost = selectedStage === "preview" ? 12 : 24;

  return (
    <article className={cx("overflow-hidden rounded-3xl border bg-[var(--surface)]", approvedAsset ? "border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,.4)]" : "border-[var(--border)]")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] p-3">
        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-1">
          {stages.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => setSelectedStage(stage)}
              className={cx("rounded-lg px-3 py-2 text-[.62rem] font-black transition", selectedStage === stage ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]")}
            >
              {stage === "preview" ? "Preview" : "Final"}
            </button>
          ))}
        </div>
        {approvedAsset && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-[.62rem] font-black text-emerald-600"><CheckCircle2 size={13} /> {isMainVisualAnchor ? "Visual anchor" : "Approved source"}: {stageName(assetStage(approvedAsset, viewType))}</span>}
      </div>

      <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-[var(--surface-hover)]">
        {imageUrl ? (
          <>
            <img src={imageUrl} alt={`${title} ${selectedStage}`} className={cx("h-full w-full", kind === "plan" ? "object-contain p-3" : "object-cover")} />
            <button type="button" onClick={() => onEnlarge({ url: imageUrl, title: `${title} — ${stageName(selectedStage)}` })} className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-xl border border-white/45 bg-black/55 px-3 py-2 text-[.65rem] font-black text-white backdrop-blur-md transition hover:bg-black/75">
              <Maximize2 size={13} /> Enlarge
            </button>
          </>
        ) : (
          <div className="px-6 text-center">
            <ImageIcon size={30} className="mx-auto text-[var(--accent-strong)]" />
            <p className="mt-4 text-sm font-black">{stageName(selectedStage)} not generated</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-muted)]">This stage will use the previous approved project information.</p>
          </div>
        )}
        {isGenerating && <ImageCardLoading title={`${title} — ${stageName(selectedStage)}`} />}
      </div>

      <div className="p-5">
        <p className="text-lg font-black">{title}</p>
        <p className="mt-2 min-h-10 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{description}</p>
        {stageDependency && <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-[.68rem] font-bold leading-5 text-amber-700 dark:text-amber-300">{stageDependency}</p>}
        <div className="mt-5 grid gap-2 2xl:grid-cols-2">
          <Button className="w-full" onClick={() => onGenerate(selectedStage)} disabled={disabled}>
            {imageUrl ? <RefreshCcw size={15} /> : <Sparkles size={15} />} {kind === "plan"
              ? `${imageUrl ? "Regenerate" : "Generate"} ${selectedStage === "preview" ? "Plan Preview" : "Professional Final"} · ${cost} credits`
              : `${imageUrl ? "Regenerate" : "Generate"} ${stageName(selectedStage)} · ${cost} credits`}
          </Button>
          {asset && (
            <Button className="w-full" variant={selectedStageApproved ? "secondary" : "primary"} onClick={() => onApprove(asset)} disabled={selectedStageApproved || approvingAssetId === asset.id || Boolean(generating)}>
              {approvingAssetId === asset.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {selectedStageApproved
                ? isMainVisualAnchor ? "Visual anchor approved" : "Approved source"
                : kind === "plan" ? "Approve plan" : isMainVisualAnchor ? "Approve as visual anchor" : `Approve ${stageName(selectedStage)}`}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function ImageCardLoading({ title }: { title: string }) {
  return (
    <StudioLoader
      tone="interior"
      title={`Generating ${title}`}
      detail="Preserving the approved layout, materials, furniture and lighting."
      variant="overlay"
    />
  );
}

function ProfessionalPackageSection({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") {
    return (
      <GlassCard className="p-8 text-center">
        <BriefcaseBusiness size={34} className="mx-auto text-[var(--accent-strong)]" />
        <h2 className="mt-4 text-2xl font-black">Professional package not generated</h2>
        <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">Switch to Professional Mode and regenerate the project to create schedules, quantities, procurement registers and the delivery plan.</p>
      </GlassCard>
    );
  }
  const pack = value as Record<string, unknown>;
  const overview = pack.proposalOverview && typeof pack.proposalOverview === "object" ? pack.proposalOverview as Record<string, unknown> : {};
  const sections = [
    { key: "executionLogic", title: "Plan of work", icon: <ClipboardCheck size={20} /> },
    { key: "masterTimeline", title: "Master timeline", icon: <CalendarRange size={20} /> },
    { key: "deliveryMilestones", title: "Delivery milestones", icon: <CheckCircle2 size={20} /> },
    { key: "procurementStrategy", title: "Procurement strategy", icon: <ShoppingBag size={20} /> },
    { key: "procurementRegisters", title: "Floor-by-floor procurement registers", icon: <PackageCheck size={20} /> },
    { key: "laborAndFixedWorks", title: "Labour and fixed works", icon: <BriefcaseBusiness size={20} /> },
    { key: "finishQuantitySummary", title: "Finish quantity summary", icon: <Ruler size={20} /> },
    { key: "areaSchedule", title: "Area schedule", icon: <LayoutDashboard size={20} /> },
    { key: "wetAreaTakeoff", title: "Wet-area tile take-off", icon: <Layers3 size={20} /> },
    { key: "woodFlooringQuantities", title: "Wood-floor quantities", icon: <Layers3 size={20} /> },
    { key: "furnitureSchedule", title: "Furniture schedule and dimensions", icon: <Armchair size={20} /> },
    { key: "lightingSchedule", title: "Lighting schedule", icon: <LampFloor size={20} /> },
    { key: "sanitarySchedule", title: "Sanitary schedule", icon: <FileText size={20} /> },
    { key: "applianceSchedule", title: "Appliance schedule", icon: <FileText size={20} /> },
    { key: "joinerySchedule", title: "Joinery and fixed fit-out schedule", icon: <Ruler size={20} /> },
    { key: "closeoutPlan", title: "Close-out and handover", icon: <ClipboardCheck size={20} /> },
  ];

  return (
    <div className="space-y-5">
      <GlassCard className="p-6 sm:p-8">
        <Eyebrow>Professional interior fit-out package</Eyebrow>
        <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">From design intent to procurement and delivery control</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">This section follows the structure of a professional client proposal: scope snapshot, work programme, procurement registers, quantities, schedules, dimensions and close-out controls.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Project duration" value={String(overview.projectDuration || "To confirm")} />
          <MetricCard label="Floors covered" value={String(overview.floorsCovered || "To confirm")} />
          <MetricCard label="Key trades" value={`${Array.isArray(overview.keyTrades) ? overview.keyTrades.length : 0} packages`} />
          <MetricCard label="Procurement tracks" value={`${Array.isArray(overview.procurementTracks) ? overview.procurementTracks.length : 0} tracks`} />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ResultCard index={0} title="Proposal intent" value={overview.intent || []} />
          <ResultCard index={1} title="Assumptions" value={overview.assumptions || []} />
        </div>
      </GlassCard>

      {sections.map((section, index) => {
        const sectionValue = pack[section.key];
        if (!sectionValue) return null;
        return (
          <GlassCard key={section.key} className="p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">{section.icon}</span>
              <div>
                <Eyebrow>Section {String(index + 1).padStart(2, "0")}</Eyebrow>
                <h3 className="mt-1 text-2xl font-black">{section.title}</h3>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><RenderCards value={sectionValue} /></div>
          </GlassCard>
        );
      })}
      <div className="rounded-2xl border border-amber-300/50 bg-amber-500/10 p-4 text-xs font-semibold leading-5 text-amber-800 dark:text-amber-200">{config.disclaimer}</div>
    </div>
  );
}

function DesignPackSection({ result, assets, workMode, onDownload }: { result: ResultData; assets: ProjectAsset[]; workMode: WorkMode; onDownload: () => void }) {
  const approvedPlans = PLAN_VIEWS.filter((plan) => isAnyStageApproved(assets, plan.id)).length;
  const approvedVisuals = VISUALS.filter((visual) => isAnyStageApproved(assets, visual.id)).length;
  return (
    <GlassCard className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <Eyebrow>Interior design pack</Eyebrow>
          <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Compile the project into one connected package</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">The pack includes the brief, layout, products, approved plans and visuals{workMode === "professional" ? ", procurement registers, quantities, dimensions, programme and close-out plan" : ""}.</p>
        </div>
        <Button onClick={onDownload}>
          <Download size={15} /> Download project data
        </Button>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <PackStatus label="Concept strategy" ready={Boolean(result.conceptSummary)} />
        <PackStatus label={`Approved plans ${approvedPlans}/${PLAN_VIEWS.length}`} ready={approvedPlans === PLAN_VIEWS.length} />
        <PackStatus label="Material & product schedule" ready={Array.isArray(result.materialPalette) && result.materialPalette.length > 0} />
        <PackStatus label={`Approved visuals ${approvedVisuals}/${VISUALS.length}`} ready={approvedVisuals === VISUALS.length} />
        <PackStatus label="Professional package" ready={workMode !== "professional" || Boolean(result.professionalPackage)} />
      </div>
      <div className="mt-5 rounded-2xl border border-amber-300/50 bg-amber-500/10 p-4 text-xs font-semibold leading-5 text-amber-800 dark:text-amber-200">{config.disclaimer}</div>
    </GlassCard>
  );
}

function FullScreenGenerationOverlay({ workMode }: { workMode: WorkMode }) {
  const steps = workMode === "professional"
    ? [
        "Structuring the space, scope and visual intent",
        "Building procurement and fit-out schedules",
        "Preparing quantities, dimensions and delivery controls",
        "Saving the professional interior workspace",
      ]
    : [
        "Structuring the space and circulation",
        "Coordinating materials and colour",
        "Building furniture and lighting direction",
        "Saving the connected interior workspace",
      ];
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    setActiveStep(0);
    const timer = window.setInterval(() => setActiveStep((current) => Math.min(steps.length - 1, current + 1)), 3200);
    return () => window.clearInterval(timer);
  }, [workMode, steps.length]);

  return (
    <StudioLoader
      tone="interior"
      eyebrow="Interior Studio is preparing"
      title={steps[activeStep]}
      detail="Generation continues safely in the background if you leave this page. Reserved credits are automatically returned if generation fails."
      steps={steps}
      activeStep={activeStep}
      variant="fullscreen"
    />
  );
}

function ImageLightbox({ image, onClose }: { image: { url: string; title: string }; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[450] flex items-center justify-center bg-black/88 p-4 backdrop-blur-lg" role="dialog" aria-modal="true" aria-label={image.title} onClick={onClose}>
      <div className="relative flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0d0b11] shadow-2xl" onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close enlarged image" className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/65 text-white backdrop-blur-md transition hover:bg-black">
          <X size={20} />
        </button>
        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          <img src={image.url} alt={image.title} className="mx-auto max-h-[82vh] max-w-full object-contain" />
        </div>
        <div className="border-t border-white/10 px-6 py-4 text-sm font-black text-white">{image.title}</div>
      </div>
    </div>
  );
}

function ArchitectureConnection({
  form,
  projects,
  onChange,
}: {
  form: FormState;
  projects: ArchitectureRecord[];
  onChange: (id: string, value: string | string[]) => void;
}) {
  const options = projects.map((project) => ({
    value: project.id,
    label: `${project.project_name || "Untitled Architecture project"}${project.project_type ? ` · ${project.project_type}` : ""}${project.city || project.country ? ` · ${[project.city, project.country].filter(Boolean).join(", ")}` : ""}`,
  }));
  return (
    <div className="mt-7 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-strong)] text-[var(--accent-strong)]"><Building2 size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[var(--text-primary)]">Connect this interior to the Architecture project</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">The selected building brief, room programme, approved direction, materials, plans and openings become the fixed architectural context for the interior.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <HeyySelect
              value={String(form.architectureSource || "Start as a standalone interior project")}
              tone="interior"
              ariaLabel="Architecture source"
              options={["Use an existing Architecture project", "Start as a standalone interior project", "Upload plans later"]}
              onChange={(value: string) => {
                onChange("architectureSource", value);
                if (value !== "Use an existing Architecture project") onChange("architectureProjectId", "");
              }}
            />
            {form.architectureSource === "Use an existing Architecture project" ? (
              <HeyySelect
                value={String(form.architectureProjectId || "")}
                tone="interior"
                ariaLabel="Saved Architecture project"
                placeholder={projects.length ? "Choose an Architecture project" : "No Architecture projects found"}
                options={options}
                disabled={!projects.length}
                onChange={(value: string) => onChange("architectureProjectId", value)}
              />
            ) : (
              <div className="flex min-h-12 items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--text-muted)]">The interior can be linked to an Architecture project later.</div>
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
      <label className="text-[.65rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">
        {field.label}
        {field.required && <span className="ml-1 text-[var(--accent-strong)]">*</span>}
      </label>
      {field.helper && <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">{field.helper}</p>}
      {field.type === "textarea" ? (
        <textarea value={String(value || "")} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)} placeholder={field.placeholder} rows={4} className="heyy-form-field mt-2 resize-y" />
      ) : field.type === "select" ? (
        <div className="mt-2">
          <HeyySelect value={String(value || "")} tone="interior" ariaLabel={field.label} placeholder="Select an option" options={field.options || []} onChange={(next) => onChange(next)} />
        </div>
      ) : field.type === "multiselect" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {field.options?.map((option) => {
            const current = Array.isArray(value) ? value : [];
            const active = current.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(active ? current.filter((item) => item !== option) : [...current, option])}
                className={cx(
                  "rounded-full border px-3.5 py-2 text-xs font-black transition",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_20px_var(--accent-soft)]"
                    : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]",
                )}
              >
                {active && <Check size={12} className="mr-1 inline" />}
                {option}
              </button>
            );
          })}
        </div>
      ) : (
        <input value={String(value || "")} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} placeholder={field.placeholder} className="heyy-form-field mt-2" />
      )}
    </div>
  );
}

function RenderCards({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return <>{value.map((item, index) => <ResultCard key={index} index={index} value={item} />)}</>;
  }
  if (value && typeof value === "object") {
    return <>{Object.entries(value as Record<string, unknown>).map(([key, item], index) => <ResultCard key={key} index={index} title={humanize(key)} value={item} />)}</>;
  }
  return <ResultCard index={0} value={value} />;
}

function ResultCard({ index, title, value }: { index: number; title?: string; value: unknown }) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--accent-soft)] text-xs font-black text-[var(--accent-strong)]">{String(index + 1).padStart(2, "0")}</span>
        {title && <p className="text-[.6rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">{title}</p>}
      </div>
      <div className="mt-4 text-sm font-semibold leading-6 text-[var(--text-secondary)]"><RenderValue value={value} /></div>
    </article>
  );
}

function RenderValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-2">
        {value.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
            <span>{typeof item === "string" ? item : formatObject(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (value && typeof value === "object") {
    return (
      <div className="space-y-2">
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key} className="rounded-xl bg-[var(--surface-hover)] p-3">
            <p className="text-[.58rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">{humanize(key)}</p>
            <p className="mt-1 text-xs font-bold text-[var(--text-primary)]">{Array.isArray(item) ? item.join(", ") : String(item || "—")}</p>
          </div>
        ))}
      </div>
    );
  }
  return <p>{String(value || "Not generated")}</p>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[.58rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-sm font-black text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function PackStatus({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <span className={cx("grid h-9 w-9 place-items-center rounded-xl", ready ? "bg-emerald-500/15 text-emerald-600" : "bg-[var(--surface-hover)] text-[var(--text-muted)]")}>
        {ready ? <CheckCircle2 size={17} /> : <PackageCheck size={17} />}
      </span>
      <p className="text-xs font-black text-[var(--text-primary)]">{label}</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return <div className="mt-5 rounded-2xl border border-red-300/60 bg-red-500/10 p-4 text-sm font-bold text-red-700 dark:text-red-200">{message}</div>;
}

function getInteriorAsset(assets: ProjectAsset[], viewType: InteriorImageType, stage?: GenerationStage) {
  return assets.find((asset) => {
    const metadataType = String(asset.metadata?.view_type || "");
    const assetType = String(asset.asset_type || "");
    const matchesType = metadataType === viewType || assetType.includes(`_${viewType}`);
    if (!matchesType) return false;
    if (!stage) return true;
    return assetStage(asset, viewType) === stage;
  });
}

function assetStage(asset: ProjectAsset, viewType?: InteriorImageType): GenerationStage {
  const metadataStage = String(asset.metadata?.stage || "");
  if (metadataStage === "technical" || metadataStage === "preview" || metadataStage === "final") return metadataStage;
  const assetType = String(asset.asset_type || "");
  if (assetType.endsWith("_technical")) return "technical";
  if (assetType.endsWith("_final")) return "final";
  if (assetType.endsWith("_preview")) return "preview";
  const inferredType = viewType || String(asset.metadata?.view_type || "");
  return inferredType.endsWith("_plan") || assetType.startsWith("interior_plan_") ? "technical" : "preview";
}

function isApprovedAsset(asset: ProjectAsset) {
  return asset.metadata?.approved === true || asset.metadata?.approved === "true";
}

function isAssetApproved(assets: ProjectAsset[], viewType: InteriorImageType, stage: GenerationStage) {
  const asset = getInteriorAsset(assets, viewType, stage);
  return Boolean(asset && isApprovedAsset(asset));
}

function isAnyStageApproved(assets: ProjectAsset[], viewType: InteriorImageType) {
  return (["technical", "preview", "final"] as GenerationStage[]).some((stage) => isAssetApproved(assets, viewType, stage));
}

function stageName(stage: GenerationStage) {
  return stage === "technical" ? "Technical" : stage === "preview" ? "Preview" : "Professional Final";
}

type ProductReference = {
  name: string;
  category: string;
  description: string;
  specification: string;
  searchQuery: string;
  imageSearchQuery: string;
  quantity: string;
};

function normaliseProductRecommendations(value: unknown, domain: "materials" | "furniture" | "lighting"): ProductReference[] {
  const fallback = domain === "materials"
    ? ["Natural stone finish", "Warm timber finish", "Brushed metal accent"]
    : domain === "furniture"
      ? ["Primary sofa", "Feature chair", "Dining or coffee table"]
      : ["Ambient downlight system", "Decorative pendant", "Task or accent light"];
  const source = Array.isArray(value) && value.length ? value : fallback;
  return source.slice(0, 12).map((item, index) => {
    if (item && typeof item === "object") {
      const entry = item as Record<string, unknown>;
      const name = String(entry.item || entry.material || entry.fixture || entry.layer || entry.name || `${humanize(domain)} item ${index + 1}`);
      const specification = String(entry.proportion || entry.indicativeDimensions || entry.finish || entry.temperature || entry.recommendation || entry.use || "");
      const description = String(entry.notes || entry.reason || entry.placement || entry.recommendation || entry.use || "Selected to support the approved interior direction.");
      const searchQuery = String(entry.searchQuery || entry.search_query || `${name} ${specification}`).trim();
      const imageSearchQuery = String(entry.imageSearchQuery || entry.image_search_query || `${name} product photography`).trim();
      const category = String(entry.category || (domain === "materials" ? "Material" : domain === "furniture" ? "Furniture" : "Lighting"));
      const quantity = String(entry.quantity || "");
      return { name, category, description, specification, searchQuery, imageSearchQuery, quantity };
    }
    return {
      name: String(item),
      category: domain === "materials" ? "Material" : domain === "furniture" ? "Furniture" : "Lighting",
      description: "Reference product aligned with the approved interior concept.",
      specification: "Verify exact dimensions, finish, availability and delivery before purchase.",
      searchQuery: String(item),
      imageSearchQuery: `${String(item)} product photograph`,
      quantity: "",
    };
  });
}

function preciseSourcingQuery(item: ProductReference, domain: "materials" | "furniture" | "lighting", market: string) {
  const parts = [
    item.name ? `"${item.name}"` : "",
    item.specification,
    domain === "materials" ? "material finish" : domain === "lighting" ? "lighting fixture" : "furniture",
    market,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").slice(0, 260);
}

function shoppingSearchUrl(query: string, market: string) {
  const gl = countryCodeFromMarket(market);
  const params = new URLSearchParams({ tbm: "shop", q: query, hl: "en" });
  if (gl) params.set("gl", gl);
  return `https://www.google.com/search?${params.toString()}`;
}

function retailerSearchUrl(query: string, market: string) {
  const localQuery = [query, "supplier showroom", market].filter(Boolean).join(" ");
  const params = new URLSearchParams({ api: "1", query: localQuery });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function countryCodeFromMarket(market: string) {
  const value = market.toLowerCase();
  const mappings: Array<[RegExp, string]> = [
    [/united states|usa|new york|los angeles|miami|chicago/, "US"],
    [/lebanon|beirut|koura|tripoli/, "LB"],
    [/australia|melbourne|sydney|brisbane/, "AU"],
    [/united arab emirates|uae|dubai|abu dhabi/, "AE"],
    [/united kingdom|uk|london|england/, "GB"],
    [/germany|berlin|munich/, "DE"],
    [/france|paris/, "FR"],
    [/italy|milan|rome/, "IT"],
    [/canada|toronto|vancouver/, "CA"],
    [/saudi|riyadh|jeddah/, "SA"],
    [/qatar|doha/, "QA"],
    [/nigeria|lagos/, "NG"],
  ];
  return mappings.find(([pattern]) => pattern.test(value))?.[1] || "";
}

const INTERIOR_TAB_STORAGE_PREFIX = "heyy:interior:active-tab:";

function readInteriorWorkspaceTab(projectId: string, workMode: WorkMode, result: ResultData): WorkspaceTab {
  if (typeof window === "undefined") return "overview";
  const fromUrl = new URLSearchParams(window.location.search).get("tab");
  const fromStorage = window.localStorage.getItem(`${INTERIOR_TAB_STORAGE_PREFIX}${projectId}`);
  const candidate = fromUrl || fromStorage;
  const allowed = workspaceTabs(workMode, result).some((tab) => tab.id === candidate);
  return allowed ? (candidate as WorkspaceTab) : "overview";
}

function rememberInteriorWorkspaceTab(projectId: string, tab: WorkspaceTab) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${INTERIOR_TAB_STORAGE_PREFIX}${projectId}`, tab);
}

function normaliseLayoutPriorities(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const entry = item as Record<string, unknown>;
          return String(entry.summary || entry.strategy || entry.description || entry.recommendation || entry.title || formatObject(entry));
        }
        return String(item || "");
      })
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .flatMap((item) => Array.isArray(item) ? item : [item])
      .map((item) => typeof item === "string" ? item : formatObject(item))
      .filter(Boolean);
  }
  return value ? [String(value)] : [];
}

function compactLayoutPriority(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  const words = clean.split(" ");
  if (words.length <= 18) return clean;
  return `${words.slice(0, 18).join(" ")}…`;
}

function initialState() {
  const state: FormState = {
    workMode: "guided",
    architectureSource: "Start as a standalone interior project",
    architectureProjectId: "",
  };
  const fields = [
    ...config.steps.flatMap((item) => item.fields),
    ...(config.professionalSteps || []).flatMap((item) => item.fields),
  ];
  fields.forEach((field) => {
    if (state[field.id] !== undefined) return;
    state[field.id] = field.type === "multiselect" ? [] : "";
  });
  return state;
}

function isEmpty(value: unknown) {
  return Array.isArray(value) ? value.length === 0 : !String(value || "").trim();
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatObject(value: unknown) {
  if (!value || typeof value !== "object") return String(value || "");
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${humanize(key)}: ${Array.isArray(item) ? item.join(", ") : String(item)}`)
    .join(" · ");
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
