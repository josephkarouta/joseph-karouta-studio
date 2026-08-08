"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import StudioProjectWorkspace from "@/components/studio-project-workspace";
import BrandProjectBrief from "@/components/studio/brand/BrandProjectBrief";
import BrandMoodboards from "@/components/studio/brand/BrandMoodboards";
import BrandLogos from "@/components/studio/brand/BrandLogos";
import BrandApplicationsWorkspace from "@/components/studio/brand/BrandApplicationsWorkspace";
import BrandGuidelines from "@/components/studio/brand/BrandGuidelines";
import BrandExport from "@/components/studio/brand/BrandExport";
import BrandProductionWorkspace from "@/components/studio/brand/BrandProductionWorkspace";
import StudioAssets from "@/components/studio/workspace/StudioAssets";
import BrandBookExportRenderer from "@/components/studio/brand-book/export/BrandBookExportRenderer";
import { getProjectAssets } from "@/services/workspace/asset.service";
import {
  getApplicationDeliverables,
  getBrandJourney,
  normaliseBrandJourney,
} from "@/lib/brand/project-templates";
import type { StudioStep } from "@/components/studio/workspace/StudioStepper";
import type { StudioWorkspaceTab } from "@/components/studio/workspace/StudioTabs";
import StudioLoader from "@/components/ui/StudioLoader";

function hasAssetType(assets: any[], types: string[]) {
  return assets.some((asset) => types.includes(asset.asset_type));
}


