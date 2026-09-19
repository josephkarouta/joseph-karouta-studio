"use client";

import { useMemo, useState } from "react";
import PresentationExportControls from "@/components/presentation/PresentationExportControls";
import AssetExportPanel from "@/components/studio/brand-book/export/AssetExportPanel";
import { buildBrandPresentation } from "@/lib/presentation/build-brand-presentation";
import { createPresentationPdfBlob } from "@/lib/presentation/export-pdf";
import { createPresentationPptxBlob } from "@/lib/presentation/export-pptx";
import { createBrowserZip, type BrowserZipFile } from "@/lib/client/zip";

function safeName(value: unknown, fallback = "brand-project") {
  return (
    String(value || fallback)
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || fallback
  );
}

function asRecord(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function readPayload(asset: any) {
  const source = asset?.output_payload || asset?.payload || {};
  if (typeof source === "string") {
    try {
      return JSON.parse(source);
    } catch {
      return {};
    }
  }
  return asRecord(source);
}

function mimeExtension(type: string, url = "") {
  const mime = String(type || "").toLowerCase();
  const pathname = String(url || "").split("?")[0];
  const explicit = pathname.match(/\.([a-z0-9]{2,6})$/i)?.[1];
  if (explicit) return explicit.toLowerCase();
  if (mime.includes("webp")) return "webp";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("svg")) return "svg";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("presentationml")) return "pptx";
  if (mime.includes("zip")) return "zip";
  return "bin";
}

async function remoteZipFile(url: string, name: string): Promise<BrowserZipFile | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const extension = mimeExtension(blob.type, url);
    const withExtension = /\.[a-z0-9]{2,6}$/i.test(name) ? name : `${name}.${extension}`;
    return { name: withExtension, data: await blob.arrayBuffer() };
  } catch {
    return null;
  }
}

function collectAssetFiles(assets: any[]) {
  const rows: Array<{ url: string; name: string }> = [];
  const seen = new Set<string>();
  const add = (url: unknown, name: string) => {
    const value = typeof url === "string" ? url.trim() : "";
    if (!value || seen.has(value)) return;
    seen.add(value);
    rows.push({ url: value, name });
  };

  assets.forEach((asset, assetIndex) => {
    const payload = readPayload(asset);
    const base = `${String(assetIndex + 1).padStart(2, "0")}-${safeName(
      asset?.title || asset?.asset_type || "Brand-Asset",
      "Brand-Asset",
    )}`;

    add(asset?.file_url, `03-Project-Files/${base}`);
    if (!asset?.file_url) add(asset?.thumbnail_url, `03-Project-Files/${base}`);

    const outputCollections = [
      payload?.outputs,
      payload?.logos,
      payload?.moodboards,
      payload?.variations,
      payload?.images,
    ];
    outputCollections.forEach((collection, collectionIndex) => {
      if (!Array.isArray(collection)) return;
      collection.forEach((item: any, itemIndex: number) => {
        add(
          item?.imageUrl || item?.image_url || item?.file_url || item?.url,
          `04-Generated-Images/${base}-${collectionIndex + 1}-${itemIndex + 1}`,
        );
      });
    });

    add(payload?.imageUrl || payload?.image_url, `04-Generated-Images/${base}`);
  });

  return rows;
}

function firstText(...values: unknown[]) {
  return values.find((value) => typeof value === "string" && value.trim()) as
    | string
    | undefined;
}

function toText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item: unknown): string => toText(item))
      .filter((item): item is string => Boolean(item))
      .join(", ");
  }
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const entries: string[] = Object.entries(value as Record<string, unknown>)
      .map(([key, item]): string => {
        const clean: string = toText(item).trim();
        if (!clean) return "";
        const label = key
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase());
        return `${label}: ${clean}`;
      })
      .filter((item): item is string => Boolean(item));
    return entries.join(" · ");
  }
  return value == null ? "" : String(value);
}

