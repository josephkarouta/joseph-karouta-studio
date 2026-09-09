"use client";

import BrandColours from "@/components/studio/brand-book/BrandColours";
import BrandTypography from "@/components/studio/brand-book/BrandTypography";
import BrandLogo from "@/components/studio/brand-book/BrandLogo";
import { normaliseBrandJourney } from "@/lib/brand/project-templates";

export default function BrandIdentitySystem({
  project,
  brand,
  selectedConcept,
  selectedLogo,
}: {
  project: any;
  brand: any;
  selectedConcept?: any;
  selectedLogo?: any;
}) {
  const journey = normaliseBrandJourney(brand, project);
  const guidelines = brand?.generatedGuidelines?.identity || {};
  const existingLogoUrl = journey.existingLogoUrl;
  const activeLogo = selectedLogo || (existingLogoUrl ? { imageUrl: existingLogoUrl } : null);
  const logoIncluded = journey.logoAction !== "none" || Boolean(activeLogo);

  return (
    <div className="brand-identity-workspace grid gap-5">
      <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(48,31,68,.06)]">
        <header className="border-b border-slate-200 p-5 sm:p-6">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">Identity system</p>
          <h2 className="mt-1 text-3xl font-black tracking-[-0.045em] text-slate-950">Visual identity rules</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            One clear system for creative direction, imagery, graphic language and motion. The content stays visual without turning every rule into a different colour or icon.
          </p>
        </header>

        <div className="grid gap-4 p-5 md:grid-cols-2 sm:p-6">
          <IdentityCard
            eyebrow="Creative direction"
            title={selectedConcept?.title || selectedConcept?.conceptName || "Selected visual route"}
            copy={selectedConcept?.conceptIdea || selectedConcept?.brandStory || selectedConcept?.story || guidelines?.creativeDirection?.summary || "Select a creative direction to establish the visual world."}
            items={[...(Array.isArray(selectedConcept?.emotionalTone) ? selectedConcept.emotionalTone : []), ...(Array.isArray(selectedConcept?.keywords) ? selectedConcept.keywords : [])].slice(0, 8)}
          />
          <IdentityCard
            eyebrow="Imagery"
            title="Image and art direction"
            copy={guidelines?.imagery?.direction || selectedConcept?.imageStyle || "Imagery should remain consistent with the selected direction."}
            items={[...(guidelines?.imagery?.subjects || []), ...(guidelines?.imagery?.composition || [])].slice(0, 7)}
          />
          <IdentityCard
            eyebrow="Graphic language"
            title="Repeatable visual devices"
            copy={selectedConcept?.graphicLanguage || "Use a consistent grid, shape and composition system."}
            items={[...(guidelines?.graphicLanguage?.devices || []), ...(guidelines?.graphicLanguage?.layout || [])].slice(0, 7)}
          />
          <IdentityCard
            eyebrow="Motion & interaction"
            title="How the identity moves"
            copy="Motion should reinforce the same personality rather than add a separate visual language."
            items={(guidelines?.graphicLanguage?.motion || []).slice(0, 6)}
          />
        </div>
      </section>

      <BrandColours brand={brand} />
      <BrandTypography brand={brand} />

      {logoIncluded ? (
        <div className="grid gap-5">
          <BrandLogo logo={activeLogo} />
          <LogoRules guidelines={guidelines?.logoSystem || {}} journey={journey} />
        </div>
      ) : (
        <section className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm font-black text-slate-700">Logo rules are not part of this project scope.</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">The identity section focuses on colour, typography, imagery and the selected application system.</p>
        </section>
      )}
    </div>
  );
}

function IdentityCard({ eyebrow, title, copy, items }: { eyebrow: string; title: string; copy: string; items: string[] }) {
  const uniqueItems = items.reduce<string[]>((result, value) => {
    const item = typeof value === "string" ? value.trim() : "";
    if (!item) return result;
    if (!result.some((current) => current.toLocaleLowerCase() === item.toLocaleLowerCase())) result.push(item);
    return result;
  }, []);

  return (
    <article className="rounded-[19px] border border-slate-200 bg-white p-5">
      <p className="text-[8px] font-black uppercase tracking-[0.17em] text-violet-600">{eyebrow}</p>
      <h3 className="mt-1 text-xl font-black leading-6 tracking-[-0.035em] text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
      {uniqueItems.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {uniqueItems.map((item) => (
            <span key={item.toLocaleLowerCase()} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] font-black text-slate-700">{item}</span>
          ))}
        </div>
      )}
    </article>
  );
}

function LogoRules({ guidelines, journey }: { guidelines: any; journey: any }) {
  const rules = [
    { label: "Primary use", value: guidelines?.primaryUse || "Use the approved primary logo whenever space and contrast allow." },
    { label: "Clear space", value: guidelines?.clearSpace || "Maintain clear space around the logo and keep nearby content visually separate." },
    { label: "Minimum size", value: guidelines?.minimumSize || "Test small-size legibility before digital or print production." },
  ];

  return (
    <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_15px_38px_rgba(55,30,83,.06)]">
      <header className="border-b border-slate-200 p-5">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-600">Logo rules</p>
        <h3 className="mt-1 text-2xl font-black text-slate-950">
          {journey.logoAction === "keep" ? "Rules around the retained logo" : journey.logoAction === "refine" ? "Refinement and usage system" : "Logo system guidance"}
        </h3>
      </header>
      <div className="grid gap-3 p-5 md:grid-cols-3">
        {rules.map(({ label, value }) => (
          <div key={label} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-[8px] font-black uppercase tracking-[0.15em] text-violet-600">{label}</p>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-700">{value}</p>
          </div>
        ))}
      </div>
      {Array.isArray(guidelines?.donts) && guidelines.donts.length > 0 && (
        <div className="border-t border-slate-100 p-5">
          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-500">Do not</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {guidelines.donts.map((item: string) => (
              <div key={item} className="rounded-[13px] border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700">{item}</div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