export default function BrandProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const userId = user?.id || null;

  const [project, setProject] = useState<any>(null);
  const [projectAssets, setProjectAssets] = useState<any[]>([]);
  const [projectLoading, setProjectLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProject() {
      if (!userId || !projectId) return;
      setProjectLoading(true);

      const { data, error } = await supabase
        .from("brand_projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", userId)
        .single();

      if (!active) return;

      if (error || !data) {
        console.error("Brand project load error:", error);
        setProject(null);
        setProjectAssets([]);
        setProjectLoading(false);
        return;
      }

      const assets = await getProjectAssets(data.id);
      if (!active) return;
      setProject(data);
      setProjectAssets(assets);
      setProjectLoading(false);
    }

    if (!authLoading) {
      if (!userId) {
        setProjectLoading(false);
      } else {
        void loadProject();
      }
    }

    return () => {
      active = false;
    };
  }, [authLoading, userId, projectId]);

  const workflowProgress = useMemo(() => {
    const hasDirections = hasAssetType(projectAssets, [
      "creative_direction_selected",
      "moodboard_selected",
    ]);
    const hasDirectionContent = hasAssetType(projectAssets, [
      "creative_directions",
      "moodboard",
      "moodboard_variations",
      "creative_direction_selected",
      "moodboard_selected",
    ]);
    const hasExistingLogo = hasAssetType(projectAssets, ["existing_logo"]);
    const hasLogo = hasAssetType(projectAssets, [
      "logo_concept",
      "logo_variation",
      "logo_selected",
    ]);
    const hasGuidelines = hasAssetType(projectAssets, ["brand_guidelines"]);

    return {
      hasDirections,
      hasDirectionContent,
      hasExistingLogo,
      hasLogo,
      hasGuidelines,
      hasAssets: projectAssets.length > 0,
    };
  }, [projectAssets]);

  if (authLoading || projectLoading) return <BrandWorkspaceLoading />;

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f6fa] px-6 text-[#17151f]">
        <div className="max-w-md rounded-[28px] border border-violet-200 bg-white p-8 text-center shadow-xl shadow-violet-900/10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">Sign in required</p>
          <h1 className="mt-4 text-3xl font-black">Sign in to open this Brand Project.</h1>
          <p className="mt-4 text-slate-500">Your saved Studio projects live inside your Heyy Studio dashboard.</p>
          <button
            type="button"
            onClick={() => signInWithGoogle(window.location.href)}
            className="mt-6 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-violet-600"
          >
            Sign in with Google
          </button>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f6fa] px-6 text-[#17151f]">
        <div className="max-w-md rounded-[28px] border border-violet-200 bg-white p-8 text-center shadow-xl shadow-violet-900/10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">Project not found</p>
          <h1 className="mt-4 text-3xl font-black">This project is unavailable.</h1>
          <p className="mt-4 text-slate-500">It may have been deleted, or it may belong to another account.</p>
          <a href="/dashboard" className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-violet-600">
            Back to Dashboard
          </a>
        </div>
      </main>
    );
  }

  const brand = project.brand_system_json || {};
  const journey = normaliseBrandJourney(brand, project);
  const journeyConfig = getBrandJourney(journey.journeyId);
  const selectedApplications = getApplicationDeliverables(journey.selectedDeliverables);
  const selectedApplicationCount = selectedApplications.length;
  const showDirections = journey.workspaceSections.includes("directions");
  const showLogo = journey.workspaceSections.includes("logo");
  const showApplications = journey.workspaceSections.includes("applications") && selectedApplicationCount > 0;
  const showGuidelines = journey.workspaceSections.includes("guidelines");
  const showAssets = journey.workspaceSections.includes("assets");
  const showExport = journey.workspaceSections.includes("export");
  const singleApplicationLabel = selectedApplicationCount === 1 ? selectedApplications[0].label : null;
  const logoReady = journey.logoAction === "keep"
    ? workflowProgress.hasExistingLogo || Boolean(journey.existingLogoUrl)
    : workflowProgress.hasLogo;

  const steps: StudioStep[] = [
    {
      id: "brief",
      label: singleApplicationLabel ? `${singleApplicationLabel} Brief` : "Project Brief",
      status: "done",
      helper: journeyConfig.shortTitle,
      tabId: "brief",
    },
  ];

  const tabs: StudioWorkspaceTab[] = [
    {
      id: "brief",
      label: singleApplicationLabel ? `${singleApplicationLabel} Brief` : "Project Brief",
      description: singleApplicationLabel ? `The information required for this ${singleApplicationLabel.toLowerCase()} project` : "Journey, existing identity and selected scope",
      content: <BrandProjectBrief project={project} brand={brand} assets={projectAssets} />,
    },
  ];

  if (showDirections) {
    steps.push({
      id: "creative-direction",
      label: "Creative Directions",
      status: workflowProgress.hasDirections ? "done" : "upcoming",
      helper: workflowProgress.hasDirections
        ? "Direction selected."
        : workflowProgress.hasDirectionContent
          ? "Compare and select."
          : "Generate three routes.",
      tabId: "moodboards",
    });
    tabs.push({
      id: "moodboards",
      label: "Creative Directions",
      description: "Text-first concepts with optional visual boards",
      content: <BrandMoodboards project={project} brand={brand} />,
    });
  }

  if (showLogo) {
    steps.push({
      id: "logo",
      label: journey.logoAction === "keep" ? "Existing Logo" : "Logo Directions",
      status: logoReady ? "done" : "upcoming",
      helper: journey.logoAction === "keep"
        ? logoReady ? "Current mark connected." : "Review current mark."
        : logoReady ? "Logo route saved." : "Explore three routes.",
      tabId: "logos",
    });
    tabs.push({
      id: "logos",
      label: journey.logoAction === "keep" ? "Existing Logo" : "Logo Directions",
      description: journey.logoAction === "keep"
        ? "Current logo, health check and usage guidance"
        : "Concept logic, generation and refinements",
      content: <BrandLogos project={project} brand={brand} />,
    });
  }

  if (showApplications) {
    steps.push({
      id: "applications",
      label: singleApplicationLabel || "Applications",
      status: "upcoming",
      helper: `${selectedApplicationCount} selected`,
      tabId: "applications",
    });
    tabs.push({
      id: "applications",
      label: singleApplicationLabel || "Applications",
      description: singleApplicationLabel ? `Focused ${singleApplicationLabel.toLowerCase()} workspace` : "Only the deliverables included in this project",
      content: <BrandApplicationsWorkspace project={project} brand={brand} />,
    });
  }

  if (showGuidelines) {
    steps.push({
      id: "guidelines",
      label: "Guidelines",
      status: workflowProgress.hasGuidelines ? "done" : "upcoming",
      helper: workflowProgress.hasGuidelines ? "Guideline system saved." : "Build tailored rules.",
      tabId: "guidelines",
    });
    tabs.push({
      id: "guidelines",
      label: "Guidelines",
      description: "Foundation, identity, applications and readiness",
      content: <BrandGuidelines project={project} brand={brand} />,
    });
  }

  if (showAssets) {
    steps.push({
      id: "assets",
      label: "Assets",
      status: workflowProgress.hasAssets ? "done" : "upcoming",
      helper: workflowProgress.hasAssets ? "Saved project files." : "Uploaded and generated files.",
      tabId: "assets",
    });
    tabs.push({
      id: "assets",
      label: "Assets",
      description: "Uploaded logo, references and generated outputs",
      content: <StudioAssets />,
    });
  }

  if (showExport) {
    steps.push({
      id: "export",
      label: "Export",
      status: "upcoming",
      helper: "Download the current project package.",
      tabId: "export",
    });
    tabs.push({
      id: "export",
      label: "Export",
      description: "Export only the current project scope and saved outputs",
      content: <BrandExport project={project} brand={brand} assets={projectAssets} />,
    });
  }

  steps.push({
    id: "production",
    label: "Production",
    status: "upcoming",
    helper: "Vector, editable and print-ready final files.",
    tabId: "production",
  });
  tabs.push({
    id: "production",
    label: "Production",
    description: "Send any selected deliverable for professional final-file preparation",
    content: <BrandProductionWorkspace project={project} brand={brand} assets={projectAssets} />,
  });

  return (
    <>
      <StudioProjectWorkspace
        project={{
          id: project.id,
          name: project.project_name,
          studio: "Brand Studio",
          status: "active",
          version: 1,
          createdAt: project.created_at,
          ownerId: project.user_id,
        }}
        assets={projectAssets}
        onAssetsChange={setProjectAssets}
        projectTypeLabel={singleApplicationLabel ? `${singleApplicationLabel} Project` : "Brand Studio Project"}
        projectName={project.project_name}
        statusLabel={journeyConfig.shortTitle}
        metaItems={[
          project.industry || "Brand",
          project.audience || "Audience",
          project.style || "Style",
        ]}
        steps={steps}
        tabs={tabs}
      />

      <div className="hidden">
        <BrandBookExportRenderer project={project} brand={brand} assets={projectAssets} />
      </div>
    </>
  );
}

function BrandWorkspaceLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5">
      <div className="w-full max-w-[460px]">
        <StudioLoader
          tone="brand"
          eyebrow="Brand Studio"
          title="Loading your project"
          detail="Preparing the project journey, selected scope and saved assets."
          variant="inline"
        />
      </div>
    </main>
  );
}