function personalitySummary(value: unknown) {
  const record = asRecord(value);
  if (!Object.keys(record).length) return toText(value);
  return firstText(record.description, record.summary, record.personality, record.traits) || toText(value);
}

function paletteSummary(value: unknown) {
  const record = asRecord(value);
  const rows = Array.isArray(value) ? value : Array.isArray(record.colors) ? record.colors : Array.isArray(record.colours) ? record.colours : [];
  if (rows.length) {
    return rows.map((item: any) => {
      if (typeof item === "string") return item;
      const name = firstText(item?.name, item?.label, item?.role) || "Colour";
      const code = firstText(item?.hex, item?.value, item?.color, item?.colour);
      return code ? `${name} (${code})` : name;
    }).filter(Boolean).join(" · ");
  }
  return toText(value);
}

function typographySummary(value: unknown) {
  const record = asRecord(value);
  if (!Object.keys(record).length) return toText(value);
  const rows = [
    ["Primary", record.primary || record.heading || record.headline || record.display],
    ["Secondary", record.secondary || record.body || record.bodyFont],
    ["Accent", record.accent || record.supporting],
  ].filter(([, item]) => toText(item).trim());
  return rows.length ? rows.map(([label, item]) => `${label}: ${toText(item)}`).join(" · ") : toText(value);
}

function paletteRows(value: unknown) {
  const record = asRecord(value);
  const rows = Array.isArray(value)
    ? value
    : Array.isArray(record.colors)
      ? record.colors
      : Array.isArray(record.colours)
        ? record.colours
        : [];
  return rows.map((item: any) => {
    if (typeof item === "string") return { name: item, hex: "" };
    return {
      name: firstText(item?.name, item?.label, item?.role) || "Colour",
      hex: firstText(item?.hex, item?.value, item?.color, item?.colour) || "",
    };
  }).filter((item) => item.name);
}

function typographyRows(value: unknown) {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  for (const key of ["fonts", "typefaces", "fontPairing", "font_pairing"]) {
    if (Array.isArray(record[key])) return record[key];
  }
  return [
    record.primary || record.heading || record.headline || record.display,
    record.secondary || record.body || record.bodyFont,
    record.accent || record.supporting,
  ].filter(Boolean);
}

function parseHexColor(value: string) {
  const match = String(value || "").trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1];
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)] as const;
}

