"use client";

import type { ReactNode } from "react";

export type StudioWorkspaceTab = {
  id: string;
  label: string;
  description?: string;
  content: ReactNode;
};

export default function StudioTabs({
  tabs,
  activeTab,
  setActiveTab,
}: {
  tabs: StudioWorkspaceTab[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  return (
    <nav className="mt-8 flex gap-3 overflow-x-auto pb-2">
      {tabs.map((tab) => {
        const active = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`min-w-[180px] rounded-2xl border p-5 text-left transition ${
              active
                ? "border-purple-400/50 bg-purple-500/15"
                : "border-white/10 bg-white/[0.04] hover:border-purple-400/40 hover:bg-purple-500/10"
            }`}
          >
            <span className="block font-black">{tab.label}</span>

            {tab.description && (
              <span className="mt-2 block text-xs leading-5 text-white/45">
                {tab.description}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
