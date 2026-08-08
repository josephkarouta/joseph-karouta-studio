"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Compass,
  LayoutTemplate,
  Palette,
  type LucideIcon,
} from "lucide-react";
import BrandOverview from "@/components/studio/brand-book/BrandOverview";
import BrandIdentitySystem from "@/components/studio/brand-book/BrandIdentitySystem";
import BrandApplications from "@/components/studio/brand-book/BrandApplications";
import BrandChecklist from "@/components/studio/brand-book/BrandChecklist";
import { normaliseBrandJourney } from "@/lib/brand/project-templates";

type BrandBookTab = {
  id: string;
  label: string;
  helper: string;
  Icon: LucideIcon;
};

export default function BrandBook({
  project,
  brand,
  assets = [],
  selectedConcept,
  selectedMoodboard,
  selectedLogo,
}: {
  project: any;
  brand: any;
  assets?: any[];
  selectedConcept?: any;
  selectedMoodboard?: any;
  selectedLogo?: any;
}) {
  const journey = normaliseBrandJourney(brand, project);
  const hasApplications = journey.selectedDeliverables.some(
    (id) => !["strategy", "creative-direction", "logo", "guidelines"].includes(id),
  );
  const tabs = useMemo<BrandBookTab[]>(
    () => [
      {
        id: "foundation",
        label: "Foundation",
        helper: "Strategy and voice",
        Icon: Compass,
      },
      {
        id: "identity",
        label: "Identity",
        helper: "Visual rules",
        Icon: Palette,
      },
      ...(hasApplications
        ? [
            {
              id: "applications",
              label: "Applications",
              helper: "Selected touchpoints",
              Icon: LayoutTemplate,
            },
          ]
        : []),
      {
        id: "checklist",
        label: "Checklist",
        helper: "Readiness and handoff",
        Icon: ClipboardCheck,
      },
    ],
    [hasApplications],
  );
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || "foundation");

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id || "foundation");
    }
  }, [tabs, activeTab]);

  return (
    <div className="brand-book-workspace w-full min-w-0 overflow-hidden text-[#17151f]">
      <nav className="relative z-10 mb-5 rounded-[22px] border border-violet-200 bg-white p-2 shadow-[0_12px_30px_rgba(55,30,83,.07)]">
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`group flex min-h-[58px] min-w-[185px] flex-1 items-center gap-3 rounded-[16px] border px-4 text-left transition-colors duration-150 ${
                  selected
                    ? "border-violet-700 bg-violet-700 text-white shadow-lg shadow-violet-700/20"
                    : "border-transparent bg-slate-50 text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] transition-colors duration-150 ${
                    selected
                      ? "bg-white/16 text-white"
                      : "bg-white text-violet-700 shadow-sm"
                  }`}
                >
                  <Icon size={17} strokeWidth={2.1} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-black">
                    {tab.label}
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-[9px] font-bold ${
                      selected ? "text-white/70" : "text-slate-400"
                    }`}
                  >
                    {tab.helper}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="min-w-0 overflow-hidden">
        <section hidden={activeTab !== "foundation"}>
          <BrandOverview project={project} brand={brand} />
        </section>
        <section hidden={activeTab !== "identity"}>
          <BrandIdentitySystem
            project={project}
            brand={brand}
            selectedConcept={selectedConcept}
            selectedLogo={selectedLogo}
          />
        </section>
        {hasApplications && (
          <section hidden={activeTab !== "applications"}>
            <BrandApplications project={project} brand={brand} assets={assets} />
          </section>
        )}
        <section hidden={activeTab !== "checklist"}>
          <BrandChecklist
            project={project}
            brand={brand}
            assets={assets}
            selectedConcept={selectedConcept}
            selectedMoodboard={selectedMoodboard}
            selectedLogo={selectedLogo}
          />
        </section>
      </div>
    </div>
  );
}
