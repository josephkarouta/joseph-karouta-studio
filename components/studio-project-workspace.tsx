"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import StudioHeader from "@/components/studio/workspace/StudioHeader";
import StudioNavigation from "@/components/studio/workspace/StudioNavigation";
import StudioStepper, {
  type StudioStep,
} from "@/components/studio/workspace/StudioStepper";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import type { ProjectContext } from "@/types/project";
import type { ProjectAsset } from "@/types/asset";
import type { StudioWorkspaceTab } from "@/components/studio/workspace/StudioTabs";

type StudioProjectWorkspaceProps = {
  project: ProjectContext;
  assets?: ProjectAsset[];
  onAssetsChange?: (assets: ProjectAsset[]) => void;
  projectTypeLabel: string;
  projectName: string;
  statusLabel?: string;
  metaItems?: string[];
  backHref?: string;
  backLabel?: string;
  steps?: StudioStep[];
  tabs: StudioWorkspaceTab[];
};

export default function StudioProjectWorkspace({
  project,
  assets = [],
  onAssetsChange,
  projectTypeLabel,
  projectName,
  statusLabel = "Saved Project",
  metaItems = [],
  backHref = "/dashboard",
  backLabel = "Back to Dashboard",
  steps = [],
  tabs,
}: StudioProjectWorkspaceProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const firstWorkflowTab =
    steps.find((step) => step.tabId && step.status !== "locked")?.tabId ||
    tabs[0]?.id ||
    "";

  const urlTab = searchParams.get("tab");
  const safeUrlTab = tabs.some((tab) => tab.id === urlTab) ? urlTab : null;

  const [activeTab, setActiveTab] = useState(safeUrlTab || firstWorkflowTab);

  useEffect(() => {
    if (!safeUrlTab) return;
    setActiveTab((currentTab) =>
      currentTab === safeUrlTab ? currentTab : safeUrlTab,
    );
  }, [safeUrlTab]);

  function updateActiveTab(tabId: string) {
    if (!tabs.some((tab) => tab.id === tabId)) return;

    setActiveTab(tabId);

    // Keep a shareable tab URL without triggering a Next.js navigation.
    // Native history avoids the visible route flicker seen when switching Studio steps.
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tabId);
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
  }

  const mountedTabs = useMemo(() => tabs, [tabs]);

  return (
    <WorkspaceProvider
      value={{
        project,
        assets,
        activity: [],
        onAssetsChange,
      }}
    >
      <main className="heyy-studio-project-page min-h-[calc(100vh-var(--heyy-header-height))] overflow-x-clip px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <style>{`
          .heyy-studio-project-page {
            background:
              radial-gradient(circle at 86% 7%, rgba(132,40,255,.09), transparent 27%),
              radial-gradient(circle at 12% 42%, rgba(255,75,183,.045), transparent 26%),
              #f7f6fa;
          }

          .heyy-studio-project-frame {
            width: 100%;
            max-width: 1680px;
            margin: 0 auto;
          }

          .heyy-studio-project-content {
            width: 100%;
            min-width: 0;
            margin-top: 24px;
          }

          .heyy-studio-project-panel {
            width: 100%;
            min-width: 0;
          }
        `}</style>

        <div className="heyy-studio-project-frame">
          <a
            href={backHref}
            className="inline-flex items-center rounded-full px-1 py-2 text-sm font-bold text-slate-600 transition hover:text-violet-700"
          >
            ← {backLabel}
          </a>

          <StudioHeader
            projectTypeLabel={projectTypeLabel}
            projectName={projectName}
            statusLabel={statusLabel}
            metaItems={metaItems}
          />

          <div className="mt-5 w-full overflow-x-auto pb-1">
            <StudioStepper
              steps={steps}
              activeTab={activeTab}
              onStepClick={(step) => {
                if (step.tabId) {
                  updateActiveTab(step.tabId);
                }
              }}
            />
          </div>

          <div className="heyy-studio-project-content">
            <section className="heyy-studio-project-panel">
              {mountedTabs.map((tab) => (
                <div
                  key={tab.id}
                  hidden={tab.id !== activeTab}
                  className={tab.id === activeTab ? "block w-full" : "hidden"}
                >
                  {tab.content}
                </div>
              ))}

              <StudioNavigation
                steps={steps}
                activeTab={activeTab}
                onNavigate={updateActiveTab}
              />
            </section>
          </div>
        </div>

        <style>{`
          [data-theme="dark"] .heyy-studio-project-page {
            color-scheme: dark;
            background:
              radial-gradient(circle at 86% 7%, rgba(132,40,255,.16), transparent 29%),
              radial-gradient(circle at 12% 42%, rgba(255,75,183,.08), transparent 28%),
              #0f0c15 !important;
            color: var(--text-primary) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .heyy-studio-project-frame > a {
            color: var(--text-secondary) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .heyy-studio-project-frame > a:hover {
            color: var(--accent-strong) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .heyy-studio-header {
            border-color: rgba(171,126,255,.32) !important;
            background:
              radial-gradient(circle at 86% 18%, rgba(126,39,255,.34), transparent 29%),
              radial-gradient(circle at 69% 100%, rgba(255,62,188,.14), transparent 32%),
              linear-gradient(135deg,#1c1725 0%,#23182f 58%,#321a4b 100%) !important;
            box-shadow: 0 24px 64px rgba(0,0,0,.32) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .heyy-studio-header::after {
            color: rgba(255,255,255,.13) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .heyy-studio-header h1 {
            color: #fff !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .heyy-studio-header [class*="bg-white"] {
            background: rgba(20,16,27,.72) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .heyy-studio-stepper,
          [data-theme="dark"] .heyy-studio-project-page .heyy-studio-navigation {
            border-color: var(--border-strong) !important;
            background: rgba(24,20,32,.96) !important;
            box-shadow: 0 18px 44px rgba(0,0,0,.24) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .heyy-step:not([data-active="true"]):not([data-done="true"]) {
            border-color: transparent !important;
            background: #211b2a !important;
            color: var(--text-primary) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .heyy-step:hover:not(:disabled):not([data-active="true"]) {
            border-color: var(--accent-border) !important;
            background: rgba(111,45,255,.17) !important;
            color: #dccbff !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .heyy-step[data-done="true"]:not([data-active="true"]) {
            border-color: rgba(86,211,166,.26) !important;
            background: rgba(20,166,115,.13) !important;
            color: #b9f5dc !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .heyy-step-circle {
            background: rgba(255,255,255,.08) !important;
            color: var(--text-secondary) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .heyy-nav-button[data-tone="back"] {
            border-color: var(--border-strong) !important;
            background: #211b2a !important;
            color: var(--text-primary) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page :is(.bg-white,.bg-slate-50,.bg-gray-50,.bg-zinc-50) {
            background-color: var(--surface-strong) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page :is(.bg-violet-50,.bg-violet-100) {
            background-color: rgba(159,44,224,.13) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .bg-blue-50 { background-color: rgba(46,124,246,.12) !important; }
          [data-theme="dark"] .heyy-studio-project-page .bg-pink-50 { background-color: rgba(239,63,180,.12) !important; }
          [data-theme="dark"] .heyy-studio-project-page .bg-emerald-50 { background-color: rgba(20,166,115,.12) !important; }
          [data-theme="dark"] .heyy-studio-project-page .bg-amber-50 { background-color: rgba(240,180,41,.11) !important; }
          [data-theme="dark"] .heyy-studio-project-page .bg-cyan-50 { background-color: rgba(0,169,214,.11) !important; }

          [data-theme="dark"] .heyy-studio-project-page :is(.text-slate-950,.text-slate-900,.text-slate-800,.text-slate-700) {
            color: var(--text-primary) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page :is(.text-slate-600,.text-slate-500,.text-slate-400) {
            color: var(--text-secondary) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page :is(.border-slate-200,.border-slate-300,.border-violet-100,.border-violet-200,.border-violet-300) {
            border-color: var(--border-strong) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .from-violet-50 {
            --tw-gradient-from: rgba(111,45,255,.17) var(--tw-gradient-from-position) !important;
            --tw-gradient-to: rgba(111,45,255,0) var(--tw-gradient-to-position) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .via-white {
            --tw-gradient-via: rgba(31,27,40,.97) var(--tw-gradient-via-position) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .to-white {
            --tw-gradient-to: rgba(20,17,27,.98) var(--tw-gradient-to-position) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page :is(input,textarea,select) {
            border-color: var(--border-strong) !important;
            background: #17131f !important;
            color: var(--text-primary) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page :is(input,textarea)::placeholder {
            color: var(--text-muted) !important;
            opacity: 1;
          }

          [data-theme="dark"] .heyy-studio-project-page select option {
            background: #17131f;
            color: var(--text-primary);
          }

          [data-theme="dark"] .heyy-studio-project-page .brand-production-workspace > section > header,
          [data-theme="dark"] .heyy-studio-project-page .heyy-assets-shell > section > header {
            border-color: var(--border) !important;
            background: linear-gradient(135deg,rgba(111,45,255,.16),rgba(31,27,40,.98) 55%,rgba(20,17,27,.98)) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .brand-production-workspace > section,
          [data-theme="dark"] .heyy-studio-project-page .heyy-assets-shell > section {
            border-color: var(--border-strong) !important;
            background: var(--surface-strong) !important;
            box-shadow: 0 24px 64px rgba(0,0,0,.26) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page .heyy-asset-filter[data-active="false"] {
            border-color: var(--border-strong) !important;
            background: #211b2a !important;
            color: var(--text-secondary) !important;
          }

          [data-theme="dark"] .heyy-studio-project-page [role="dialog"],
          [data-theme="dark"] .heyy-studio-project-page .fixed > div {
            color: var(--text-primary);
          }
        `}</style>
      </main>
    </WorkspaceProvider>
  );
}
