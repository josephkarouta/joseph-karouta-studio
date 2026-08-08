"use client";

import { useMemo, useState } from "react";
import PresentationRenderer from "@/components/presentation/PresentationRenderer";
import { exportPresentationPdf } from "@/lib/presentation/export-pdf";
import { exportPresentationPptx } from "@/lib/presentation/export-pptx";
import type { PresentationDocument } from "@/lib/presentation/types";

type ExportKind = "pdf" | "pptx";

export default function PresentationExportControls({
  document,
  rootId,
  compact = false,
}: {
  document: PresentationDocument;
  rootId: string;
  compact?: boolean;
}) {
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [message, setMessage] = useState("");

  const pageLabel = useMemo(
    () => `${document.slides.length} designed page${document.slides.length === 1 ? "" : "s"}`,
    [document.slides.length],
  );

  async function runExport(kind: ExportKind) {
    if (exporting) return;

    setExporting(kind);
    setMessage(
      kind === "pdf"
        ? "Rendering a fitted presentation-quality PDF..."
        : "Building an editable PowerPoint presentation...",
    );

    try {
      if (kind === "pdf") {
        await exportPresentationPdf({
          document,
          rootId,
          quality: "high",
        });
      } else {
        await exportPresentationPptx(document);
      }

      setMessage(
        kind === "pdf"
          ? `PDF ready · ${pageLabel}`
          : `Editable PowerPoint ready · ${pageLabel}`,
      );
    } catch (error) {
      console.error("Presentation export failed:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "The presentation could not be exported.",
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <style>{exportStyles}</style>

      <div className={`heyy-presentation-export-controls${compact ? " compact" : ""}`}>
        <button
          type="button"
          className="heyy-presentation-export-button pdf"
          onClick={() => void runExport("pdf")}
          disabled={Boolean(exporting)}
        >
          <PdfIcon />
          <span>
            <strong>{exporting === "pdf" ? "Preparing PDF..." : "Export PDF"}</strong>
            {!compact && <small>Fitted pages · no browser headers</small>}
          </span>
        </button>

        <button
          type="button"
          className="heyy-presentation-export-button pptx"
          onClick={() => void runExport("pptx")}
          disabled={Boolean(exporting)}
        >
          <PowerPointIcon />
          <span>
            <strong>{exporting === "pptx" ? "Preparing PowerPoint..." : "Export Editable PowerPoint"}</strong>
            {!compact && <small>Editable text, shapes and images</small>}
          </span>
        </button>
      </div>

      {message && (
        <p className="heyy-presentation-export-message" role="status" aria-live="polite">
          {message}
        </p>
      )}

      <PresentationRenderer document={document} rootId={rootId} />
    </>
  );
}

function PdfIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5M9.5 13h5M9.5 16h5" />
    </svg>
  );
}

function PowerPointIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h4.2a2.3 2.3 0 0 1 0 4.6H8zM8 8v9" />
    </svg>
  );
}

const exportStyles = `
.heyy-presentation-export-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
}
.heyy-presentation-export-button {
  display: inline-flex;
  min-height: 54px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  gap: 11px;
  border: 1px solid;
  border-radius: 999px;
  padding: 0 20px;
  text-align: left;
  transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
}
.heyy-presentation-export-button:hover:not(:disabled) {
  transform: translateY(-2px);
}
.heyy-presentation-export-button:disabled {
  cursor: wait;
  opacity: .55;
}
.heyy-presentation-export-button svg {
  flex: 0 0 auto;
}
.heyy-presentation-export-button span {
  display: grid;
  gap: 2px;
}
.heyy-presentation-export-button strong {
  font-size: 12px;
  font-weight: 950;
}
.heyy-presentation-export-button small {
  font-size: 9px;
  font-weight: 750;
  opacity: .7;
}
.heyy-presentation-export-button.pdf {
  border-color: #0b8f4d;
  background: #0b8f4d;
  color: #fff;
  box-shadow: 0 10px 22px rgba(11,143,77,.2);
}
.heyy-presentation-export-button.pptx {
  border-color: #6c00ff;
  background: #6c00ff;
  color: #fff;
  box-shadow: 0 10px 22px rgba(108,0,255,.18);
}
.heyy-presentation-export-controls.compact .heyy-presentation-export-button {
  min-height: 42px;
  padding: 0 15px;
}
.heyy-presentation-export-controls.compact .heyy-presentation-export-button strong {
  font-size: 10px;
}
.heyy-presentation-export-message {
  margin: 10px 0 0;
  color: #526174;
  font-size: 10px;
  font-weight: 850;
}
`;
