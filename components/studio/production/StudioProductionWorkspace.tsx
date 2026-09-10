"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { BadgeCheck, Boxes, Check, FileOutput } from "lucide-react";
import ProductionPanel from "@/components/studio/production/ProductionPanel";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { getStudioIdentity } from "@/lib/studio/studio-identity";

export type StudioProductionScope = {
  id: string;
  title: string;
  service: string;
  serviceId: string;
  description: string;
  outputs: string[];
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  assets?: any[];
};

type PackageDefinition = {
  title: string;
  service: string;
  serviceId: string;
  description: string;
};

type Props = {
  project: any;
  studio: string;
  baseContext: Record<string, any>;
  scopes: StudioProductionScope[];
  selectedPackage: PackageDefinition;
  completePackage: PackageDefinition;
  previewImage?: string;
  usage: string;
  expertNote: string;
  heading?: string;
  intro?: string;
  emptyMessage?: string;
};

function sameIds(first: string[], second: string[]) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function uniqueAssets(scopes: StudioProductionScope[]) {
  const seen = new Set<string>();
  const output: any[] = [];
  for (const scope of scopes) {
    for (const asset of scope.assets || []) {
      const key = String(asset?.id || asset?.file_url || asset?.image_url || asset?.storage_path || `${scope.id}-${output.length}`);
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(asset);
    }
  }
  return output;
}

