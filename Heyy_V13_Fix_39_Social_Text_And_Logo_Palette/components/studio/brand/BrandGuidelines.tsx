"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck } from "lucide-react";
import BrandBook from "@/components/studio/brand-book/BrandBook";
import BrandGenerationState from "@/components/studio/brand/common/BrandGenerationState";
import { useAssets } from "@/hooks/use-assets";
import { useBrandGuidelines } from "@/hooks/use-brand-guidelines";
import { normaliseBrandJourney } from "@/lib/brand/project-templates";
import { CREDIT_COSTS } from "@/lib/credits/config";

function readPayload(asset: any) {
  const payload = asset?.output_payload;
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return payload;
}

function latest(assets: any[], types: string[]) {
  return assets.find((asset) => types.includes(asset.asset_type));
}

function selectedConcept(assets: any[]) {
  const selectionPayload = readPayload(
    latest(assets, ["creative_direction_selected", "moodboard_selected"]),
  );
  const selectedIndex =
    typeof selectionPayload?.selectedMoodboard === "number"
      ? selectionPayload.selectedMoodboard
      : 0;
  const selectedTitle = String(
    selectionPayload?.selectedConcept?.title ||
      selectionPayload?.selectedConcept?.conceptName ||
      "",
  );

  for (const asset of assets) {
    if (
      ![
        "moodboard_selected",
        "moodboard_variations",
        "moodboard",
        "creative_direction_selected",
        "creative_directions",
      ].includes(asset?.asset_type)
    ) {
      continue;
    }
    const payload = readPayload(asset);
    const directions = payload?.directions || payload?.moodboards || [];
    const byTitle = selectedTitle
      ? directions.find(
          (item: any) =>
            String(item?.title || item?.conceptName || "") === selectedTitle,
        )
      : null;
    const candidate = byTitle || directions[selectedIndex] || directions[0];
    if (candidate?.imageUrl || candidate?.image_url) return candidate;
    if (candidate && !selectionPayload?.selectedConcept) return candidate;
  }

  return selectionPayload?.selectedConcept || null;
}

function selectedMoodboard(assets: any[]) {
  return selectedConcept(assets);
}

function selectedLogo(assets: any[]) {
  const asset = latest(assets, [
    "logo_selected",
    "logo_variation",
    "logo_concept",
    "existing_logo",
  ]);
  if (!asset) return null;
  if (asset.asset_type === "existing_logo") {
    return asset.file_url ? { imageUrl: asset.file_url, source: "existing" } : null;
  }
  const payload = readPayload(asset);
  const index =
    typeof payload?.selectedDirection === "number"
      ? payload.selectedDirection
      : payload?.directionIndex;
  if (payload?.conceptsByDirection && index !== undefined) {
    return payload.conceptsByDirection[index] || null;
  }
  return payload?.logos?.[0] || (asset.file_url ? { imageUrl: asset.file_url } : null);
}

function savedGuidelines(assets: any[]) {
  const payload = readPayload(latest(assets, ["brand_guidelines"]));
  return payload?.guidelines || null;
}

function mergeGuidelines(
  brand: any,
  guidelines: any,
  direction: any,
  logo: any,
  logoPalette: any[] | null,
) {
  if (!guidelines) {
    const palette = logoPalette?.length
      ? logoPalette
      : brand?.colourPalette || brand?.colorPalette || [];
    return {
      ...brand,
      colourPalette: palette,
      colorPalette: palette,
      workspaceContext: { selectedDirection: direction, selectedLogo: logo },
    };
  }
  const foundation = guidelines?.foundation || {};
  const palette = logoPalette?.length
    ? logoPalette
    : guidelines?.colourPalette?.length
      ? guidelines.colourPalette
      : brand?.colourPalette || brand?.colorPalette || [];
  return {
    ...brand,
    colourPalette: palette,
    colorPalette: palette,
    generatedGuidelines: guidelines,
    workspaceContext: { selectedDirection: direction, selectedLogo: logo },
    foundation: {
      ...(brand?.foundation || {}),
      summary: foundation?.overview || brand?.foundation?.summary,
      purpose: foundation?.purpose || brand?.foundation?.purpose,
      positioning: foundation?.positioning || brand?.foundation?.positioning,
      mission: foundation?.mission || brand?.foundation?.mission,
      vision: foundation?.vision || brand?.foundation?.vision,
      brandPromise: foundation?.brandPromise || brand?.foundation?.brandPromise,
      targetAudience:
        foundation?.audience || brand?.foundation?.targetAudience,
      audienceNeeds:
        foundation?.audienceNeeds || brand?.foundation?.audienceNeeds,
      coreValues: foundation?.values || brand?.foundation?.coreValues,
      personality: {
        headline:
          brand?.foundation?.personality?.headline || "Brand Personality",
        traits:
          foundation?.personality ||
          brand?.foundation?.personality?.traits ||
          [],
      },
      brandVoice: foundation?.voice || brand?.foundation?.brandVoice,
      toneOfVoice:
        foundation?.voice?.principles || brand?.foundation?.toneOfVoice,
      messagingPillars:
        foundation?.messagingPillars || brand?.foundation?.messagingPillars,
      proofPoints: foundation?.proofPoints || brand?.foundation?.proofPoints,
      dos: foundation?.voice?.dos || brand?.foundation?.dos,
      donts: foundation?.voice?.donts || brand?.foundation?.donts,
    },
  };
}

