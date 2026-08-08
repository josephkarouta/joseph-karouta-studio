"use client";

import { useMemo } from "react";
import PresentationExportControls from "@/components/presentation/PresentationExportControls";
import AssetExportPanel from "@/components/studio/brand-book/export/AssetExportPanel";
import { buildBrandPresentation } from "@/lib/presentation/build-brand-presentation";

export default function BrandExport({
  project,
  brand,
  assets,
}: {
  project: any;
  brand: any;
  assets: any[];
}) {
  const presentation = useMemo(
    () => buildBrandPresentation({ project, brand, assets }),
    [assets, brand, project],
  );

  return (
    <div className="heyy-export-shell grid gap-5">
      <style>{brandExportStyles}</style>

      <section className="overflow-hidden rounded-[25px] border border-emerald-200 bg-white shadow-[0_14px_34px_rgba(25,110,70,.07)]">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-white p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <span className="heyy-export-icon">
              <ExportIcon />
            </span>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.19em] text-emerald-700">
                Universal Presentation Export
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-slate-950 sm:text-3xl">
                Professional Brand Guidelines
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Export a fitted presentation-quality PDF or an editable PowerPoint.
                This no longer prints the dark dashboard page.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-emerald-600 px-4 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-white">
            ✓ {presentation.slides.length} Designed Pages
          </span>
        </header>

        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_340px]">
          <div className="rounded-[20px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
            <h3 className="text-xl font-black text-slate-950">
              Create the final presentation
            </h3>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              PDF pages are generated from fixed 16:9 layouts with no browser URL,
              date or print margins. The PowerPoint keeps text, shapes and presentation
              structure editable.
            </p>

            <div className="mt-5">
              <PresentationExportControls
                document={presentation}
                rootId={`brand-presentation-${project?.id || "project"}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metric title="Assets" value={String(assets.length)} tone="purple" />
            <Metric title="Pages" value={String(presentation.slides.length)} tone="blue" />
            <Metric title="PDF" value="16:9" tone="amber" />
            <Metric title="PPTX" value="Editable" tone="green" />
          </div>
        </div>
      </section>

      <AssetExportPanel />
    </div>
  );
}

function Metric({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "purple" | "blue" | "amber" | "green";
}) {
  const colours = {
    purple: ["#f1e8ff", "#6c00ff"],
    blue: ["#e7f4ff", "#1766c2"],
    amber: ["#fff3d8", "#a45c00"],
    green: ["#e4faed", "#0b8f4d"],
  }[tone];

  return (
    <div
      className="heyy-export-metric rounded-[18px] border p-4"
      style={{
        backgroundColor: colours[0],
        borderColor: `${colours[1]}33`,
      }}
    >
      <p
        className="text-[8px] font-black uppercase tracking-[0.16em]"
        style={{ color: colours[1] }}
      >
        {title}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function ExportIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v11M8 11l4 4 4-4M5 20h14" />
    </svg>
  );
}

const brandExportStyles = `
.heyy-export-icon {
  display: flex !important;
  width: 48px !important;
  height: 48px !important;
  flex: 0 0 48px !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 15px !important;
  background: #0b8f4d !important;
  color: #fff !important;
  box-shadow: 0 11px 23px rgba(11,143,77,.22) !important;
}
.heyy-export-icon svg {
  stroke: #fff !important;
}
`;
