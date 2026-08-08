"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Clock3, ImageIcon } from "lucide-react";
import {
  BRAND_APPLICATION_FIELDS,
  BRAND_DELIVERABLES,
  normaliseBrandJourney,
} from "@/lib/brand/project-templates";

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

function approvalByApplication(assets: any[]) {
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
  return approvals;
}

function visualByApplication(assets: any[]) {
  const visuals: Record<string, any> = {};
  for (const asset of assets) {
    if (asset?.asset_type !== "brand_application_visual") continue;
    const payload = readAssetPayload(asset);
    const applicationId = payload?.applicationId;
    if (typeof applicationId === "string" && !visuals[applicationId]) {
      visuals[applicationId] = {
        ...payload,
        visualAssetId: asset.id,
        imageUrl:
          asset?.file_url ||
          asset?.thumbnail_url ||
          payload?.imageUrl ||
          payload?.outputs?.[0]?.imageUrl ||
          null,
        createdAt: asset.created_at,
      };
    }
  }
  return visuals;
}

function compactBriefItems(applicationId: string, brief: Record<string, unknown>) {
  return Object.entries(brief || {})
    .filter(([, value]) =>
      typeof value === "string" ? Boolean(value.trim()) : Boolean(value),
    )
    .map(([key, value]) => {
      const label =
        BRAND_APPLICATION_FIELDS[applicationId]?.find((field) => field.id === key)
          ?.label || key;
      return `${label}: ${String(value)}`;
    });
}

function defaultContent(id: string) {
  const map: Record<string, string[]> = {
    "business-card": ["Name and role", "Contact information", "Approved logo", "Print format"],
    letterhead: ["Business details", "Header and footer hierarchy", "Approved logo", "Document content area"],
    envelope: ["Return address", "Mailing format", "Approved logo", "Print specification"],
    "email-signature": ["Name and role", "Phone, email and website", "Approved logo", "Social links or disclaimer"],
    presentation: ["Cover slide", "Content hierarchy", "Charts and imagery", "Closing slide"],
    "social-system": ["Campaign message", "Selected platforms", "Required formats", "Content pillars"],
    website: ["Primary goal", "Hero message", "Call to action", "Key sections"],
    packaging: ["Product name", "Mandatory information", "Front-panel hierarchy", "Dieline or dimensions"],
    signage: ["Viewing distance", "Dimensions", "Material direction", "Approved logo"],
    merchandise: ["Selected item", "Logo placement", "Production method", "Colour variant"],
  };
  return map[id] || ["Approved content", "Approved logo", "Selected format", "Production notes"];
}

function defaultLayoutRules(id: string) {
  const map: Record<string, string[]> = {
    "email-signature": ["Compact horizontal hierarchy", "Readable at desktop and mobile sizes", "Keep contact details selectable in final HTML", "Use the approved logo with clear space"],
    "social-system": ["Use safe zones for every platform", "Keep headlines inside the protected text area", "Maintain one connected campaign family", "Adapt hierarchy for square, portrait and story formats"],
    website: ["Responsive desktop and mobile hierarchy", "Strong hero focus", "Consistent component spacing", "Clear primary call to action"],
    presentation: ["Reusable master layouts", "Clear cover and content hierarchy", "Consistent image treatment", "Accessible chart and text contrast"],
  };
  return map[id] || ["Follow the approved grid", "Use clear hierarchy", "Maintain brand consistency", "Respect final production dimensions"];
}

