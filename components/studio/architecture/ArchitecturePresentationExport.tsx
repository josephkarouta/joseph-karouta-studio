"use client";

import { useMemo, useState } from "react";
import PresentationExportControls from "@/components/presentation/PresentationExportControls";
import { buildArchitecturePresentation } from "@/lib/presentation/build-architecture-presentation";
import { createPresentationPdfBlob } from "@/lib/presentation/export-pdf";
import { createPresentationPptxBlob } from "@/lib/presentation/export-pptx";
import { createBrowserZip, type BrowserZipFile } from "@/lib/client/zip";


function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function safeName(value: unknown, fallback = "architecture-project") {
  return String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || fallback;
}

function masterUrl(metadata: unknown, fallback?: unknown) {
  const record = objectValue(metadata);
  const finalAssets = objectValue(record.final_assets);
  const previewAssets = objectValue(record.preview_assets);
  const technicalAssets = objectValue(record.technical_assets);
  return String(
    finalAssets.master_url ||
    technicalAssets.master_url ||
    previewAssets.master_url ||
    finalAssets.preview_url ||
    technicalAssets.preview_url ||
    previewAssets.preview_url ||
    fallback ||
    "",
  ).trim();
}

function directionMasterUrl(direction: any) {
  return masterUrl(direction?.generation_json, direction?.image_url);
}

function mimeExtension(type: string, fallback = "bin") {
  const mime = type.toLowerCase();
  if (mime.includes("webp")) return "webp";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("presentationml")) return "pptx";
  return fallback;
}

async function remoteZipFile(url: string, baseName: string): Promise<BrowserZipFile | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return {
      name: `${baseName}.${mimeExtension(blob.type, "webp")}`,
      data: await blob.arrayBuffer(),
    };
  } catch {
    return null;
  }
}

