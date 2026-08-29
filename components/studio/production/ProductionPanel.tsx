"use client";

import { type CSSProperties, useEffect, useState } from "react";
import ClientProductionWorkspace from "@/components/studio/production/ClientProductionWorkspace";
import { getStudioIdentity } from "../../../lib/studio/studio-identity";
import { createSupabaseBrowserClient } from "../../../lib/supabase";
import { resolveProductionService } from "@/lib/production/service-registry";

type ProductionPanelProps = {
  project: any;
  brand: any;
  service: string;
  serviceId?: string;
  studio?: string;
  previewImage?: string;
  description?: string;
  usage?: string;
  expertNote?: string;
  buttonLabel?: string;
};

async function getAccessToken() {
  const supabase = createSupabaseBrowserClient();
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (sessionError || !token) {
    throw new Error("Your session expired. Sign in again.");
  }

  return token;
}

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

function compactOutput(output: any, index: number) {
  if (!output || typeof output !== "object") return null;
  const imageUrl =
    output.imageUrl || output.image_url || output.file_url || output.thumbnail_url || null;
  if (!imageUrl) return null;
  return {
    id: output.id || `output-${index + 1}`,
    label: output.label || output.title || `Output ${index + 1}`,
    imageUrl,
    storagePath: output.storagePath || output.storage_path || null,
    width: output.width || null,
    height: output.height || null,
  };
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function firstText(...values: unknown[]) {
  return values.find((value) => typeof value === "string" && value.trim()) as string | undefined;
}

function architectureAssetUrl(asset: any, payload: Record<string, any>, outputs: any[]) {
  const metadata = recordValue(asset?.metadata);
  const nested = [
    asset?.final_assets,
    asset?.rendered_final_assets,
    asset?.preview_assets,
    asset?.rendered_preview_assets,
    asset?.technical_assets,
    metadata.final_assets,
    metadata.rendered_final_assets,
    metadata.preview_assets,
    metadata.rendered_preview_assets,
    metadata.technical_assets,
  ].map(recordValue);

  return firstText(
    asset?.file_url,
    asset?.image_url,
    asset?.thumbnail_url,
    payload?.imageUrl,
    payload?.image_url,
    ...nested.flatMap((item) => [item.preview_url, item.master_url, item.thumbnail_url]),
    outputs[0]?.imageUrl,
  ) || null;
}

function architectureStoragePath(asset: any, payload: Record<string, any>) {
  const metadata = recordValue(asset?.metadata);
  const nested = [
    asset?.final_assets,
    asset?.rendered_final_assets,
    asset?.preview_assets,
    asset?.rendered_preview_assets,
    asset?.technical_assets,
    metadata.final_assets,
    metadata.rendered_final_assets,
    metadata.preview_assets,
    metadata.rendered_preview_assets,
    metadata.technical_assets,
  ].map(recordValue);

  return firstText(
    asset?.storage_path,
    asset?.image_storage_path,
    metadata.storage_path,
    metadata.image_storage_path,
    payload?.storagePath,
    payload?.storage_path,
    ...nested.flatMap((item) => [item.preview_storage_path, item.master_storage_path, item.thumbnail_storage_path]),
  ) || null;
}

function compactProductionAsset(asset: any) {
  const payload = readAssetPayload(asset);
  const outputs = Array.isArray(payload?.outputs)
    ? payload.outputs
        .map((output: any, index: number) => compactOutput(output, index))
        .filter(Boolean)
    : [];
  const fileUrl = architectureAssetUrl(asset, payload, outputs);
  const storagePath = architectureStoragePath(asset, payload);

  return {
    id: asset?.id || null,
    asset_type: asset?.asset_type || null,
    group: asset?.group || recordValue(asset?.metadata).group || null,
    visual_type: asset?.visual_type || recordValue(asset?.metadata).view_type || null,
    title: asset?.title || asset?.name || asset?.asset_type || asset?.visual_type || "Generated asset",
    is_approved: asset?.is_approved ?? (recordValue(asset?.metadata).approved === true || recordValue(asset?.metadata).approved === "true"),
    file_url: fileUrl,
    image_url: fileUrl,
    storage_path: storagePath,
    thumbnail_url: asset?.thumbnail_url || null,
    created_at: asset?.created_at || null,
    technical_assets: asset?.technical_assets || recordValue(asset?.metadata).technical_assets || null,
    rendered_preview_assets: asset?.rendered_preview_assets || recordValue(asset?.metadata).rendered_preview_assets || null,
    rendered_final_assets: asset?.rendered_final_assets || recordValue(asset?.metadata).rendered_final_assets || null,
    preview_assets: asset?.preview_assets || recordValue(asset?.metadata).preview_assets || null,
    final_assets: asset?.final_assets || recordValue(asset?.metadata).final_assets || null,
    payload: {
      applicationId: payload?.applicationId || null,
      applicationLabel: payload?.applicationLabel || null,
      imageUrl: payload?.imageUrl || payload?.image_url || fileUrl,
      storagePath,
      width: payload?.width || null,
      height: payload?.height || null,
      outputs,
      selectedDirectionTitle: payload?.selectedDirectionTitle || null,
      logoPreserved: payload?.logoPreserved ?? null,
      creativeDirectionApplied: payload?.creativeDirectionApplied ?? null,
    },
  };
}

function collectGeneratedAssets(context: any) {
  if (!context || typeof context !== "object") return [];
  const direct = Array.isArray(context.all_generated_outputs) ? context.all_generated_outputs : [];
  if (direct.length) return direct;

  const candidates = [
    context.concept_plans,
    context.generated_plans,
    context.approved_visuals,
    context.generated_visuals,
    context.visuals,
    context.renders,
  ].flatMap((value) => Array.isArray(value) ? value : []);

  const seen = new Set<string>();
  return candidates.filter((asset: any, index: number) => {
    const key = String(asset?.id || asset?.file_url || asset?.image_url || `${asset?.asset_type || asset?.visual_type || "asset"}-${index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compactProjectContext(context: any) {
  if (!context || typeof context !== "object") return {};
  return {
    summary: context.summary || null,
    foundation: context.foundation || null,
    brandStrategy: context.brandStrategy || null,
    brandVoice: context.brandVoice || null,
    personality: context.personality || null,
    colourPalette: context.colourPalette || null,
    typography: context.typography || null,
    projectJourney: context.projectJourney || null,
    applicationPlan: context.applicationPlan || null,
    applicationBriefs: context.applicationBriefs || null,
    production_scope: context.production_scope || null,
    production_scope_id: context.production_scope_id || null,
    final_file_requirements: context.final_file_requirements || null,
    selected_brand_applications: context.selected_brand_applications || null,
  };
}

function listText(values: unknown) {
  return Array.isArray(values)
    ? values.filter((value) => typeof value === "string" && value.trim()).join("\n- ")
    : "";
}

export default function ProductionPanel({
  project,
  brand,
  service: serviceInput,
  serviceId,
  studio = "brand_studio",
  previewImage,
  description,
  usage,
  expertNote,
  buttonLabel = "Start Production →",
}: ProductionPanelProps) {
  const productionService = resolveProductionService({
    serviceId,
    service: serviceInput,
    studio,
  });
  const service = productionService.label;
  const canonicalServiceId = productionService.id;
  const projectName = project?.project_name || project?.name || "Project";
  const studioIdentity = getStudioIdentity(studio);
  const contextItems = getProductionContextItems(studio, brand);
  const generatedAssets = collectGeneratedAssets(brand);

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [job, setJob] = useState<any>(null);
  const [requestRecord, setRequestRecord] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [timeline, setTimeline] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [deliverableGroups, setDeliverableGroups] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);

  async function loadDeliverables(accessToken?: string) {
    if (!project?.id || !service) return;

    const token = accessToken || (await getAccessToken());
    const response = await fetch(
      `/api/production/client-deliverables?projectId=${project.id}&serviceId=${encodeURIComponent(
        canonicalServiceId,
      )}&service=${encodeURIComponent(service)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const data = await response.json();

    if (data.success) {
      setDeliverables(data.deliverables || []);
      setDeliverableGroups(data.groups || []);
    }
  }

  async function loadQuotes(accessToken?: string) {
    if (!project?.id) return;

    const token = accessToken || (await getAccessToken());
    const response = await fetch(
      `/api/quotes/project?projectId=${project.id}&serviceId=${encodeURIComponent(canonicalServiceId)}&service=${encodeURIComponent(service)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const data = await response.json();

    if (data.success) {
      setQuotes(data.quotes || []);
    }
  }

  async function checkProductionStatus() {
    if (!project?.id || !service) return;

    setChecking(true);
    setStatusError("");

    try {
      const token = await getAccessToken();
      const response = await fetch(
        `/api/production/client-status?projectId=${project.id}&serviceId=${encodeURIComponent(
          canonicalServiceId,
        )}&service=${encodeURIComponent(service)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load production status.");
      }

      setRequestRecord(data.request || null);

      if (data.exists) {
        setJob(data.job);
        setStatus(data.job.status || "Waiting Assignment");
        setTimeline(data.timeline || []);
        await loadDeliverables(token);
        await loadQuotes(token);
      } else {
        setJob(null);
        setStatus("");
        setTimeline([]);
        setDeliverables([]);
        setDeliverableGroups([]);
        await loadQuotes(token);
      }
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "Could not load production status.",
      );
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkProductionStatus();
  }, [project?.id, canonicalServiceId]);

  async function startProduction() {
    setSubmitting(true);

    try {
      const compactAssets = generatedAssets.map(compactProductionAsset);
      const compactContext = compactProjectContext(brand);
      const requiredOutputs = listText(brand?.final_file_requirements);
      const projectBrief = [
        "Production Request",
        "",
        `Project: ${projectName}`,
        `Project ID: ${project?.id || "Not available"}`,
        `Studio: ${studioIdentity.label}`,
        `Service: ${service}`,
        "",
        "Scope",
        description || "Not provided",
        "",
        "Best Used For",
        usage || "Not provided",
        "",
        "Expert Production Note",
        expertNote || "Not provided",
        requiredOutputs ? "" : null,
        requiredOutputs ? "Required Final Files" : null,
        requiredOutputs ? `- ${requiredOutputs}` : null,
        "",
        `Visual references attached: ${compactAssets.length}`,
      ]
        .filter((value): value is string => typeof value === "string")
        .join("\n")
        .trim();

      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const response = await fetch("/api/studio-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          notes:
            notes ||
            `Please turn the ${service} concept into production-ready files.`,
          project_brief: projectBrief,
          attachments: [],
          metadata: {
            project_id: project?.id || null,
            project_name: projectName,
            studio,
            service,
            service_id: canonicalServiceId,
            production_type: service,
            preview_image: previewImage ||
              compactAssets.find(
                (asset: ReturnType<typeof compactProductionAsset>) => asset.file_url,
              )?.file_url ||
              null,
            description,
            usage,
            expertNote,
            context_items: contextItems,
            project_context: compactContext,
            generated_assets: compactAssets,
            generated_asset_count: compactAssets.length,
            project_context_type: studioIdentity.id,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not start production.");
      }

      setRequestRecord(data.request || null);
      await checkProductionStatus();
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadFile(path: string) {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Your session expired. Sign in again.");
      }

      const response = await fetch("/api/production/download-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ path }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not create download link");
      }

      const link = document.createElement("a");
      link.href = data.url;
      link.download = data.filename || "production-file";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not download file",
      );
    }
  }

  const latestQuote = quotes[0];
  const requestSubmitted = !job && !latestQuote && !!requestRecord;
  const quoteReady =
    latestQuote &&
    (latestQuote.status === "Sent" || latestQuote.status === "Accepted");
  const delivered = status === "Delivered";

  return (
    <section
      className="heyy-production-panel"
      style={{
        "--production-accent": studioIdentity.accent,
        "--production-accent-strong": studioIdentity.id === "architecture_studio" ? "#0f5fbd" : studioIdentity.accent,
        "--production-accent-soft": studioIdentity.soft,
        "--production-accent-border": studioIdentity.border,
      } as CSSProperties}
    >
      <style>{`
        .heyy-production-panel {
          overflow: hidden !important;
          border: 1px solid var(--production-accent-border) !important;
          border-radius: 24px !important;
          background:
            radial-gradient(circle at 16% 15%, rgba(255,255,255,.13), transparent 24%),
            linear-gradient(135deg,var(--production-accent-strong) 0%,var(--production-accent) 58%,color-mix(in srgb,var(--production-accent) 68%,#ffffff) 100%) !important;
          padding: 24px !important;
          color: #fff !important;
          box-shadow: 0 20px 44px color-mix(in srgb,var(--production-accent) 24%,transparent) !important;
        }

        .heyy-production-panel .heyy-production-eyebrow,
        .heyy-production-panel .heyy-production-title,
        .heyy-production-panel .heyy-production-copy {
          color: #fff !important;
        }

        .heyy-production-grid {
          display: grid;
          gap: 22px;
          align-items: start;
        }

        .heyy-production-card {
          min-width: 0;
          border: 1px solid rgba(255,255,255,.86) !important;
          border-radius: 22px !important;
          background: #fff !important;
          color: #17151f !important;
          padding: 18px !important;
          box-shadow: 0 18px 36px rgba(42,0,88,.20) !important;
        }

        .heyy-production-card * {
          box-sizing: border-box;
        }

        .heyy-benefit {
          min-height: 52px;
          border: 1px solid rgba(255,255,255,.28) !important;
          background: rgba(255,255,255,.12) !important;
          color: #fff !important;
          padding: 11px 12px !important;
        }

        .heyy-benefit-icon {
          display: flex !important;
          width: 27px !important;
          height: 27px !important;
          flex: 0 0 27px !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 9px !important;
          background: #12a964 !important;
          color: #fff !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          box-shadow: 0 7px 15px rgba(0,55,30,.18) !important;
        }

        .heyy-status-icon {
          display: flex !important;
          width: 44px !important;
          height: 44px !important;
          flex: 0 0 44px !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 14px !important;
          background: #12a964 !important;
          color: #fff !important;
          font-size: 18px !important;
          font-weight: 900 !important;
          box-shadow: 0 9px 20px rgba(18,169,100,.22) !important;
        }

        .heyy-current-status {
          border: 1px solid #dbe2ea !important;
          border-radius: 16px !important;
          background: #f8fafc !important;
          padding: 13px 14px !important;
        }

        .heyy-current-status-chip {
          display: inline-flex !important;
          min-height: 29px !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 999px !important;
          background: #e7fff1 !important;
          color: #087542 !important;
          padding: 0 11px !important;
          font-size: 9px !important;
          font-weight: 900 !important;
          letter-spacing: .11em !important;
          text-transform: uppercase !important;
          white-space: nowrap !important;
        }

        .heyy-accordion {
          overflow: hidden !important;
          border: 1px solid #e1d9ea !important;
          border-radius: 16px !important;
          background: #fff !important;
        }

        .heyy-accordion-button {
          display: flex !important;
          width: 100% !important;
          min-height: 58px !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 14px !important;
          border: 0 !important;
          background: #f8f7fb !important;
          color: #17151f !important;
          padding: 12px 14px !important;
          text-align: left !important;
          transition: all 180ms ease !important;
        }

        .heyy-accordion-button:hover {
          background: var(--production-accent-soft) !important;
          color: var(--production-accent-strong) !important;
        }

        .heyy-accordion-button[data-open="true"] {
          background: var(--production-accent-soft) !important;
          color: var(--production-accent-strong) !important;
        }

        .heyy-accordion-icon {
          display: flex !important;
          width: 34px !important;
          height: 34px !important;
          flex: 0 0 34px !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 11px !important;
          background: var(--production-accent) !important;
          color: #fff !important;
          font-size: 14px !important;
          font-weight: 900 !important;
        }

        .heyy-accordion-chevron {
          display: flex !important;
          width: 29px !important;
          height: 29px !important;
          flex: 0 0 29px !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1px solid #d7ccdf !important;
          border-radius: 999px !important;
          background: #fff !important;
          color: var(--production-accent-strong) !important;
          transition: transform 180ms ease !important;
        }

        .heyy-accordion-button[data-open="true"] .heyy-accordion-chevron {
          transform: rotate(180deg);
        }

        .heyy-accordion-body {
          max-height: 390px;
          overflow-y: auto;
          overscroll-behavior: contain;
          border-top: 1px solid #e6dfee !important;
          background: #fff !important;
          padding: 14px !important;
          scrollbar-width: thin;
          scrollbar-color: var(--production-accent) #f1edf6;
        }

        .heyy-accordion-body::-webkit-scrollbar {
          width: 8px;
        }

        .heyy-accordion-body::-webkit-scrollbar-track {
          background: #f1edf6;
          border-radius: 999px;
        }

        .heyy-accordion-body::-webkit-scrollbar-thumb {
          background: var(--production-accent);
          border-radius: 999px;
        }

        .heyy-accordion-body [class*="bg-black"] {
          background: #f8fafc !important;
        }

        .heyy-accordion-body [class*="border-white"] {
          border-color: #dbe2ea !important;
        }

        .heyy-accordion-body textarea {
          border-color: var(--production-accent-border) !important;
          background: #fff !important;
          color: #17151f !important;
        }

        .heyy-accordion-body textarea::placeholder {
          color: #94a3b8 !important;
        }

        .heyy-accordion-body button:not(.heyy-accordion-button) {
          border-color: var(--production-accent) !important;
          background: var(--production-accent) !important;
          color: #fff !important;
        }

        .heyy-accordion-body button:not(.heyy-accordion-button):hover:not(:disabled) {
          border-color: var(--production-accent-strong) !important;
          background: var(--production-accent-strong) !important;
          color: #fff !important;
        }

        .heyy-timeline-list {
          display: grid;
          gap: 8px;
        }

        .heyy-timeline-item {
          display: flex;
          gap: 10px;
          border: 1px solid #e2e8f0 !important;
          border-radius: 13px !important;
          background: #f8fafc !important;
          padding: 10px 11px !important;
        }

        .heyy-timeline-icon {
          display: flex !important;
          width: 23px !important;
          height: 23px !important;
          flex: 0 0 23px !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 8px !important;
          background: var(--production-accent) !important;
          color: #fff !important;
          font-size: 9px !important;
          font-weight: 900 !important;
        }

        .heyy-accept-quote {
          display: inline-flex !important;
          width: 100% !important;
          min-height: 48px !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1px solid var(--production-accent) !important;
          border-radius: 16px !important;
          background: var(--production-accent) !important;
          color: #fff !important;
          padding: 0 22px !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          box-shadow: 0 11px 24px color-mix(in srgb,var(--production-accent) 28%,transparent) !important;
          transition: all 180ms ease !important;
        }

        .heyy-accept-quote:hover {
          transform: translateY(-2px);
          border-color: var(--production-accent-strong) !important;
          background: var(--production-accent-strong) !important;
          color: #fff !important;
          box-shadow: 0 15px 29px color-mix(in srgb,var(--production-accent) 34%,transparent) !important;
        }

        .heyy-quote-question {
          display: inline-flex !important;
          width: 100% !important;
          min-height: 46px !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1px solid #cfc7d8 !important;
          border-radius: 16px !important;
          background: #fff !important;
          color: #4a4350 !important;
          padding: 0 22px !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          transition: all 180ms ease !important;
        }

        .heyy-quote-question:hover {
          border-color: var(--production-accent) !important;
          background: var(--production-accent-soft) !important;
          color: var(--production-accent-strong) !important;
        }

        .heyy-quote-question-form {
          margin-top: 12px !important;
          border: 1px solid #ddd3e8 !important;
          border-radius: 16px !important;
          background: #faf8fd !important;
          padding: 13px !important;
        }

        .heyy-quote-question-textarea {
          width: 100% !important;
          min-height: 100px !important;
          resize: vertical !important;
          border: 1px solid #d9d1e2 !important;
          border-radius: 13px !important;
          background: #fff !important;
          color: #17151f !important;
          padding: 12px !important;
          font-size: 12px !important;
          line-height: 1.7 !important;
          outline: none !important;
        }

        .heyy-quote-question-textarea:focus {
          border-color: var(--production-accent) !important;
          box-shadow: 0 0 0 4px var(--production-accent-soft) !important;
        }

        .heyy-payment-message {
          margin-top: 12px !important;
          border: 1px solid #bfdbfe !important;
          border-radius: 13px !important;
          background: #eff6ff !important;
          color: #1d4ed8 !important;
          padding: 10px 12px !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          line-height: 1.6 !important;
        }

        .heyy-payment-message[data-success="true"] {
          border-color: #bbf7d0 !important;
          background: #f0fdf4 !important;
          color: #15803d !important;
        }

        .heyy-production-panel button {
          position: relative;
          overflow: visible !important;
        }

        @media (min-width: 980px) {
          .heyy-production-grid:not([data-workspace="true"]) {
            grid-template-columns: minmax(0,.88fr) minmax(360px,1.12fr);
          }
        }

        .heyy-production-grid[data-workspace="true"] {
          grid-template-columns: minmax(0,1fr) !important;
        }

        @media (max-width: 640px) {
          .heyy-production-panel {
            padding: 18px !important;
          }

          .heyy-production-card {
            padding: 14px !important;
          }
        }
      `}</style>

      <p className="heyy-production-eyebrow text-[10px] font-black uppercase tracking-[0.24em]">
        Production
      </p>

      {statusError && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <div>
            <p className="text-xs font-black">Production status could not be loaded</p>
            <p className="mt-1 text-[11px] font-semibold opacity-80">{statusError}</p>
          </div>
          <button
            type="button"
            onClick={() => void checkProductionStatus()}
            disabled={checking}
            className="rounded-full border border-current px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] disabled:opacity-50"
          >
            {checking ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}

      {checking && !job && !requestRecord && quotes.length === 0 && !statusError && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-xs font-bold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          Checking the latest production status...
        </div>
      )}

      <div className="heyy-production-grid mt-4" data-workspace={job ? "true" : "false"}>
        <div>
          <h3 className="heyy-production-title text-3xl font-black tracking-[-0.05em] md:text-4xl">
            {job
              ? delivered
                ? "Production complete."
                : "Production in progress."
              : requestSubmitted
                ? "Production request received."
                : `Ready to produce ${service}?`}
          </h3>

          <p className="heyy-production-copy mt-4 max-w-xl text-sm leading-7">
            {job
              ? delivered
                ? "Your production files are ready. Messages, revisions, final files and project activity are organised in one connected workspace."
                : "Your payment has been received and production has started."
              : requestSubmitted
                ? "Your request has been sent to the Heyy Studio team. We’ll review the scope and prepare a quote."
                : "AI created the concept. Heyy Studio production turns it into real, editable, professional files."}
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {contextItems.map((item) => (
              <Benefit key={item.key} available={item.available}>
                {item.available ? `${item.label} attached` : `${item.label} not prepared`}
              </Benefit>
            ))}
          </div>
        </div>

        <div className={job ? "min-w-0" : "heyy-production-card"}>
          {quoteReady ? (
            <QuoteReady
              quote={latestQuote}
              request={requestRecord}
              studioLabel={studioIdentity.label}
              onRefresh={checkProductionStatus}
            />
          ) : requestSubmitted ? (
            <RequestSubmitted
              request={requestRecord}
              service={service}
              studioLabel={studioIdentity.label}
            />
          ) : job ? (
            <ClientProductionWorkspace
              job={job}
              project={project}
              service={service}
              studioLabel={studioIdentity.label}
              status={status}
              timeline={timeline}
              deliverableGroups={deliverableGroups}
              onDownload={downloadFile}
              onRefresh={checkProductionStatus}
            />
          ) : (
            <>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                Additional production notes
              </p>

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={`Optional: add anything you want the production team to know about this ${service} concept.`}
                className="mt-4 min-h-[120px] w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />

              <button
                type="button"
                onClick={startProduction}
                disabled={checking || submitting}
                className="heyy-accept-quote mt-5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checking
                  ? "Checking Production..."
                  : submitting
                    ? "Starting Production..."
                    : buttonLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

type ProductionContextItem = {
  key: string;
  label: string;
  available: boolean;
};

function hasMeaningfulObject(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.length > 0;

  return Object.values(value as Record<string, unknown>).some((item) => {
    if (Array.isArray(item)) return item.length > 0;
    if (item && typeof item === "object") return hasMeaningfulObject(item);
    return item !== null && item !== undefined && String(item).trim() !== "";
  });
}

function getProductionContextItems(
  studio: string,
  context: any,
): ProductionContextItem[] {
  if (studio === "interior_studio") {
    return [
      {
        key: "brief",
        label: "Interior Brief",
        available: hasMeaningfulObject(context?.project_brief),
      },
      {
        key: "layout",
        label: "Layout Strategy",
        available: hasMeaningfulObject(context?.layout_plan),
      },
      {
        key: "plans",
        label: "Interior Plans",
        available: Array.isArray(context?.concept_plans) && context.concept_plans.length > 0,
      },
      {
        key: "materials",
        label: "Material Schedule",
        available: hasMeaningfulObject(context?.material_palette),
      },
      {
        key: "furniture",
        label: "Furniture Schedule",
        available: hasMeaningfulObject(context?.furniture_schedule),
      },
      {
        key: "lighting",
        label: "Lighting Strategy",
        available: hasMeaningfulObject(context?.lighting_strategy),
      },
      {
        key: "visuals",
        label: "Generated Visuals",
        available: Array.isArray(context?.approved_visuals) && context.approved_visuals.length > 0,
      },
      {
        key: "design-pack",
        label: "Interior Design Pack",
        available: hasMeaningfulObject(context?.design_pack),
      },
    ];
  }

  if (studio === "marketing_studio") {
    return [
      {
        key: "brief",
        label: "Campaign Brief",
        available: hasMeaningfulObject(context?.project_brief),
      },
      {
        key: "audience",
        label: "Audience Segments",
        available: hasMeaningfulObject(context?.audience_segments),
      },
      {
        key: "strategy",
        label: "Campaign Strategy & Big Idea",
        available:
          hasMeaningfulObject(context?.strategy) ||
          hasMeaningfulObject(context?.big_idea),
      },
      {
        key: "messaging",
        label: "Messaging & Copy Bank",
        available:
          hasMeaningfulObject(context?.key_message) ||
          hasMeaningfulObject(context?.copy_bank),
      },
      {
        key: "channels",
        label: "Channel Plan & Calendar",
        available:
          hasMeaningfulObject(context?.channel_plan) ||
          hasMeaningfulObject(context?.content_calendar),
      },
      {
        key: "visuals",
        label: "Approved Campaign Visuals",
        available:
          Array.isArray(context?.approved_visuals) &&
          context.approved_visuals.length > 0,
      },
      {
        key: "testing",
        label: "Testing & Measurement Plan",
        available:
          hasMeaningfulObject(context?.testing_plan) ||
          hasMeaningfulObject(context?.measurement_plan),
      },
      {
        key: "campaign-pack",
        label: "Campaign Pack",
        available:
          hasMeaningfulObject(context?.professional_package) ||
          hasMeaningfulObject(context?.all_generated_outputs),
      },
    ];
  }

  if (studio === "architecture_studio") {
    return [
      {
        key: "project",
        label: "Architecture Brief",
        available: hasMeaningfulObject(context?.project),
      },
      {
        key: "site",
        label: "Land & Site",
        available: hasMeaningfulObject(context?.site),
      },
      {
        key: "planning",
        label: "Planning Guide",
        available: hasMeaningfulObject(context?.planning),
      },
      {
        key: "direction",
        label: "Selected Direction",
        available: hasMeaningfulObject(context?.selected_direction),
      },
      {
        key: "concept",
        label: "Architecture Concept",
        available: hasMeaningfulObject(context?.architecture_concept),
      },
      {
        key: "plans",
        label: "Concept Plans",
        available: hasMeaningfulObject(context?.concept_plan_set),
      },
      {
        key: "visuals",
        label: "Approved Visuals",
        available:
          Array.isArray(context?.approved_visuals) &&
          context.approved_visuals.length > 0,
      },
      {
        key: "design-pack",
        label: "Design Pack",
        available: hasMeaningfulObject(context?.design_pack),
      },
    ];
  }

  return [
    {
      key: "strategy",
      label: "Brand Strategy",
      available: Boolean(
        context?.brandStrategy || context?.strategy || context?.brand_strategy,
      ),
    },
    {
      key: "brand-book",
      label: "Brand Book",
      available: hasMeaningfulObject(context),
    },
    {
      key: "logos",
      label: "Logo Concepts",
      available: Boolean(
        context?.logoDirections || context?.logo_directions || context?.logos,
      ),
    },
    {
      key: "palette",
      label: "Colour Palette",
      available: Boolean(
        context?.colourPalette || context?.colorPalette || context?.palette,
      ),
    },
    {
      key: "moodboards",
      label: "Moodboards",
      available: Boolean(context?.moodboards || context?.moodboard),
    },
    {
      key: "application",
      label: "Selected Application",
      available: true,
    },
  ];
}

function Benefit({
  children,
  available = true,
}: {
  children: React.ReactNode;
  available?: boolean;
}) {
  return (
    <div
      className="heyy-benefit flex items-center gap-3 rounded-2xl"
      style={available ? undefined : { opacity: 0.58 }}
    >
      <span
        className="heyy-benefit-icon"
        style={
          available
            ? undefined
            : { backgroundColor: "rgba(255,255,255,.18)", color: "#ffffff" }
        }
      >
        {available ? "✓" : "·"}
      </span>
      <span className="text-xs font-bold leading-5 text-white">{children}</span>
    </div>
  );
}

function ClientTimelineItem({
  title,
  description,
  done = false,
}: {
  title: string;
  description?: string;
  done?: boolean;
}) {
  return (
    <div className="heyy-timeline-item">
      <div className="heyy-timeline-icon">{done ? "✓" : "•"}</div>

      <div className="min-w-0">
        <p className="text-xs font-black text-slate-800">{title}</p>

        {description && (
          <p className="mt-1 text-[10px] leading-5 text-slate-500">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function RequestSubmitted({
  request,
  service,
  studioLabel,
}: {
  request: any;
  service: string;
  studioLabel: string;
}) {
  const status = request?.status || "New";

  return (
    <div>
      <div className="heyy-status-icon">✓</div>

      <h4 className="mt-4 text-2xl font-black text-slate-950">Request received</h4>

      <p className="mt-3 text-sm leading-7 text-slate-600">
        Your {service} production request has been sent to {studioLabel}. We’ll
        review the project context, selected concept and notes before preparing
        a quote.
      </p>

      <div className="heyy-current-status mt-5">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
          Current Stage
        </p>

        <p className="mt-2 text-sm font-black text-violet-700">{status}</p>

        <p className="mt-2 text-xs leading-6 text-slate-500">
          Production has not started yet. The next step is an admin quote.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <ClientTimelineItem
          title="Production Request Sent"
          description={`Your request and ${studioLabel} project context were sent to the studio.`}
          done
        />
        <ClientTimelineItem
          title="Quote Preparation"
          description="The studio will prepare a production quote for this service."
        />
        <ClientTimelineItem
          title="Payment & Production"
          description="After payment, a production job will be created automatically."
        />
      </div>
    </div>
  );
}

function QuoteReady({
  quote,
  request,
  studioLabel,
  onRefresh,
}: {
  quote: any;
  request: any;
  studioLabel: string;
  onRefresh: () => Promise<void>;
}) {
  const [checkoutStarting, setCheckoutStarting] = useState(false);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [sendingQuestion, setSendingQuestion] = useState(false);
  const [questionMessage, setQuestionMessage] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const savedQuestions = Array.isArray(request?.metadata?.quote_questions)
    ? request.metadata.quote_questions
    : [];

  async function reconcilePayment(silent = false) {
    setReconciling(true);
    if (!silent) setPaymentMessage("Checking the payment securely...");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (sessionError || !accessToken) {
        throw new Error("Your login session could not be read. Refresh the page and try again.");
      }

      const params = new URLSearchParams(window.location.search);
      const returnedSessionId = params.get("session_id");

      const response = await fetch("/api/quotes/reconcile-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          quoteId: quote.id,
          sessionId: returnedSessionId,
        }),
      });

      const responseText = await response.text();
      let data: any = null;

      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch {
        throw new Error(
          response.ok
            ? "The payment server returned an unreadable response."
            : `Payment check failed (${response.status}).`,
        );
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Payment could not be confirmed.");
      }

      if (data.paid) {
        setPaymentConfirmed(true);
        setPaymentMessage("Payment confirmed. Your production workspace is being opened...");
        await onRefresh();
        return;
      }

      setPaymentConfirmed(false);
      setPaymentMessage(data.message || "The payment is still being confirmed. Please try again shortly.");
    } catch (error) {
      setPaymentConfirmed(false);
      setPaymentMessage(
        error instanceof Error ? error.message : "Payment could not be checked.",
      );
    } finally {
      setReconciling(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const returnedQuoteId = params.get("quote");

    if (returnedQuoteId !== quote.id) return;

    if (payment === "success") {
      setPaymentMessage("Payment completed. Confirming it securely...");
      void reconcilePayment(true);
    } else if (payment === "cancelled") {
      setPaymentMessage("Checkout was cancelled. Your quote is still available.");
    }
  }, [quote.id]);

  async function acceptQuote() {
    setCheckoutStarting(true);
    setPaymentMessage("");

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/quotes/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quoteId: quote.id }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.error || "Could not start checkout.");
      }

      window.location.href = data.url;
    } catch (error) {
      setCheckoutStarting(false);
      setPaymentMessage(
        error instanceof Error ? error.message : "Could not start checkout.",
      );
    }
  }

  async function sendQuestion() {
    if (!question.trim()) {
      setQuestionMessage("Write your question first.");
      return;
    }

    setSendingQuestion(true);
    setQuestionMessage("");

    try {
      const response = await fetch("/api/quotes/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id, message: question.trim() }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Question could not be sent.");
      }

      setQuestion("");
      setQuestionOpen(false);
      setQuestionMessage(`Question sent to ${studioLabel}.`);
      await onRefresh();
    } catch (error) {
      setQuestionMessage(
        error instanceof Error ? error.message : "Question could not be sent.",
      );
    } finally {
      setSendingQuestion(false);
    }
  }

  return (
    <div>
      <div className="heyy-status-icon">$</div>

      <h4 className="mt-4 text-2xl font-black text-slate-950">Quote ready</h4>

      <p className="mt-3 text-sm leading-7 text-slate-600">
        The studio reviewed your request and prepared a quote.
      </p>

      <div className="heyy-current-status mt-5">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
          {quote.title}
        </p>

        <p className="mt-3 text-4xl font-black text-slate-950">
          {quote.currency || "USD"} {Number(quote.amount).toFixed(2)}
        </p>

        {quote.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
            {quote.description}
          </p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <SmallInfo
            label="Estimated"
            value={`${quote.estimated_days ?? "-"} days`}
          />
          <SmallInfo
            label="Revisions"
            value={`${quote.included_revisions ?? 0} included`}
          />
          <SmallInfo
            label="Extra Revision"
            value={`${quote.currency || "USD"} ${quote.extra_revision_fee ?? 0}`}
          />
          <SmallInfo label="Status" value={quote.status} />
        </div>
      </div>

      {paymentMessage && (
        <div className="heyy-payment-message" data-success={paymentConfirmed ? "true" : "false"}>
          {paymentMessage}
        </div>
      )}

      <button
        type="button"
        onClick={acceptQuote}
        disabled={checkoutStarting || reconciling}
        className="heyy-accept-quote mt-5 disabled:cursor-wait disabled:opacity-60"
      >
        {checkoutStarting ? "Opening Secure Checkout..." : "Accept Quote & Pay →"}
      </button>

      {quote.stripe_session_id && (
        <button
          type="button"
          onClick={() => void reconcilePayment(false)}
          disabled={reconciling || checkoutStarting}
          className="heyy-quote-question mt-3 disabled:cursor-wait disabled:opacity-60"
        >
          {reconciling ? "Checking Payment..." : "Check Payment Status"}
        </button>
      )}

      <button
        type="button"
        onClick={() => setQuestionOpen((current) => !current)}
        className="heyy-quote-question mt-3"
      >
        {questionOpen ? "Close Question" : "Ask a Question"}
      </button>

      {questionOpen && (
        <div className="heyy-quote-question-form">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-700">
            Question about this quote
          </p>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="heyy-quote-question-textarea mt-3"
            placeholder="Ask about the scope, delivery, revisions or anything included in this quote."
          />
          <button
            type="button"
            onClick={sendQuestion}
            disabled={sendingQuestion}
            className="heyy-accept-quote mt-3 disabled:cursor-wait disabled:opacity-60"
          >
            {sendingQuestion ? "Sending Question..." : "Send Question →"}
          </button>
        </div>
      )}

      {questionMessage && (
        <p className="mt-3 text-xs font-bold leading-6 text-violet-700">
          {questionMessage}
        </p>
      )}

      {savedQuestions.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-700">
              Quote Conversation
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onRefresh()}
                className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.11em] text-violet-700 transition hover:border-violet-400 hover:bg-violet-50"
              >
                Refresh Replies
              </button>
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-violet-700">
                {savedQuestions.length} question{savedQuestions.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {savedQuestions.map((savedQuestion: any, index: number) => {
            const replies = Array.isArray(savedQuestion.replies)
              ? savedQuestion.replies
              : [];

            return (
              <div
                key={savedQuestion.id || `${savedQuestion.created_at}-${index}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">
                    Your question
                  </p>
                  <span
                    className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.11em] ${
                      replies.length
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {replies.length ? "Answered" : "Waiting for reply"}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {savedQuestion.message}
                </p>

                {replies.length > 0 && (
                  <div className="mt-3 space-y-2 border-l-2 border-violet-300 pl-3">
                    {replies.map((reply: any, replyIndex: number) => (
                      <div
                        key={reply.id || `${reply.created_at}-${replyIndex}`}
                        className="rounded-xl border border-violet-100 bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-black text-violet-800">
                            {reply.sender_name || studioLabel}
                          </p>
                          {reply.created_at && (
                            <p className="text-[9px] font-bold text-slate-400">
                              {new Date(reply.created_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {reply.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xs font-black text-slate-800">{value}</p>
    </div>
  );
}
