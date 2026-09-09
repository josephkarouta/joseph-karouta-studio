"use client";

import { useEffect, useMemo, useState } from "react";
import BrandOverview from "@/components/studio/brand-book/BrandOverview";
import BrandIdentitySystem from "@/components/studio/brand-book/BrandIdentitySystem";
import BrandApplications from "@/components/studio/brand-book/BrandApplications";
import BrandChecklist from "@/components/studio/brand-book/BrandChecklist";
import { normaliseBrandJourney } from "@/lib/brand/project-templates";

type BrandBookTab = {
  id: string;
  label: string;
  helper: string;
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
      { id: "foundation", label: "Foundation", helper: "Strategy and voice" },
      { id: "identity", label: "Identity", helper: "Visual rules" },
      ...(hasApplications
        ? [{ id: "applications", label: "Applications", helper: "Selected touchpoints" }]
        : []),
      { id: "checklist", label: "Checklist", helper: "Readiness and handoff" },
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
      <nav className="relative z-10 mb-5 rounded-[18px] border border-slate-200 bg-white p-1.5 shadow-[0_10px_26px_rgba(55,30,83,.05)]">
        <div className="flex gap-1.5 overflow-x-auto">
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[54px] min-w-[165px] flex-1 rounded-[13px] border px-4 text-left transition-colors duration-150 ${
                  selected
                    ? "border-violet-700 bg-violet-700 text-white"
                    : "border-transparent bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50/60 hover:text-violet-700"
                }`}
              >
                <span className="block text-[11px] font-black">{tab.label}</span>
                <span className={`mt-0.5 block text-[9px] font-bold ${selected ? "text-white/70" : "text-slate-400"}`}>
                  {tab.helper}
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
