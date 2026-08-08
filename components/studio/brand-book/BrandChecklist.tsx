"use client";

import { BRAND_DELIVERABLES, normaliseBrandJourney } from "@/lib/brand/project-templates";

export default function BrandChecklist({
  project,
  brand,
  selectedConcept,
  selectedMoodboard,
  selectedLogo,
  assets = [],
}: {
  project?: any;
  brand: any;
  selectedConcept?: any;
  selectedMoodboard?: any;
  selectedLogo?: any;
  assets?: any[];
}) {
  const journey = normaliseBrandJourney(brand, project);
  const generated = Array.isArray(brand?.generatedGuidelines?.checklist) ? brand.generatedGuidelines.checklist : [];
  const hasExistingLogo = Boolean(journey.existingLogoUrl || assets.some((asset) => asset.asset_type === "existing_logo"));
  const applicationIds = journey.selectedDeliverables.filter((id) => !["strategy", "creative-direction", "logo", "guidelines"].includes(id));

  const checks: Array<{ id: string; label: string; category: string; done: boolean; note: string }> = [
    { id: "foundation", label: "Brand foundation prepared", category: "Foundation", done: Boolean(brand?.foundation?.positioning && brand?.foundation?.mission), note: "Purpose, positioning, audience, mission and brand promise are defined." },
    ...(journey.includeCreativeDirections ? [{ id: "direction", label: "Creative direction selected", category: "Direction", done: Boolean(selectedConcept), note: "One strategic route is selected before visual development continues." }] : []),
    ...(journey.logoAction === "create" || journey.logoAction === "refine" ? [{ id: "logo", label: "Logo concept selected", category: "Logo", done: Boolean(selectedLogo?.imageUrl), note: "A concept is selected; vector production and trademark review remain pending." }] : journey.logoAction === "keep" ? [{ id: "existing-logo", label: "Existing logo supplied", category: "Logo", done: hasExistingLogo, note: "The retained logo is available as the source identity asset." }] : []),
    { id: "colour", label: "Colour hierarchy prepared", category: "Identity", done: Boolean(brand?.colourPalette?.length || brand?.colorPalette?.length), note: "Primary, supporting, accent and neutral colours are documented." },
    { id: "type", label: "Typography hierarchy prepared", category: "Identity", done: Boolean(brand?.typography?.length), note: "Display, heading and body roles are defined." },
    ...(journey.includeGuidelines ? [{ id: "guidelines", label: "Guideline text generated", category: "Guidelines", done: Boolean(brand?.generatedGuidelines), note: "Foundation, identity, applications and readiness rules are documented." }] : []),
    ...applicationIds.map((id) => ({ id: `application-${id}`, label: `${BRAND_DELIVERABLES.find((item) => item.id === id)?.label || id} brief prepared`, category: "Application", done: Boolean(brand?.applicationPlan?.some((item: any) => item.id === id)), note: "The concept brief is ready; final production files are not yet implied." })),
    { id: "production", label: "Production readiness reviewed", category: "Production", done: false, note: "Final editable, vector, print-ready or developer-ready files require expert production and approval." },
  ];

  generated.forEach((item: any) => {
    if (!checks.some((check) => check.id === item.id)) checks.push({ id: item.id, label: item.label, category: item.category || "Project", done: false, note: item.completionRule || "Review required." });
  });

  const completed = checks.filter((item) => item.done).length;
  const progress = Math.round((completed / Math.max(1, checks.length)) * 100);

  return (
    <section className="overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_18px_45px_rgba(55,30,83,.08)]">
      <header className="border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-white p-5 sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">Project Checklist</p><h2 className="mt-1 text-3xl font-black tracking-[-0.045em] text-slate-950">Real readiness, not a generic checklist</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Requirements change according to the journey, logo decision and selected applications.</p></div><span className="inline-flex min-h-14 min-w-24 items-center justify-center rounded-full bg-violet-700 px-5 text-xl font-black text-white">{progress}%</span></div></header>
      <div className="p-5 sm:p-6"><div className="overflow-hidden rounded-full bg-violet-100 p-1"><div className="h-3 rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-500 transition-all" style={{ width: `${progress}%` }} /></div><div className="mt-5 grid gap-3 md:grid-cols-2">{checks.map((item) => <div key={item.id} className={`rounded-[18px] border p-4 ${item.done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><div><p className={`text-[8px] font-black uppercase tracking-[0.15em] ${item.done ? "text-emerald-700" : "text-violet-600"}`}>{item.category}</p><h3 className="mt-1 text-sm font-black text-slate-950">{item.label}</h3></div><span className={`flex h-8 w-8 items-center justify-center rounded-[10px] text-xs font-black ${item.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>{item.done ? "✓" : "•"}</span></div><p className="mt-2 text-xs leading-5 text-slate-600">{item.note}</p></div>)}</div><div className="mt-5 rounded-[18px] border border-amber-200 bg-amber-50 p-4"><p className="text-[8px] font-black uppercase tracking-[0.15em] text-amber-700">Important</p><p className="mt-1 text-xs font-bold leading-5 text-amber-900">AI completion means the concept or guideline is prepared. It does not automatically mean vector, legal, print, supplier or launch readiness.</p></div></div>
    </section>
  );
}
