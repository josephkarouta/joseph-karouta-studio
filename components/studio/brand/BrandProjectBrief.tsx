"use client";

import {
  BRAND_APPLICATION_FIELDS,
  deliverableLabels,
  getApplicationDeliverables,
  getBrandJourney,
  normaliseBrandJourney,
} from "@/lib/brand/project-templates";

export default function BrandProjectBrief({ project, brand, assets = [] }: { project: any; brand: any; assets?: any[] }) {
  const journey = normaliseBrandJourney(brand, project);
  const journeyConfig = getBrandJourney(journey.journeyId);
  const applications = getApplicationDeliverables(journey.selectedDeliverables);
  const existingLogo = assets.find((asset) => asset.asset_type === "existing_logo")?.file_url || journey.existingLogoUrl;
  const selected = deliverableLabels(journey.selectedDeliverables);
  const singleApplication = applications.length === 1 ? applications[0] : null;
  const title = singleApplication ? `${singleApplication.label} Project` : journeyConfig.title;
  const description = singleApplication
    ? `A focused ${singleApplication.label.toLowerCase()} project using the supplied identity. No unrelated rebrand, logo directions or guidelines are included.`
    : journeyConfig.description;

  return (
    <section className="brand-project-brief-workspace overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_18px_45px_rgba(55,30,83,.08)]">
      <header className="relative overflow-hidden border-b border-violet-100 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-6 sm:p-8">
        <div className="absolute right-[-30px] top-[-65px] h-52 w-52 rounded-full bg-violet-200/45 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-600">{singleApplication ? `${singleApplication.label} Brief` : "Project Brief"}</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950 sm:text-4xl">{title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-violet-700 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white">{project.style || "Brand direction"}</span>
        </div>
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)] sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <BriefCard label="Business" value={project.project_name} copy={project.description || brand?.foundation?.summary || "No additional context saved."} />
          <BriefCard label="Industry" value={project.industry || "Brand"} copy="The industry context guides hierarchy, content and production requirements." />
          <BriefCard label="Audience" value={project.audience || "Audience"} copy={brand?.foundation?.targetAudience || "The selected audience remains attached to this project."} />
          <BriefCard label="Style" value={project.style || "Style direction"} copy="This is a visual preference, not permission to redesign unrelated parts of the identity." />
          <BriefCard label="Logo" value={logoLabel(journey.logoAction)} copy={logoCopy(journey.logoAction, singleApplication?.label)} />
          <BriefCard label="Workspace" value={`${journey.workspaceSections.length} focused sections`} copy={journey.workspaceSections.map(sectionLabel).join(" · ")} />
        </div>

        <aside className="space-y-4">
          {existingLogo && (
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-600">Uploaded logo</p>
              <div className="mt-3 flex aspect-[16/10] items-center justify-center rounded-[16px] border border-slate-200 bg-white p-7">
                <img src={existingLogo} alt="Existing logo" className="max-h-full max-w-full object-contain" />
              </div>
            </div>
          )}

          <div className="rounded-[22px] border border-violet-200 bg-violet-50 p-4">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-700">Selected scope</p>
            <div className="mt-3 grid gap-2">
              {selected.length ? selected.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[13px] border border-violet-100 bg-white px-3 py-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-violet-700 text-[10px] font-black text-white">✓</span>
                  <span className="text-xs font-black text-slate-700">{item}</span>
                </div>
              )) : <p className="text-xs leading-5 text-slate-600">{journey.customScope || "Custom scope will be developed in the workspace."}</p>}
            </div>
          </div>

          {applications.map((application) => {
            const values = journey.applicationBriefs[application.id] || {};
            const entries = Object.entries(values).filter(([, value]) => value?.trim());
            if (!entries.length) return null;
            return (
              <div key={application.id} className="rounded-[22px] border border-blue-200 bg-blue-50 p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-blue-700">{application.label} content</p>
                <div className="mt-3 grid gap-2">
                  {entries.map(([key, value]) => (
                    <div key={key} className="rounded-[12px] bg-white px-3 py-2">
                      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">{BRAND_APPLICATION_FIELDS[application.id]?.find((field) => field.id === key)?.label || key}</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs font-bold leading-5 text-slate-700">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {(journey.preserveNotes || journey.changeNotes) && (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4">
              {journey.preserveNotes && <Note label="Must preserve" value={journey.preserveNotes} />}
              {journey.changeNotes && <div className={journey.preserveNotes ? "mt-4 border-t border-amber-200 pt-4" : ""}><Note label="Needs to change" value={journey.changeNotes} /></div>}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function BriefCard({ label, value, copy }: { label: string; value: string; copy: string }) {
  return <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(38,25,52,.04)]"><p className="text-[8px] font-black uppercase tracking-[0.15em] text-violet-600">{label}</p><h3 className="mt-2 text-lg font-black text-slate-950">{value}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{copy}</p></div>;
}
function Note({ label, value }: { label: string; value: string }) { return <><p className="text-[8px] font-black uppercase tracking-[0.15em] text-amber-700">{label}</p><p className="mt-1 text-xs font-bold leading-5 text-amber-900">{value}</p></>; }
function logoLabel(action: string) { return action === "create" ? "Create new logo" : action === "refine" ? "Refine existing logo" : action === "keep" ? "Use uploaded logo" : "No logo work"; }
function logoCopy(action: string, item?: string) { return action === "create" ? "Three logo routes are included because logo creation is part of this scope." : action === "refine" ? "The supplied mark remains the reference during refinement." : action === "keep" ? `The existing logo is used for ${item ? `the ${item.toLowerCase()}` : "this project"}; no new logo directions are added.` : "This project does not include logo work."; }
function sectionLabel(section: string) { return section === "brief" ? "Brief" : section === "directions" ? "Directions" : section === "logo" ? "Logo" : section === "applications" ? "Applications" : section === "guidelines" ? "Guidelines" : section === "assets" ? "Assets" : "Export"; }