async function createProjectOverviewPdfBlob(args: {
  project: any;
  site: any;
  planning: any;
  direction: any;
  materials: any[];
  spaceProgram: any[];
}) {
  const { jsPDF } = await import("jspdf");
  const { project, site, planning, direction, materials, spaceProgram } = args;
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 46;
  const contentWidth = pageWidth - margin * 2;
  const footerY = pageHeight - 34;
  const selectedMaterials = materials.filter((item) => item?.is_selected !== false);
  const location = [project?.city, project?.region, project?.country].filter(Boolean).join(", ") || "Not added";
  const totalArea = Math.round(spaceProgram.reduce((sum, item) => sum + Number(item?.total_area_m2 || 0), 0));
  let y = 54;
  let pageNumber = 1;

  const footer = () => {
    pdf.setDrawColor(225, 230, 238);
    pdf.line(margin, footerY - 12, pageWidth - margin, footerY - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(110, 122, 140);
    pdf.text("Heyy Studio · Architecture Project Overview", margin, footerY);
    pdf.text(String(pageNumber).padStart(2, "0"), pageWidth - margin, footerY, { align: "right" });
  };

  const addPage = () => {
    footer();
    pdf.addPage();
    pageNumber += 1;
    y = 48;
  };

  const ensure = (height: number) => {
    if (y + height > footerY - 24) addPage();
  };

  const heading = (title: string) => {
    ensure(42);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(20, 31, 49);
    pdf.text(title, margin, y);
    y += 9;
    pdf.setDrawColor(221, 227, 236);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 22;
  };

  const paragraph = (value: unknown, muted = false) => {
    const text = String(value || "").trim() || "Not added";
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    if (muted) pdf.setTextColor(101, 116, 139);
    else pdf.setTextColor(45, 55, 72);
    const lines = pdf.splitTextToSize(text, contentWidth);
    ensure(lines.length * 14 + 8);
    pdf.text(lines, margin, y, { lineHeightFactor: 1.35 });
    y += lines.length * 13.2 + 9;
  };

  const infoRows = (rows: Array<[string, unknown]>) => {
    for (const [label, value] of rows) {
      ensure(34);
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin, y - 13, contentWidth, 27, 5, 5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(91, 104, 123);
      pdf.text(label.toUpperCase(), margin + 10, y + 2);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(26, 35, 51);
      const display = String(value ?? "Not added").trim() || "Not added";
      pdf.text(display, pageWidth - margin - 10, y + 2, { align: "right", maxWidth: contentWidth * 0.56 });
      y += 34;
    }
    y += 5;
  };

  const title = String(project?.project_name || "Architecture Project");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(35, 113, 219);
  pdf.text("HEYY STUDIO · ARCHITECTURE PROJECT OVERVIEW", margin, y);
  y += 25;
  pdf.setFontSize(30);
  pdf.setTextColor(17, 24, 39);
  const titleLines = pdf.splitTextToSize(title, contentWidth);
  pdf.text(titleLines, margin, y, { lineHeightFactor: 1.05 });
  y += titleLines.length * 31 + 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  pdf.text(location, margin, y);
  y += 34;

  heading("Project Foundation");
  infoRows([
    ["Project type", project?.project_type || "Not added"],
    ["Scope", project?.scope || "Not added"],
    ["Style", project?.architectural_style || "Not added"],
    ["Working mode", project?.working_mode || "Guided"],
    ["Plot area", site?.plot_area ? `${site.plot_area} m²` : "Not added"],
    ["Planning", planning?.verification_status || "Needs verification"],
  ]);

  heading("Project Brief");
  paragraph(project?.notes || project?.source_notes || "No additional project requirements were added.");

  heading("Selected Design Direction");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(21, 31, 48);
  const directionTitle = pdf.splitTextToSize(String(direction?.title || "Not selected"), contentWidth);
  ensure(directionTitle.length * 16 + 10);
  pdf.text(directionTitle, margin, y);
  y += directionTitle.length * 15 + 8;
  paragraph(direction?.philosophy || "No direction description was saved.", true);

  heading("Selected Materials");
  if (!selectedMaterials.length) {
    paragraph("No materials selected.", true);
  } else {
    for (const material of selectedMaterials) {
      const name = String(material?.name || "Material");
      const detail = [material?.finish, material?.application].filter(Boolean).join(" · ") || "Finish/application to verify";
      ensure(30);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(25, 35, 50);
      pdf.text(`• ${name}`, margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 116, 139);
      const detailLines = pdf.splitTextToSize(detail, contentWidth - 14);
      pdf.text(detailLines, margin + 10, y + 13, { lineHeightFactor: 1.25 });
      y += 18 + detailLines.length * 10;
    }
    y += 5;
  }

  heading("Space Program");
  paragraph(`${spaceProgram.length} saved spaces${totalArea ? ` · approximately ${totalArea} m² programmed` : ""}.`, true);
  const colX = [margin, margin + 220, margin + 340, margin + 410];
  const tableHeader = () => {
    ensure(28);
    pdf.setFillColor(23, 34, 55);
    pdf.roundedRect(margin, y - 12, contentWidth, 24, 4, 4, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(255, 255, 255);
    ["SPACE", "LEVEL", "QTY", "APPROX. AREA"].forEach((label, index) => pdf.text(label, colX[index] + 7, y + 2));
    y += 30;
  };
  tableHeader();
  for (const item of spaceProgram) {
    if (y + 28 > footerY - 24) {
      addPage();
      heading("Space Program · continued");
      tableHeader();
    }
    pdf.setDrawColor(230, 234, 240);
    pdf.line(margin, y + 11, pageWidth - margin, y + 11);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.2);
    pdf.setTextColor(47, 58, 75);
    pdf.text(String(item?.space_name || item?.space || "Space"), colX[0] + 7, y);
    pdf.text(String(item?.level || "-"), colX[1] + 7, y);
    pdf.text(String(item?.quantity || 1), colX[2] + 7, y);
    const area = Number(item?.total_area_m2 || item?.approx_area_m2 || 0);
    pdf.text(area ? `${area} m²` : "-", colX[3] + 7, y);
    y += 25;
  }

  ensure(80);
  y += 14;
  pdf.setFillColor(255, 248, 220);
  pdf.setDrawColor(224, 181, 65);
  pdf.roundedRect(margin, y, contentWidth, 62, 8, 8, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(131, 91, 5);
  pdf.text("CONCEPT-STAGE ARCHITECTURE ONLY", margin + 13, y + 19);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.2);
  const notice = pdf.splitTextToSize("AI-generated plans, visuals and project information are intended for concept exploration and early design direction. They are not construction-ready or professionally verified documents.", contentWidth - 26);
  pdf.text(notice, margin + 13, y + 35, { lineHeightFactor: 1.25 });
  y += 74;

  footer();
  return pdf.output("blob");
}

function triggerZipDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ArchitecturePresentationExport({
  project,
  site,
  planning,
  direction,
  concept,
  planSet,
  visuals,
  materials,
  spaceProgram,
}: {
  project: any;
  site: any;
  planning: any;
  direction: any;
  concept: any;
  planSet: any;
  visuals: any[];
  materials: any[];
  spaceProgram: any[];
}) {
  const [packing, setPacking] = useState(false);
  const [packMessage, setPackMessage] = useState("");
  const presentation = useMemo(
    () =>
      buildArchitecturePresentation({
        project,
        site,
        planning,
        direction,
        concept,
        planSet,
        visuals,
        materials,
        spaceProgram,
      }),
    [
      concept,
      direction,
      materials,
      planSet,
      planning,
      project,
      site,
      spaceProgram,
      visuals,
    ],
  );

  const rootId = `architecture-presentation-${project?.id || "project"}`;

  async function downloadProjectPack() {
    if (packing) return;
    setPacking(true);
    setPackMessage("Building the complete project pack...");
    try {
      const pdfBlob = await createPresentationPdfBlob({ document: presentation, rootId, quality: "high" });
      const pptxBlob = await createPresentationPptxBlob(presentation);
      const overviewPdfBlob = await createProjectOverviewPdfBlob({ project, site, planning, direction, materials, spaceProgram });
      const files: BrowserZipFile[] = [
        { name: `01-Project-Overview/${safeName(project?.project_name)}-Project-Overview.pdf`, data: await overviewPdfBlob.arrayBuffer() },
        { name: `02-Concept-Pack/${presentation.filenameBase}.pdf`, data: await pdfBlob.arrayBuffer() },
        { name: `02-Concept-Pack/${presentation.filenameBase}.pptx`, data: await pptxBlob.arrayBuffer() },
      ];

      const directionFile = await remoteZipFile(directionMasterUrl(direction), `03-Selected-Direction/${safeName(direction?.title, "Selected-Direction")}`);
      if (directionFile) files.push(directionFile);

      const planRows = visuals.filter((visual) => visual?.visual_type === "plan_foundation_sheet" || String(visual?.metadata?.group || "") === "plans");
      for (let index = 0; index < planRows.length; index += 1) {
        const visual = planRows[index];
        const file = await remoteZipFile(masterUrl(visual?.metadata, visual?.image_url), `04-Plans/${String(index + 1).padStart(2, "0")}-${safeName(visual?.title || visual?.visual_type, "Plan")}`);
        if (file) files.push(file);
      }

      const conceptBoards = visuals.filter((visual) => visual?.metadata?.group === "visuals" && (visual?.is_approved || !visuals.some((item) => item?.metadata?.group === "visuals" && item?.is_approved)));
      for (let index = 0; index < conceptBoards.length; index += 1) {
        const visual = conceptBoards[index];
        const file = await remoteZipFile(masterUrl(visual?.metadata, visual?.image_url), `05-Concept-Boards/${String(index + 1).padStart(2, "0")}-${safeName(visual?.title || visual?.visual_type, "Concept-Board")}`);
        if (file) files.push(file);
      }

      if (concept?.image_url) {
        const conceptFile = await remoteZipFile(masterUrl(concept?.generation_json, concept?.image_url), `06-Architecture-Strategy/${safeName(concept?.title, "Architecture-Strategy")}`);
        if (conceptFile) files.push(conceptFile);
      }

      for (let index = 0; index < materials.filter((item) => item?.is_selected !== false && item?.image_url).length; index += 1) {
        const material = materials.filter((item) => item?.is_selected !== false && item?.image_url)[index];
        const file = await remoteZipFile(String(material.image_url), `07-Selected-Materials/${String(index + 1).padStart(2, "0")}-${safeName(material.name, "Material")}`);
        if (file) files.push(file);
      }

      files.push({
        name: "README.txt",
        data: new TextEncoder().encode("Heyy Studio Architecture Project Pack\n\nIncludes the project overview, concept-pack PDF, editable PowerPoint, selected design direction, generated plans, approved concept boards and selected material references.\n\nIMPORTANT: Architecture Studio outputs are conceptual and must be professionally verified before planning, pricing, engineering, construction or procurement use."),
      });

      const zip = createBrowserZip(files);
      triggerZipDownload(zip, `${safeName(project?.project_name)}-Architecture-Project-Pack.zip`);
      setPackMessage(`Project pack ready · ${files.length} files`);
    } catch (error) {
      setPackMessage(error instanceof Error ? error.message : "The project pack could not be created.");
    } finally {
      setPacking(false);
    }
  }

  return (
    <div className="architecture-presentation-export">
      <PresentationExportControls
        document={presentation}
        rootId={rootId}
        compact
      />
      <button
        type="button"
        className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-full border border-slate-300 bg-slate-950 px-4 text-[10px] font-black text-white transition hover:opacity-85 disabled:cursor-wait disabled:opacity-55 dark:border-white/15 dark:bg-white dark:text-slate-950"
        onClick={() => void downloadProjectPack()}
        disabled={packing}
      >
        {packing ? "Preparing Project Pack..." : "Download Complete Project Pack (.zip)"}
      </button>
      {packMessage && <p className="mt-2 max-w-[360px] text-[9px] font-bold leading-4 text-slate-500">{packMessage}</p>}
    </div>
  );
}
