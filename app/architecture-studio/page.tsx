"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import StudioAccessGate from "@/components/studio-access-gate";
import { CreditPill, Eyebrow, PageContainer } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";
import StudioModeToggle from "@/components/ui/StudioModeToggle";
import { ClipboardList, DraftingCompass, HousePlus, PanelsTopLeft, PencilRuler, Upload } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { CREDIT_COSTS } from "@/lib/credits/config";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import {
  ARCHITECTURE_PROJECT_TYPES,
  getArchitectureProjectTemplate,
  getArchitectureSpaceDefault,
} from "@/lib/architecture/project-templates";

type Mode = "build" | "upload";
type WorkingMode = "guided" | "professional";
type LandStart = "owned" | "looking" | "exploring";
type FileCategory = "source" | "planning" | "reference";

type SourceBriefForm = {
  sourceType: string;
  sourceStatus: string;
  preserveElements: string;
  requestedChanges: string;
  interpretationLevel: string;
  renderTarget: string;
  geometryRule: string;
  timeOfDay: string;
  materials: string;
  landscapeStyle: string;
  surroundingContext: string;
  renderMood: string;
  cameraViews: string[];
};

type BuilderForm = {
  projectName: string;
  targetGrossArea: string;
  budgetLevel: string;
  structuralPreference: string;
  professionalNotes: string;
  userCapacity: string;
  country: string;
  region: string;
  city: string;
  address: string;
  plotArea: string;
  width: string;
  depth: string;
  floors: string;
  terrain: string;
  cornerLot: string;
  notes: string;
};

type UploadItem = {
  category: FileCategory;
  file: File;
};



const projectTypes = ARCHITECTURE_PROJECT_TYPES;
const otherProjectType = projectTypes.find((item) => item.toLowerCase().startsWith("other")) || "Other";

const architecturalStyles = [
  "Contemporary",
  "Minimal",
  "Mediterranean",
  "Modern Arabic",
  "Japanese",
  "Organic",
  "Scandinavian",
  "Industrial",
  "Luxury",
  "Traditional",
  "Other / Custom",
];

const initialSourceBrief: SourceBriefForm = {
  sourceType: "",
  sourceStatus: "",
  preserveElements: "",
  requestedChanges: "",
  interpretationLevel: "Faithful interpretation",
  renderTarget: "",
  geometryRule: "Keep the uploaded geometry",
  timeOfDay: "Day",
  materials: "",
  landscapeStyle: "",
  surroundingContext: "",
  renderMood: "Natural daylight",
  cameraViews: [],
};

const cameraViewOptions = [
  "Front exterior",
  "Rear exterior",
  "Street view",
  "Aerial view",
  "Eye-level corner view",
  "Day view",
  "Night view",
];

const sourceTypeOptions = [
  "Hand sketch",
  "Façade sketch",
  "Massing sketch",
  "Floor plan",
  "Elevation drawing",
  "Section drawing",
  "PDF drawing set",
  "DWG / CAD file",
  "Existing building photo",
  "Site photo",
  "3D model screenshot",
  "Inspiration image",
  "Other",
];



const initialForm: BuilderForm = {
  projectName: "",
  targetGrossArea: "",
  budgetLevel: "",
  structuralPreference: "",
  professionalNotes: "",
  userCapacity: "",
  country: "",
  region: "",
  city: "",
  address: "",
  plotArea: "",
  width: "",
  depth: "",
  floors: "",
  terrain: "Flat",
  cornerLot: "No",
  notes: "",
};

