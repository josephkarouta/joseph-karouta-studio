"use client";

import StudioCard from "@/components/studio/common/StudioCard";
import StudioSection from "@/components/studio/common/StudioSection";
import ExportButton from "@/components/studio/brand-book/ExportButton";
import AssetExportPanel from "@/components/studio/brand-book/export/AssetExportPanel";
import BrandBookPrintStyles from "@/components/studio/brand-book/export/BrandBookPrintStyles";
import BrandBookExportRenderer from "@/components/studio/brand-book/export/BrandBookExportRenderer";

export default function BrandExport({
  project,
  brand,
  assets,
}: {
  project: any;
  brand: any;
  assets: any[];
}) {
  function downloadProjectPackage() {
    const payload = {
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.project_name,
        industry: project.industry,
        audience: project.audience,
        style: project.style,
      },
      brandSystem: brand,
      assets,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${project.project_name || "brand-project"}-project-package.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <>
      <BrandBookPrintStyles />

      <div className="space-y-6">
        <StudioSection eyebrow="Final Export" title="Ready to Deliver">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <StudioCard>
              <p className="text-sm leading-6 text-white/55">
                Export a designed Brand Book PDF using the premium Heyy Studio
                Brand Book renderer.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <ExportButton />

                <button
                  type="button"
                  onClick={downloadProjectPackage}
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-black"
                >
                  Download Project
                </button>
              </div>
            </StudioCard>

            <StudioCard>
              <div className="grid grid-cols-2 gap-3">
                <Metric title="Assets" value={String(assets.length)} />
                <Metric title="Format" value="A4 PDF" />
                <Metric title="Engine" value="V2" />
                <Metric title="Status" value="Ready" />
              </div>
            </StudioCard>
          </div>
        </StudioSection>

        <AssetExportPanel />
      </div>

      <div className="hidden">
        <BrandBookExportRenderer
          project={project}
          brand={brand}
          assets={assets}
        />
      </div>
    </>
  );
}

function Metric({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
        {title}
      </p>

      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}