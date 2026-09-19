"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Check,
  Clock3,
  Loader2,
  Search,
  Send,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import HeyySelect from "@/components/ui/heyy-select";

type Expert = {
  id: string;
  full_name: string;
  email: string;
  studio: string;
  role_title: string | null;
  location: string | null;
  timezone: string | null;
  years_experience: number | null;
  specialties: string[];
  software_tools: string[];
  availability: string;
  status: string;
};

type Opportunity = {
  id: string;
  status: string;
  expert_profile_id: string;
  quoted_fee_cents: number | null;
  currency: string;
  turnaround_days: number | null;
  included_revisions: number | null;
  extra_revision_fee_cents: number | null;
  expert_notes: string | null;
  requested_at: string;
  quoted_at: string | null;
  expert: Expert | null;
};

type SharePackItem = {
  id: string;
  sectionId: string;
  sectionTitle: string;
  label: string;
  value: string;
  recommended: boolean;
};

type SharePackVisual = {
  id: string;
  title: string;
  type: string;
  url: string;
  width: number | null;
  height: number | null;
  recommended: boolean;
};

type SharePackOptions = {
  sections: Array<{
    id: string;
    title: string;
    description: string;
    items: SharePackItem[];
  }>;
  visuals: SharePackVisual[];
  recommendedItemIds: string[];
  recommendedVisualIds: string[];
};

type Payload = {
  request: {
    id: string;
    projectName: string | null;
    projectId: string | null;
    studio: string | null;
    service: string | null;
    status: string | null;
    sharedScope: Record<string, any>;
    sharePackOptions: SharePackOptions;
  };
  clientQuote: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    production_job_id: string | null;
  } | null;
  experts: Expert[];
  opportunities: Opportunity[];
  selected: Opportunity | null;
};

