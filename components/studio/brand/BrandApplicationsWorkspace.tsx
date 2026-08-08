"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Download,
  FileOutput,
  ImageIcon,
  Maximize2,
  RefreshCcw,
  WandSparkles,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import BrandGenerationState from "@/components/studio/brand/common/BrandGenerationState";
import BrandImageModal from "@/components/studio/brand/common/BrandImageModal";
import { useActivity } from "@/hooks/use-activity";
import { useAssets } from "@/hooks/use-assets";
import {
  BRAND_APPLICATION_FIELDS,
  getApplicationDeliverables,
  normaliseBrandJourney,
} from "@/lib/brand/project-templates";
import { CREDIT_COSTS } from "@/lib/credits/config";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function readAssetPayload(asset: any) {
  const source = asset?.output_payload || asset?.payload || {};
  if (typeof source === "string") {
    try {
      return JSON.parse(source);
    } catch {
      return {};
    }
  }
  return source && typeof source === "object" ? source : {};
}

function assetUrl(asset: any) {
  const payload = readAssetPayload(asset);
  return (
    asset?.file_url ||
    asset?.thumbnail_url ||
    payload?.imageUrl ||
    payload?.image_url ||
    null
  );
}

function applicationVisualsFromAssets(assets: any[]) {
  const visuals: Record<string, any> = {};
  const approvals: Record<string, any> = {};

  for (const asset of assets) {
    if (asset?.asset_type !== "brand_application_approval") continue;
    const payload = readAssetPayload(asset);
    const applicationId = payload?.applicationId;
    if (typeof applicationId === "string" && !approvals[applicationId]) {
      approvals[applicationId] = {
        ...payload,
        approvalAssetId: asset.id,
        approvedAt: payload?.approvedAt || asset.created_at,
      };
    }
  }

  for (const asset of assets) {
    if (asset?.asset_type !== "brand_application_visual") continue;
    const payload = readAssetPayload(asset);
    const applicationId = payload?.applicationId;
    if (typeof applicationId === "string" && !visuals[applicationId]) {
      const approval = approvals[applicationId];
      const approved = Boolean(
        approval &&
          approval.visualAssetId &&
          String(approval.visualAssetId) === String(asset.id),
      );
      visuals[applicationId] = {
        ...payload,
        imageUrl: assetUrl(asset),
        assetId: asset.id,
        createdAt: asset.created_at,
        approved,
        approval: approved ? approval : null,
      };
    }
  }
  return visuals;
}

type BrandApplicationReferences = {
  logoReferenceUrl: string | null;
  directionReferenceUrl: string | null;
  selectedDirection: any | null;
  referenceImageUrls: string[];
};