export default function StudioProductionWorkspace({
  project,
  studio,
  baseContext,
  scopes,
  selectedPackage,
  completePackage,
  previewImage,
  usage,
  expertNote,
  heading = "Select the items you want to send to production",
  intro,
  emptyMessage,
}: Props) {
  const identity = getStudioIdentity(studio);
  const scopeIdsKey = scopes.map((scope) => scope.id).join("|");
  const restoreAttemptRef = useRef<string | null>(null);
  const [restoredServiceId, setRestoredServiceId] = useState<string | null>(null);

  const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const requestedScope = query?.get("scope") || null;
  const requestedScopes = query?.get("scopes") || null;
  const requestedEmptySelection = requestedScope === "none";
  const requestedSelectedPackage = requestedScope === "selected-package" || restoredServiceId === selectedPackage.serviceId;

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
  }, [requestedScope, requestedScopes, scopeIdsKey]);

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
    if (requestedScope || requestedScopes || !project?.id || !scopes.length) return;
    const restoreKey = `${studio}:${project.id}:${scopeIdsKey}`;
    if (restoreAttemptRef.current === restoreKey) return;
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const restoreProduction = async (attempt = 0) => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (active && attempt < 1) retryTimer = setTimeout(() => void restoreProduction(attempt + 1), 350);
          return;
        }

        const response = await fetch(
          `/api/production/client-status?projectId=${encodeURIComponent(project.id)}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
        );
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok || !payload?.success) {
          if (attempt < 1) retryTimer = setTimeout(() => void restoreProduction(attempt + 1), 450);
          return;
        }

        restoreAttemptRef.current = restoreKey;
        if (!payload?.latest || String(payload.latest.studio || "") !== studio) return;

        const serviceId = String(payload.latest.serviceId || "");
        setRestoredServiceId(serviceId || null);
        const params = new URLSearchParams(window.location.search);
        const selected = Array.isArray(payload.latest.selectedScopes)
          ? payload.latest.selectedScopes
              .map((item: any) => String(typeof item === "string" ? item : item?.id || ""))
              .filter((id: string) => scopes.some((scope) => scope.id === id))
          : [];

        if (serviceId === selectedPackage.serviceId) {
          params.set("scope", "selected-package");
          if (selected.length) {
            params.set("scopes", selected.join(","));
            setSelectedScopeIds(selected);
          }
        } else if (serviceId === completePackage.serviceId) {
          params.set("scope", "complete-package");
          setSelectedScopeIds(scopes.map((scope) => scope.id));
        } else {
          const matched = scopes.find((scope) => scope.serviceId === serviceId);
          if (!matched) return;
          params.set("scope", matched.id);
          setSelectedScopeIds([matched.id]);
        }

        window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`);
      } catch (error) {
        if (active && attempt < 1) {
          retryTimer = setTimeout(() => void restoreProduction(attempt + 1), 450);
        } else {
          console.warn(`Could not restore latest ${identity.shortLabel} production request:`, error);
        }
      }
    };

    void restoreProduction();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [project?.id, requestedScope, requestedScopes, scopeIdsKey, studio, selectedPackage.serviceId, completePackage.serviceId]);

  useEffect(() => {
    setSelectedScopeIds((current) => {
      let next = current.filter((id) => scopes.some((scope) => scope.id === id));
      if (requestedEmptySelection) next = [];
      else if (requestedScopeIds.length) next = requestedScopeIds;
      else if (!next.length && scopes[0]) next = [scopes[0].id];
      return sameIds(current, next) ? current : next;
    });
  }, [requestedEmptySelection, requestedScopeIds, scopeIdsKey]);

  const selectedScopes = useMemo(
    () => scopes.filter((scope) => selectedScopeIds.includes(scope.id)),
    [scopes, selectedScopeIds],
  );
  const allSelected = scopes.length > 0 && selectedScopes.length === scopes.length;

  const requestScope = useMemo<StudioProductionScope | null>(() => {
    if (requestedSelectedPackage && !requestedScopes) {
      return {
        id: "selected-package",
        title: selectedPackage.title,
        service: selectedPackage.service,
        serviceId: selectedPackage.serviceId,
        description: selectedPackage.description,
        outputs: [],
        icon: Boxes,
        assets: uniqueAssets(selectedScopes),
      };
    }
    if (!selectedScopes.length) return null;
    if (selectedScopes.length === 1) return selectedScopes[0];

    const outputs = Array.from(new Set(selectedScopes.flatMap((scope) => scope.outputs)));
    if (selectedScopes.length === scopes.length) {
      return {
        id: "complete-package",
        title: completePackage.title,
        service: completePackage.service,
        serviceId: completePackage.serviceId,
        description: completePackage.description,
        outputs,
        icon: Boxes,
        assets: uniqueAssets(selectedScopes),
      };
    }

    return {
      id: "selected-package",
      title: `${selectedScopes.length} Selected ${identity.shortLabel} Items`,
      service: selectedPackage.service,
      serviceId: selectedPackage.serviceId,
      description: `Prepare these selected deliverables together: ${selectedScopes.map((scope) => scope.title).join(", ")}.`,
      outputs,
      icon: Boxes,
      assets: uniqueAssets(selectedScopes),
    };
  }, [requestedSelectedPackage, requestedScopes, selectedScopes, scopes.length, selectedPackage, completePackage, identity.shortLabel]);

  function persistScopeSelection(next: string[]) {
    const ordered = scopes.map((scope) => scope.id).filter((id) => next.includes(id));
    setSelectedScopeIds(ordered);

    const params = new URLSearchParams(window.location.search);
    params.delete("scope");
    params.delete("scopes");
    if (ordered.length === scopes.length && scopes.length > 0) params.set("scope", "complete-package");
    else if (ordered.length === 1) params.set("scope", ordered[0]);
    else if (ordered.length > 1) {
      params.set("scope", "selected-package");
      params.set("scopes", ordered.join(","));
    } else params.set("scope", "none");

    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`);
  }

  const themeStyle = {
    "--scope-accent": identity.accent,
    "--scope-accent-dark": identity.accentDark,
    "--scope-soft": identity.soft,
    "--scope-border": identity.border,
  } as CSSProperties;

  if (!scopes.length) {
    return (
      <section className="rounded-[28px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
        <p className="text-sm font-black text-[var(--text-primary)]">No production scope is available yet.</p>
        <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Complete the Studio project first, then return here for Expert production.</p>
      </section>
    );
  }

  return (
    <div className="studio-production-workspace grid gap-5" style={themeStyle}>
      <style>{`
        .studio-production-workspace .scope-selector { border-color: var(--scope-border); }
        .studio-production-workspace .scope-header { background: linear-gradient(90deg,var(--scope-soft),var(--surface-strong) 60%); }
        .studio-production-workspace .scope-eyebrow, .studio-production-workspace .scope-accent-text { color: var(--scope-accent-dark); }
        .studio-production-workspace .scope-count, .studio-production-workspace .scope-summary { border-color: var(--scope-border); color: var(--scope-accent-dark); }
        .studio-production-workspace .scope-card { border-color: var(--border); background: var(--surface); }
        .studio-production-workspace .scope-card:hover { border-color: var(--scope-accent); background: var(--surface-strong); transform: translateY(-1px); }
        .studio-production-workspace .scope-card[data-selected="true"] { border-color: var(--scope-accent); background: var(--scope-accent); color: #fff; box-shadow: 0 14px 30px color-mix(in srgb,var(--scope-accent) 22%,transparent); }
        .studio-production-workspace .scope-icon { background: var(--scope-soft); color: var(--scope-accent-dark); }
        .studio-production-workspace .scope-card[data-selected="true"] .scope-icon { background: rgba(255,255,255,.17); color:#fff; }
        .studio-production-workspace .scope-check { border-color: var(--border-strong); background:var(--surface-strong); color:transparent; }
        .studio-production-workspace .scope-card[data-selected="true"] .scope-check { border-color:rgba(255,255,255,.5); color:var(--scope-accent-dark); }
        .studio-production-workspace .scope-card[data-selected="true"] .scope-check { background:#fff; }
        .studio-production-workspace .scope-action { border-color: var(--scope-border); color:var(--scope-accent-dark); background:var(--scope-soft); }
        .studio-production-workspace .scope-action:hover { border-color:var(--scope-accent); }
      `}</style>

      <section className="scope-selector overflow-hidden rounded-[28px] border bg-[var(--surface-strong)] shadow-[0_18px_45px_rgba(20,20,35,.07)]">
        <header className="scope-header border-b border-[var(--border)] p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="scope-eyebrow text-[9px] font-black uppercase tracking-[0.18em]">Expert production</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-[var(--text-primary)]">{heading}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{intro || `Choose one item, combine several items into one request, or send the complete ${identity.shortLabel.toLowerCase()} package to production.`}</p>
            </div>
            <span className="scope-count inline-flex items-center gap-2 rounded-full border bg-[var(--surface-strong)] px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em]">
              <FileOutput size={14} /> {selectedScopes.length} of {scopes.length} selected
            </span>
          </div>
        </header>

        <div className="p-5 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[var(--text-primary)]">Production items</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">Click an item to include or remove it from this production request.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => persistScopeSelection(scopes.map((scope) => scope.id))} disabled={allSelected} className="scope-action inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-[10px] font-black transition disabled:cursor-default disabled:opacity-50">
                <Check size={14} /> Send all items to production
              </button>
              <button type="button" onClick={() => persistScopeSelection([])} disabled={!selectedScopeIds.length} className="inline-flex min-h-10 items-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-[10px] font-black text-[var(--text-secondary)] transition hover:border-[var(--scope-accent)] disabled:cursor-default disabled:opacity-50">Clear selection</button>
            </div>
          </div>

          <div className="grid max-h-[430px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {scopes.map((scope) => {
              const Icon = scope.icon;
              const selected = selectedScopeIds.includes(scope.id);
              return (
                <button key={scope.id} type="button" data-selected={selected ? "true" : "false"} aria-pressed={selected} onClick={() => persistScopeSelection(selected ? selectedScopeIds.filter((id) => id !== scope.id) : [...selectedScopeIds, scope.id])} className="scope-card group rounded-[18px] border p-4 text-left transition">
                  <div className="flex items-start gap-3">
                    <span className="scope-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"><Icon size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-black leading-5">{scope.title}</p>
                        <span className="scope-check flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"><Check size={13} strokeWidth={3} /></span>
                      </div>
                      <p className={`mt-2 line-clamp-2 text-[11px] font-semibold leading-4 ${selected ? "text-white/75" : "text-[var(--text-secondary)]"}`}>{scope.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {requestScope ? (
            <div className="mt-5 rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="scope-eyebrow text-[8px] font-black uppercase tracking-[0.15em]">Request summary</p>
                  <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--text-primary)]">{requestScope.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{requestScope.description}</p>
                </div>
                <span className="scope-summary rounded-full border bg-[var(--surface-strong)] px-4 py-2 text-[9px] font-black uppercase tracking-[0.13em]">{requestScope.outputs.length} final-file requirements</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {selectedScopes.map((scope) => <span key={scope.id} className="scope-summary rounded-full border bg-[var(--surface-strong)] px-3 py-1.5 text-[9px] font-black">{scope.title}</span>)}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {requestScope.outputs.slice(0, 6).map((output, index) => (
                  <div key={`${output}-${index}`} className="flex gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 text-xs font-bold leading-5 text-[var(--text-primary)]">
                    <BadgeCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" /><span>{output}</span>
                  </div>
                ))}
              </div>
              {requestScope.outputs.length > 6 && <p className="scope-accent-text mt-3 text-[10px] font-black">+ {requestScope.outputs.length - 6} additional final-file requirements included in the request.</p>}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-[var(--scope-border)] bg-[var(--scope-soft)] p-8 text-center">
              <p className="text-sm font-black text-[var(--text-primary)]">Select at least one item to continue.</p>
              <p className="mt-2 text-xs font-semibold text-[var(--text-secondary)]">{emptyMessage || "You can choose one item, several items or the full package."}</p>
            </div>
          )}
        </div>
      </section>

      {requestScope && (
        <ProductionPanel
          key={`${requestScope.serviceId}-${selectedScopeIds.join("-")}`}
          project={project}
          brand={{
            ...baseContext,
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
            available_production_scopes: scopes.map(({ icon: _icon, assets: _assets, ...scope }) => scope),
            final_file_requirements: requestScope.outputs,
            all_generated_outputs: requestScope.assets !== undefined ? requestScope.assets : baseContext.all_generated_outputs || [],
          }}
          service={requestScope.service}
          serviceId={requestScope.serviceId}
          studio={studio}
          previewImage={requestScope.assets?.find((asset: any) => asset?.file_url || asset?.image_url)?.file_url || requestScope.assets?.find((asset: any) => asset?.file_url || asset?.image_url)?.image_url || previewImage}
          description={requestScope.description}
          usage={usage}
          expertNote={expertNote}
          buttonLabel={allSelected ? `Request complete ${identity.shortLabel.toLowerCase()} package →` : selectedScopes.length > 1 ? `Request ${selectedScopes.length} selected items →` : `Request ${requestScope.title} →`}
        />
      )}
    </div>
  );
}