async function createBrandProjectSummaryPdfBlob({ project, brand }: { project: any; brand: any }) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  const accent = [139, 92, 246] as const;
  const dark = [23, 19, 31] as const;
  const muted = [100, 92, 111] as const;
  const border = [228, 222, 235] as const;
  const soft = [248, 245, 253] as const;
  let page = 1;
  let y = 46;

  const foundation = asRecord(brand?.foundation);
  const strategy = asRecord(brand?.brandStrategy);
  const journey = asRecord(brand?.projectJourney);
  const voice = asRecord(brand?.brandVoice);
  const personality = asRecord(brand?.personality || foundation?.personality);
  const paletteValue = brand?.colourPalette || foundation?.colourPalette || foundation?.colorPalette;
  const typographyValue = brand?.typography || foundation?.typography;

  const footer = () => {
    pdf.setDrawColor(...border);
    pdf.line(margin, pageHeight - 44, pageWidth - margin, pageHeight - 44);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...muted);
    pdf.text("Heyy Studio · Brand Project Summary", margin, pageHeight - 27);
    pdf.text(String(page).padStart(2, "0"), pageWidth - margin, pageHeight - 27, { align: "right" });
  };

  const pageHeader = (section?: string) => {
    pdf.setFillColor(...accent);
    pdf.rect(0, 0, pageWidth, 6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...accent);
    pdf.text("HEYY STUDIO", margin, 31);
    if (section) {
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...muted);
      pdf.text(section.toUpperCase(), pageWidth - margin, 31, { align: "right" });
    }
  };

  const newPage = (section?: string) => {
    footer();
    pdf.addPage();
    page += 1;
    pageHeader(section);
    y = 58;
  };

  const ensure = (height: number, section?: string) => {
    if (y + height <= pageHeight - 66) return;
    newPage(section);
  };

  const sectionTitle = (eyebrow: string, title: string) => {
    ensure(54, eyebrow);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...accent);
    pdf.text(eyebrow.toUpperCase(), margin, y);
    y += 16;
    pdf.setFontSize(18);
    pdf.setTextColor(...dark);
    pdf.text(title, margin, y);
    y += 22;
  };

  const card = (label: string, value: unknown, options: { tint?: "violet" | "neutral"; fontSize?: number } = {}) => {
    const text = toText(value).trim();
    if (!text) return;
    const fontSize = options.fontSize || 9.4;
    const lines = pdf.splitTextToSize(text, contentWidth - 28);
    const height = 39 + lines.length * (fontSize + 4);
    ensure(height + 12);
    const violet = options.tint === "violet";
    const cardFill: readonly [number, number, number] = violet ? [247, 241, 255] : [251, 250, 252];
    const cardBorder: readonly [number, number, number] = violet ? [221, 203, 247] : border;
    const cardLabel: readonly [number, number, number] = violet ? accent : muted;
    pdf.setFillColor(...cardFill);
    pdf.setDrawColor(...cardBorder);
    pdf.roundedRect(margin, y, contentWidth, height, 11, 11, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...cardLabel);
    pdf.text(label.toUpperCase(), margin + 14, y + 17);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...dark);
    pdf.text(lines, margin + 14, y + 34);
    y += height + 10;
  };

  const twoSmallCards = (left: [string, unknown], right: [string, unknown]) => {
    const gap = 10;
    const width = (contentWidth - gap) / 2;
    const draw = (x: number, [label, value]: [string, unknown]) => {
      const text = toText(value).trim() || "—";
      const lines = pdf.splitTextToSize(text, width - 26);
      const h = Math.max(66, 35 + lines.length * 12);
      pdf.setFillColor(...soft);
      pdf.setDrawColor(...border);
      pdf.roundedRect(x, y, width, h, 10, 10, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.2);
      pdf.setTextColor(...accent);
      pdf.text(label.toUpperCase(), x + 13, y + 17);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...dark);
      pdf.text(lines, x + 13, y + 34);
      return h;
    };
    const lText = pdf.splitTextToSize(toText(left[1]).trim() || "—", width - 26);
    const rText = pdf.splitTextToSize(toText(right[1]).trim() || "—", width - 26);
    const height = Math.max(66, 35 + Math.max(lText.length, rText.length) * 12);
    ensure(height + 12);
    draw(margin, left);
    draw(margin + width + gap, right);
    y += height + 12;
  };

  pageHeader("Project overview");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(27);
  pdf.setTextColor(...dark);
  const projectName = String(project?.project_name || project?.name || "Brand Project");
  pdf.text(pdf.splitTextToSize(projectName, contentWidth), margin, y + 22);
  y += 42;
  pdf.setFontSize(9);
  pdf.setTextColor(...accent);
  pdf.text("BRAND PROJECT SUMMARY", margin, y);
  y += 25;

  card("Project summary", brand?.summary, { tint: "violet", fontSize: 10 });
  twoSmallCards(
    ["Journey", firstText(journey?.journeyTitle, journey?.journeyId, journey?.journey_id) || "Brand Studio"],
    ["Selected deliverables", journey?.selectedDeliverables || "—"],
  );

  sectionTitle("Strategy", "Brand strategy");
  card("Positioning", firstText(strategy?.positioning, strategy?.strategy, foundation?.positioning), { tint: "violet" });
  card("Mission", firstText(strategy?.mission, strategy?.purpose, foundation?.mission));
  card("Vision", firstText(strategy?.vision, foundation?.vision));
  card("Audience", firstText(strategy?.audience, strategy?.targetAudience, foundation?.targetAudience));
  card("Brand voice", firstText(voice?.description, voice?.voice, foundation?.brandVoice?.description), { tint: "violet" });

  newPage("Identity");
  sectionTitle("Identity", "Brand identity system");

  const personalityHeadline = firstText(personality?.headline, personality?.title, personality?.summary);
  const personalityTraits = Array.isArray(personality?.traits)
    ? personality.traits.join(" · ")
    : firstText(personality?.traits, personality?.description, personality?.personality) || personalitySummary(brand?.personality || foundation?.personality);
  if (personalityHeadline || personalityTraits) {
    card("Personality", [personalityHeadline, personalityTraits].filter(Boolean).join("\n"), { tint: "violet" });
  }

  const colours = paletteRows(paletteValue);
  if (colours.length) {
    ensure(52 + colours.length * 31, "Identity");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...accent);
    pdf.text("COLOUR PALETTE", margin, y);
    y += 14;
    const rowWidth = contentWidth;
    colours.forEach((colour) => {
      const rgb = parseHexColor(colour.hex);
      pdf.setFillColor(251, 250, 252);
      pdf.setDrawColor(...border);
      pdf.roundedRect(margin, y, rowWidth, 25, 7, 7, "FD");
      if (rgb) {
        pdf.setFillColor(...rgb);
        pdf.roundedRect(margin + 8, y + 6, 13, 13, 4, 4, "F");
      }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.7);
      pdf.setTextColor(...dark);
      pdf.text(String(colour.name), margin + 29, y + 16);
      if (colour.hex) {
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...muted);
        pdf.text(String(colour.hex).toUpperCase(), pageWidth - margin - 10, y + 16, { align: "right" });
      }
      y += 31;
    });
    y += 8;
  } else {
    card("Colour palette", paletteSummary(paletteValue));
  }

  const fonts = typographyRows(typographyValue);
  if (fonts.length) {
    sectionTitle("Typography", "Typography system");
    fonts.forEach((item: any, index: number) => {
      const row = asRecord(item);
      const name = typeof item === "string" ? item : firstText(row.font, row.name, row.family, row.fontFamily) || `Typeface ${index + 1}`;
      const role = firstText(row.role, row.usage, row.type, row.label);
      const reason = firstText(row.reason, row.rationale, row.description);
      const fallback = firstText(row.fallback, row.fallbacks);
      const source = firstText(row.sourceUrl, row.source_url, row.url, row.source);
      const details = [
        role ? `Role: ${role}` : null,
        reason ? `Why it works: ${reason}` : null,
        fallback ? `Fallback: ${fallback}` : null,
        source ? `Source: ${source}` : null,
      ].filter(Boolean).join("\n");
      card(name || `Typeface ${index + 1}`, details || toText(item), { tint: index === 0 ? "violet" : "neutral", fontSize: 8.8 });
    });
  } else {
    card("Typography", typographySummary(typographyValue));
  }

  footer();
  return pdf.output("blob");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export default function BrandExport({
  project,
  brand,
  assets,
}: {
  project: any;
  brand: any;
  assets: any[];
}) {
  const [packing, setPacking] = useState(false);
  const [packMessage, setPackMessage] = useState("");
  const presentation = useMemo(
    () => buildBrandPresentation({ project, brand, assets }),
    [assets, brand, project],
  );
  const rootId = `brand-presentation-${project?.id || "project"}`;

  async function downloadProjectPack() {
    if (packing) return;
    setPacking(true);
    setPackMessage("Preparing the complete Brand project pack...");

    try {
      const [summaryPdf, guidelinesPdf, guidelinesPptx] = await Promise.all([
        createBrandProjectSummaryPdfBlob({ project, brand }),
        createPresentationPdfBlob({ document: presentation, rootId, quality: "high" }),
        createPresentationPptxBlob(presentation),
      ]);

      const files: BrowserZipFile[] = [
        {
          name: `01-Project-Summary/${safeName(project?.project_name)}-Project-Summary.pdf`,
          data: await summaryPdf.arrayBuffer(),
        },
        {
          name: `02-Brand-Guidelines/${presentation.filenameBase}.pdf`,
          data: await guidelinesPdf.arrayBuffer(),
        },
        {
          name: `02-Brand-Guidelines/${presentation.filenameBase}.pptx`,
          data: await guidelinesPptx.arrayBuffer(),
        },
      ];

      const assetRows = collectAssetFiles(assets);
      for (const row of assetRows) {
        const file = await remoteZipFile(row.url, row.name);
        if (file) files.push(file);
      }

      files.push({
        name: "README.txt",
        data: new TextEncoder().encode(
          "Heyy Studio Brand Project Pack\n\nIncludes the project summary, Brand Guidelines PDF, editable PowerPoint, saved project files and generated/approved visual assets available in this Brand Studio project.\n\nAI concepts are design-direction assets. Production-ready source files are included only when they exist in the project or have been delivered through Expert Production.",
        ),
      });

      const zip = createBrowserZip(files);
      triggerDownload(zip, `${safeName(project?.project_name)}-Brand-Project-Pack.zip`);
      setPackMessage(`Project pack ready · ${files.length} files`);
    } catch (error) {
      console.error("Brand project pack failed:", error);
      setPackMessage(error instanceof Error ? error.message : "The project pack could not be created.");
    } finally {
      setPacking(false);
    }
  }

  return (
    <div className="heyy-export-shell grid gap-5">
      <style>{brandExportStyles}</style>

      <section className="overflow-hidden rounded-[25px] border border-emerald-200 bg-white shadow-[0_14px_34px_rgba(25,110,70,.07)]">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-white p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <span className="heyy-export-icon"><ExportIcon /></span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.19em] text-emerald-700">Universal Presentation Export</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-slate-950 sm:text-3xl">Professional Brand Guidelines</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Export the Brand Guidelines individually or download one complete Brand project pack.</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-600 px-4 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-white">✓ {presentation.slides.length} Designed Pages</span>
        </header>

        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_340px]">
          <div className="rounded-[20px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
            <h3 className="text-xl font-black text-slate-950">Create the final presentation</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">PDF pages use fitted 16:9 layouts and the PowerPoint keeps text, shapes and presentation structure editable.</p>
            <div className="mt-5">
              <PresentationExportControls document={presentation} rootId={rootId} />
            </div>
            <button
              type="button"
              onClick={() => void downloadProjectPack()}
              disabled={packing}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-950 bg-slate-950 px-5 text-[10px] font-black text-white transition hover:opacity-85 disabled:cursor-wait disabled:opacity-55"
            >
              {packing ? "Preparing Complete Project Pack..." : "Download Complete Brand Project Pack (.zip)"}
            </button>
            {packMessage && <p className="mt-2 text-[10px] font-bold leading-5 text-slate-500">{packMessage}</p>}
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

function Metric({ title, value, tone }: { title: string; value: string; tone: "purple" | "blue" | "amber" | "green" }) {
  const colours = {
    purple: ["#f1e8ff", "#8b5cf6"],
    blue: ["#e7f4ff", "#1766c2"],
    amber: ["#fff3d8", "#a45c00"],
    green: ["#e4faed", "#0b8f4d"],
  }[tone];
  return (
    <div className="heyy-export-metric rounded-[18px] border p-4" style={{ backgroundColor: colours[0], borderColor: `${colours[1]}33` }}>
      <p className="text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: colours[1] }}>{title}</p>
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
.heyy-export-icon { display:flex!important;width:48px!important;height:48px!important;flex:0 0 48px!important;align-items:center!important;justify-content:center!important;border-radius:15px!important;background:#0b8f4d!important;color:#fff!important;box-shadow:0 11px 23px rgba(11,143,77,.22)!important; }
.heyy-export-icon svg { stroke:#fff!important; }
`;
