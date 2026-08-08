"use client";

import {
  Ban,
  BadgeCheck,
  Image,
  Layers3,
  Maximize2,
  Move,
  ScanLine,
  Shapes,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
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
  const activeLogo =
    selectedLogo || (existingLogoUrl ? { imageUrl: existingLogoUrl } : null);
  const logoIncluded = journey.logoAction !== "none" || Boolean(activeLogo);

  return (
    <div className="brand-identity-workspace grid gap-5">
      <section className="overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_18px_45px_rgba(55,30,83,.08)]">
        <header className="relative overflow-hidden border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-white p-5 sm:p-6">
          <div className="relative z-10 flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-violet-700 to-fuchsia-500 text-white shadow-lg shadow-violet-700/20">
              <Layers3 size={22} strokeWidth={2.1} />
            </span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.19em] text-violet-600">
                Identity System
              </p>
              <h2 className="mt-1 text-3xl font-black tracking-[-0.045em] text-slate-950">
                The rules that make the brand recognisable
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                The selected creative direction controls the imagery, graphic
                language, colour behaviour and application system. Existing-logo
                projects retain the exact current mark and build the identity around it.
              </p>
            </div>
          </div>
          <Layers3 className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 text-violet-700/[0.035]" />
        </header>

        <div className="grid gap-4 p-5 md:grid-cols-2 sm:p-6">
          <IdentityCard
            Icon={Sparkles}
            eyebrow="Creative Direction"
            title={
              selectedConcept?.title ||
              selectedConcept?.conceptName ||
              "Selected visual route"
            }
            copy={
              selectedConcept?.conceptIdea ||
              selectedConcept?.brandStory ||
              selectedConcept?.story ||
              guidelines?.creativeDirection?.summary ||
              "Select a creative direction to establish the visual world."
            }
            items={[
              ...(Array.isArray(selectedConcept?.emotionalTone)
                ? selectedConcept.emotionalTone
                : []),
              ...(Array.isArray(selectedConcept?.keywords)
                ? selectedConcept.keywords
                : []),
            ].slice(0, 8)}
            tone="violet"
          />
          <IdentityCard
            Icon={Image}
            eyebrow="Imagery"
            title="Image and art direction"
            copy={
              guidelines?.imagery?.direction ||
              selectedConcept?.imageStyle ||
              "Imagery should remain consistent with the selected direction."
            }
            items={[
              ...(guidelines?.imagery?.subjects || []),
              ...(guidelines?.imagery?.composition || []),
            ].slice(0, 7)}
            tone="blue"
          />
          <IdentityCard
            Icon={Shapes}
            eyebrow="Graphic Language"
            title="Repeatable visual devices"
            copy={
              selectedConcept?.graphicLanguage ||
              "Use a consistent grid, shape and composition system."
            }
            items={[
              ...(guidelines?.graphicLanguage?.devices || []),
              ...(guidelines?.graphicLanguage?.layout || []),
            ].slice(0, 7)}
            tone="rose"
          />
          <IdentityCard
            Icon={Move}
            eyebrow="Motion & Interaction"
            title="How the identity moves"
            copy="Motion should reinforce the same personality rather than add a separate visual language."
            items={(guidelines?.graphicLanguage?.motion || []).slice(0, 6)}
            tone="emerald"
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
          <p className="text-sm font-black text-slate-700">
            Logo rules are not part of this project scope.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            The identity section focuses on colour, typography, imagery and the
            selected application system.
          </p>
        </section>
      )}
    </div>
  );
}

