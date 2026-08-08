"use client";

import { useBrandExport } from "@/hooks/use-brand-export";

export default function ExportButton() {
  const { exportBrandBook, loading, step } = useBrandExport();

  return (
    <div className="heyy-export-button-wrap">
      <style>{`
        .heyy-export-pdf {
          display: inline-flex !important;
          min-height: 46px !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 9px !important;
          border: 1px solid #0b8f4d !important;
          border-radius: 999px !important;
          background: #0b8f4d !important;
          color: #fff !important;
          padding: 0 20px !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          box-shadow: 0 10px 22px rgba(11,143,77,.22) !important;
          transition: all 180ms ease !important;
        }

        .heyy-export-pdf:hover:not(:disabled) {
          transform: translateY(-2px);
          border-color: #076a39 !important;
          background: #076a39 !important;
          color: #fff !important;
          box-shadow: 0 13px 27px rgba(11,143,77,.28) !important;
        }

        .heyy-export-pdf svg {
          stroke: #fff !important;
        }

        .heyy-export-pdf:disabled {
          cursor: wait !important;
          opacity: .45 !important;
        }
      `}</style>

      <button type="button" onClick={exportBrandBook} disabled={loading} className="heyy-export-pdf">
        <DownloadIcon />
        {loading ? "Exporting..." : "Export Brand Book PDF"}
      </button>

      {loading && (
        <p className="mt-3 text-xs font-bold text-emerald-700">
          {step || "Preparing export..."}
        </p>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v11M8 11l4 4 4-4M5 20h14" />
    </svg>
  );
}
