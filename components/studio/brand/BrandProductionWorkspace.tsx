"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  BriefcaseBusiness,
  Check,
  FileOutput,
  LayoutTemplate,
  PackageCheck,
  Palette,
  PenTool,
  Shapes,
  WandSparkles,
} from "lucide-react";

import ProductionPanel from "@/components/studio/production/ProductionPanel";
import {
  getApplicationDeliverables,
  normaliseBrandJourney,
} from "@/lib/brand/project-templates";

type ProductionScope = {
  id: string;
  title: string;
  service: string;
  serviceId: string;
  description: string;
  outputs: string[];
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

const APPLICATION_OUTPUTS: Record<string, string[]> = {
  "business-card": [
    "Editable Adobe Illustrator or InDesign source",
    "CMYK print-ready PDF with bleed and crop marks",
    "Outlined-font production PDF",
    "PNG and JPG presentation previews",
  ],
  letterhead: [
    "Editable Illustrator, InDesign or Word template",
    "Print-ready CMYK PDF",
    "Digital PDF and office-use template",
    "Linked logo, font and colour assets",
  ],
  envelope: [
    "Editable Illustrator or InDesign source",
    "Print-ready PDF with dieline, bleed and safe zones",
    "CMYK colour specification",
    "PNG and JPG previews",
  ],
  "email-signature": [
    "Responsive HTML email signature",
    "Hosted and local image assets",
    "Installation guide for common email clients",
    "Static PNG fallback",
  ],
  presentation: [
    "Editable PowerPoint master template",
    "Reusable cover, content, chart and closing layouts",
    "PDF reference guide",
    "Linked fonts, icons and image directions",
  ],
  "social-system": [
    "Editable social templates",
    "Platform-ready post, story and carousel sizes",
    "PNG/JPG export package",
    "Template usage and safe-zone guide",
  ],
  website: [
    "Editable desktop and mobile design files",
    "Component and layout specification",
    "Exported web assets",
    "Developer handoff notes",
  ],
  packaging: [
    "Editable vector artwork",
    "Print-ready CMYK PDF on supplied dieline",
    "Bleed, varnish, foil and finish layers where required",
    "3D presentation mockups and PNG/JPG previews",
  ],
  signage: [
    "Editable vector artwork",
    "Scale and dimension schedule",
    "Production-ready PDF",
    "Material, colour and installation notes",
  ],
  merchandise: [
    "Editable vector artwork",
    "Print or embroidery production files",
    "Placement and size specifications",
    "Colour variants and PNG previews",
  ],
};

const APPLICATION_ICONS: Record<string, ProductionScope["icon"]> = {
  "business-card": BriefcaseBusiness,
  letterhead: FileOutput,
  envelope: PackageCheck,
  "email-signature": BadgeCheck,
  presentation: LayoutTemplate,
  "social-system": Shapes,
  website: LayoutTemplate,
  packaging: PackageCheck,
  signage: Shapes,
  merchandise: Boxes,
};

const CORE_SCOPE_ASSET_TYPES: Record<string, string[]> = {
  logo: ["existing_logo", "logo_selected", "logo_concept", "logo_variation"],
  "creative-direction": [
    "creative_direction_selected",
    "moodboard_selected",
    "moodboard",
    "moodboard_variations",
    "creative_directions",
  ],
  guidelines: ["brand_guidelines", "brand_book", "brand_guideline_system"],
  strategy: ["brand_strategy", "brand_blueprint", "brand_foundation"],
};

function assetPayload(asset: any) {
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
  const payload = assetPayload(asset);
  return (
    asset?.file_url ||
    asset?.thumbnail_url ||
    asset?.image_url ||
    payload?.imageUrl ||
    payload?.image_url ||
    null
  );
}

function assetTitle(asset: any) {
  return asset?.title || asset?.name || asset?.asset_type || "Generated brand asset";
}

function sameIds(first: string[], second: string[]) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

export default function BrandProductionWorkspace({
  project,
  brand,
  assets,
}: {
  project: any;
  brand: any;
  assets: any[];
}) {
  const searchParams = useSearchParams();
  const journey = normaliseBrandJourney(brand, project);
  const selectedApplications = useMemo(
    () => getApplicationDeliverables(journey.selectedDeliverables),
    [journey.selectedDeliverables],
  );

  const scopes = useMemo<ProductionScope[]>(() => {
    const next: ProductionScope[] = [];

    if (journey.selectedDeliverables.includes("strategy")) {
      next.push({
        id: "strategy",
        title: "Brand Strategy Finalisation",
        service: "Brand Strategy Finalisation",
        serviceId: "brand-strategy-finalisation",
        description:
          "Turn the approved strategy into a polished client-ready and editable strategic document.",
        outputs: [
          "Editable strategy document",
          "Presentation-ready PDF",
          "Positioning, audience, voice and messaging summary",
          "Final proofread copy",
        ],
        icon: WandSparkles,
      });
    }

    if (journey.selectedDeliverables.includes("creative-direction")) {
      next.push({
        id: "creative-direction",
        title: "Creative Direction Production",
        service: "Creative Direction Production",
        serviceId: "brand-creative-direction-production",
        description:
          "Refine the selected route into a coherent art-direction board with licensed and production-safe references.",
        outputs: [
          "Editable direction board",
          "High-resolution PDF",
          "Colour, typography, imagery and composition guidance",
          "Linked reference asset list",
        ],
        icon: Palette,
      });
    }

    if (journey.selectedDeliverables.includes("logo") || journey.logoAction !== "none") {
      next.push({
        id: "logo",
        title: "Logo Master Files",
        service: "Logo Finalisation and Master Files",
        serviceId: "brand-logo-finalisation",
        description:
          "Professionally redraw, refine and prepare the selected logo as a complete master-file package.",
        outputs: [
          "Adobe Illustrator (.ai) master artwork",
          "EPS and SVG vector files",
          "Print-ready PDF",
          "Transparent PNG and high-resolution JPG",
          "RGB, CMYK, black, white, reversed and monochrome variants",
          "Primary lockup, icon, wordmark and favicon files where applicable",
          "Clear-space and minimum-size usage sheet",
        ],
        icon: PenTool,
      });
    }

    if (journey.selectedDeliverables.includes("guidelines")) {
      next.push({
        id: "guidelines",
        title: "Brand Guidelines Production",
        service: "Brand Guidelines Production",
        serviceId: "brand-guidelines-production",
        description:
          "Turn the approved system into a professionally designed and editable brand-guidelines document.",
        outputs: [
          "Complete brand-guidelines PDF",
          "Editable source document",
          "Linked logo, colour, font and image assets",
          "Print and screen-ready versions",
        ],
        icon: BookOpenCheck,
      });
    }

    for (const item of selectedApplications) {
      next.push({
        id: item.id,
        title: `${item.label} Production`,
        service: `${item.label} Production`,
        serviceId: `brand-${item.id}`,
        description: `Turn the approved ${item.label.toLowerCase()} concept into editable, correctly sized and production-ready files.`,
        outputs:
          APPLICATION_OUTPUTS[item.id] || [
            "Editable source files",
            "Production-ready PDF",
            "Correctly sized digital exports",
            "Linked brand assets and specifications",
          ],
        icon: APPLICATION_ICONS[item.id] || FileOutput,
      });
    }

    if (journey.journeyId === "custom" && journey.customScope.trim()) {
      next.push({
        id: "custom",
        title: "Custom Brand Deliverable Production",
        service: "Custom Brand Deliverable Production",
        serviceId: "brand-custom-deliverable",
        description: journey.customScope,
        outputs: [
          "Editable source files",
          "Correctly sized production exports",
          "Print or platform-ready final files",
          "Linked brand assets and delivery notes",
        ],
        icon: FileOutput,
      });
    }

    return next;
  }, [journey, selectedApplications]);

  const requestedScope = searchParams.get("scope");
  const requestedScopes = searchParams.get("scopes");
  const requestedEmptySelection = requestedScope === "none";
  const scopeIdsKey = scopes.map((scope) => scope.id).join("|");
  const requestedScopeIds = useMemo(() => {
    if (requestedScope === "complete-package") return scopes.map((scope) => scope.id);

    const multiple = String(requestedScopes || "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => scopes.some((scope) => scope.id === value));
    if (multiple.length) return Array.from(new Set(multiple));

    if (requestedScope && scopes.some((scope) => scope.id === requestedScope)) {
      return [requestedScope];
    }

    return [];
  }, [requestedScope, requestedScopes, scopeIdsKey, scopes]);

  const [selectedScopeIds, setSelectedScopeIds] = useState<string[]>(() =>
    requestedEmptySelection
      ? []
      : requestedScopeIds.length
        ? requestedScopeIds
        : scopes[0]
          ? [scopes[0].id]
          : [],
  );

  useEffect(() => {
    setSelectedScopeIds((current) => {
      let next = current.filter((id) => scopes.some((scope) => scope.id === id));

      if (requestedEmptySelection) {
        next = [];
      } else if (requestedScopeIds.length) {
        next = requestedScopeIds;
      } else if (!next.length && scopes[0]) {
        next = [scopes[0].id];
      }

      return sameIds(current, next) ? current : next;
    });
  }, [requestedEmptySelection, requestedScopeIds, scopeIdsKey, scopes]);

  const selectedScopes = useMemo(
    () => scopes.filter((scope) => selectedScopeIds.includes(scope.id)),
    [scopes, selectedScopeIds],
  );
  const allSelected = scopes.length > 0 && selectedScopes.length === scopes.length;

  const requestScope = useMemo<ProductionScope | null>(() => {
    if (!selectedScopes.length) return null;
    if (selectedScopes.length === 1) return selectedScopes[0];

    const selectedOutputs = Array.from(
      new Set(selectedScopes.flatMap((scope) => scope.outputs)),
    );

    if (selectedScopes.length === scopes.length) {
      return {
        id: "complete-package",
        title: "Complete Brand Production Package",
        service: "Complete Brand Production Package",
        serviceId: "brand-complete-package",
        description:
          "Send every selected brand deliverable to production as one coordinated final-file package.",
        outputs: selectedOutputs,
        icon: Boxes,
      };
    }

    return {
      id: "selected-package",
      title: `${selectedScopes.length} Selected Brand Items`,
      service: "Selected Brand Production Package",
      serviceId: "brand-selected-package",
      description: `Prepare these selected deliverables together: ${selectedScopes
        .map((scope) => scope.title)
        .join(", ")}.`,
      outputs: selectedOutputs,
      icon: Boxes,
    };
  }, [selectedScopes, scopes.length]);

  const generatedOutputs = useMemo(
    () =>
      assets.map((asset) => ({
        id: asset.id,
        asset_type: asset.asset_type,
        title: assetTitle(asset),
        file_url: assetUrl(asset),
        thumbnail_url: asset.thumbnail_url || null,
        payload: assetPayload(asset),
        metadata: asset.metadata || null,
        created_at: asset.created_at || null,
      })),
    [assets],
  );

  const approvedApplicationIds = useMemo(() => {
    const map = new Map<string, string>();
    for (const asset of generatedOutputs) {
      const applicationId = asset.payload?.applicationId;
      if (
        asset.asset_type === "brand_application_approval" &&
        typeof applicationId === "string" &&
        !map.has(applicationId)
      ) {
        map.set(applicationId, String(asset.id));
      }
    }
    return map;
  }, [generatedOutputs]);

  const requestGeneratedOutputs = useMemo(() => {
    if (!selectedScopes.length) return [];

    return generatedOutputs.filter((asset) =>
      selectedScopes.some((scope) => {
        const coreTypes = CORE_SCOPE_ASSET_TYPES[scope.id];
        if (coreTypes) return coreTypes.includes(asset.asset_type);
        if (scope.id === "custom") return true;

        const applicationId = asset.payload?.applicationId;
        const approvedAssetId = approvedApplicationIds.get(scope.id);
        if (approvedAssetId) return String(asset.id) === approvedAssetId;

        return (
          asset.asset_type === "brand_application_visual" &&
          applicationId === scope.id
        );
      }),
    );
  }, [approvedApplicationIds, generatedOutputs, selectedScopes]);

  const previewImage =
    requestGeneratedOutputs.find((asset) => asset.file_url)?.file_url ||
    generatedOutputs.find((asset) => asset.file_url)?.file_url ||
    undefined;

  function persistScopeSelection(next: string[]) {
    const ordered = scopes
      .map((scope) => scope.id)
      .filter((id) => next.includes(id));
    setSelectedScopeIds(ordered);

    const params = new URLSearchParams(window.location.search);
    params.delete("scope");
    params.delete("scopes");

    if (ordered.length === scopes.length && scopes.length > 0) {
      params.set("scope", "complete-package");
    } else if (ordered.length === 1) {
      params.set("scope", ordered[0]);
    } else if (ordered.length > 1) {
      params.set("scopes", ordered.join(","));
    } else {
      params.set("scope", "none");
    }

    const nextUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
  }

  function toggleScope(scopeId: string) {
    const next = selectedScopeIds.includes(scopeId)
      ? selectedScopeIds.filter((id) => id !== scopeId)
      : [...selectedScopeIds, scopeId];
    persistScopeSelection(next);
  }

  if (!scopes.length) {
    return (
      <section className="rounded-[28px] border border-dashed border-violet-300 bg-violet-50 p-10 text-center">
        <p className="text-sm font-black text-violet-800">
          No production scope is available yet.
        </p>
        <p className="mt-2 text-xs leading-5 text-violet-600">
          Add at least one Brand Studio deliverable to prepare final files.
        </p>
      </section>
    );
  }

  return (
    <div className="brand-production-workspace grid gap-5">
      <style>{`
        .brand-production-workspace .bg-white { background: var(--surface-strong) !important; }
        .brand-production-workspace .bg-slate-50 { background: var(--surface) !important; }
        .brand-production-workspace .border-slate-200 { border-color: var(--border) !important; }
        .brand-production-workspace .text-slate-950,
        .brand-production-workspace .text-slate-900,
        .brand-production-workspace .text-slate-800,
        .brand-production-workspace .text-slate-700 { color: var(--text-primary) !important; }
        .brand-production-workspace .text-slate-600,
        .brand-production-workspace .text-slate-500 { color: var(--text-secondary) !important; }
        [data-theme="dark"] .brand-production-workspace .bg-violet-50 { background: rgba(159,44,224,.13) !important; }
      `}</style>

      <section className="overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_18px_45px_rgba(55,30,83,.08)]">
        <header className="border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">
                Expert production
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-slate-950">
                Select the items you want to send to production
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Choose one item, combine several items into one request, or send the complete selected brand package to production.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-violet-700">
              <FileOutput size={14} /> {selectedScopes.length} of {scopes.length} selected
            </span>
          </div>
        </header>

        <div className="p-5 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-slate-950">Production items</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                Click an item to include or remove it from this production request.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => persistScopeSelection(scopes.map((scope) => scope.id))}
                disabled={allSelected}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-violet-300 bg-violet-50 px-4 text-[10px] font-black text-violet-700 transition hover:bg-violet-100 disabled:cursor-default disabled:opacity-50"
              >
                <Check size={14} /> Send all items to production
              </button>
              <button
                type="button"
                onClick={() => persistScopeSelection([])}
                disabled={!selectedScopeIds.length}
                className="inline-flex min-h-10 items-center rounded-full border border-slate-300 bg-white px-4 text-[10px] font-black text-slate-700 transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-default disabled:opacity-50"
              >
                Clear selection
              </button>
            </div>
          </div>

          <div className="grid max-h-[430px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {scopes.map((scope) => {
              const Icon = scope.icon;
              const selected = selectedScopeIds.includes(scope.id);
              return (
                <button
                  key={scope.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleScope(scope.id)}
                  className={`group rounded-[18px] border p-4 text-left transition ${
                    selected
                      ? "border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                      : "border-slate-200 bg-slate-50 text-slate-900 hover:border-violet-400 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${
                        selected
                          ? "bg-white/16 text-white"
                          : "bg-violet-100 text-violet-700"
                      }`}
                    >
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-black leading-5">{scope.title}</p>
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? "border-white/45 bg-white text-violet-700"
                              : "border-slate-300 bg-white text-transparent"
                          }`}
                        >
                          <Check size={13} strokeWidth={3} />
                        </span>
                      </div>
                      <p
                        className={`mt-2 line-clamp-2 text-[11px] font-semibold leading-4 ${
                          selected ? "text-white/75" : "text-slate-500"
                        }`}
                      >
                        {scope.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {requestScope ? (
            <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[8px] font-black uppercase tracking-[0.15em] text-violet-600">
                    Request summary
                  </p>
                  <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">
                    {requestScope.title}
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                    {requestScope.description}
                  </p>
                </div>
                <span className="rounded-full border border-violet-200 bg-white px-4 py-2 text-[9px] font-black uppercase tracking-[0.13em] text-violet-700">
                  {requestScope.outputs.length} final-file requirements
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {selectedScopes.map((scope) => (
                  <span
                    key={scope.id}
                    className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[9px] font-black text-violet-700"
                  >
                    {scope.title}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {requestScope.outputs.slice(0, 6).map((output, index) => (
                  <div
                    key={`${output}-${index}`}
                    className="flex gap-2 rounded-[14px] border border-slate-200 bg-white px-3 py-3 text-xs font-bold leading-5 text-slate-700"
                  >
                    <BadgeCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                    <span>{output}</span>
                  </div>
                ))}
              </div>
              {requestScope.outputs.length > 6 && (
                <p className="mt-3 text-[10px] font-black text-violet-700">
                  + {requestScope.outputs.length - 6} additional final-file requirements included in the request.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-violet-300 bg-violet-50 p-8 text-center">
              <p className="text-sm font-black text-violet-800">
                Select at least one item to continue.
              </p>
              <p className="mt-2 text-xs font-semibold text-violet-600">
                You can choose one item, several items or the full package.
              </p>
            </div>
          )}
        </div>
      </section>

      {requestScope && (
        <ProductionPanel
          key={`${requestScope.serviceId}-${selectedScopeIds.join("-")}`}
          project={project}
          brand={{
            ...brand,
            projectJourney: journey,
            production_scope: requestScope,
            production_scope_id: requestScope.id,
            selected_production_scopes: selectedScopes.map((scope) => ({
              id: scope.id,
              title: scope.title,
              service: scope.service,
              serviceId: scope.serviceId,
              description: scope.description,
              outputs: scope.outputs,
            })),
            available_production_scopes: scopes,
            final_file_requirements: requestScope.outputs,
            selected_brand_applications: selectedApplications,
            all_generated_outputs: requestGeneratedOutputs,
          }}
          service={requestScope.service}
          serviceId={requestScope.serviceId}
          studio="brand_studio"
          previewImage={previewImage}
          description={requestScope.description}
          usage={`Final production for ${selectedScopes
            .map((scope) => scope.title)
            .join(", ")} inside the ${journey.journeyTitle} project.`}
          expertNote="Prepare every selected item as professional, editable and production-ready files. Preserve the approved Brand Studio direction and include all relevant generated references."
          buttonLabel={
            allSelected
              ? "Request complete brand package →"
              : selectedScopes.length > 1
                ? `Request ${selectedScopes.length} selected items →`
                : `Request ${requestScope.title} →`
          }
        />
      )}
    </div>
  );
}