export default function BrandGuidelines({
  project,
  brand,
}: {
  project: any;
  brand: any;
}) {
  const { assets } = useAssets();
  const concept = selectedConcept(assets);
  const moodboard = selectedMoodboard(assets);
  const logo = selectedLogo(assets);
  const saved = savedGuidelines(assets);
  const [logoPalette, setLogoPalette] = useState<any[] | null>(null);
  const logoUrl =
    logo?.imageUrl ||
    logo?.image_url ||
    logo?.file_url ||
    brand?.projectJourney?.existingLogoUrl ||
    "";

  useEffect(() => {
    let cancelled = false;
    if (!project?.id || !logoUrl) {
      setLogoPalette(null);
      return;
    }

    fetch("/api/brand-studio/logo-palette", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, logoUrl }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json();
        return Array.isArray(payload?.palette) ? payload.palette : null;
      })
      .then((palette) => {
        if (!cancelled && palette?.length) setLogoPalette(palette);
      })
      .catch(() => {
        if (!cancelled) setLogoPalette(null);
      });

    return () => {
      cancelled = true;
    };
  }, [project?.id, logoUrl]);

  const contextBrand = useMemo(() => {
    const palette = logoPalette?.length
      ? logoPalette
      : brand?.colourPalette || brand?.colorPalette || [];
    return {
      ...brand,
      colourPalette: palette,
      colorPalette: palette,
      workspaceContext: { selectedDirection: concept, selectedLogo: logo },
    };
  }, [brand, concept, logo, logoPalette]);
  const { loading, guidelines, error, generateGuidelines } =
    useBrandGuidelines({ project, brand: contextBrand });
  const [localError, setLocalError] = useState("");
  const active = guidelines || saved;
  const enhanced = mergeGuidelines(brand, active, concept, logo, logoPalette);
  const journey = normaliseBrandJourney(enhanced, project);
  async function handleGenerate() {
    setLocalError("");
    try {
      const result = await generateGuidelines();
      if (!result) setLocalError("The guideline system could not be generated.");
    } catch (generationError) {
      setLocalError(
        generationError instanceof Error
          ? generationError.message
          : "The guideline system could not be generated.",
      );
    }
  }

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_18px_45px_rgba(55,30,83,.08)]">
        <header className="flex flex-col gap-5 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-violet-700 to-fuchsia-500 text-white shadow-lg shadow-violet-700/20">
              <BookOpenCheck size={22} strokeWidth={2.1} />
            </span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">
                Smart Guidelines
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">
                Foundation, identity, applications and readiness
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                The modules adapt to the {journey.journeyTitle.toLowerCase()} journey
                and its selected deliverables.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="min-h-11 rounded-full bg-violet-700 px-5 text-xs font-black text-white shadow-lg shadow-violet-700/20 transition hover:bg-violet-800 disabled:cursor-wait disabled:opacity-50"
          >
            {loading
              ? "Generating Guidelines…"
              : `${active ? "Update" : "Generate"} Guideline System · ${CREDIT_COSTS.brandGuidelines} credits`}
          </button>
        </header>
        <div className="p-5 sm:p-6">
          {loading && (
            <BrandGenerationState
              title="Structuring the tailored guideline system"
              steps={[
                "Reading the selected project journey",
                "Connecting approved creative direction",
                "Building relevant identity rules",
                "Writing selected application guidance",
                "Preparing the project-specific checklist",
              ]}
            />
          )}
          {(localError || error) && (
            <div className="rounded-[16px] border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
              {localError || error}
            </div>
          )}
          {!loading && !localError && !error && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-violet-700">One guideline workspace</span>
              {logoPalette?.length ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                  Colour palette synced from selected logo
                </span>
              ) : null}
              <span>Use the navigation below to move between Foundation, Identity, Applications and Checklist.</span>
            </div>
          )}
        </div>
      </section>

      <BrandBook
        project={project}
        brand={enhanced}
        assets={assets}
        selectedConcept={concept}
        selectedMoodboard={moodboard}
        selectedLogo={logo}
      />
    </div>
  );
}