export default function ExpertSourcing({
  requestId,
  onChanged,
  onPreferredSelected,
}: {
  requestId: string;
  onChanged?: () => void | Promise<void>;
  onPreferredSelected?: () => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("available_or_limited");
  const [specialty, setSpecialty] = useState("all");
  const [selectedExpertIds, setSelectedExpertIds] = useState<string[]>([]);
  const [sharedBrief, setSharedBrief] = useState("");
  const [selectedShareItemIds, setSelectedShareItemIds] = useState<string[]>([]);
  const [selectedShareVisualIds, setSelectedShareVisualIds] = useState<string[]>([]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/expert-sourcing?requestId=${encodeURIComponent(requestId)}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Expert sourcing could not be loaded.");
      }
      setData(result);
      setSharedBrief(result.request?.sharedScope?.brief || "");
      const snapshotItems = Array.isArray(result.request?.sharedScope?.quotePack?.items)
        ? result.request.sharedScope.quotePack.items.map((item: any) => String(item.id || "")).filter(Boolean)
        : [];
      const snapshotVisuals = Array.isArray(result.request?.sharedScope?.quotePack?.visuals)
        ? result.request.sharedScope.quotePack.visuals.map((item: any) => String(item.id || "")).filter(Boolean)
        : [];
      const hasExistingOpportunities = Array.isArray(result.opportunities) && result.opportunities.length > 0;
      setSelectedShareItemIds(
        snapshotItems.length
          ? snapshotItems
          : hasExistingOpportunities
            ? []
            : result.request?.sharePackOptions?.recommendedItemIds || [],
      );
      setSelectedShareVisualIds(
        snapshotVisuals.length
          ? snapshotVisuals
          : hasExistingOpportunities
            ? []
            : result.request?.sharePackOptions?.recommendedVisualIds || [],
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Expert sourcing could not be loaded.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [requestId]);

  const specialties = useMemo(() => {
    const values = new Set<string>();
    for (const expert of data?.experts || []) {
      for (const item of expert.specialties || []) {
        if (item) values.add(item);
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [data?.experts]);

  const requestedExpertIds = useMemo(
    () =>
      new Set(
        (data?.opportunities || [])
          .filter((item) => !["declined", "expired"].includes(item.status))
          .map((item) => item.expert_profile_id),
      ),
    [data?.opportunities],
  );

  const filteredExperts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.experts || []).filter((expert) => {
      if (availability === "available" && expert.availability !== "available") {
        return false;
      }
      if (availability === "limited" && expert.availability !== "limited") {
        return false;
      }
      if (
        availability === "available_or_limited" &&
        expert.availability === "unavailable"
      ) {
        return false;
      }
      if (
        specialty !== "all" &&
        !(expert.specialties || []).includes(specialty)
      ) {
        return false;
      }
      if (!query) return true;
      return [
        expert.full_name,
        expert.role_title,
        expert.location,
        ...(expert.specialties || []),
        ...(expert.software_tools || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data?.experts, search, availability, specialty]);

  async function run(action: string, body: Record<string, unknown> = {}) {
    if (working) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/admin/expert-sourcing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, requestId, ...body }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Expert sourcing action failed.");
      }
      setData(result);
      setSelectedExpertIds([]);
      setSharedBrief(result.request?.sharedScope?.brief || sharedBrief);
      const snapshotItems = Array.isArray(result.request?.sharedScope?.quotePack?.items)
        ? result.request.sharedScope.quotePack.items.map((item: any) => String(item.id || "")).filter(Boolean)
        : [];
      const snapshotVisuals = Array.isArray(result.request?.sharedScope?.quotePack?.visuals)
        ? result.request.sharedScope.quotePack.visuals.map((item: any) => String(item.id || "")).filter(Boolean)
        : [];
      if (snapshotItems.length) setSelectedShareItemIds(snapshotItems);
      if (snapshotVisuals.length) setSelectedShareVisualIds(snapshotVisuals);
      await onChanged?.();
      if (action === "select_preferred") onPreferredSelected?.();
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Expert sourcing action failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="heyy-source-loading">
        <Loader2 className="animate-spin" size={18} /> Loading Expert Network…
      </div>
    );
  }

  if (!data) {
    return <div className="heyy-source-error">{error || "Could not load Expert sourcing."}</div>;
  }

  const quoted = data.opportunities.filter((item) => item.status === "quoted");
  const locked = String(data.request.status || "").toLowerCase() === "converted";
  const sharePackLocked =
    locked ||
    data.opportunities.some((item) =>
      ["requested", "quoted", "selected", "closed"].includes(item.status),
    );
  const packOptions = data.request.sharePackOptions || {
    sections: [],
    visuals: [],
    recommendedItemIds: [],
    recommendedVisualIds: [],
  };
  const selectedItemCount = selectedShareItemIds.length;
  const selectedVisualCount = selectedShareVisualIds.length;

  function toggleShareItem(id: string) {
    if (sharePackLocked) return;
    setSelectedShareItemIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleShareVisual(id: string) {
    if (sharePackLocked) return;
    setSelectedShareVisualIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="heyy-source-root">
      <style>{styles}</style>

      <section className="heyy-source-card">
        <header className="heyy-source-head">
          <div>
            <p className="heyy-source-kicker">Expert Quote Pack</p>
            <h2>Choose exactly what Experts can see before they quote</h2>
            <p>
              Build a controlled snapshot from the client brief, production scope and generated references.
              Client billing, contact details, Heyy Studio margin and Admin-only information are never included.
            </p>
          </div>
          <ShieldCheck size={22} color="#8b5cf6" />
        </header>
        <div className="heyy-source-body">
          <div className="heyy-pack-toolbar">
            <div>
              <strong>{selectedItemCount} detail{selectedItemCount === 1 ? "" : "s"} + {selectedVisualCount} visual{selectedVisualCount === 1 ? "" : "s"}</strong>
              <p>{sharePackLocked ? "Snapshot locked after the first quote request." : "Start with recommended context, then add or remove anything before sharing."}</p>
            </div>
            {!sharePackLocked && (
              <div className="heyy-pack-toolbar-actions">
                <button
                  type="button"
                  className="heyy-source-secondary"
                  onClick={() => {
                    setSelectedShareItemIds(packOptions.recommendedItemIds || []);
                    setSelectedShareVisualIds(packOptions.recommendedVisualIds || []);
                  }}
                >
                  Recommended
                </button>
                <button
                  type="button"
                  className="heyy-source-secondary"
                  onClick={() => {
                    setSelectedShareItemIds(packOptions.sections.flatMap((section) => section.items.map((item) => item.id)));
                    setSelectedShareVisualIds(packOptions.visuals.map((visual) => visual.id));
                  }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="heyy-source-secondary"
                  onClick={() => {
                    setSelectedShareItemIds([]);
                    setSelectedShareVisualIds([]);
                  }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="heyy-pack-sections">
            {packOptions.sections.map((section) => (
              <div key={section.id} className="heyy-pack-section">
                <div className="heyy-pack-section-head">
                  <div>
                    <strong>{section.title}</strong>
                    <p>{section.description}</p>
                  </div>
                  <span>{section.items.filter((item) => selectedShareItemIds.includes(item.id)).length}/{section.items.length}</span>
                </div>
                <div className="heyy-pack-items">
                  {section.items.map((item) => {
                    const active = selectedShareItemIds.includes(item.id);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className="heyy-pack-item"
                        data-active={active ? "true" : "false"}
                        disabled={sharePackLocked}
                        onClick={() => toggleShareItem(item.id)}
                      >
                        <span className="heyy-pack-check">{active ? <Check size={13} /> : null}</span>
                        <span className="min-w-0 text-left">
                          <strong>{item.label}</strong>
                          <span>{item.value}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {packOptions.visuals.length > 0 && (
            <div className="heyy-pack-visual-block">
              <div className="heyy-pack-section-head">
                <div>
                  <strong>Generated visual references</strong>
                  <p>Select only the concepts, directions or approved visuals the Expert needs to price the work.</p>
                </div>
                <span>{selectedVisualCount}/{packOptions.visuals.length}</span>
              </div>
              <div className="heyy-pack-visuals">
                {packOptions.visuals.map((visual) => {
                  const active = selectedShareVisualIds.includes(visual.id);
                  return (
                    <button
                      type="button"
                      key={visual.id}
                      className="heyy-pack-visual"
                      data-active={active ? "true" : "false"}
                      disabled={sharePackLocked}
                      onClick={() => toggleShareVisual(visual.id)}
                    >
                      <span className="heyy-pack-visual-image">
                        <img src={visual.url} alt={visual.title} loading="lazy" />
                        <span className="heyy-pack-visual-check">{active ? <Check size={14} /> : null}</span>
                      </span>
                      <span className="heyy-pack-visual-copy">
                        <strong>{visual.title}</strong>
                        <span>{visual.type}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="heyy-pack-note">
            <span className="heyy-source-label">Heyy Studio message to Expert</span>
            <textarea
              value={sharedBrief}
              onChange={(event) => setSharedBrief(event.target.value)}
              disabled={sharePackLocked}
              className="heyy-source-textarea"
              placeholder="Add any clarification the Expert needs to price this project accurately."
            />
          </label>
          <p className="heyy-source-help">
            The selected details, selected visuals and this message are saved as a snapshot on each quote request.
            Later client changes do not silently change what the Expert originally priced.
          </p>
        </div>
      </section>

      {data.selected ? (
        <section className="heyy-source-card heyy-source-selected-card">
          <header className="heyy-source-head">
            <div>
              <p className="heyy-source-kicker">Preferred Expert</p>
              <h2>{data.selected.expert?.full_name || "Selected Expert"}</h2>
              <p>
                Selected for costing. The Expert is not assigned to production until
                the client pays the Heyy Studio quote.
              </p>
            </div>
            <UserRoundCheck size={23} color="#168d53" />
          </header>
          <div className="heyy-source-body">
            <div className="heyy-source-metrics">
              <Metric
                label="Expert fee"
                value={money(data.selected.quoted_fee_cents, data.selected.currency)}
              />
              <Metric
                label="Turnaround"
                value={
                  data.selected.turnaround_days
                    ? `${data.selected.turnaround_days} days`
                    : "—"
                }
              />
              <Metric
                label="Included revisions"
                value={String(data.selected.included_revisions ?? "—")}
              />
              <Metric
                label="Expert fee / extra revision"
                value={data.selected.extra_revision_fee_cents !== null ? money(data.selected.extra_revision_fee_cents, data.selected.currency) : "—"}
              />
              <Metric
                label="Client quote"
                value={data.clientQuote ? prettyStatus(data.clientQuote.status) : "Not sent"}
              />
            </div>
            {data.selected.expert_notes && (
              <div className="heyy-source-note">
                <strong>Expert notes</strong>
                <p>{data.selected.expert_notes}</p>
              </div>
            )}
            {!data.clientQuote && !locked && (
              <div className="heyy-source-actions">
                <button
                  type="button"
                  className="heyy-source-primary"
                  disabled={working}
                  onClick={() => onPreferredSelected?.()}
                >
                  Continue to client quote →
                </button>
                <button
                  type="button"
                  className="heyy-source-secondary"
                  disabled={working}
                  onClick={() => void run("clear_preferred")}
                >
                  Change preferred Expert
                </button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="heyy-source-card">
            <header className="heyy-source-head">
              <div>
                <p className="heyy-source-kicker">Expert matching</p>
                <h2>Find Experts for this request</h2>
                <p>
                  Match by Studio, specialty and availability, then request private
                  quotes from one or more Experts.
                </p>
              </div>
              <UsersRound size={22} color="#8b5cf6" />
            </header>
            <div className="heyy-source-body">
              <div className="heyy-source-filters">
                <label className="heyy-source-filter">
                  <span className="heyy-source-label">Search</span>
                  <div className="heyy-source-search">
                    <Search size={14} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Name, skill, software…"
                    />
                  </div>
                </label>
                <div className="heyy-source-filter">
                  <span className="heyy-source-label">Availability</span>
                  <HeyySelect
                    tone="admin"
                    value={availability}
                    ariaLabel="Expert availability"
                    options={[
                      { value: "available_or_limited", label: "Available + Limited" },
                      { value: "available", label: "Available" },
                      { value: "limited", label: "Limited" },
                      { value: "all", label: "All" },
                    ]}
                    onChange={setAvailability}
                  />
                </div>
                <div className="heyy-source-filter">
                  <span className="heyy-source-label">Specialty</span>
                  <HeyySelect
                    tone="admin"
                    value={specialty}
                    ariaLabel="Expert specialty"
                    options={[
                      { value: "all", label: "All specialties" },
                      ...specialties.map((item) => ({ value: item, label: item })),
                    ]}
                    onChange={setSpecialty}
                  />
                </div>
              </div>

              <div className="heyy-source-experts">
                {filteredExperts.length ? (
                  filteredExperts.map((expert) => {
                    const isSelected = selectedExpertIds.includes(expert.id);
                    const alreadyRequested = requestedExpertIds.has(expert.id);
                    return (
                      <div
                        key={expert.id}
                        className="heyy-source-expert"
                        data-selected={isSelected ? "true" : "false"}
                      >
                        <button
                          type="button"
                          className="heyy-source-check"
                          data-active={isSelected ? "true" : "false"}
                          disabled={alreadyRequested || working || locked}
                          onClick={() =>
                            setSelectedExpertIds((current) =>
                              current.includes(expert.id)
                                ? current.filter((id) => id !== expert.id)
                                : [...current, expert.id],
                            )
                          }
                          aria-label={`Select ${expert.full_name}`}
                        >
                          {alreadyRequested ? (
                            <Clock3 size={14} />
                          ) : isSelected ? (
                            <Check size={15} />
                          ) : null}
                        </button>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong>{expert.full_name}</strong>
                            {alreadyRequested && (
                              <span className="heyy-source-pill">Quote requested</span>
                            )}
                          </div>
                          <p>
                            {expert.role_title || "Heyy Studio Expert"}
                            {expert.location ? ` · ${expert.location}` : ""}
                            {expert.years_experience !== null
                              ? ` · ${expert.years_experience} yrs`
                              : ""}
                          </p>
                          <div className="heyy-source-tags">
                            {(expert.specialties || []).slice(0, 6).map((item) => (
                              <span key={item}>{item}</span>
                            ))}
                          </div>
                        </div>
                        <span className={`heyy-source-availability ${expert.availability}`}>
                          {expert.availability}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="heyy-source-empty">No Experts match these filters.</div>
                )}
              </div>

              <div className="heyy-source-actions">
                <button
                  type="button"
                  className="heyy-source-primary"
                  disabled={
                    !selectedExpertIds.length ||
                    working ||
                    locked ||
                    (!selectedShareItemIds.length && !selectedShareVisualIds.length && !sharedBrief.trim())
                  }
                  onClick={() =>
                    void run("request_quotes", {
                      expertIds: selectedExpertIds,
                      sharedBrief,
                      shareItemIds: selectedShareItemIds,
                      shareVisualIds: selectedShareVisualIds,
                    })
                  }
                >
                  {working ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Send size={14} />
                  )}
                  Request quote{selectedExpertIds.length === 1 ? "" : "s"}
                  {selectedExpertIds.length ? ` (${selectedExpertIds.length})` : ""}
                </button>
              </div>
            </div>
          </section>

          <section className="heyy-source-card">
            <header className="heyy-source-head">
              <div>
                <p className="heyy-source-kicker">Quote comparison</p>
                <h2>Expert responses</h2>
                <p>
                  These fees are private Heyy Studio costs. The client sees only the
                  final Heyy Studio quote.
                </p>
              </div>
              <BadgeDollarSign size={22} color="#8b5cf6" />
            </header>
            <div className="heyy-source-body">
              {data.opportunities.length === 0 ? (
                <div className="heyy-source-empty">No Expert quote requests sent yet.</div>
              ) : (
                <div className="heyy-source-quotes">
                  {data.opportunities.map((opportunity) => (
                    <article key={opportunity.id} className="heyy-source-quote">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <strong>{opportunity.expert?.full_name || "Expert"}</strong>
                          <p>
                            {opportunity.expert?.role_title ||
                              opportunity.expert?.studio ||
                              "Heyy Studio Expert"}
                          </p>
                        </div>
                        <span className="heyy-source-pill">
                          {prettyStatus(opportunity.status)}
                        </span>
                      </div>
                      {opportunity.status === "quoted" &&
                      opportunity.quoted_fee_cents !== null ? (
                        <>
                          <div className="heyy-source-money">
                            {money(opportunity.quoted_fee_cents, opportunity.currency)}
                          </div>
                          <div className="heyy-source-inline-metrics">
                            <span>{opportunity.turnaround_days || "—"} days</span>
                            <span>
                              {opportunity.included_revisions ?? "—"} revisions
                            </span>
                          </div>
                          {opportunity.expert_notes && (
                            <p className="heyy-source-quote-notes">
                              {opportunity.expert_notes}
                            </p>
                          )}
                          <button
                            type="button"
                            className="heyy-source-select"
                            disabled={working || locked}
                            onClick={() =>
                              void run("select_preferred", {
                                opportunityId: opportunity.id,
                              })
                            }
                          >
                            <UserRoundCheck size={14} /> Select as preferred
                          </button>
                        </>
                      ) : (
                        <p className="heyy-source-waiting">
                          {opportunity.status === "requested"
                            ? "Waiting for fee, turnaround and revision details."
                            : "This quote request is closed."}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
              {quoted.length > 1 && (
                <p className="heyy-source-help mt-3">
                  Compare fit, turnaround and fee. Selecting one Expert closes the
                  other open quote requests.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      {error && <div className="heyy-source-error">{error}</div>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="heyy-source-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function prettyStatus(value: string) {
  return String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function money(cents: number | null, currency = "USD") {
  if (cents === null || cents === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(Number(cents) / 100);
  } catch {
    return `${currency} ${(Number(cents) / 100).toFixed(2)}`;
  }
}

const styles = `
  .heyy-source-root{display:grid;gap:16px}.heyy-source-card{overflow:hidden;border:1px solid #ddd6e8;border-radius:24px;background:#fff;box-shadow:0 10px 28px rgba(30,20,45,.055)}.heyy-source-selected-card{border-color:#a7e3c1;background:linear-gradient(135deg,#f5fff8,#fff)}.heyy-source-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 22px;border-bottom:1px solid #eee9f4;background:linear-gradient(135deg,#fff,#f8f3ff)}.heyy-source-head h2{margin:4px 0 0;font-size:21px;font-weight:950;letter-spacing:-.025em;color:#17151f}.heyy-source-head p:not(.heyy-source-kicker){margin:6px 0 0;max-width:760px;font-size:12px;line-height:1.7;color:#6b6473}.heyy-source-kicker{margin:0;font-size:9px;font-weight:950;letter-spacing:.19em;text-transform:uppercase;color:#8b5cf6}.heyy-source-body{padding:20px 22px}.heyy-source-label{display:block;margin-bottom:7px;font-size:9px;font-weight:950;letter-spacing:.15em;text-transform:uppercase;color:#746d7c}.heyy-source-textarea{width:100%;min-height:116px;border:1px solid #dcd5e5;border-radius:14px;background:#fff;padding:13px;color:#17151f;outline:none;resize:vertical}.heyy-source-textarea:focus{border-color:#8b5cf6;box-shadow:0 0 0 4px rgba(139,92,246,.10)}.heyy-source-help{margin:8px 0 0;font-size:10px;line-height:1.6;color:#7a7382}.heyy-source-filters{display:grid;grid-template-columns:1.15fr .8fr .8fr;gap:10px}.heyy-source-filter{min-width:0;border:1px solid #e3deea;border-radius:15px;background:#faf9fc;padding:10px 12px}.heyy-source-search{display:flex;height:43px;align-items:center;gap:8px;border:1px solid #ded8e6;border-radius:12px;background:#fff;padding:0 11px;color:#8b8394}.heyy-source-search input{width:100%;border:0;background:transparent;color:#17151f;outline:none}.heyy-source-experts{display:grid;gap:9px;margin-top:14px}.heyy-source-expert{display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:12px;border:1px solid #e6e0eb;border-radius:16px;padding:12px;background:#fff}.heyy-source-expert[data-selected="true"]{border-color:#8b5cf6;background:#f8f2ff}.heyy-source-check{display:grid;width:32px;height:32px;place-items:center;border:1px solid #ded8e6;border-radius:10px;background:#fff;color:#8b5cf6}.heyy-source-check[data-active="true"]{border-color:#8b5cf6;background:#8b5cf6;color:#fff}.heyy-source-expert strong,.heyy-source-quote strong{font-size:12px;font-weight:950;color:#17151f}.heyy-source-expert p,.heyy-source-quote p{margin:3px 0 0;font-size:10px;line-height:1.5;color:#777080}.heyy-source-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.heyy-source-tags span{border-radius:999px;background:#f1e8ff;padding:4px 7px;font-size:8px;font-weight:900;color:#8b5cf6}.heyy-source-availability{border-radius:999px;padding:5px 8px;font-size:8px;font-weight:950;text-transform:uppercase}.heyy-source-availability.available{background:#e7f8ee;color:#168d53}.heyy-source-availability.limited{background:#fff4d8;color:#a26200}.heyy-source-availability.unavailable{background:#f5f2f5;color:#8b8394}.heyy-source-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.heyy-source-primary,.heyy-source-secondary,.heyy-source-select{display:inline-flex;min-height:42px;align-items:center;justify-content:center;gap:7px;border-radius:12px;padding:0 14px;font-size:10px;font-weight:950}.heyy-source-primary{border:1px solid #8b5cf6;background:#8b5cf6;color:#fff}.heyy-source-secondary{border:1px solid #d9d2e1;background:#fff;color:#5e5667}.heyy-source-select{width:100%;margin-top:12px;border:1px solid #168d53;background:#168d53;color:#fff}.heyy-source-primary:disabled,.heyy-source-secondary:disabled,.heyy-source-select:disabled{cursor:default;opacity:.5}.heyy-source-quotes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.heyy-source-quote{border:1px solid #e5dfeb;border-radius:16px;background:#fff;padding:15px}.heyy-source-pill{display:inline-flex;border:1px solid #e1d8ef;border-radius:999px;background:#f8f4ff;padding:4px 7px;font-size:8px;font-weight:950;color:#8b5cf6}.heyy-source-money{margin-top:14px;font-size:25px;font-weight:950;letter-spacing:-.035em;color:#17151f}.heyy-source-inline-metrics{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.heyy-source-inline-metrics span{border-radius:999px;background:#f4f1f6;padding:5px 8px;font-size:8px;font-weight:900;color:#5f5868}.heyy-source-quote-notes{white-space:pre-wrap}.heyy-source-waiting{margin-top:14px!important}.heyy-source-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.heyy-source-metric{border:1px solid #dce8e1;border-radius:14px;background:#fff;padding:12px}.heyy-source-metric span{display:block;font-size:8px;font-weight:950;letter-spacing:.12em;text-transform:uppercase;color:#7b7e7c}.heyy-source-metric strong{display:block;margin-top:5px;font-size:13px;font-weight:950;color:#17151f}.heyy-source-note{margin-top:12px;border:1px solid #e7e1eb;border-radius:14px;background:#faf9fc;padding:12px}.heyy-source-note strong{font-size:10px;color:#17151f}.heyy-source-note p{margin:5px 0 0;font-size:11px;line-height:1.6;color:#6b6473}.heyy-source-empty,.heyy-source-loading,.heyy-source-error{border:1px dashed #ddd4e7;border-radius:16px;background:#fbfafd;padding:18px;text-align:center;font-size:11px;font-weight:800;color:#777080}.heyy-source-loading{display:flex;align-items:center;justify-content:center;gap:8px}.heyy-source-error{border-color:#fecdd3;background:#fff1f2;color:#be123c}.heyy-pack-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid #e5dcef;border-radius:16px;background:#faf7ff;padding:13px 14px}.heyy-pack-toolbar strong{font-size:12px;font-weight:950;color:#17151f}.heyy-pack-toolbar p{margin:3px 0 0;font-size:10px;line-height:1.5;color:#756d7e}.heyy-pack-toolbar-actions{display:flex;flex-wrap:wrap;gap:7px}.heyy-pack-sections{display:grid;gap:11px;margin-top:14px}.heyy-pack-section,.heyy-pack-visual-block{border:1px solid #e8e2ee;border-radius:17px;background:#fff;padding:14px}.heyy-pack-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.heyy-pack-section-head strong{display:block;font-size:12px;font-weight:950;color:#17151f}.heyy-pack-section-head p{margin:4px 0 0;max-width:780px;font-size:10px;line-height:1.55;color:#756d7e}.heyy-pack-section-head>span{flex:none;border-radius:999px;background:#f2e9ff;padding:5px 8px;font-size:8px;font-weight:950;color:#8b5cf6}.heyy-pack-items{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:11px}.heyy-pack-item{display:grid;grid-template-columns:24px minmax(0,1fr);gap:9px;align-items:start;border:1px solid #e4dee9;border-radius:13px;background:#fbfafc;padding:10px;color:#17151f;text-align:left}.heyy-pack-item[data-active="true"]{border-color:#8b5cf6;background:#f7f0ff}.heyy-pack-item:disabled{cursor:default}.heyy-pack-check{display:grid;width:22px;height:22px;place-items:center;border:1px solid #d8d0e1;border-radius:7px;background:#fff;color:#8b5cf6}.heyy-pack-item[data-active="true"] .heyy-pack-check{border-color:#8b5cf6;background:#8b5cf6;color:#fff}.heyy-pack-item strong{display:block;font-size:10px;font-weight:950}.heyy-pack-item span span{display:-webkit-box;overflow:hidden;margin-top:4px;color:#6e6677;font-size:9px;line-height:1.45;white-space:pre-wrap;-webkit-box-orient:vertical;-webkit-line-clamp:3}.heyy-pack-visual-block{margin-top:11px}.heyy-pack-visuals{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:11px}.heyy-pack-visual{overflow:hidden;border:1px solid #e4dee9;border-radius:14px;background:#fff;text-align:left}.heyy-pack-visual[data-active="true"]{border-color:#8b5cf6;box-shadow:0 0 0 2px rgba(139,92,246,.08)}.heyy-pack-visual:disabled{cursor:default}.heyy-pack-visual-image{position:relative;display:block;height:120px;background:#f3f0f5}.heyy-pack-visual-image img{width:100%;height:100%;object-fit:contain}.heyy-pack-visual-check{position:absolute;right:8px;top:8px;display:grid;width:25px;height:25px;place-items:center;border:1px solid #d8d0e1;border-radius:8px;background:rgba(255,255,255,.92);color:#8b5cf6}.heyy-pack-visual[data-active="true"] .heyy-pack-visual-check{border-color:#8b5cf6;background:#8b5cf6;color:#fff}.heyy-pack-visual-copy{display:block;padding:9px}.heyy-pack-visual-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;font-weight:950;color:#17151f}.heyy-pack-visual-copy span{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;color:#7c7485}.heyy-pack-note{display:block;margin-top:14px}@media(max-width:850px){.heyy-source-filters,.heyy-source-metrics{grid-template-columns:1fr 1fr}.heyy-source-quotes{grid-template-columns:1fr}.heyy-pack-visuals{grid-template-columns:repeat(2,minmax(0,1fr))}.heyy-pack-items{grid-template-columns:1fr}}@media(max-width:620px){.heyy-source-filters,.heyy-source-metrics{grid-template-columns:1fr}.heyy-source-expert{grid-template-columns:32px minmax(0,1fr)}.heyy-source-availability{grid-column:2;justify-self:start}.heyy-pack-toolbar{align-items:flex-start;flex-direction:column}.heyy-pack-visuals{grid-template-columns:1fr 1fr}}
`;