export default function ArchitectureStudioPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mode, setMode] = useState<Mode>("build");
  const [workingMode, setWorkingMode] = useState<WorkingMode>("guided");
  const [step, setStep] = useState(1);
  const [landStart, setLandStart] = useState<LandStart>("owned");
  const [projectType, setProjectType] = useState("");
  const [customProjectType, setCustomProjectType] = useState("");
  const [scope, setScope] = useState("New Build");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [customStyle, setCustomStyle] = useState("");
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [form, setForm] = useState<BuilderForm>(initialForm);
  const [sourceBrief, setSourceBrief] = useState<SourceBriefForm>(initialSourceBrief);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const builderSectionRef = useRef<HTMLDivElement | null>(null);

  const totalSteps = 5;
  const progress = Math.round((step / totalSteps) * 100);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      setCheckingAuth(false);
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setCheckingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  function updateField(name: keyof BuilderForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateSourceBrief(name: keyof SourceBriefForm, value: string | string[]) {
    setSourceBrief((current) => ({ ...current, [name]: value }));
  }

  function toggleCameraView(view: string) {
    setSourceBrief((current) => ({
      ...current,
      cameraViews: current.cameraViews.includes(view)
        ? current.cameraViews.filter((item) => item !== view)
        : [...current.cameraViews, view],
    }));
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setStep(1);
    setErrorMessage("");
    setUploads([]);
    setSourceBrief(initialSourceBrief);
    setProjectType("");
    setCustomProjectType("");
    setSelectedStyle("");
    setCustomStyle("");
    setSelectedSpaces([]);
    setScope(nextMode === "build" ? "New Build" : "Existing Design");
  }

  function changeProjectType(nextType: string) {
    const template = getArchitectureProjectTemplate(nextType);
    setProjectType(nextType);
    if (nextType !== otherProjectType) setCustomProjectType("");
    setSelectedSpaces(template.defaultSpaces);
    setErrorMessage("");
  }

  function toggleSpace(space: string) {
    setSelectedSpaces((current) =>
      current.includes(space)
        ? current.filter((item) => item !== space)
        : [...current, space],
    );
  }

  function addFiles(category: FileCategory, files: FileList | null) {
    if (!files?.length) return;

    const nextFiles = Array.from(files).map((file) => ({ category, file }));
    setUploads((current) => [...current, ...nextFiles]);
  }

  function removeFile(target: UploadItem) {
    setUploads((current) =>
      current.filter(
        (item) =>
          !(
            item.category === target.category &&
            item.file.name === target.file.name &&
            item.file.size === target.file.size &&
            item.file.lastModified === target.file.lastModified
          ),
      ),
    );
  }

  function validateCurrentStep() {
    if (mode === "build") {
      if (step === 1 && (!form.projectName.trim() || !projectType)) {
        return "Add a project name and select the project type.";
      }
      if (step === 1 && projectType === otherProjectType && !customProjectType.trim()) {
        return "Describe the custom project type before continuing.";
      }
      if (step === 2 && landStart === "owned" && !form.country.trim()) {
        return "Add the country for the confirmed site.";
      }
      if (step === 4 && !selectedStyle) {
        return "Select an architectural style before continuing.";
      }
      if (step === 4 && selectedStyle === "Other / Custom" && !customStyle.trim()) {
        return "Describe the custom architectural style before continuing.";
      }
    } else {
      if (
        step === 1 &&
        (!form.projectName.trim() ||
          !projectType ||
          !uploads.some((item) => item.category === "source"))
      ) {
        return "Add the project name and type, then upload at least one existing drawing, plan, sketch or model reference.";
      }
      if (step === 1 && projectType === otherProjectType && !customProjectType.trim()) {
        return "Describe the custom project type before continuing.";
      }
      if (step === 2 && !sourceBrief.sourceType) {
        return "Identify the type of source you uploaded.";
      }
      if (step === 3 && !sourceBrief.renderTarget) {
        return "Select what you want the uploaded source to become.";
      }
      if (step === 4 && !selectedStyle) {
        return "Select an architectural style before continuing.";
      }
      if (step === 4 && selectedStyle === "Other / Custom" && !customStyle.trim()) {
        return "Describe the custom architectural style before continuing.";
      }
    }
    return "";
  }
  function scrollToBuilder() {
    window.setTimeout(() => {
      builderSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function goNext() {
    const error = validateCurrentStep();
    if (error) {
      setErrorMessage(error);
      return;
    }

    setErrorMessage("");
    setStep((current) => Math.min(totalSteps, current + 1));
    scrollToBuilder();
  }

  function goBack() {
    setErrorMessage("");
    setStep((current) => Math.max(1, current - 1));
    scrollToBuilder();
  }

  async function uploadProjectFiles(projectId: string, userId: string) {
    for (let index = 0; index < uploads.length; index += 1) {
      const item = uploads[index];
      const safeName = item.file.name
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-");
      const storagePath = `${userId}/${projectId}/${item.category}/${Date.now()}-${index}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("architecture-files")
        .upload(storagePath, item.file, {
          contentType: item.file.type || undefined,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: documentError } = await supabase
        .from("architecture_documents")
        .insert({
          project_id: projectId,
          user_id: userId,
          category: item.category,
          filename: item.file.name,
          storage_path: storagePath,
          mime_type: item.file.type || null,
          file_size: item.file.size,
        });

      if (documentError) {
        await supabase.storage.from("architecture-files").remove([storagePath]);
        throw documentError;
      }
    }
  }

  function buildSourceBriefPayload() {
    if (mode === "build") return {};

    return {
      workflow_mode: inferUploadedWorkflow(sourceBrief.sourceType),
      source_type: sourceBrief.sourceType || null,
      source_status: sourceBrief.sourceStatus || null,
      desired_floors: toNullableInteger(form.floors),
      preserve_elements: sourceBrief.preserveElements.trim() || null,
      requested_changes: sourceBrief.requestedChanges.trim() || null,
      interpretation_level: sourceBrief.interpretationLevel || null,
      render_target: sourceBrief.renderTarget || null,
      geometry_rule: sourceBrief.geometryRule || null,
      time_of_day: sourceBrief.timeOfDay || null,
      materials: sourceBrief.materials.trim() || null,
      landscape_style: sourceBrief.landscapeStyle.trim() || null,
      surrounding_context: sourceBrief.surroundingContext.trim() || null,
      render_mood: sourceBrief.renderMood || null,
      camera_views: sourceBrief.cameraViews,
      main_source_files: uploads
        .filter((item) => item.category === "source")
        .map((item) => item.file.name),
      reference_files: uploads
        .filter((item) => item.category === "reference")
        .map((item) => item.file.name),
    };
  }

  async function createWorkspace() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!user?.id) {
      window.location.href = "/login?redirect=/architecture-studio";
      return;
    }

    setCreating(true);
    setErrorMessage("");
    setCreateMessage("Creating the architecture project...");

    let createdProjectId: string | null = null;

    try {
      const workflowMode = mode === "build"
        ? "build_from_scratch"
        : inferUploadedWorkflow(sourceBrief.sourceType);
      const savedProjectType =
        projectType === otherProjectType
          ? customProjectType.trim() || otherProjectType
          : projectType;

      const { data: project, error: projectError } = await supabase
        .from("architecture_projects")
        .insert({
          user_id: user.id,
          project_name: form.projectName.trim(),
          workflow_mode: workflowMode,
          project_type: savedProjectType || null,
          scope: mode === "build" ? scope || null : "Existing Design",
          working_mode: workingMode,
          professional_brief: {
            target_gross_area_m2: toNullableNumber(form.targetGrossArea),
            budget_level: form.budgetLevel || null,
            structural_preference: form.structuralPreference || null,
            notes: form.professionalNotes.trim() || null,
            user_capacity: form.userCapacity.trim() || null,
          },
          country: form.country.trim() || null,
          region: form.region.trim() || null,
          city: form.city.trim() || null,
          architectural_style: selectedStyle === "Other / Custom" ? customStyle.trim() || "Other / Custom" : selectedStyle || null,
          selected_spaces: selectedSpaces,
          notes: form.notes.trim() || null,
          source_notes:
            mode === "build"
              ? null
              : [sourceBrief.preserveElements, sourceBrief.requestedChanges, form.notes]
                  .map((value) => value.trim())
                  .filter(Boolean)
                  .join("\n\n") || null,
          source_brief: buildSourceBriefPayload(),
          status: mode === "build" ? "Brief" : "Source Uploaded",
          completion: mode === "build" ? 25 : 28,
        })
        .select("id")
        .single();

      if (projectError || !project?.id) {
        throw projectError || new Error("The architecture project was not created.");
      }

      createdProjectId = project.id;
      setCreateMessage("Saving land and site information...");

      const { error: siteError } = await supabase.from("architecture_sites").insert({
        project_id: project.id,
        user_id: user.id,
        land_start: mode === "build" ? landStart : "exploring",
        address: form.address.trim() || null,
        plot_area: toNullableNumber(form.plotArea),
        width: toNullableNumber(form.width),
        depth: toNullableNumber(form.depth),
        desired_floors: toNullableInteger(form.floors),
        terrain: form.terrain || null,
        corner_lot: form.cornerLot || null,
      });

      if (siteError) throw siteError;

      if (mode === "build" && landStart === "owned") {
        const { error: planningError } = await supabase
          .from("architecture_planning")
          .insert({
            project_id: project.id,
            user_id: user.id,
            verification_status: "Needs verification",
            confidence: "Unverified",
            notes: "Planning information has not yet been verified.",
          });
        if (planningError) throw planningError;
      }

      const initialProgramRows = buildInitialSpaceProgramRows(project.id, user.id, selectedSpaces, projectType);
      if (initialProgramRows.length > 0) {
        const { error: programError } = await supabase
          .from("architecture_space_programs")
          .insert(initialProgramRows);
        if (programError) throw programError;
      }


      if (uploads.length > 0) {
        setCreateMessage(`Uploading ${uploads.length} project file${uploads.length === 1 ? "" : "s"}...`);
        await uploadProjectFiles(project.id, user.id);
      }

      setCreateMessage("Opening the architecture workspace...");
      window.location.href = `/dashboard/architecture/${project.id}`;
    } catch (error) {
      console.error("Architecture project creation error:", error);

      if (createdProjectId) {
        await supabase
          .from("architecture_projects")
          .delete()
          .eq("id", createdProjectId)
          .eq("user_id", user.id);
      }

      setCreating(false);
      setCreateMessage("");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The architecture workspace could not be created.",
      );
    }
  }

  const sourceFiles = uploads.filter((item) => item.category === "source");
  const planningFiles = uploads.filter((item) => item.category === "planning");
  const referenceFiles = uploads.filter((item) => item.category === "reference");

  return (
    <StudioAccessGate path="/architecture-studio">
      <SiteHeader />

      <WorkspaceShell>
        <main className="heyy-page architecture-studio-page">
          <style>{architectureStyles}</style>

          {creating && (
            <div className="architecture-creating-overlay" role="status" aria-live="polite">
              <div className="architecture-creating-card">
                <div className="architecture-loading-ring" aria-hidden="true" />
                <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">
                  Creating Project
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-slate-950">
                  Building your Architecture workspace
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {createMessage || "Saving your project information..."}
                </p>
                <p className="mt-4 text-[11px] font-bold leading-6 text-slate-400">
                  Keep this page open. You will be taken to the project automatically.
                </p>
              </div>
            </div>
          )}

          <PageContainer className="architecture-wrap" aria-busy={creating}>
            <section className="architecture-hero">
              <div className="architecture-hero-ring" />
              <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-4xl">
                  <Eyebrow style={{ color: "#1676e8" }}>Site planning & architecture direction</Eyebrow>
                  <h1 className="mt-4 text-4xl font-black leading-[.94] tracking-[-.06em] sm:text-6xl">Architecture Studio</h1>
                  <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)] sm:text-base">Start a new design or develop a sketch, plan, drawing, photo or model you already have. Guided and Professional modes share one connected project workspace.</p>
                </div>
                <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 backdrop-blur-xl">
                  <StudioModeToggle
                    value={workingMode}
                    onChange={setWorkingMode}
                    tone="architecture"
                    compact
                  />
                  <div className="mt-3 flex items-center justify-between gap-3 px-1">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      {workingMode === "guided"
                        ? "Simple language and smart recommendations"
                        : "Areas, structure, schedules and technical controls"}
                    </span>
                    <CreditPill credits={CREDIT_COSTS.architectureDirection} />
                  </div>
                </div>
              </div>
            </section>


            <div ref={builderSectionRef} className="builder-grid scroll-mt-28">
              <section className="builder-panel">
                <div className="architecture-start-choice">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-700">Project starting point</p>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Tell us about the project</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                      Choose whether Heyy Studio is creating the architecture from a new brief or developing an existing design you already have.
                    </p>
                  </div>
                  <div className="architecture-start-toggle" role="group" aria-label="Architecture project starting point">
                    <button type="button" data-active={mode === "build"} onClick={() => changeMode("build")}>
                      <BuildIcon />
                      <span><strong>New design</strong><small>Start from a brief, site and space requirements.</small></span>
                    </button>
                    <button type="button" data-active={mode === "upload"} onClick={() => changeMode("upload")}>
                      <UploadDevelopIcon />
                      <span><strong>Existing design</strong><small>Upload plans, drawings or a model and preserve them as the design source.</small></span>
                    </button>
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap items-start justify-between gap-4 border-t border-[var(--border)] pt-6">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-700">
                      {modeLabel(mode)}
                    </p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.035em]">
                      {stepTitle(mode, step)}
                    </h3>
                  </div>

                  <span className="rounded-full bg-blue-100 px-3 py-2 text-[9px] font-black uppercase tracking-[0.13em] text-blue-700">
                    Step {step} of {totalSteps}
                  </span>
                </div>

                <div className="progress-wrap">
                  <div className="progress-line">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs font-black text-blue-700">{progress}%</span>
                </div>

                {errorMessage && (
                  <div className="error-banner" role="alert">
                    {errorMessage}
                  </div>
                )}

                {mode === "build" ? (
                  <BuildWorkflow
                    step={step}
                    form={form}
                    updateField={updateField}
                    landStart={landStart}
                    setLandStart={setLandStart}
                    projectType={projectType}
                    setProjectType={changeProjectType}
                    customProjectType={customProjectType}
                    setCustomProjectType={setCustomProjectType}
                    scope={scope}
                    setScope={setScope}
                    selectedSpaces={selectedSpaces}
                    toggleSpace={toggleSpace}
                    selectedStyle={selectedStyle}
                    setSelectedStyle={setSelectedStyle}
                    customStyle={customStyle}
                    setCustomStyle={setCustomStyle}
                    planningFiles={planningFiles}
                    referenceFiles={referenceFiles}
                    addFiles={addFiles}
                    removeFile={removeFile}
                    workingMode={workingMode}
                  />
                ) : (
                  <UploadWorkflow
                    step={step}
                    form={form}
                    updateField={updateField}
                    sourceFiles={sourceFiles}
                    referenceFiles={referenceFiles}
                    addFiles={addFiles}
                    removeFile={removeFile}
                    selectedStyle={selectedStyle}
                    setSelectedStyle={setSelectedStyle}
                    customStyle={customStyle}
                    setCustomStyle={setCustomStyle}
                    projectType={projectType}
                    setProjectType={changeProjectType}
                    customProjectType={customProjectType}
                    setCustomProjectType={setCustomProjectType}
                    selectedSpaces={selectedSpaces}
                    toggleSpace={toggleSpace}
                    sourceBrief={sourceBrief}
                    updateSourceBrief={updateSourceBrief}
                    toggleCameraView={toggleCameraView}
                    workingMode={workingMode}
                  />
                )}

                <div className="actions">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={step === 1 || creating}
                    className="secondary-button disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Previous
                  </button>

                  <button
                    type="button"
                    onClick={step === totalSteps ? createWorkspace : goNext}
                    disabled={creating || checkingAuth}
                    className="primary-button disabled:cursor-wait disabled:opacity-60"
                  >
                    {creating
                      ? createMessage || "Creating workspace..."
                      : step === totalSteps
                        ? user
                          ? "Create Architecture Workspace →"
                          : "Sign in to Create Workspace →"
                        : "Continue →"}
                  </button>
                </div>
              </section>

              <aside className="summary-panel">
                <div className="summary-head">
                  <div className="summary-icon">
                    <SummaryIcon />
                  </div>
                  <p className="mt-5 text-[9px] font-black uppercase tracking-[0.18em] text-blue-700">
                    Project Summary
                  </p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.035em]">
                    {form.projectName || "New Architecture Project"}
                  </h3>
                </div>

                <div className="summary-body">
                  <SummaryRow label="Workflow" value={modeLabel(mode)} />
                  <SummaryRow label="Working Mode" value={workingMode === "professional" ? "Professional Mode" : "Guided Mode"} />
                  <SummaryRow
                    label="Project Type"
                    value={projectType === otherProjectType ? customProjectType.trim() || otherProjectType : projectType || "Not selected"}
                  />
                  <SummaryRow label="Scope" value={scope || "Not selected"} />
                  <SummaryRow
                    label="Location"
                    value={[form.city, form.country].filter(Boolean).join(", ") || "Not added"}
                  />
                  <SummaryRow
                    label="Land"
                    value={
                      landStart === "owned"
                        ? form.plotArea
                          ? `${form.plotArea} m²`
                          : "Land selected"
                        : landStart === "looking"
                          ? "Looking for land"
                          : "Exploring"
                    }
                  />
                  <SummaryRow label="Style" value={selectedStyle || "Not selected"} />
                  {mode === "upload" && (
                    <SummaryRow label="Source Type" value={sourceBrief.sourceType || "Not selected"} />
                  )}
                  {mode === "upload" && (
                    <SummaryRow label="Development Goal" value={sourceBrief.renderTarget || "Not selected"} />
                  )}
                  <SummaryRow
                    label="Files"
                    value={uploads.length ? `${uploads.length} selected` : "No files selected"}
                  />

                  <div className="warning">
                    Planning and buildable-area information is conceptual guidance.
                    Local authorities and licensed professionals must verify zoning,
                    setbacks, compliance and approvals.
                  </div>
                </div>
              </aside>
            </div>
          </PageContainer>
        </main>

        <SiteFooter />
      </WorkspaceShell>
    </StudioAccessGate>
  );
}

function ProfessionalFields({ form, updateField }: { form: BuilderForm; updateField: (name: keyof BuilderForm, value: string) => void }) {
  return (
    <div className="professional-fields">
      <div className="professional-fields-head"><strong>Professional Controls</strong><span>Exact area, occupancy, budget, structure and consultant constraints are available only in Professional Mode.</span></div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Exact Target Gross Area m²" value={form.targetGrossArea} onChange={(value) => updateField("targetGrossArea", value)} inputMode="decimal" />
        <SelectField label="Budget Level" value={form.budgetLevel} options={["", "Controlled", "Mid-range", "Premium", "Signature"]} onChange={(value) => updateField("budgetLevel", value)} />
        <SelectField label="Structural Preference" value={form.structuralPreference} options={["", "Open for recommendation", "Reinforced concrete", "Steel frame", "Timber / hybrid", "Masonry"]} onChange={(value) => updateField("structuralPreference", value)} />
      </div>
      <Field label="Capacity / Occupancy" value={form.userCapacity} onChange={(value) => updateField("userCapacity", value)} placeholder="Exact staff, guests, students, beds, units or peak occupancy" />
      <div className="field"><label className="field-label">Professional Notes</label><textarea className="textarea" value={form.professionalNotes} onChange={(event) => updateField("professionalNotes", event.target.value)} placeholder="Grid, spans, façade performance, output scales, consultant constraints or design-development priorities." /></div>
    </div>
  );
}

function BuildWorkflow({
  step, form, updateField, landStart, setLandStart, projectType, setProjectType, customProjectType, setCustomProjectType, scope, setScope,
  selectedSpaces, toggleSpace, selectedStyle, setSelectedStyle, customStyle, setCustomStyle,
  planningFiles, referenceFiles, addFiles, removeFile, workingMode,
}: {
  step: number; form: BuilderForm; updateField: (name: keyof BuilderForm, value: string) => void;
  landStart: LandStart; setLandStart: (value: LandStart) => void; projectType: string; setProjectType: (value: string) => void;
  customProjectType: string; setCustomProjectType: (value: string) => void;
  scope: string; setScope: (value: string) => void; selectedSpaces: string[]; toggleSpace: (value: string) => void;
  selectedStyle: string; setSelectedStyle: (value: string) => void; customStyle: string; setCustomStyle: (value: string) => void;
  planningFiles: UploadItem[]; referenceFiles: UploadItem[];
  addFiles: (category: FileCategory, files: FileList | null) => void; removeFile: (item: UploadItem) => void;
  workingMode: WorkingMode;
}) {
  const template = getArchitectureProjectTemplate(projectType);

  if (step === 1) return <>
    <div className="info-panel"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-700">Project Foundation</p><h3 className="mt-2 text-2xl font-black text-slate-950">Start with the purpose of the building.</h3><p className="mt-3 text-sm leading-7 text-slate-600">The selected project type changes the spaces, design priorities and future visual gallery automatically.</p></div>
    <Field label="Project Name" value={form.projectName} onChange={(value) => updateField("projectName", value)} placeholder="Example: Harbour Restaurant" />
    <div className="field"><p className="field-label">Project Type</p><div className="chip-wrap">{projectTypes.map((item) => <button key={item} type="button" className="chip" data-active={projectType === item} onClick={() => setProjectType(item)}>{item}</button>)}</div></div>
    {projectType === otherProjectType && <Field label="Describe the Project Type" value={customProjectType} onChange={setCustomProjectType} placeholder="Example: indoor sports and wellness complex" />}
    <div className="field"><p className="field-label">Scope</p><div className="chip-wrap">{["New Build", "Renovation", "Extension", "Feasibility Study", "Concept Only"].map((item) => <button key={item} type="button" className="chip" data-active={scope === item} onClick={() => setScope(item)}>{item}</button>)}</div></div>
  </>;

  if (step === 2) return <>
    <div className={`info-panel ${workingMode === "professional" ? "blue" : ""}`}><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-700">{workingMode === "professional" ? "Professional Site Setup" : "Guided Size Setup"}</p><h3 className="mt-2 text-2xl font-black text-slate-950">{workingMode === "professional" ? "Enter known dimensions and technical project controls." : "Approximate size is enough. Unknown information can stay empty."}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{workingMode === "professional" ? "Survey information, exact width and depth, occupancy, structure and planning documents will feed the professional workspace." : "Students, homeowners and early-stage users only need an estimated property area, building area, location and number of floors."}</p></div>
    <div className="field"><p className="field-label">How are you starting?</p><div className="choice-grid">
      <ChoiceCard active={landStart === "owned"} onClick={() => setLandStart("owned")} title="I have land" body={workingMode === "professional" ? "Add survey and site information. The Professional workspace will unlock the Planning Guide." : "Add only the approximate property size and location. Technical planning remains hidden in Guided Mode."} />
      <ChoiceCard active={landStart === "looking"} onClick={() => setLandStart("looking")} title="Looking for land" body="Define the project without pretending a site is confirmed." />
      <ChoiceCard active={landStart === "exploring"} onClick={() => setLandStart("exploring")} title="Just exploring" body="Perfect for students and early concept projects." />
    </div></div>
    <div className="grid gap-4 md:grid-cols-3"><Field label="Country" value={form.country} onChange={(value) => updateField("country", value)} /><Field label="State / Region" value={form.region} onChange={(value) => updateField("region", value)} /><Field label="City / Municipality" value={form.city} onChange={(value) => updateField("city", value)} /></div>
    <div className="grid gap-4 md:grid-cols-3">
      <Field label={workingMode === "professional" ? "Target Gross Area m²" : "Approximate Building Area m²"} value={form.targetGrossArea} onChange={(value) => updateField("targetGrossArea", value)} inputMode="decimal" placeholder={workingMode === "professional" ? "Exact target" : "Leave blank if unknown"} />
      <Field label="Desired Floors" value={form.floors} onChange={(value) => updateField("floors", value)} inputMode="numeric" placeholder="Leave blank if unknown" />
      <Field label={template.simpleCapacityLabel} value={form.userCapacity} onChange={(value) => updateField("userCapacity", value)} placeholder={template.simpleCapacityPlaceholder} />
    </div>
    {landStart === "owned" && <>
      <Field label="Address or Lot Number" value={form.address} onChange={(value) => updateField("address", value)} placeholder="Optional in Guided Mode" />
      <div className="grid gap-4 md:grid-cols-3"><Field label="Property / Plot Area m²" value={form.plotArea} onChange={(value) => updateField("plotArea", value)} inputMode="decimal" placeholder="Approximate is fine" />{workingMode === "professional" && <><Field label="Exact Width m" value={form.width} onChange={(value) => updateField("width", value)} inputMode="decimal" /><Field label="Exact Depth m" value={form.depth} onChange={(value) => updateField("depth", value)} inputMode="decimal" /></>}</div>
      {workingMode === "professional" && <div className="grid gap-4 md:grid-cols-2"><SelectField label="Terrain" value={form.terrain} options={["Flat", "Gentle Slope", "Steep Slope", "Unknown"]} onChange={(value) => updateField("terrain", value)} /><SelectField label="Corner Lot" value={form.cornerLot} options={["No", "Yes", "Unknown"]} onChange={(value) => updateField("cornerLot", value)} /></div>}
      {workingMode === "professional" && <FilePicker category="planning" title="Upload professional planning and site documents" body="Add surveys, zoning documents, site plans, title information or authority records." files={planningFiles} onFiles={addFiles} onRemove={removeFile} accept="application/pdf,image/*,.dwg" />}
    </>}
    {workingMode === "professional" && <ProfessionalFields form={form} updateField={updateField} />}
  </>;

  if (step === 3) return <>
    <div className="info-panel blue"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-700">{template.label} Space Program</p><h3 className="mt-2 text-2xl font-black text-slate-950">Choose only the spaces that match this building type.</h3><p className="mt-3 text-sm leading-7 text-slate-600">The workspace turns these choices into an editable area schedule. Suggested sizes remain optional and can be changed later.</p></div>
    <div className="field"><p className="field-label">Spaces & Features</p><div className="chip-wrap">{template.spaces.map((space) => <button key={space} type="button" className="chip" data-active={selectedSpaces.includes(space)} onClick={() => toggleSpace(space)}>{space}</button>)}</div></div>
    <div className="field"><label className="field-label">Additional Requirements</label><textarea className="textarea" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder={`Describe the users, atmosphere, operations, adjacencies, accessibility and priorities for this ${template.label.toLowerCase()} project.`} /></div>
  </>;

  if (step === 4) return <>
    <div className="info-panel"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-700">Design Character</p><h3 className="mt-2 text-2xl font-black text-slate-950">Choose the architectural language now. Materials and colours come later inside the workspace.</h3></div>
    <div className="field"><p className="field-label">Architectural Style</p><div className="chip-wrap">{architecturalStyles.map((style) => <button key={style} type="button" className="chip" data-active={selectedStyle === style} onClick={() => setSelectedStyle(style)}>{style}</button>)}</div></div>
    {selectedStyle === "Other / Custom" && <Field label="Describe the Custom Style" value={customStyle} onChange={setCustomStyle} placeholder="Example: contemporary Lebanese architecture with Mediterranean proportions and shaded modern glazing" />}
    <FilePicker category="reference" title="Add style references" body="Optional precedent projects or inspiration boards. Materials, paints and finishes are selected later in Material Studio." files={referenceFiles} onFiles={addFiles} onRemove={removeFile} accept="image/*,application/pdf" />
  </>;

  return <>
    <div className="info-panel blue"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-700">Ready to Create</p><h3 className="mt-2 text-2xl font-black text-slate-950">Your project will open as an editable Architecture workspace.</h3><p className="mt-3 text-sm leading-7 text-slate-600">Materials, colours, planning details, Space Program and all generated content remain editable after creation.</p></div>
    <div className="grid gap-4 md:grid-cols-2"><SummaryRow label="Project" value={form.projectName || "Not added"} /><SummaryRow label="Project Type" value={projectType === otherProjectType ? customProjectType.trim() || otherProjectType : projectType || "Not selected"} /><SummaryRow label="Working Mode" value={workingMode === "professional" ? "Professional" : "Guided"} /><SummaryRow label="Site" value={landStart === "owned" ? "Confirmed land" : landStart === "looking" ? "Looking for land" : "Exploring without land"} /><SummaryRow label="Spaces" value={selectedSpaces.join(", ") || "Smart suggestions later"} /><SummaryRow label="Style" value={selectedStyle === "Other / Custom" ? customStyle || "Custom" : selectedStyle || "Not selected"} /></div>
  </>;
}

function UploadWorkflow({
  step, form, updateField, sourceFiles, referenceFiles, addFiles, removeFile, selectedStyle, setSelectedStyle,
  customStyle, setCustomStyle, projectType, setProjectType, customProjectType, setCustomProjectType, selectedSpaces, toggleSpace, sourceBrief, updateSourceBrief, toggleCameraView, workingMode,
}: {
  step: number; form: BuilderForm; updateField: (name: keyof BuilderForm, value: string) => void; sourceFiles: UploadItem[]; referenceFiles: UploadItem[];
  addFiles: (category: FileCategory, files: FileList | null) => void; removeFile: (item: UploadItem) => void; selectedStyle: string; setSelectedStyle: (value: string) => void;
  customStyle: string; setCustomStyle: (value: string) => void; projectType: string; setProjectType: (value: string) => void; customProjectType: string; setCustomProjectType: (value: string) => void; selectedSpaces: string[]; toggleSpace: (value: string) => void; sourceBrief: SourceBriefForm; updateSourceBrief: (name: keyof SourceBriefForm, value: string | string[]) => void;
  toggleCameraView: (view: string) => void; workingMode: WorkingMode;
}) {
  const template = getArchitectureProjectTemplate(projectType);
  if (step === 1) return <>
    <div className="info-panel"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-700">Existing design</p><h3 className="mt-2 text-2xl font-black text-slate-950">Use the design you already have as the source of truth.</h3><p className="mt-3 text-sm leading-7 text-slate-600">Upload floor plans, elevations, sections, sketches, PDFs or model screenshots. When the source contains developed plans, Heyy Studio must preserve that geometry rather than inventing a new layout.</p></div>
    <Field label="Project Name" value={form.projectName} onChange={(value) => updateField("projectName", value)} placeholder="Example: Existing House Visualisation" />
    <div className="field"><p className="field-label">Project Type</p><div className="chip-wrap">{projectTypes.map((item) => <button key={item} type="button" className="chip" data-active={projectType === item} onClick={() => setProjectType(item)}>{item}</button>)}</div></div>
    {projectType === otherProjectType && <Field label="Describe the Project Type" value={customProjectType} onChange={setCustomProjectType} placeholder="Example: indoor sports and wellness complex" />}
    <FilePicker category="source" title="Upload the existing design" body="Upload all relevant plans, elevations, sections or source drawings. These files remain the geometry reference for later plans and visuals." files={sourceFiles} onFiles={addFiles} onRemove={removeFile} accept="application/pdf,image/*,.dwg,.dxf" />
  </>;
  if (step === 2) return <>
    <SelectField label="What did you upload?" value={sourceBrief.sourceType} options={["", ...sourceTypeOptions]} onChange={(value) => {
      updateSourceBrief("sourceType", value);
      if (isPlanSourceType(value)) {
        updateSourceBrief("geometryRule", "Keep the uploaded geometry");
        if (!sourceBrief.renderTarget) updateSourceBrief("renderTarget", "Photoreal visuals from existing plans");
      }
    }} />
    <SelectField label="Current Source Status" value={sourceBrief.sourceStatus} options={["", "Early idea", "Concept drawing", "Measured drawing", "Planning drawing", "Existing condition", "Developed design", "Unknown"]} onChange={(value) => updateSourceBrief("sourceStatus", value)} />
    <div className="grid gap-4 md:grid-cols-3"><Field label="Desired Floors" value={form.floors} onChange={(value) => updateField("floors", value)} inputMode="numeric" /><Field label={template.simpleCapacityLabel} value={form.userCapacity} onChange={(value) => updateField("userCapacity", value)} placeholder={template.simpleCapacityPlaceholder} /><Field label="Approx. Area m²" value={form.targetGrossArea} onChange={(value) => updateField("targetGrossArea", value)} inputMode="decimal" /></div>
    <div className="field"><p className="field-label">{template.label} Spaces & Features</p><div className="chip-wrap">{template.spaces.map((space) => <button key={space} type="button" className="chip" data-active={selectedSpaces.includes(space)} onClick={() => toggleSpace(space)}>{space}</button>)}</div></div>
    {workingMode === "professional" && <ProfessionalFields form={form} updateField={updateField} />}
  </>;
  if (step === 3) return <>
    <SelectField label="What should the source become?" value={sourceBrief.renderTarget} options={["", "Photoreal visuals from existing plans", "Realistic architecture interpretation", "Exterior façade study", "Renovation transformation", "Full building massing", "Interior and exterior concept", "Complete multi-view render set", "Architecture concept development"]} onChange={(value) => updateSourceBrief("renderTarget", value)} />
    <SelectField label="Geometry / Interpretation Rule" value={sourceBrief.geometryRule} options={["Keep the uploaded geometry", "Preserve the key idea but refine it", "Allow minor façade adjustments", "Allow massing development", "Bold transformation"]} onChange={(value) => updateSourceBrief("geometryRule", value)} />
    <div className="field"><label className="field-label">What must remain?</label><textarea className="textarea" value={sourceBrief.preserveElements} onChange={(event) => updateSourceBrief("preserveElements", event.target.value)} /></div>
    <div className="field"><label className="field-label">What should change or improve?</label><textarea className="textarea" value={sourceBrief.requestedChanges} onChange={(event) => updateSourceBrief("requestedChanges", event.target.value)} /></div>
    <div className="field"><p className="field-label">Desired Output Views</p><div className="chip-wrap">{template.visualViews.map((view) => <button key={view} type="button" className="chip" data-active={sourceBrief.cameraViews.includes(view)} onClick={() => toggleCameraView(view)}>{view}</button>)}</div></div>
  </>;
  if (step === 4) return <>
    <div className="field"><p className="field-label">Architectural Style</p><div className="chip-wrap">{architecturalStyles.map((style) => <button key={style} type="button" className="chip" data-active={selectedStyle === style} onClick={() => setSelectedStyle(style)}>{style}</button>)}</div></div>
    {selectedStyle === "Other / Custom" && <Field label="Describe the Custom Style" value={customStyle} onChange={setCustomStyle} />}
    <div className="grid gap-4 md:grid-cols-2"><SelectField label="Time of Day" value={sourceBrief.timeOfDay} options={["Day", "Golden hour", "Sunset", "Night", "Day and night"]} onChange={(value) => updateSourceBrief("timeOfDay", value)} /><Field label="Landscape / Context" value={sourceBrief.landscapeStyle} onChange={(value) => updateSourceBrief("landscapeStyle", value)} /><SelectField label="Render Mood" value={sourceBrief.renderMood} options={["Natural daylight", "Warm premium", "Dramatic editorial", "Soft minimal", "Photoreal commercial"]} onChange={(value) => updateSourceBrief("renderMood", value)} /><Field label="Surrounding Context" value={sourceBrief.surroundingContext} onChange={(value) => updateSourceBrief("surroundingContext", value)} /></div>
    <FilePicker category="reference" title="Add reference images" body="Optional inspiration images. Materials and colours remain editable later in the workspace." files={referenceFiles} onFiles={addFiles} onRemove={removeFile} accept="application/pdf,image/*" />
  </>;
  return <>
    <div className="info-panel blue"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-700">Ready to Create</p><h3 className="mt-2 text-2xl font-black text-slate-950">Your source and development rules will become one coordinated Architecture workspace.</h3></div>
    <div className="grid gap-4 md:grid-cols-2"><SummaryRow label="Project" value={form.projectName || "Not added"} /><SummaryRow label="Project Type" value={projectType === otherProjectType ? customProjectType.trim() || otherProjectType : projectType || "Not selected"} /><SummaryRow label="Source Type" value={sourceBrief.sourceType || "Not selected"} /><SummaryRow label="Development Goal" value={sourceBrief.renderTarget || "Not selected"} /><SummaryRow label="Views" value={sourceBrief.cameraViews.join(", ") || "Template views later"} /><SummaryRow label="Style" value={selectedStyle === "Other / Custom" ? customStyle || "Custom" : selectedStyle || "Not selected"} /></div>
  </>;
}

function FilePicker({
  category,
  title,
  body,
  files,
  onFiles,
  onRemove,
  accept,
}: {
  category: FileCategory;
  title: string;
  body: string;
  files: UploadItem[];
  onFiles: (category: FileCategory, files: FileList | null) => void;
  onRemove: (item: UploadItem) => void;
  accept: string;
}) {
  return (
    <div className="field">
      <label className="upload-box">
        <input
          type="file"
          multiple
          className="sr-only"
          accept={accept}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onFiles(category, event.target.files);
            event.target.value = "";
          }}
        />
        <span className="upload-icon">
          <UploadIcon />
        </span>
        <span className="mt-4 block font-black text-slate-900">{title}</span>
        <span className="mt-2 block text-xs leading-6 text-slate-500">{body}</span>
        <span className="upload-action">Choose Files</span>
      </label>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((item, index) => (
            <div key={`${item.file.name}-${item.file.lastModified}-${index}`} className="file-row">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{item.file.name}</p>
                <p className="mt-1 text-xs text-slate-500">{formatBytes(item.file.size)}</p>
              </div>
              <button type="button" className="remove-file" onClick={() => onRemove(item)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button type="button" onClick={onClick} className="choice-card" data-active={active}>
      <p className="font-black text-slate-950">{title}</p>
      <p className="mt-2 text-xs leading-6 text-slate-500">{body}</p>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "text" | "decimal" | "numeric";
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        className="input"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <HeyySelect
        value={value}
        options={options.map((option) => ({ value: option, label: option || "Select" }))}
        placeholder="Select"
        ariaLabel={label}
        tone="architecture"
        onChange={onChange}
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function modeLabel(mode: Mode) {
  return mode === "upload" ? "Existing Design" : "New Design";
}

function stepTitle(mode: Mode, step: number) {
  if (mode === "upload") {
    return ["Project & source files", "Describe the existing design", "Choose what to develop", "Choose the design character", "Review & create"][step - 1];
  }
  return ["Project brief", "Site and project size", "Define the space program", "Choose the design character", "Review & create"][step - 1];
}

function isPlanSourceType(sourceType: string) {
  const planTypes = ["Floor plan", "Elevation drawing", "Section drawing", "PDF drawing set", "DWG / CAD file"];
  return planTypes.includes(sourceType);
}

function inferUploadedWorkflow(sourceType: string) {
  return isPlanSourceType(sourceType) ? "plan_to_render" : "sketch_to_real";
}

function buildInitialSpaceProgramRows(projectId: string, userId: string, selected: string[], projectType: string) {
  const template = getArchitectureProjectTemplate(projectType);
  const base = selected.length ? selected : template.defaultSpaces;
  return base.map((spaceName, index) => {
    const item = getArchitectureSpaceDefault(spaceName);
    return { project_id: projectId, user_id: userId, space_name: spaceName, zone: item.zone, level: item.level, quantity: item.quantity, area_each_m2: item.area, total_area_m2: item.quantity * item.area, priority: "Required", notes: null, is_ai_suggested: true, sort_order: index };
  });
}

function toNullableNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableInteger(value: string) {
  const parsed = toNullableNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const architectureStyles = `
  .architecture-studio-page, .architecture-studio-page * { box-sizing:border-box; }
  .architecture-studio-page { min-height:100vh; background:var(--background); color:var(--text-primary); padding:32px 0 72px; }
  .architecture-wrap { width:100%; }
  .architecture-creating-overlay { position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(8,10,18,.72); padding:20px; backdrop-filter:blur(12px); }
  .architecture-creating-card { width:min(440px,100%); border:1px solid var(--border); border-radius:26px; background:var(--surface-strong); color:var(--text-primary); padding:30px; text-align:center; box-shadow:var(--shadow-card-hover); }
  .architecture-loading-ring { width:58px; height:58px; margin:0 auto; border:5px solid rgba(73,146,255,.18); border-top-color:#1676e8; border-right-color:#58a6ff; border-radius:999px; animation:architecture-spin .8s linear infinite; }
  @keyframes architecture-spin { to { transform:rotate(360deg); } }
  .architecture-hero { position:relative; overflow:hidden; border:1px solid rgba(60,139,242,.34); border-radius:2rem; background:linear-gradient(120deg,rgba(73,146,255,.16),var(--surface-strong),rgba(46,124,246,.08)); padding:36px; box-shadow:var(--shadow-card); }
  .architecture-hero-ring { position:absolute; right:-56px; top:-80px; width:224px; height:224px; border:34px solid rgba(255,255,255,.18); border-radius:999px; }
  .architecture-hero-icon, .mode-icon, .summary-icon, .upload-icon { display:flex; align-items:center; justify-content:center; }
  .architecture-start-choice { display:grid; gap:18px; }
  .architecture-start-toggle { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .architecture-start-toggle button { display:flex; min-height:86px; align-items:center; gap:12px; border:1px solid var(--border-strong); border-radius:18px; background:var(--surface-strong); color:var(--text-primary); padding:14px 16px; text-align:left; transition:all 180ms ease; }
  .architecture-start-toggle button > svg { width:22px; height:22px; flex:0 0 auto; color:#1676e8; }
  .architecture-start-toggle button span { display:grid; gap:3px; }
  .architecture-start-toggle button strong { font-size:14px; font-weight:900; }
  .architecture-start-toggle button small { color:var(--text-secondary); font-size:11px; font-weight:650; line-height:1.45; }
  .architecture-start-toggle button:hover { border-color:#1676e8; background:rgba(73,146,255,.08); }
  .architecture-start-toggle button[data-active="true"] { border:2px solid #1676e8; background:rgba(73,146,255,.13); box-shadow:0 10px 26px rgba(22,118,232,.12); }
  .architecture-start-toggle button[data-active="true"] > svg { color:#fff; background:#1676e8; border-radius:10px; padding:4px; box-sizing:content-box; }
  .architecture-hero-icon { width:56px; height:56px; border-radius:18px; background:#1676e8; color:#fff; box-shadow:0 14px 30px rgba(22,118,232,.24); }
  .working-mode-panel { display:grid; gap:18px; margin-top:20px; border:1px solid var(--border); border-radius:var(--radius-card); background:var(--glass); padding:20px; box-shadow:var(--shadow-card); backdrop-filter:blur(24px); }
  .working-mode-toggle { display:grid; gap:10px; }
  .working-mode-toggle button { display:grid; gap:4px; border:1px solid var(--border); border-radius:16px; background:var(--surface); color:var(--text-primary); padding:14px 16px; text-align:left; transition:all 180ms ease; }
  .working-mode-toggle button span { color:var(--text-secondary); font-size:11px; line-height:1.5; }
  .working-mode-toggle button:hover { border-color:rgba(60,139,242,.58); background:rgba(73,146,255,.09); }
  .working-mode-toggle button[data-active="true"] { border-color:#1676e8; background:rgba(73,146,255,.14); box-shadow:0 10px 24px rgba(22,118,232,.13); }
  .mode-grid { display:grid; gap:16px; margin-top:16px; }
  .mode-card { min-height:205px; border:1px solid var(--border); border-radius:var(--radius-card); background:var(--glass); color:var(--text-primary); padding:22px; text-align:left; transition:all 200ms ease; backdrop-filter:blur(24px); }
  .mode-card:hover { transform:translateY(-4px); border-color:#1676e8; background:rgba(73,146,255,.08); box-shadow:var(--shadow-card-hover); }
  .mode-card[data-active="true"] { border:2px solid #1676e8; background:linear-gradient(135deg,rgba(73,146,255,.15),var(--surface-strong)); box-shadow:0 18px 40px rgba(22,118,232,.15); }
  .mode-icon { width:48px; height:48px; border-radius:15px; background:rgba(73,146,255,.14); color:#1676e8; }
  .mode-card[data-active="true"] .mode-icon { background:#1676e8; color:#fff; }
  .builder-grid { display:grid; gap:22px; margin-top:22px; }
  .builder-panel, .summary-panel { border:1px solid var(--border); border-radius:var(--radius-card); background:var(--glass); box-shadow:var(--shadow-card); backdrop-filter:blur(24px); }
  .builder-panel { padding:26px; }
  .summary-panel { overflow:hidden; }
  .progress-wrap { display:flex; align-items:center; gap:10px; margin-top:22px; padding:14px; border:1px solid var(--border); border-radius:18px; background:var(--surface); }
  .progress-line { flex:1; height:8px; overflow:hidden; border-radius:999px; background:var(--surface-hover); }
  .progress-fill { height:100%; border-radius:inherit; background:linear-gradient(90deg,#1676e8,#58a6ff); transition:width 260ms ease; }
  .field { margin-top:24px; }
  .field-label { display:block; margin-bottom:10px; color:var(--text-muted); font-size:10px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; }
  .input, .textarea, .select { width:100%; border:1px solid var(--border-strong); border-radius:15px; background:var(--surface-strong); color:var(--text-primary); padding:14px 15px; font-size:13px; outline:none; transition:all 180ms ease; }
  .input::placeholder, .textarea::placeholder { color:var(--text-muted); }
  .input:focus, .textarea:focus, .select:focus { border-color:#1676e8; box-shadow:0 0 0 4px rgba(22,118,232,.13); }
  .textarea { min-height:120px; resize:vertical; }
  .architecture-custom-select { position:relative; width:100%; }
  .architecture-custom-select-trigger {
    display:flex;
    width:100%;
    min-height:48px;
    align-items:center;
    justify-content:space-between;
    gap:14px;
    border:1px solid var(--border-strong);
    border-radius:15px;
    background:var(--surface-strong);
    color:var(--text-primary);
    padding:0 15px;
    font-size:13px;
    text-align:left;
    outline:none;
    transition:border-color 180ms ease,box-shadow 180ms ease,background 180ms ease;
  }
  .architecture-custom-select-trigger:hover,
  .architecture-custom-select[data-open="true"] .architecture-custom-select-trigger {
    border-color:#1676e8;
    background:var(--surface);
    box-shadow:0 0 0 4px rgba(22,118,232,.13);
  }
  .architecture-custom-select-trigger span[data-placeholder="true"] { color:var(--text-muted); }
  .architecture-custom-select-trigger svg { flex:0 0 auto; color:#1676e8; transition:transform 180ms ease; }
  .architecture-custom-select[data-open="true"] .architecture-custom-select-trigger svg { transform:rotate(180deg); }
  .architecture-custom-select-menu {
    position:absolute;
    z-index:80;
    top:calc(100% + 8px);
    left:0;
    right:0;
    display:grid;
    max-height:280px;
    overflow:auto;
    gap:4px;
    border:1px solid rgba(73,146,255,.42);
    border-radius:16px;
    background:var(--surface-strong);
    padding:7px;
    box-shadow:0 22px 55px rgba(10,20,38,.22);
    backdrop-filter:blur(22px);
  }
  .architecture-custom-select-menu button {
    display:flex;
    min-height:40px;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    border:0;
    border-radius:11px;
    background:transparent;
    color:var(--text-secondary);
    padding:0 11px;
    font-size:12px;
    font-weight:800;
    text-align:left;
  }
  .architecture-custom-select-menu button:hover { background:rgba(73,146,255,.12); color:#1676e8; }
  .architecture-custom-select-menu button[data-selected="true"] { background:linear-gradient(135deg,#0f65cc,#2e7cf6); color:#fff; }
  .chip-wrap { display:flex; flex-wrap:wrap; gap:9px; }
  .chip { min-height:38px; border:1px solid var(--border); border-radius:999px; background:var(--surface-strong); color:var(--text-secondary); padding:0 15px; font-size:12px; font-weight:800; transition:all 180ms ease; }
  .chip:hover { border-color:#1676e8; background:rgba(73,146,255,.10); color:#1676e8; }
  .chip[data-active="true"] { border-color:#1676e8; background:#1676e8; color:#fff; box-shadow:0 8px 18px rgba(22,118,232,.20); }
  .choice-grid { display:grid; gap:12px; }
  .choice-card { border:1px solid var(--border); border-radius:18px; background:var(--surface-strong); color:var(--text-primary); padding:17px; text-align:left; transition:all 180ms ease; }
  .choice-card:hover { border-color:#1676e8; background:rgba(73,146,255,.09); }
  .choice-card[data-active="true"] { border:2px solid #1676e8; background:rgba(73,146,255,.14); box-shadow:0 10px 22px rgba(22,118,232,.13); }
  .upload-box { display:flex; min-height:190px; cursor:pointer; flex-direction:column; align-items:center; justify-content:center; border:1px dashed rgba(73,146,255,.58); border-radius:20px; background:linear-gradient(135deg,rgba(73,146,255,.09),var(--surface-strong)); padding:24px; text-align:center; transition:all 180ms ease; }
  .upload-box:hover { border-color:#1676e8; background:linear-gradient(135deg,rgba(73,146,255,.15),var(--surface-strong)); box-shadow:0 12px 25px rgba(22,118,232,.10); }
  .upload-icon { width:48px; height:48px; border-radius:15px; background:rgba(73,146,255,.14); color:#1676e8; }
  .upload-action { display:inline-flex; min-height:38px; align-items:center; justify-content:center; margin-top:15px; border-radius:999px; background:#1676e8; color:#fff; padding:0 16px; font-size:11px; font-weight:900; }
  .file-list { display:grid; gap:9px; margin-top:12px; }
  .file-row { display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid var(--border); border-radius:15px; background:var(--surface); padding:12px 14px; }
  .remove-file { flex:0 0 auto; border:1px solid rgba(244,63,94,.30); border-radius:999px; background:rgba(244,63,94,.08); color:#e54b6b; padding:7px 11px; font-size:10px; font-weight:900; }
  .remove-file:hover { background:rgba(244,63,94,.16); }
  .info-panel { margin-top:24px; border:1px solid rgba(73,146,255,.34); border-radius:20px; background:rgba(73,146,255,.10); padding:20px; }
  .info-panel.blue { border-color:rgba(73,146,255,.34); background:rgba(73,146,255,.10); }
  .professional-fields { margin-top:24px; border:1px solid rgba(73,146,255,.38); border-radius:20px; background:linear-gradient(135deg,rgba(73,146,255,.11),var(--surface-strong)); padding:18px; }
  .professional-fields-head { display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; }
  .professional-fields-head strong { color:#1676e8; }
  .professional-fields-head span { color:var(--text-secondary); font-size:11px; }
  .initial-material-card { position:relative; overflow:hidden; border:1px solid var(--border); border-radius:18px; background:var(--surface-strong); color:var(--text-primary); text-align:left; transition:all 180ms ease; }
  .initial-material-card:hover { transform:translateY(-3px); border-color:#1676e8; box-shadow:0 12px 26px rgba(22,118,232,.12); }
  .initial-material-card[data-active="true"] { border:2px solid #1676e8; background:rgba(73,146,255,.11); }
  .initial-material-card img { width:100%; height:112px; object-fit:cover; }
  .initial-material-card > span { display:grid; gap:4px; padding:12px; }
  .initial-material-card small, .initial-material-card em { color:var(--text-secondary); font-size:10px; }
  .initial-material-card b { position:absolute; right:9px; top:9px; border-radius:999px; background:var(--surface-strong); color:#1676e8; padding:6px 9px; font-size:9px; box-shadow:var(--shadow-button); }
  .initial-material-card em { line-height:1.5; font-style:normal; }
  .material-picker-tools { display:grid; gap:10px; margin-top:16px; }
  .material-category-scroll { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; }
  .material-category-scroll button { flex:0 0 auto; border:1px solid var(--border); border-radius:999px; background:var(--surface-strong); padding:8px 11px; color:var(--text-secondary); font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:.09em; }
  .material-category-scroll button[data-active="true"] { border-color:#1676e8; background:rgba(73,146,255,.13); color:#1676e8; }
  .error-banner { margin-top:18px; border:1px solid rgba(244,63,94,.35); border-radius:16px; background:rgba(244,63,94,.10); color:#e95d79; padding:13px 15px; font-size:12px; font-weight:800; line-height:1.6; }
  .actions { display:flex; flex-wrap:wrap; justify-content:space-between; gap:12px; margin-top:28px; border-top:1px solid var(--border); padding-top:20px; }
  .primary-button, .secondary-button { display:inline-flex; min-height:46px; align-items:center; justify-content:center; border-radius:999px; padding:0 21px; font-size:12px; font-weight:900; transition:all 180ms ease; }
  .primary-button { border:1px solid #1676e8; background:#1676e8; color:#fff; box-shadow:0 11px 24px rgba(22,118,232,.22); }
  .primary-button:hover { transform:translateY(-2px); background:#0d63ca; }
  .secondary-button { border:1px solid var(--border-strong); background:var(--surface-strong); color:var(--text-primary); }
  .secondary-button:hover { border-color:#1676e8; background:rgba(73,146,255,.11); color:#1676e8; }
  .summary-head { background:linear-gradient(135deg,rgba(73,146,255,.16),rgba(73,146,255,.06)); padding:23px; }
  .summary-icon { width:44px; height:44px; border-radius:14px; background:#1676e8; color:#fff; }
  .summary-body { display:grid; gap:11px; padding:20px; }
  .summary-row { border:1px solid var(--border); border-radius:15px; background:var(--surface); padding:13px; }
  .warning { margin-top:7px; border:1px solid rgba(240,180,41,.42); border-radius:17px; background:rgba(240,180,41,.11); padding:15px; color:#dca938; font-size:11px; line-height:1.65; }
  .architecture-studio-page .text-slate-950, .architecture-studio-page .text-slate-900 { color:var(--text-primary) !important; }
  .architecture-studio-page .text-slate-700, .architecture-studio-page .text-slate-600, .architecture-studio-page .text-slate-500 { color:var(--text-secondary) !important; }
  .architecture-studio-page .text-slate-400 { color:var(--text-muted) !important; }
  .architecture-studio-page .text-blue-700 { color:#1676e8 !important; }
  [data-theme="dark"] .architecture-studio-page .bg-blue-100 { background:rgba(73,146,255,.14) !important; }
  [data-theme="dark"] .architecture-studio-page :is(.input,.textarea,.select,input:not([type="color"]):not([type="file"]),textarea,select) {
    border-color:var(--border-strong) !important;
    background:#17141f !important;
    color:var(--text-primary) !important;
    color-scheme:dark;
  }
  [data-theme="dark"] .architecture-studio-page :is(input,textarea)::placeholder { color:var(--text-muted) !important; opacity:1; }
  [data-theme="dark"] .architecture-studio-page select option { background:#17141f; color:var(--text-primary); }
  @media (min-width:780px) { .working-mode-panel { grid-template-columns:minmax(240px,.7fr) minmax(0,1.3fr); align-items:center; } .working-mode-toggle { grid-template-columns:repeat(2,minmax(0,1fr)); } .mode-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .choice-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
  @media (min-width:1080px) { .builder-grid { grid-template-columns:minmax(0,1fr) 330px; align-items:start; } .summary-panel { position:sticky; top:104px; } }
  @media (max-width:720px) { .architecture-start-toggle { grid-template-columns:1fr; } .architecture-studio-page { padding:24px 0 56px; } .architecture-hero { padding:25px 20px; } .builder-panel { padding:20px 16px; } .primary-button, .secondary-button { width:100%; } }
`;

function ArchitectureIcon() { return <DraftingCompass size={26} strokeWidth={1.9} />; }
function BuildIcon() { return <HousePlus size={23} strokeWidth={1.9} />; }
function UploadDevelopIcon() { return <Upload size={23} strokeWidth={1.9} />; }
function SketchIcon() { return <PencilRuler size={23} strokeWidth={1.9} />; }
function PlanIcon() { return <PanelsTopLeft size={23} strokeWidth={1.9} />; }
function SummaryIcon() { return <ClipboardList size={21} strokeWidth={1.9} />; }
function UploadIcon() { return <Upload size={22} strokeWidth={1.9} />; }