function IdentityCard({
  Icon,
  eyebrow,
  title,
  copy,
  items,
  tone,
}: {
  Icon: LucideIcon;
  eyebrow: string;
  title: string;
  copy: string;
  items: string[];
  tone: string;
}) {
  const toneClass: Record<
    string,
    { shell: string; icon: string; eyebrow: string }
  > = {
    violet: {
      shell: "border-violet-200 bg-gradient-to-br from-violet-50 to-white",
      icon: "bg-violet-700 text-white shadow-violet-700/20",
      eyebrow: "text-violet-700",
    },
    blue: {
      shell: "border-blue-200 bg-gradient-to-br from-blue-50 to-white",
      icon: "bg-blue-600 text-white shadow-blue-600/20",
      eyebrow: "text-blue-700",
    },
    rose: {
      shell: "border-rose-200 bg-gradient-to-br from-rose-50 to-white",
      icon: "bg-rose-600 text-white shadow-rose-600/20",
      eyebrow: "text-rose-700",
    },
    emerald: {
      shell: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
      icon: "bg-emerald-600 text-white shadow-emerald-600/20",
      eyebrow: "text-emerald-700",
    },
  };
  const palette = toneClass[tone] || toneClass.violet;
  const uniqueItems = items.reduce<string[]>((result, value) => {
    const item = typeof value === "string" ? value.trim() : "";
    if (!item) return result;
    const exists = result.some(
      (current) => current.toLocaleLowerCase() === item.toLocaleLowerCase(),
    );
    if (!exists) result.push(item);
    return result;
  }, []);

  return (
    <article
      className={`rounded-[21px] border p-5 shadow-[0_10px_24px_rgba(48,31,68,.045)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(48,31,68,.08)] ${palette.shell}`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] shadow-lg ${palette.icon}`}
        >
          <Icon size={19} strokeWidth={2.1} />
        </span>
        <div className="min-w-0">
          <p
            className={`text-[8px] font-black uppercase tracking-[0.17em] ${palette.eyebrow}`}
          >
            {eyebrow}
          </p>
          <h3 className="mt-1 text-xl font-black leading-6 tracking-[-0.035em] text-slate-950">
            {title}
          </h3>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{copy}</p>
      {uniqueItems.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {uniqueItems.map((item) => (
            <span
              key={item.toLocaleLowerCase()}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-black text-slate-700 shadow-sm"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function LogoRules({ guidelines, journey }: { guidelines: any; journey: any }) {
  const rules = [
    {
      Icon: BadgeCheck,
      label: "Primary use",
      value:
        guidelines?.primaryUse ||
        "Use the approved primary logo whenever space and contrast allow.",
    },
    {
      Icon: Maximize2,
      label: "Clear space",
      value:
        guidelines?.clearSpace ||
        "Maintain clear space around the logo and keep nearby content visually separate.",
    },
    {
      Icon: ScanLine,
      label: "Minimum size",
      value:
        guidelines?.minimumSize ||
        "Test small-size legibility before digital or print production.",
    },
  ];

  return (
    <section className="overflow-hidden rounded-[26px] border border-violet-200 bg-white shadow-[0_15px_38px_rgba(55,30,83,.07)]">
      <header className="flex items-center gap-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-violet-700 text-white">
          <BadgeCheck size={20} strokeWidth={2.1} />
        </span>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-600">
            Logo Rules
          </p>
          <h3 className="mt-1 text-2xl font-black text-slate-950">
            {journey.logoAction === "keep"
              ? "Rules around the retained logo"
              : journey.logoAction === "refine"
                ? "Refinement and usage system"
                : "Logo system guidance"}
          </h3>
        </div>
      </header>
      <div className="grid gap-3 p-5 md:grid-cols-3">
        {rules.map(({ Icon, label, value }) => (
          <div
            key={label}
            className="rounded-[18px] border border-slate-200 bg-slate-50 p-4"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white text-violet-700 shadow-sm">
              <Icon size={17} strokeWidth={2.1} />
            </span>
            <p className="mt-4 text-[8px] font-black uppercase tracking-[0.15em] text-violet-600">
              {label}
            </p>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-700">
              {value}
            </p>
          </div>
        ))}
      </div>
      {Array.isArray(guidelines?.donts) && guidelines.donts.length > 0 && (
        <div className="border-t border-slate-100 p-5">
          <div className="flex items-center gap-2 text-rose-700">
            <Ban size={16} />
            <p className="text-[8px] font-black uppercase tracking-[0.15em]">
              Do not
            </p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {guidelines.donts.map((item: string) => (
              <div
                key={item}
                className="rounded-[13px] border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
