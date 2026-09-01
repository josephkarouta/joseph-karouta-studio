"use client";

import { createBrowserZip, type BrowserZipFile } from "@/lib/client/zip";

export type InteriorDesignPackAsset = {
  id: string;
  title?: string | null;
  file_url?: string | null;
  thumbnail_url?: string | null;
  asset_type?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

type ExportArgs = {
  projectName: string;
  workMode: "guided" | "professional";
  accessToken: string;
  brief: Record<string, string | string[]>;
  concept: Record<string, unknown>;
  assets: InteriorDesignPackAsset[];
  disclaimer: string;
};

const AI_CONCEPT_NOTICE =
  "AI-generated plans and visuals are intended for concept exploration and early design direction only. They are not construction-ready or professionally verified documents. For accurate plans, technical drawings or production-ready design, continue with Heyy Studio expert production.";

export async function downloadInteriorDesignPack(args: ExportArgs) {
  const projectName = args.projectName.trim() || "Interior project";
  const files: BrowserZipFile[] = [];
  const skipped: string[] = [];
  const included: string[] = [];

  const summary = await buildSummaryPdf({ ...args, projectName });
  files.push({ name: `01-${safeName(projectName)}-Project-Summary.pdf`, data: summary });
  included.push("Readable project summary PDF");

  const exportableAssets = selectExportAssets(args.assets);
  for (const [index, asset] of exportableAssets.entries()) {
    try {
      const response = await fetch(`/api/assets/download?assetId=${encodeURIComponent(asset.id)}`, {
        method: "GET",
        cache: "no-store",
        headers: { Authorization: `Bearer ${args.accessToken}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || `Download failed (${response.status}).`);
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const extension = extensionFor(contentType, asset.file_url || asset.thumbnail_url || "");
      const prefix = assetPrefix(asset);
      const filename = `${String(index + 2).padStart(2, "0")}-${prefix}-${safeName(asset.title || asset.asset_type || "asset")}.${extension}`;
      files.push({ name: filename, data: await response.arrayBuffer() });
      included.push(asset.title || asset.asset_type || "Project asset");
    } catch (error) {
      skipped.push(`${asset.title || asset.asset_type || asset.id}: ${error instanceof Error ? error.message : "Unable to retrieve file."}`);
    }
  }

  const readme = buildReadme({ projectName, included, skipped, disclaimer: args.disclaimer });
  files.push({ name: "99-README.txt", data: new TextEncoder().encode(readme) });

  const zip = createBrowserZip(files);
  triggerDownload(zip, `${safeName(projectName)}-Interior-Design-Pack.zip`);
}

function selectExportAssets(assets: InteriorDesignPackAsset[]) {
  return assets
    .filter((asset) => {
      const type = String(asset.asset_type || "");
      if (type === "interior_source_document") return Boolean(asset.file_url);
      if (type.startsWith("interior_plan_")) return asset.metadata?.approved === true && Boolean(asset.file_url || asset.thumbnail_url);
      if (type.startsWith("interior_visual_")) return asset.metadata?.approved === true && Boolean(asset.file_url || asset.thumbnail_url);
      return false;
    })
    .sort((a, b) => {
      const category = assetRank(a) - assetRank(b);
      if (category) return category;
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    });
}

function assetRank(asset: InteriorDesignPackAsset) {
  const type = String(asset.asset_type || "");
  if (type === "interior_source_document") return 0;
  if (type.startsWith("interior_plan_")) return 1;
  return 2;
}

function assetPrefix(asset: InteriorDesignPackAsset) {
  const type = String(asset.asset_type || "");
  if (type === "interior_source_document") return "Source-Plan";
  if (type.startsWith("interior_plan_")) return "Approved-Plan";
  return "Approved-Visual";
}

async function buildSummaryPdf(args: ExportArgs & { projectName: string }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const columnGap = 7;
  const columnWidth = (contentWidth - columnGap) / 2;

  type RGB = [number, number, number];
  const ink: RGB = [24, 24, 27];
  const body: RGB = [62, 62, 69];
  const muted: RGB = [113, 113, 122];
  const line: RGB = [228, 228, 231];
  const surface: RGB = [248, 248, 250];
  const purple: RGB = [111, 45, 255];
  const purpleSoft: RGB = [246, 242, 255];
  const purpleLine: RGB = [222, 210, 255];

  let y = margin;
  let activeSection = "";

  const setTextColor = (rgb: RGB) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFillColor = (rgb: RGB) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setDrawColor = (rgb: RGB) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const cleanSectionTitle = (text: string) => cleanText(text) || "Project section";

  const sectionHeader = (title: string, subtitle?: string, continuation = false) => {
    activeSection = title;
    y = 19;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setTextColor(purple);
    doc.text("HEYY STUDIO / INTERIOR DESIGN PACK", margin, y);
    y += 9;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    setTextColor(ink);
    doc.text(cleanSectionTitle(title), margin, y);

    if (continuation) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setTextColor(muted);
      doc.text("CONTINUED", pageWidth - margin, y, { align: "right" });
    }
    y += 8;

    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setTextColor(muted);
      const lines = doc.splitTextToSize(cleanText(subtitle), contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 4.5 + 3;
    }

    setDrawColor(line);
    doc.setLineWidth(0.35);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  };

  const addContentPage = (title: string, subtitle?: string, continuation = false) => {
    if (doc.getNumberOfPages() > 0) doc.addPage();
    sectionHeader(title, subtitle, continuation);
  };

  const ensureSpace = (height: number, continuedTitle = activeSection) => {
    if (y + height <= pageHeight - 18) return;
    doc.addPage();
    sectionHeader(continuedTitle || "Project summary", undefined, true);
  };

  const textLines = (text: string, width: number, fontSize = 9.5, fontStyle: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(cleanText(text), width) as string[];
  };

  const drawTextCard = (title: string, text: string, options?: { accent?: boolean; width?: number }) => {
    const width = options?.width ?? contentWidth;
    const inner = 6;
    const titleLines = textLines(title, width - inner * 2, 8.5, "bold");
    const bodyLines = textLines(text, width - inner * 2, 10, "normal");
    const height = 7 + titleLines.length * 4 + bodyLines.length * 4.8 + 5;
    ensureSpace(height + 4);

    setFillColor(options?.accent ? purpleSoft : surface);
    setDrawColor(options?.accent ? purpleLine : line);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, width, height, 2.5, 2.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setTextColor(options?.accent ? purple : muted);
    doc.text(titleLines, margin + inner, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setTextColor(body);
    doc.text(bodyLines, margin + inner, y + 6 + titleLines.length * 4 + 3.5);
    y += height + 5;
  };

  const drawKeyValueGrid = (items: Array<{ label: string; value: string }>) => {
    for (let index = 0; index < items.length; index += 2) {
      const pair = items.slice(index, index + 2);
      const measurements = pair.map((item) => {
        const valueLines = textLines(item.value, columnWidth - 12, 9.5);
        return { item, valueLines, height: Math.max(21, 11 + valueLines.length * 4.5 + 5) };
      });
      const rowHeight = Math.max(...measurements.map((item) => item.height));
      ensureSpace(rowHeight + 5);

      measurements.forEach((entry, pairIndex) => {
        const x = margin + pairIndex * (columnWidth + columnGap);
        setFillColor(surface);
        setDrawColor(line);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, columnWidth, rowHeight, 2.5, 2.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.7);
        setTextColor(muted);
        doc.text(entry.item.label.toUpperCase(), x + 6, y + 6.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        setTextColor(ink);
        doc.text(entry.valueLines, x + 6, y + 12.5);
      });
      y += rowHeight + 5;
    }
  };

  const drawBulletList = (items: string[], numbered = false) => {
    items.forEach((raw, index) => {
      const text = cleanText(raw);
      if (!text) return;
      const lines = textLines(text, contentWidth - 12, 9.8);
      const height = Math.max(8, lines.length * 4.7 + 3);
      ensureSpace(height + 2);

      if (numbered) {
        setFillColor(purpleSoft);
        setDrawColor(purpleLine);
        doc.circle(margin + 3.2, y + 3.1, 3.1, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        setTextColor(purple);
        doc.text(String(index + 1), margin + 3.2, y + 4.1, { align: "center" });
      } else {
        setFillColor(purple);
        doc.circle(margin + 2.2, y + 2.7, 1.25, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.8);
      setTextColor(body);
      doc.text(lines, margin + 9, y + 4.2);
      y += height + 2;
    });
  };

  const drawRecordCards = (
    records: Record<string, unknown>[],
    titleKeyCandidates: string[],
    fieldOrder: string[],
  ) => {
    for (let index = 0; index < records.length; index += 2) {
      const pair = records.slice(index, index + 2);
      const cards = pair.map((record) => {
        const titleKey = titleKeyCandidates.find((key) => !isEmptyValue(record[key]));
        const title = titleKey ? valueToText(record[titleKey]) : `Item ${index + 1}`;
        const fields = fieldOrder
          .filter((key) => key !== titleKey && !isEmptyValue(record[key]))
          .map((key) => ({ label: prettyLabel(key), value: valueToText(record[key]) }));

        let height = 16;
        const titleRows = textLines(title, columnWidth - 12, 10.5, "bold");
        height += titleRows.length * 4.8;
        const fieldRows = fields.map((field) => {
          const lines = textLines(field.value, columnWidth - 12, 8.8);
          height += 5.2 + lines.length * 4.1;
          return { ...field, lines };
        });
        return { title, titleRows, fieldRows, height: Math.max(30, height + 4) };
      });

      const rowHeight = Math.max(...cards.map((card) => card.height));
      ensureSpace(rowHeight + 6);

      cards.forEach((card, pairIndex) => {
        const x = margin + pairIndex * (columnWidth + columnGap);
        setFillColor([255, 255, 255]);
        setDrawColor(line);
        doc.setLineWidth(0.35);
        doc.roundedRect(x, y, columnWidth, rowHeight, 3, 3, "FD");
        setFillColor(purple);
        doc.roundedRect(x, y, 2.1, rowHeight, 1, 1, "F");

        let cardY = y + 7;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        setTextColor(ink);
        doc.text(card.titleRows, x + 7, cardY);
        cardY += card.titleRows.length * 4.8 + 3;

        card.fieldRows.forEach((field) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.3);
          setTextColor(muted);
          doc.text(field.label.toUpperCase(), x + 7, cardY);
          cardY += 3.7;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.8);
          setTextColor(body);
          doc.text(field.lines, x + 7, cardY);
          cardY += field.lines.length * 4.1 + 2.2;
        });
      });
      y += rowHeight + 6;
    }
  };

  const drawColorPalette = (records: Record<string, unknown>[]) => {
    records.forEach((record) => {
      const hex = valueToText(record.hex || "#E4E4E7");
      const name = valueToText(record.name || "Color");
      const role = valueToText(record.role || "");
      const swatch = parseHexColor(hex) || [228, 228, 231] as RGB;
      const roleLines = textLines(role, contentWidth - 54, 9);
      const height = Math.max(18, 9 + roleLines.length * 4.2);
      ensureSpace(height + 4);

      setFillColor([255, 255, 255]);
      setDrawColor(line);
      doc.roundedRect(margin, y, contentWidth, height, 2.5, 2.5, "FD");
      setFillColor(swatch);
      doc.roundedRect(margin + 4, y + 4, 10, height - 8, 1.5, 1.5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.7);
      setTextColor(ink);
      doc.text(name, margin + 19, y + 7.2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.4);
      setTextColor(muted);
      doc.text(hex.toUpperCase(), margin + 19, y + 12.1);

      if (role) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        setTextColor(body);
        doc.text(roleLines, margin + 48, y + 7.2);
      }
      y += height + 4;
    });
  };

  const asRecordArray = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      : [];

  const asStringArray = (value: unknown) =>
    Array.isArray(value)
      ? value.map((item) => valueToText(item)).filter(Boolean)
      : isEmptyValue(value)
        ? []
        : [valueToText(value)];

  const getBriefValue = (key: string) => valueToText(args.brief[key] || "");

  // Cover page
  setFillColor(purple);
  doc.rect(0, 0, pageWidth, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setTextColor(purple);
  doc.text("HEYY STUDIO", margin, 27);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setTextColor(muted);
  doc.text("INTERIOR DESIGN PACK", margin, 38);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  setTextColor(ink);
  const projectTitle = doc.splitTextToSize(args.projectName, contentWidth) as string[];
  doc.text(projectTitle, margin, 55);
  let coverY = 55 + projectTitle.length * 11;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  setTextColor(muted);
  doc.text(
    `${args.workMode === "professional" ? "Professional" : "Guided"} interior workspace  |  ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    margin,
    coverY + 2,
  );
  coverY += 16;

  const snapshot = [
    ["Space", getBriefValue("roomType")],
    ["Location", getBriefValue("location")],
    ["Style", getBriefValue("styles")],
    ["Mood", getBriefValue("mood")],
    ["Budget", getBriefValue("budget")],
  ].filter((item) => Boolean(item[1]));

  if (snapshot.length) {
    const snapshotHeight = 19 + snapshot.length * 8;
    setFillColor(surface);
    setDrawColor(line);
    doc.roundedRect(margin, coverY, contentWidth, snapshotHeight, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setTextColor(purple);
    doc.text("PROJECT SNAPSHOT", margin + 7, coverY + 8);
    let rowY = coverY + 16;
    snapshot.forEach(([labelText, valueText]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setTextColor(muted);
      doc.text(labelText.toUpperCase(), margin + 7, rowY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      setTextColor(ink);
      doc.text(String(valueText), margin + 37, rowY);
      rowY += 8;
    });
    coverY += snapshotHeight + 11;
  }

  setFillColor(purpleSoft);
  setDrawColor(purpleLine);
  const noticeLines = textLines(AI_CONCEPT_NOTICE, contentWidth - 14, 9.2);
  const noticeHeight = 15 + noticeLines.length * 4.4;
  doc.roundedRect(margin, Math.min(coverY, pageHeight - noticeHeight - 30), contentWidth, noticeHeight, 3, 3, "FD");
  const noticeY = Math.min(coverY, pageHeight - noticeHeight - 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setTextColor(purple);
  doc.text("CONCEPT-USE NOTICE", margin + 7, noticeY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  setTextColor(body);
  doc.text(noticeLines, margin + 7, noticeY + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  setTextColor(ink);
  doc.text("Create with AI. Build with Experts.", margin, pageHeight - 17);

  // Project overview
  addContentPage("Project Overview", "A concise summary of the project brief, concept and chosen design direction.");
  const briefItems = Object.entries(args.brief)
    .filter(([key, value]) => key !== "workMode" && !isEmptyValue(value))
    .map(([key, value]) => ({ label: prettyLabel(key), value: valueToText(value) }));
  drawKeyValueGrid(briefItems);

  if (!isEmptyValue(args.concept.conceptSummary)) {
    drawTextCard("CONCEPT SUMMARY", valueToText(args.concept.conceptSummary), { accent: true });
  }

  if (args.concept.designDirection && typeof args.concept.designDirection === "object") {
    const direction = args.concept.designDirection as Record<string, unknown>;
    const directionItems = ["name", "idea", "mood", "styleLogic", "qualityLevel"]
      .filter((key) => !isEmptyValue(direction[key]))
      .map((key) => ({ label: prettyLabel(key), value: valueToText(direction[key]) }));
    if (directionItems.length) {
      ensureSpace(14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      setTextColor(ink);
      doc.text("Design Direction", margin, y);
      y += 8;
      drawKeyValueGrid(directionItems);
    }
  }

  // Layout
  const layoutItems = asStringArray(args.concept.layoutPlan);
  if (layoutItems.length) {
    addContentPage("Layout & Circulation", "Spatial recommendations for flow, zoning, function and everyday use.");
    drawBulletList(layoutItems, true);
  }

  // Materials
  const materialRecords = asRecordArray(args.concept.materialPalette);
  if (materialRecords.length) {
    addContentPage("Materials", "Recommended material directions, finishes and intended applications.");
    drawRecordCards(materialRecords, ["material", "category"], ["material", "category", "use", "finish", "reason"]);
  }

  // Furniture
  const furnitureRecords = asRecordArray(args.concept.furniturePlan);
  if (furnitureRecords.length) {
    addContentPage("Furniture & Layout", "Suggested furniture selections, quantities, proportions and placement logic.");
    drawRecordCards(furnitureRecords, ["item", "category"], ["item", "category", "quantity", "placement", "proportion", "notes"]);
  }

  // Lighting and color
  const lightingRecords = asRecordArray(args.concept.lightingPlan);
  const colorRecords = asRecordArray(args.concept.colorPalette);
  if (lightingRecords.length || colorRecords.length) {
    addContentPage("Lighting & Color", "A coordinated palette for atmosphere, functional lighting and visual character.");
    if (lightingRecords.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      setTextColor(ink);
      doc.text("Lighting", margin, y);
      y += 8;
      drawRecordCards(lightingRecords, ["item", "layer"], ["item", "layer", "quantity", "temperature", "recommendation"]);
    }
    if (colorRecords.length) {
      ensureSpace(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      setTextColor(ink);
      doc.text("Color Palette", margin, y);
      y += 8;
      drawColorPalette(colorRecords);
    }
  }

  // Styling and procurement
  const stylingItems = asStringArray(args.concept.stylingNotes);
  const procurementItems = asStringArray(args.concept.procurementPriorities);
  if (stylingItems.length || procurementItems.length) {
    addContentPage("Styling & Procurement", "Practical guidance for finishing the space and prioritizing purchasing decisions.");
    if (stylingItems.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      setTextColor(ink);
      doc.text("Styling Notes", margin, y);
      y += 7;
      drawBulletList(stylingItems);
    }
    if (procurementItems.length) {
      ensureSpace(18);
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      setTextColor(ink);
      doc.text("Procurement Priorities", margin, y);
      y += 7;
      drawBulletList(procurementItems, true);
    }
  }

  // Professional package
  if (args.concept.professionalPackage && typeof args.concept.professionalPackage === "object") {
    addContentPage("Professional Package", "Additional professional-mode outputs included in this concept package.");
    for (const [key, value] of Object.entries(args.concept.professionalPackage as Record<string, unknown>)) {
      if (isEmptyValue(value)) continue;
      const title = prettyLabel(key);
      if (Array.isArray(value)) {
        const records = asRecordArray(value);
        if (records.length === value.length && records.length) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          setTextColor(ink);
          doc.text(title, margin, y);
          y += 8;
          drawRecordCards(records, ["item", "name", "title", "material"], Object.keys(records[0] || {}));
        } else {
          drawTextCard(title.toUpperCase(), asStringArray(value).join("\n"));
        }
      } else {
        drawTextCard(title.toUpperCase(), valueToText(value));
      }
    }
  }

  // Verification and package contents
  const expertItems = asStringArray(args.concept.expertNotes);
  addContentPage("Verification & Package", "Important checks before procurement, fabrication or construction, plus what is included in the ZIP.");

  if (expertItems.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setTextColor(ink);
    doc.text("Expert Verification Notes", margin, y);
    y += 7;
    drawBulletList(expertItems);
    y += 3;
  }

  drawTextCard(
    "PACKAGE CONTENTS",
    "This ZIP includes this designed project summary and, where available, original source-plan files, approved generated plans and approved generated visuals.",
    { accent: true },
  );
  drawTextCard("GENERAL VERIFICATION NOTE", args.disclaimer);
  drawTextCard("AI CONCEPT-USE NOTICE", AI_CONCEPT_NOTICE);

  // Page furniture and numbering are added after the content is complete.
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    if (page > 1) {
      setDrawColor(line);
      doc.setLineWidth(0.25);
      doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      setTextColor(muted);
      doc.text("Heyy Studio - Create with AI. Build with Experts.", margin, pageHeight - 8.5);
      doc.text(`${page} / ${totalPages}`, pageWidth - margin, pageHeight - 8.5, { align: "right" });
    }
  }

  return doc.output("arraybuffer");
}

function parseHexColor(value: string): [number, number, number] | null {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function buildReadme(args: { projectName: string; included: string[]; skipped: string[]; disclaimer: string }) {
  const lines = [
    "HEYY STUDIO — INTERIOR DESIGN PACK",
    args.projectName,
    "",
    "This package is a customer-facing project export. Start with the Project Summary PDF.",
    "",
    "Included:",
    ...args.included.map((item) => `- ${item}`),
    "",
    "Concept-use notice:",
    AI_CONCEPT_NOTICE,
    "",
    "Additional verification note:",
    args.disclaimer,
  ];
  if (args.skipped.length) {
    lines.push("", "Files that could not be retrieved while preparing this ZIP:", ...args.skipped.map((item) => `- ${item}`));
  }
  return lines.join("\n");
}

function recordToText(record: Record<string, unknown>) {
  return Object.entries(record)
    .filter(([key, value]) => !isEmptyValue(value) && !/searchquery|imagesearchquery/i.test(key))
    .map(([key, value]) => `${prettyLabel(key)}: ${valueToText(value)}`)
    .join(" · ");
}

function valueToText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => valueToText(item)).filter(Boolean).join(", ");
  if (value && typeof value === "object") return recordToText(value as Record<string, unknown>);
  return cleanText(String(value ?? ""));
}

function prettyLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isEmptyValue(value: unknown) {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length === 0;
  return false;
}

function safeName(value: string) {
  return String(value || "interior-project")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) || "interior-project";
}

function extensionFor(contentType: string, sourceUrl: string) {
  const type = contentType.toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("pdf")) return "pdf";
  if (type.includes("wordprocessingml")) return "docx";
  if (type.includes("msword")) return "doc";
  const pathname = sourceUrl.split("?")[0];
  const match = pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match?.[1]?.toLowerCase() || "bin";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