export default function BrandApplications({
  project,
  brand,
  assets = [],
}: {
  project: any;
  brand: any;
  assets?: any[];
}) {
  const journey = normaliseBrandJourney(brand, project);
  const generated = Array.isArray(brand?.generatedGuidelines?.applications)
    ? brand.generatedGuidelines.applications
    : [];
  const approvals = useMemo(() => approvalByApplication(assets), [assets]);
  const visuals = useMemo(() => visualByApplication(assets), [assets]);

  const applications = useMemo(
    () =>
      BRAND_DELIVERABLES.filter(
        (item) =>
          journey.selectedDeliverables.includes(item.id) &&
          !["strategy", "creative-direction", "logo", "guidelines"].includes(item.id),
      ).map((item) => {
        const generatedEntry = generated.find((entry: any) => entry.id === item.id) || {};
        const plan = Array.isArray(brand?.applicationPlan)
          ? brand.applicationPlan.find((entry: any) => entry.id === item.id) || {}
          : {};
        return {
          ...item,
          ...generatedEntry,
          plan,
          brief: journey.applicationBriefs[item.id] || {},
          approval: approvals[item.id] || null,
          visual: visuals[item.id] || null,
        };
      }),
    [
      journey.selectedDeliverables,
      journey.applicationBriefs,
      generated,
      brand?.applicationPlan,
      approvals,
      visuals,
    ],
  );

  const [activeId, setActiveId] = useState(applications[0]?.id || "");
  const active = applications.find((item) => item.id === activeId) || applications[0];

  if (!applications.length) {
    return (
      <section className="rounded-[26px] border border-dashed border-violet-300 bg-violet-50 p-9 text-center">
        <p className="text-sm font-black text-violet-800">
          No application module is required for this project scope.
        </p>
        <p className="mt-2 text-xs leading-5 text-violet-600">
          An application can be added later without recreating the strategy or identity.
        </p>
      </section>
    );
  }

  const approved = Boolean(
    active?.approval &&
      active?.approval?.visualAssetId &&
      String(active.approval.visualAssetId) === String(active?.visual?.visualAssetId),
  );
  const approvedImage = approved
    ? active?.approval?.imageUrl || active?.visual?.imageUrl
    : null;
  const requiredContent =
    active?.requiredContent?.length
      ? active.requiredContent
      : active?.contentNeeds?.length
        ? active.contentNeeds
        : active?.plan?.contentNeeds?.length
          ? active.plan.contentNeeds
          : compactBriefItems(active.id, active.brief).length
            ? compactBriefItems(active.id, active.brief)
            : defaultContent(active.id);
  const layoutRules =
    active?.layoutRules?.length
      ? active.layoutRules
      : active?.designPriorities?.length
        ? active.designPriorities
        : active?.plan?.designPriorities?.length
          ? active.plan.designPriorities
          : defaultLayoutRules(active.id);

  return (
    <section className="brand-guideline-applications overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_18px_45px_rgba(55,30,83,.08)]">
      <header className="border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-white p-5 sm:p-6">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">Applications</p>
        <h2 className="mt-1 text-3xl font-black tracking-[-0.045em] text-slate-950">
          Guidance for the selected touchpoints
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Guidelines use the saved application brief and, once approved, the exact selected visual concept.
        </p>
      </header>

      <div className="grid min-w-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <nav className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
          <div className="grid gap-2">
            {applications.map((item) => {
              const itemApproved = Boolean(
                item.approval?.visualAssetId &&
                  String(item.approval.visualAssetId) === String(item.visual?.visualAssetId),
              );
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={`rounded-[16px] border p-4 text-left transition ${
                    active?.id === item.id
                      ? "border-violet-600 bg-violet-600 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-violet-400"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-[0.15em] ${active?.id === item.id ? "text-white/70" : "text-violet-600"}`}>
                        {item.category}
                      </p>
                      <p className="mt-1 text-sm font-black">{item.title || item.label}</p>
                    </div>
                    {itemApproved ? (
                      <BadgeCheck size={16} className={active?.id === item.id ? "text-white" : "text-emerald-600"} />
                    ) : item.visual?.imageUrl ? (
                      <Clock3 size={16} className={active?.id === item.id ? "text-white" : "text-amber-500"} />
                    ) : null}
                  </div>
                  <p className={`mt-2 text-[10px] font-bold ${active?.id === item.id ? "text-white/70" : itemApproved ? "text-emerald-600" : "text-slate-400"}`}>
                    {itemApproved
                      ? "Approved concept connected"
                      : item.visual?.imageUrl
                        ? "Generated concept awaiting approval"
                        : "Brief guidance ready"}
                  </p>
                </button>
              );
            })}
          </div>
        </nav>

        {active && (
          <div className="p-5 sm:p-6">
            <div className="rounded-[22px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-600">{active.category}</p>
                  <h3 className="mt-2 text-3xl font-black tracking-[-0.045em] text-slate-950">{active.title || active.label}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{active.objective || active.plan?.objective || active.description}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-[0.13em] ${approved ? "border-emerald-300 bg-emerald-50 text-emerald-700" : active.visual?.imageUrl ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}>
                  {approved ? <BadgeCheck size={14} /> : active.visual?.imageUrl ? <Clock3 size={14} /> : <ImageIcon size={14} />}
                  {approved ? "Approved concept" : active.visual?.imageUrl ? "Approval required" : "No visual generated"}
                </span>
              </div>

              {approvedImage && (
                <div className="mt-5 overflow-hidden rounded-[18px] border border-emerald-200 bg-slate-950">
                  <div className="flex items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-700">Approved application reference</p>
                    <p className="text-[9px] font-bold text-emerald-700">Used for production and future guidelines</p>
                  </div>
                  <div className="flex min-h-[240px] items-center justify-center p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={approvedImage} alt={`${active.label} approved concept`} className="max-h-[520px] w-full rounded-[12px] object-contain" />
                  </div>
                </div>
              )}

              {!approved && active.visual?.imageUrl && (
                <div className="mt-5 rounded-[16px] border border-amber-300 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-800">
                  A concept has been generated, but it is not yet confirmed. Open the Applications section and click <strong>Approve this concept</strong> to connect it to these Guidelines and to expert production.
                </div>
              )}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Rules title="Required content" items={requiredContent} />
                <Rules title="Layout rules" items={layoutRules} />
                <Rules
                  title="Brand rules"
                  items={active.brandRules || [
                    "Use the approved logo and colour hierarchy",
                    "Follow the selected typography system",
                    "Keep imagery aligned to the creative direction",
                  ]}
                />
                <Rules
                  title="Production checklist"
                  items={active.productionChecklist || [
                    "Confirm final size and format",
                    "Prepare editable source files",
                    "Check bleed, margins and colour mode",
                    "Complete supplier or developer handoff",
                  ]}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Rules({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-4">
      <p className="text-[8px] font-black uppercase tracking-[0.15em] text-violet-600">{title}</p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-xs font-bold leading-5 text-slate-700">
            <span className="text-violet-600">✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