function firstNonEmptyUrl(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function logoUrlFromAsset(asset: any) {
  if (!asset) return null;
  const payload = readAssetPayload(asset);
  const selectedIndex =
    typeof payload?.selectedDirection === "number"
      ? payload.selectedDirection
      : typeof payload?.directionIndex === "number"
        ? payload.directionIndex
        : 0;
  const selectedConcept = Array.isArray(payload?.conceptsByDirection)
    ? payload.conceptsByDirection[selectedIndex]
    : null;

  return firstNonEmptyUrl(
    assetUrl(asset),
    selectedConcept?.imageUrl,
    selectedConcept?.image_url,
    payload?.logos?.[0]?.imageUrl,
    payload?.logos?.[0]?.image_url,
  );
}

function selectedDirectionFromAssets(assets: any[]) {
  let selectedIndex: number | null = null;
  let selectedTitle = "";
  let selectedDirection: any | null = null;
  let directionReferenceUrl: string | null = null;

  for (const asset of assets) {
    const payload = readAssetPayload(asset);
    if (selectedIndex === null && typeof payload?.selectedMoodboard === "number") {
      selectedIndex = payload.selectedMoodboard;
    }
    if (!selectedDirection && payload?.selectedConcept) {
      selectedDirection = payload.selectedConcept;
      selectedTitle = String(
        payload.selectedConcept?.title || payload.selectedConcept?.conceptName || "",
      );
    }
  }

  const directionTypes = new Set([
    "creative_direction_selected",
    "moodboard_selected",
    "moodboard_variations",
    "moodboard",
    "creative_directions",
  ]);

  for (const asset of assets) {
    if (!directionTypes.has(String(asset?.asset_type || ""))) continue;
    const payload = readAssetPayload(asset);
    const directions = Array.isArray(payload?.directions)
      ? payload.directions
      : Array.isArray(payload?.moodboards)
        ? payload.moodboards
        : [];
    const localIndex =
      selectedIndex ??
      (typeof payload?.selectedMoodboard === "number" ? payload.selectedMoodboard : 0);
    const byTitle = selectedTitle
      ? directions.find(
          (item: any) =>
            String(item?.title || item?.conceptName || "") === selectedTitle,
        )
      : null;
    const candidate = byTitle || directions[localIndex] || directions[0] || null;

    if (!selectedDirection && candidate) selectedDirection = candidate;
    if (!selectedTitle && candidate) {
      selectedTitle = String(candidate?.title || candidate?.conceptName || "");
    }

    const candidateUrl = firstNonEmptyUrl(
      candidate?.imageUrl,
      candidate?.image_url,
      payload?.selectedConcept?.imageUrl,
      payload?.selectedConcept?.image_url,
      assetUrl(asset),
    );
    if (candidateUrl) {
      directionReferenceUrl = candidateUrl;
      if (candidate) selectedDirection = candidate;
      break;
    }
  }

  return { selectedDirection, directionReferenceUrl };
}

function resolveApplicationReferences(
  assets: any[],
  brand: any,
  journey: any,
): BrandApplicationReferences {
  const logoPriority =
    journey?.logoAction === "keep" || journey?.logoAction === "refine"
      ? ["existing_logo", "logo_selected", "logo_variation", "logo_concept"]
      : ["logo_selected", "logo_variation", "logo_concept", "existing_logo"];

  let logoReferenceUrl: string | null = null;
  for (const type of logoPriority) {
    const asset = assets.find((item) => item?.asset_type === type);
    logoReferenceUrl = logoUrlFromAsset(asset);
    if (logoReferenceUrl) break;
  }

  logoReferenceUrl = firstNonEmptyUrl(
    logoReferenceUrl,
    journey?.existingLogoUrl,
    brand?.projectJourney?.existingLogoUrl,
  );

  const { selectedDirection, directionReferenceUrl } =
    selectedDirectionFromAssets(assets);
  const referenceImageUrls = Array.from(
    new Set(
      [directionReferenceUrl, logoReferenceUrl].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );

  return {
    logoReferenceUrl,
    directionReferenceUrl,
    selectedDirection,
    referenceImageUrls,
  };
}

export default function BrandApplicationsWorkspace({
  project,
  brand,
}: {
  project: any;
  brand: any;
}) {
  const { refreshAccount } = useAuth();
  const { assets, addAsset } = useAssets();
  const { addActivity } = useActivity();
  const journey = normaliseBrandJourney(brand, project);
  const selectedApplications = useMemo(
    () => getApplicationDeliverables(journey.selectedDeliverables),
    [journey.selectedDeliverables],
  );
  const [activeId, setActiveId] = useState(selectedApplications[0]?.id || "");
  const [visuals, setVisuals] = useState<Record<string, any>>(() =>
    applicationVisualsFromAssets(assets),
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null,
  );

  useEffect(() => {
    if (!selectedApplications.some((item) => item.id === activeId)) {
      setActiveId(selectedApplications[0]?.id || "");
    }
  }, [selectedApplications, activeId]);

  useEffect(() => {
    setVisuals((current) => ({
      ...current,
      ...applicationVisualsFromAssets(assets),
    }));
  }, [assets]);

  const active =
    selectedApplications.find((item) => item.id === activeId) ||
    selectedApplications[0];
  const plan = Array.isArray(brand?.applicationPlan)
    ? brand.applicationPlan.find((item: any) => item.id === active?.id)
    : null;
  const brief = active ? journey.applicationBriefs[active.id] || {} : {};
  const briefEntries = active
    ? Object.entries(brief).filter(([, value]) =>
        typeof value === "string" ? value.trim() : Boolean(value),
      )
    : [];
  const activeVisual = active ? visuals[active.id] : null;
  const activeOutputs = useMemo(() => {
    if (!activeVisual) return [];
    const outputs = Array.isArray(activeVisual.outputs) && activeVisual.outputs.length
      ? activeVisual.outputs.filter(
          (item: any) => item && typeof item.imageUrl === "string",
        )
      : activeVisual.imageUrl
        ? [
            {
              id: active?.id || "application",
              label: `${active?.label || "Application"} concept`,
              imageUrl: activeVisual.imageUrl,
              width: activeVisual.width || null,
              height: activeVisual.height || null,
            },
          ]
        : [];

    return active?.id === "business-card" ? outputs.slice(0, 1) : outputs;
  }, [activeVisual, active?.id, active?.label]);
  const applicationReferences = useMemo(
    () => resolveApplicationReferences(assets, brand, journey),
    [assets, brand, journey],
  );
  const {
    logoReferenceUrl,
    directionReferenceUrl,
    selectedDirection,
    referenceImageUrls,
  } = applicationReferences;

  async function generateApplicationVisual() {
    if (!active) return;

    setLoadingId(active.id);
    setError("");

    try {
      const response = await fetch("/api/brand-studio/application-visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          brand,
          application: active,
          plan,
          brief,
          logoReferenceUrl,
          directionReferenceUrl,
          selectedDirection,
          referenceImageUrls,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Application visual generation failed.");
      }
      const returnedOutputs = Array.isArray(data?.outputs)
        ? data.outputs.filter(
            (item: any) => item && typeof item.imageUrl === "string",
          )
        : [];
      const generatedOutputs =
        active.id === "business-card" ? returnedOutputs.slice(0, 1) : returnedOutputs;
      if (!data?.imageUrl && !generatedOutputs.length) {
        throw new Error("The generated application visual was not saved.");
      }
      const firstOutput = generatedOutputs[0] || null;

      const nextVisual = {
        applicationId: active.id,
        applicationLabel: active.label,
        imageUrl: firstOutput?.imageUrl || data.imageUrl,
        storagePath: firstOutput?.storagePath || data.storagePath || null,
        width: firstOutput?.width || data.width || null,
        height: firstOutput?.height || data.height || null,
        outputs: generatedOutputs.length
          ? generatedOutputs
          : [
              {
                id: active.id,
                label: `${active.label} concept`,
                imageUrl: data.imageUrl,
                storagePath: data.storagePath || null,
                width: data.width || null,
                height: data.height || null,
              },
            ],
        exactSize: Boolean(data.exactSize),
        mockup: Boolean(data.mockup),
        tier: "concept",
        logoPreserved: Boolean(data.logoPreserved || logoReferenceUrl),
        creativeDirectionApplied: Boolean(
          data.creativeDirectionApplied || selectedDirection || directionReferenceUrl,
        ),
        selectedDirectionTitle:
          selectedDirection?.title || selectedDirection?.conceptName || null,
        creditsUsed: data.creditsUsed || CREDIT_COSTS.brandApplicationVisual,
        generatedAt: new Date().toISOString(),
        approved: false,
        approval: null,
      };

      setVisuals((current) => ({ ...current, [active.id]: nextVisual }));

      const saved = await addAsset({
        user_id: project.user_id,
        project_id: project.id,
        project_type: "brand",
        asset_type: "brand_application_visual",
        title: `${active.label} AI Visual - ${project.project_name}`,
        input_payload: {
          applicationId: active.id,
          applicationLabel: active.label,
          applicationBrief: brief,
          applicationPlan: plan,
          logoReferenceUrl,
          directionReferenceUrl,
          selectedDirection,
          referenceImageUrls,
        },
        output_payload: nextVisual,
        file_url: nextVisual.imageUrl,
        thumbnail_url: nextVisual.imageUrl,
      });

      setVisuals((current) => ({
        ...current,
        [active.id]: { ...nextVisual, assetId: saved.id },
      }));

      addActivity({
        id: saved.id,
        title: `${active.label} visual generated`,
        description:
          "An AI concept preview was saved. Expert production remains available for polished final files.",
        createdAt: "Now",
      });
      await refreshAccount();
    } catch (generationError) {
      console.error(generationError);
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Application visual generation failed.",
      );
    } finally {
      setLoadingId(null);
    }
  }

  async function approveApplicationVisual() {
    if (!active || !activeVisual?.assetId || !activeOutputs.length) return;

    setApprovingId(active.id);
    setError("");
    try {
      const approvedAt = new Date().toISOString();
      const approvalPayload = {
        applicationId: active.id,
        applicationLabel: active.label,
        visualAssetId: activeVisual.assetId,
        imageUrl: activeVisual.imageUrl,
        outputs: activeOutputs,
        approvedAt,
        status: "approved",
        applicationBrief: brief,
        applicationPlan: plan,
      };

      const approvalAsset = await addAsset({
        user_id: project.user_id,
        project_id: project.id,
        project_type: "brand",
        asset_type: "brand_application_approval",
        title: `${active.label} Approved Concept - ${project.project_name}`,
        input_payload: {
          applicationId: active.id,
          visualAssetId: activeVisual.assetId,
        },
        output_payload: approvalPayload,
        file_url: activeVisual.imageUrl,
        thumbnail_url: activeVisual.imageUrl,
      });

      setVisuals((current) => ({
        ...current,
        [active.id]: {
          ...current[active.id],
          approved: true,
          approval: {
            ...approvalPayload,
            approvalAssetId: approvalAsset.id,
          },
        },
      }));

      addActivity({
        id: approvalAsset.id,
        title: `${active.label} concept approved`,
        description:
          "The selected application concept is now confirmed for Guidelines and optional expert production.",
        createdAt: "Now",
      });
    } catch (approvalError) {
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "The application concept could not be approved.",
      );
    } finally {
      setApprovingId(null);
    }
  }

  async function downloadVisual(outputIndex = 0) {
    if (!active || !activeOutputs[outputIndex]?.imageUrl) return;
    setError("");
    try {
      let response: Response;
      if (activeVisual?.assetId) {
        const supabase = createSupabaseBrowserClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (sessionError || !token) {
          throw new Error("Your session expired. Sign in again.");
        }
        response = await fetch(
          `/api/assets/download?assetId=${encodeURIComponent(activeVisual.assetId)}&index=${outputIndex}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } else {
        response = await fetch(activeOutputs[outputIndex].imageUrl, {
          cache: "no-store",
        });
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "The asset could not be downloaded.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const fallbackOutput = activeOutputs[outputIndex];
      const filename =
        disposition.match(/filename="([^"]+)"/)?.[1] ||
        fallbackOutput?.filename ||
        `${project.project_name || "brand"}-${active.id}-${outputIndex + 1}.webp`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "The asset could not be downloaded.",
      );
    }
  }

  if (!selectedApplications.length) {
    return (
      <section className="rounded-[28px] border border-dashed border-violet-300 bg-violet-50 p-10 text-center">
        <p className="text-sm font-black text-violet-800">
          No standalone applications are included in this project.
        </p>
        <p className="mt-2 text-xs leading-5 text-violet-600">
          Add an application later without changing the rest of the brand journey.
        </p>
      </section>
    );
  }

  const isSingle = selectedApplications.length === 1;

  return (
    <div className="brand-applications-workspace grid gap-5">
      <section className="overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_18px_45px_rgba(55,30,83,.08)]">
        <header className="flex flex-col gap-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-white p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">
              {isSingle ? active?.label : "Applications"}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">
              {isSingle
                ? `${active?.label} workspace`
                : "Generate concepts for every selected application"}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Generate an AI visual first, then send the selected concept to Heyy
              Studio only when polished, editable and production-ready files are
              required.
            </p>
          </div>
          <span className="rounded-full bg-violet-700 px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-white">
            {selectedApplications.length} selected
          </span>
        </header>

        <div
          className={`grid min-w-0 ${
            isSingle ? "" : "lg:grid-cols-[330px_minmax(0,1fr)]"
          }`}
        >
          {!isSingle && (
            <nav className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
              <div className="grid gap-2">
                {selectedApplications.map((item) => {
                  const generated = Boolean(visuals[item.id]?.imageUrl);
                  const approved = Boolean(visuals[item.id]?.approved);
                  const selected = activeId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveId(item.id)}
                      className={`rounded-[16px] border p-4 text-left transition ${
                        selected
                          ? "border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-600/15"
                          : "border-slate-200 bg-white text-slate-800 hover:border-violet-400"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className={`text-[8px] font-black uppercase tracking-[0.15em] ${
                            selected ? "text-white/70" : "text-violet-600"
                          }`}
                        >
                          {item.category}
                        </p>
                        {generated && (
                          <BadgeCheck
                            size={16}
                            className={
                              selected
                                ? "text-white"
                                : approved
                                  ? "text-emerald-600"
                                  : "text-amber-500"
                            }
                          />
                        )}
                      </div>
                      <p className="mt-1 text-sm font-black">{item.label}</p>
                      <p
                        className={`mt-2 text-xs leading-5 ${
                          selected ? "text-white/75" : "text-slate-500"
                        }`}
                      >
                        {approved
                          ? "Approved concept"
                          : generated
                            ? "Generated · approval needed"
                            : item.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </nav>
          )}

          {active && (
            <div className="grid gap-5 p-5 sm:p-6">
              <div className="rounded-[22px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">
                  {active.category}
                </p>
                <h3 className="mt-2 text-3xl font-black tracking-[-0.045em] text-slate-950">
                  {active.label}
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  {plan?.objective || active.description}
                </p>

                {briefEntries.length > 0 && (
                  <div className="mt-5 rounded-[18px] border border-blue-200 bg-blue-50 p-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-blue-700">
                      Saved {active.label} content
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {briefEntries.map(([key, value]) => (
                        <div key={key} className="rounded-[13px] bg-white px-3 py-3">
                          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
                            {BRAND_APPLICATION_FIELDS[active.id]?.find(
                              (field) => field.id === key,
                            )?.label || key}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-xs font-bold leading-5 text-slate-700">
                            {String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <ApplicationBlock
                    title="Content needed"
                    items={
                      plan?.contentNeeds?.length
                        ? plan.contentNeeds
                        : defaultContent(active.id)
                    }
                  />
                  <ApplicationBlock
                    title="Design priorities"
                    items={
                      plan?.designPriorities?.length
                        ? plan.designPriorities
                        : defaultPriorities(active.id)
                    }
                  />
                </div>
              </div>

              <section className="overflow-hidden rounded-[22px] border border-violet-200 bg-white shadow-[0_16px_36px_rgba(76,29,149,.08)]">
                <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
                  <div className="relative min-h-[360px] bg-gradient-to-br from-slate-100 via-white to-violet-100 p-4">
                    {loadingId === active.id ? (
                      <div className="flex h-full min-h-[330px] items-center justify-center rounded-[18px] border border-violet-200 bg-white">
                        <BrandGenerationState
                          title={`Generating ${active.label}`}
                          steps={[
                            "Reading the saved brand system",
                            "Applying the application brief",
                            "Using the selected logo or direction",
                            "Generating the visual concept",
                            "Saving it to project assets",
                          ]}
                        />
                      </div>
                    ) : activeOutputs.length ? (
                      <div
                        className={`grid h-full min-h-[330px] gap-3 ${
                          activeOutputs.length > 1
                            ? "sm:grid-cols-2"
                            : "grid-cols-1"
                        }`}
                      >
                        {activeOutputs.map((output: any, outputIndex: number) => (
                          <article
                            key={`${output.id || outputIndex}-${output.imageUrl}`}
                            className="group relative flex min-h-[300px] flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setPreview({
                                  url: output.imageUrl,
                                  title: output.label || `${active.label} output`,
                                })
                              }
                              className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-50 p-2"
                            >
                              <img
                                src={output.imageUrl}
                                alt={output.label || `${active.label} output`}
                                className="max-h-[520px] w-full object-contain transition duration-500 group-hover:scale-[1.012]"
                              />
                              <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/75 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                                <Maximize2 size={15} />
                              </span>
                            </button>
                            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-black text-slate-900">
                                  {output.label || `${active.label} output`}
                                </p>
                                {output.width && output.height && (
                                  <p className="mt-0.5 text-[9px] font-bold text-slate-400">
                                    {output.width} × {output.height} px
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => downloadVisual(outputIndex)}
                                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-[9px] font-black text-slate-700 transition hover:border-violet-300 hover:text-violet-700"
                              >
                                <Download size={13} /> Download
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[330px] flex-col items-center justify-center rounded-[18px] border border-dashed border-violet-300 bg-white/80 p-8 text-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-violet-100 text-violet-700">
                          <ImageIcon size={28} />
                        </span>
                        <h4 className="mt-5 text-xl font-black tracking-[-0.03em] text-slate-950">
                          Generate the visual concept first
                        </h4>
                        <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
                          Heyy Studio will use the saved brand system, logo or creative
                          direction, and this application brief to create a visual preview.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-between border-t border-violet-100 p-5 lg:border-l lg:border-t-0 sm:p-6">
                    <div>
                      <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-violet-700 text-white">
                        <WandSparkles size={21} />
                      </span>
                      <p className="mt-5 text-[9px] font-black uppercase tracking-[0.16em] text-violet-600">
                        AI concept preview
                      </p>
                      <h4 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
                        See the application before production
                      </h4>
                      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                        Generate direct-size visual assets using the exact saved logo,
                        exact entered content and selected creative direction. Expert
                        production remains available for editable or technically tested files.
                      </p>

                      {(logoReferenceUrl || directionReferenceUrl) && (
                        <div className="mt-4 grid gap-2 rounded-[15px] border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-5 text-emerald-800">
                          {logoReferenceUrl && (
                            <p>✓ The exact selected logo will be used inside the generated application.</p>
                          )}
                          {directionReferenceUrl && (
                            <p>✓ The selected creative-direction visual and its saved art direction will guide the final design.</p>
                          )}
                        </div>
                      )}

                      {error && (
                        <div className="mt-4 rounded-[15px] border border-rose-200 bg-rose-50 p-3 text-xs font-bold leading-5 text-rose-700">
                          {error}
                        </div>
                      )}
                    </div>

                    <div className="mt-6 grid gap-2">
                      {activeOutputs.length > 0 && (
                        <button
                          type="button"
                          onClick={approveApplicationVisual}
                          disabled={
                            approvingId === active.id || Boolean(activeVisual?.approved)
                          }
                          className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-5 text-xs font-black transition disabled:cursor-default ${
                            activeVisual?.approved
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                          }`}
                        >
                          <BadgeCheck size={16} />
                          {activeVisual?.approved
                            ? "Concept approved"
                            : approvingId === active.id
                              ? "Approving concept…"
                              : "Approve this concept"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={generateApplicationVisual}
                        disabled={loadingId === active.id}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-violet-700 px-5 text-xs font-black text-white transition hover:bg-violet-800 disabled:cursor-wait disabled:opacity-60"
                      >
                        {activeOutputs.length ? (
                          <RefreshCcw size={16} />
                        ) : (
                          <WandSparkles size={16} />
                        )}
                        {active.id === "business-card"
                          ? activeOutputs.length
                            ? "Regenerate Preview"
                            : "Generate Preview"
                          : active.id === "social-system"
                            ? activeOutputs.length
                              ? "Regenerate Previews"
                              : "Generate Previews"
                            : activeOutputs.length
                              ? "Regenerate Assets"
                              : "Generate Assets"}
                        <span className="rounded-full bg-white/15 px-2 py-1 text-[9px]">
                          {CREDIT_COSTS.brandApplicationVisual} credits
                        </span>
                      </button>

                      {activeOutputs.length === 1 && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPreview({
                                url: activeOutputs[0].imageUrl,
                                title: activeOutputs[0].label || `${active.label} output`,
                              })
                            }
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-violet-300 bg-white px-4 text-[10px] font-black text-violet-700 transition hover:bg-violet-50"
                          >
                            <Maximize2 size={14} /> Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadVisual(0)}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-[10px] font-black text-slate-700 transition hover:border-violet-300 hover:text-violet-700"
                          >
                            <Download size={14} /> Download
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[22px] border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-violet-50 p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-slate-950 text-white">
                      <FileOutput size={20} />
                    </span>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-700">
                        Optional expert production
                      </p>
                      <h4 className="mt-1 text-lg font-black text-slate-950">
                        Need polished final {active.label.toLowerCase()} files?
                      </h4>
                      <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-600">
                        Send the approved AI concept to Heyy Studio for editable,
                        correctly sized, tested and production-ready delivery.
                      </p>
                    </div>
                  </div>
                  {activeVisual?.approved ? (
                    <a
                      href={`?tab=production&scope=${encodeURIComponent(active.id)}`}
                      className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-xs font-black text-white transition hover:bg-violet-700"
                    >
                      Send approved concept to Production <ArrowRight size={15} />
                    </a>
                  ) : (
                    <div className="max-w-[250px] rounded-[14px] border border-amber-300 bg-amber-50 px-4 py-3 text-center text-[10px] font-black leading-5 text-amber-800">
                      Approve a generated concept before sending it to Production.
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </section>

      <BrandImageModal
        imageUrl={preview?.url || null}
        title={preview?.title || "Application visual"}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

function ApplicationBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-4">
      <p className="text-[8px] font-black uppercase tracking-[0.15em] text-violet-600">
        {title}
      </p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div
            key={item}
            className="flex gap-2 text-xs font-bold leading-5 text-slate-700"
          >
            <span className="text-violet-600">✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function defaultContent(id: string) {
  const map: Record<string, string[]> = {
    "business-card": [
      "Name and role",
      "Phone and email",
      "Website and address",
      "Approved logo and colours",
    ],
    letterhead: [
      "Business details",
      "Document hierarchy",
      "Legal/footer information",
      "Approved logo variants",
    ],
    envelope: [
      "Sender details",
      "Mailing format",
      "Approved logo",
      "Print size and stock",
    ],
    "email-signature": [
      "Name and role",
      "Contact details",
      "Website/social links",
      "Logo and disclaimer",
    ],
    presentation: [
      "Cover slide",
      "Content hierarchy",
      "Charts and image rules",
      "Closing/contact slide",
    ],
    "social-system": [
      "Post categories",
      "Copy hierarchy",
      "Image formats",
      "Campaign examples",
    ],
    website: [
      "Homepage purpose",
      "Primary CTA",
      "Content sections",
      "Responsive priorities",
    ],
    packaging: [
      "Product information",
      "Regulatory content",
      "Dieline/size",
      "Material and finish",
    ],
    signage: [
      "Viewing distance",
      "Physical size",
      "Material",
      "Mounting/location",
    ],
    merchandise: [
      "Item type",
      "Print/embroidery area",
      "Colour variants",
      "Supplier specifications",
    ],
  };
  return (
    map[id] || [
      "Approved brand assets",
      "Final content",
      "Required sizes",
      "Production specifications",
    ]
  );
}

function defaultPriorities(id: string) {
  const map: Record<string, string[]> = {
    "business-card": [
      "Immediate readability",
      "Clear hierarchy",
      "Premium tactility",
      "Correct print setup",
    ],
    letterhead: [
      "Professional document hierarchy",
      "Usable writing area",
      "Print consistency",
      "Digital compatibility",
    ],
    "email-signature": [
      "Mobile readability",
      "Email-client compatibility",
      "Small logo clarity",
      "Accessible links",
    ],
    presentation: [
      "Repeatable master layouts",
      "Strong hierarchy",
      "Editable content",
      "Consistent image treatment",
    ],
    "social-system": [
      "Fast recognition",
      "Flexible templates",
      "Campaign consistency",
      "Platform-safe dimensions",
    ],
  };
  return (
    map[id] || [
      "Brand consistency",
      "Clear hierarchy",
      "Correct dimensions",
      "Production readiness",
    ]
  );
}
