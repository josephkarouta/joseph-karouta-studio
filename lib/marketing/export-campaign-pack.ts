"use client";

type MarketingVisualExport = {
  title?: string | null;
  url?: string | null;
  type?: unknown;
  stage?: unknown;
  approved?: boolean;
};

type CampaignPackExportInput = {
  projectName: string;
  workMode: "guided" | "professional";
  brief: Record<string, unknown>;
  campaign: Record<string, unknown>;
  visuals: MarketingVisualExport[];
  disclaimer: string;
};

type PdfLike = any;

type Cursor = {
  pdf: PdfLike;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  y: number;
  pageNumber: number;
  projectName: string;
};

const PINK = [236, 47, 135] as const;
const INK = [20, 18, 28] as const;
const MUTED = [92, 88, 106] as const;
const LIGHT = [246, 243, 248] as const;
const BORDER = [226, 220, 231] as const;

export async function exportMarketingCampaignPackPdf(input: CampaignPackExportInput) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });

  const cursor: Cursor = {
    pdf,
    pageWidth: pdf.internal.pageSize.getWidth(),
    pageHeight: pdf.internal.pageSize.getHeight(),
    margin: 46,
    contentWidth: pdf.internal.pageSize.getWidth() - 92,
    y: 46,
    pageNumber: 1,
    projectName: input.projectName,
  };

  drawCover(cursor, input);
  cursor.pdf.addPage("a4", "portrait");
  cursor.pageNumber = 2;
  cursor.y = cursor.margin;

  const campaign = recordOf(input.campaign);
  const brief = recordOf(input.brief);

  addSection(cursor, "Executive campaign overview");
  addParagraph(cursor, text(campaign.campaignSummary) || "Campaign overview ready.", 11.2, 17);

  addSection(cursor, "Campaign brief");
  addKeyValues(cursor, [
    ["Campaign", text(brief.campaignName) || input.projectName],
    ["Business", text(brief.business)],
    ["Objective", text(brief.objective)],
    ["Offer", text(brief.offer)],
    ["Primary audience", text(brief.audience)],
    ["Market", text(brief.market)],
    ["Problem / opportunity", text(brief.problem)],
    ["Proof", text(brief.proof)],
    ["Call to action", text(brief.callToAction)],
    ["Channels", listText(brief.channels)],
    ["Tone", text(brief.tone)],
    ["Timeline", text(brief.timeline)],
    ["Budget", text(brief.budget)],
    ["Connected brand", connectedBrandName(brief)],
  ]);

  addAudience(cursor, campaign.audienceSegments);
  addStrategy(cursor, campaign);
  addCampaignAngles(cursor, campaign.campaignAngles);
  addChannelPlan(cursor, campaign.channelPlan);
  addContentCalendar(cursor, campaign.calendar);
  addCreativeBrief(cursor, campaign.creativeBrief);
  addCopyBank(cursor, campaign.copyBank);
  await addVisuals(cursor, input.visuals);
  addTesting(cursor, campaign.testingPlan);
  addMeasurement(cursor, campaign.measurementPlan);
  addChecklist(cursor, campaign.launchChecklist);

  if (text(input.disclaimer)) {
    addSection(cursor, "Important note");
    addCallout(cursor, input.disclaimer);
  }

  finishPage(cursor);
  pdf.setProperties({
    title: `${input.projectName} - Campaign Pack`,
    subject: "Heyy Studio Marketing Studio Campaign Pack",
    author: "Heyy Studio",
    creator: "Heyy Studio Marketing Studio",
  });
  pdf.save(`${slugify(input.projectName)}-campaign-pack.pdf`);
}

function drawCover(cursor: Cursor, input: CampaignPackExportInput) {
  const { pdf, pageWidth, pageHeight, margin } = cursor;
  pdf.setFillColor(...INK);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setFillColor(...PINK);
  pdf.roundedRect(margin, 72, 74, 8, 4, 4, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("HEYY STUDIO / MARKETING", margin, 124);

  pdf.setFontSize(32);
  const titleLines = pdf.splitTextToSize(input.projectName || "Marketing Campaign", cursor.contentWidth);
  pdf.text(titleLines, margin, 190);

  const titleHeight = titleLines.length * 38;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(17);
  pdf.setTextColor(224, 218, 229);
  pdf.text("Campaign Pack", margin, 205 + titleHeight);

  pdf.setFontSize(10.5);
  pdf.setTextColor(184, 177, 192);
  pdf.text(
    `${input.workMode === "professional" ? "Professional" : "Guided"} campaign system / ${formatDate(new Date())}`,
    margin,
    238 + titleHeight,
  );

  pdf.setDrawColor(74, 68, 82);
  pdf.line(margin, pageHeight - 120, pageWidth - margin, pageHeight - 120);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Create with AI. Build with Experts.", margin, pageHeight - 88);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(160, 153, 170);
  pdf.text("Strategy / messaging / content / creative / testing / measurement", margin, pageHeight - 68);
}

function addAudience(cursor: Cursor, value: unknown) {
  const items = records(value);
  if (!items.length) return;
  addSection(cursor, "Audience profiles");
  items.forEach((item, index) => {
    addSubheading(cursor, text(item.name) || `Audience ${index + 1}`);
    addParagraph(cursor, text(item.description), 10.5, 15.5);
    addKeyValues(cursor, [
      ["Motivation", text(item.motivation)],
      ["Objection", text(item.objection)],
      ["Trigger", text(item.trigger)],
      ["Channels", listText(item.channels)],
      ["Message angle", text(item.messageAngle)],
    ], true);
  });
}

function addStrategy(cursor: Cursor, campaign: Record<string, unknown>) {
  const strategy = recordOf(campaign.strategy);
  const bigIdea = recordOf(campaign.bigIdea);
  const keyMessage = recordOf(campaign.keyMessage);
  if (!Object.keys(strategy).length && !Object.keys(bigIdea).length && !Object.keys(keyMessage).length) return;

  addSection(cursor, "Strategy and big idea");
  addKeyValues(cursor, [
    ["Objective", text(strategy.objective)],
    ["Audience insight", text(strategy.audienceInsight)],
    ["Opportunity", text(strategy.opportunity)],
    ["Barrier", text(strategy.barrier)],
    ["Strategic response", text(strategy.response)],
    ["Funnel role", text(strategy.funnelRole)],
  ]);

  if (Object.keys(bigIdea).length) {
    addSubheading(cursor, "Big idea");
    addKeyValues(cursor, [
      ["Name", text(bigIdea.name)],
      ["Line", text(bigIdea.line)],
      ["Rationale", text(bigIdea.rationale)],
      ["Creative device", text(bigIdea.creativeDevice)],
    ], true);
  }

  if (Object.keys(keyMessage).length) {
    addSubheading(cursor, "Message hierarchy");
    addKeyValues(cursor, [
      ["Primary message", text(keyMessage.primary)],
      ["Supporting messages", listText(keyMessage.supporting)],
      ["Proof points", listText(keyMessage.proofPoints)],
      ["Call to action", text(keyMessage.callToAction)],
    ], true);
  }
}

function addCampaignAngles(cursor: Cursor, value: unknown) {
  const items = records(value);
  if (!items.length) return;
  addSection(cursor, "Campaign angles");
  items.forEach((item, index) => {
    addSubheading(cursor, text(item.title) || `Angle ${index + 1}`);
    addKeyValues(cursor, [
      ["Hook", text(item.hook)],
      ["Message", text(item.message)],
      ["Proof", text(item.proof)],
      ["Best for", text(item.bestFor)],
    ], true);
  });
}

function addChannelPlan(cursor: Cursor, value: unknown) {
  const items = records(value);
  if (!items.length) return;
  addSection(cursor, "Channel plan");
  items.forEach((item) => {
    addSubheading(cursor, text(item.channel) || "Channel");
    addKeyValues(cursor, [
      ["Role", text(item.role)],
      ["Funnel stage", text(item.funnelStage)],
      ["Cadence", text(item.cadence)],
      ["Formats", listText(item.formats)],
      ["Message style", text(item.messageStyle)],
      ["Required assets", listText(item.requiredAssets)],
    ], true);
  });
}

function addContentCalendar(cursor: Cursor, value: unknown) {
  const items = records(value);
  if (!items.length) return;
  addSection(cursor, "Content calendar");
  items.forEach((item, index) => {
    addSubheading(cursor, `${text(item.week) || `Item ${index + 1}`} - ${text(item.phase) || "Campaign"}`);
    addKeyValues(cursor, [
      ["Topic", text(item.topic)],
      ["Hook", text(item.hook)],
      ["Channel", text(item.channel)],
      ["Format", text(item.format)],
      ["Caption", text(item.caption)],
      ["CTA", text(item.callToAction)],
      ["Visual required", text(item.visualRequired)],
      ["Status", text(item.status)],
    ], true);
  });
}

function addCreativeBrief(cursor: Cursor, value: unknown) {
  const item = recordOf(value);
  if (!Object.keys(item).length) return;
  addSection(cursor, "Creative brief");
  addKeyValues(cursor, [
    ["Visual direction", text(item.visualDirection)],
    ["Imagery", text(item.imagery)],
    ["Composition", text(item.composition)],
    ["Colour and type", text(item.colourAndType)],
    ["Copy direction", text(item.copyDirection)],
    ["Must include", listText(item.mustInclude)],
    ["Avoid", listText(item.avoid)],
  ]);
}

function addCopyBank(cursor: Cursor, value: unknown) {
  const item = recordOf(value);
  if (!Object.keys(item).length) return;
  addSection(cursor, "Copy bank");
  [
    ["Headlines", item.headlines],
    ["Hooks", item.hooks],
    ["Calls to action", item.callsToAction],
    ["Captions", item.captions],
    ["Email subjects", item.emailSubjects],
  ].forEach(([label, content]) => {
    const values = strings(content).slice(0, 12);
    if (!values.length) return;
    addSubheading(cursor, String(label));
    addBullets(cursor, values);
  });
}

async function addVisuals(cursor: Cursor, visuals: MarketingVisualExport[]) {
  const usable = visuals.filter((item) => text(item.url)).slice(0, 8);
  if (!usable.length) return;
  addSection(cursor, "Creative visuals");

  for (const visual of usable) {
    addSubheading(
      cursor,
      `${text(visual.title) || "Campaign visual"}${visual.approved ? " - Approved" : " - Preview"}`,
    );
    const url = text(visual.url);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Image unavailable");
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      const properties = cursor.pdf.getImageProperties(dataUrl);
      const maxWidth = cursor.contentWidth;
      const maxHeight = 300;
      const scale = Math.min(maxWidth / properties.width, maxHeight / properties.height, 1);
      const width = properties.width * scale;
      const height = properties.height * scale;
      ensureSpace(cursor, height + 32);
      cursor.pdf.addImage(dataUrl, imageFormat(blob.type), cursor.margin, cursor.y, width, height, undefined, "FAST");
      cursor.y += height + 20;
    } catch {
      addParagraph(cursor, "Preview image could not be embedded in the PDF. It remains available inside the Marketing Studio project.", 9.5, 14);
    }
  }
}

function addTesting(cursor: Cursor, value: unknown) {
  const items = records(value);
  if (!items.length) return;
  addSection(cursor, "Testing matrix");
  items.forEach((item, index) => {
    addSubheading(cursor, text(item.test) || text(item.hypothesis) || `Test ${index + 1}`);
    addKeyValues(cursor, [
      ["Audience", text(item.audience)],
      ["Variant A", text(item.variantA)],
      ["Variant B", text(item.variantB)],
      ["Success signal", text(item.successSignal)],
      ["Decision rule", text(item.decisionRule)],
    ], true);
  });
}

function addMeasurement(cursor: Cursor, value: unknown) {
  const items = records(value);
  if (!items.length) return;
  addSection(cursor, "Measurement framework");
  items.forEach((item, index) => {
    addSubheading(cursor, text(item.stage) || text(item.funnelStage) || `Stage ${index + 1}`);
    addKeyValues(cursor, [
      ["Signal", text(item.signal) || listText(item.primarySignals)],
      ["Why it matters", text(item.why)],
      ["Action", text(item.action) || text(item.optimisationAction)],
    ], true);
  });
}

function addChecklist(cursor: Cursor, value: unknown) {
  const items = strings(value);
  if (!items.length) return;
  addSection(cursor, "Launch checklist");
  addBullets(cursor, items);
}

function addSection(cursor: Cursor, title: string) {
  ensureSpace(cursor, 72);
  cursor.y += cursor.y > cursor.margin + 8 ? 12 : 0;
  cursor.pdf.setFillColor(...PINK);
  cursor.pdf.roundedRect(cursor.margin, cursor.y, 34, 4, 2, 2, "F");
  cursor.y += 22;
  cursor.pdf.setFont("helvetica", "bold");
  cursor.pdf.setFontSize(20);
  cursor.pdf.setTextColor(...INK);
  cursor.pdf.text(title, cursor.margin, cursor.y);
  cursor.y += 24;
}

function addSubheading(cursor: Cursor, title: string) {
  if (!text(title)) return;
  ensureSpace(cursor, 40);
  cursor.pdf.setFont("helvetica", "bold");
  cursor.pdf.setFontSize(12);
  cursor.pdf.setTextColor(...INK);
  cursor.pdf.text(title, cursor.margin, cursor.y);
  cursor.y += 18;
}

function addParagraph(cursor: Cursor, value: string, size = 10.5, lineHeight = 15.5) {
  const content = text(value);
  if (!content) return;
  cursor.pdf.setFont("helvetica", "normal");
  cursor.pdf.setFontSize(size);
  cursor.pdf.setTextColor(...MUTED);
  const lines = cursor.pdf.splitTextToSize(content, cursor.contentWidth);
  for (const line of lines) {
    ensureSpace(cursor, lineHeight + 4);
    cursor.pdf.text(String(line), cursor.margin, cursor.y);
    cursor.y += lineHeight;
  }
  cursor.y += 5;
}

function addKeyValues(cursor: Cursor, rows: Array<[string, string]>, compact = false) {
  rows.filter(([, value]) => text(value)).forEach(([label, value]) => {
    const labelWidth = compact ? 108 : 124;
    const valueWidth = cursor.contentWidth - labelWidth - 18;
    const lines = cursor.pdf.splitTextToSize(text(value), valueWidth);
    const height = Math.max(34, lines.length * 13 + 16);
    ensureSpace(cursor, height + 6);

    cursor.pdf.setFillColor(...LIGHT);
    cursor.pdf.setDrawColor(...BORDER);
    cursor.pdf.roundedRect(cursor.margin, cursor.y, cursor.contentWidth, height, 6, 6, "FD");

    cursor.pdf.setFont("helvetica", "bold");
    cursor.pdf.setFontSize(8.5);
    cursor.pdf.setTextColor(...MUTED);
    cursor.pdf.text(label.toUpperCase(), cursor.margin + 10, cursor.y + 16);

    cursor.pdf.setFont("helvetica", "normal");
    cursor.pdf.setFontSize(9.5);
    cursor.pdf.setTextColor(...INK);
    cursor.pdf.text(lines, cursor.margin + labelWidth, cursor.y + 16);
    cursor.y += height + 6;
  });
  cursor.y += 4;
}

function addBullets(cursor: Cursor, items: string[]) {
  items.filter(Boolean).forEach((item) => {
    const lines = cursor.pdf.splitTextToSize(item, cursor.contentWidth - 20);
    const lineHeight = 14;
    ensureSpace(cursor, Math.max(22, lines.length * lineHeight + 4));
    cursor.pdf.setFillColor(...PINK);
    cursor.pdf.circle(cursor.margin + 4, cursor.y - 3, 2, "F");
    cursor.pdf.setFont("helvetica", "normal");
    cursor.pdf.setFontSize(9.5);
    cursor.pdf.setTextColor(...INK);
    cursor.pdf.text(lines, cursor.margin + 16, cursor.y);
    cursor.y += lines.length * lineHeight + 5;
  });
  cursor.y += 4;
}

function addCallout(cursor: Cursor, value: string) {
  const lines = cursor.pdf.splitTextToSize(value, cursor.contentWidth - 24);
  const height = Math.max(56, lines.length * 14 + 28);
  ensureSpace(cursor, height + 8);
  cursor.pdf.setFillColor(253, 240, 247);
  cursor.pdf.setDrawColor(247, 178, 211);
  cursor.pdf.roundedRect(cursor.margin, cursor.y, cursor.contentWidth, height, 8, 8, "FD");
  cursor.pdf.setFont("helvetica", "normal");
  cursor.pdf.setFontSize(9.5);
  cursor.pdf.setTextColor(...INK);
  cursor.pdf.text(lines, cursor.margin + 12, cursor.y + 19);
  cursor.y += height + 8;
}

function ensureSpace(cursor: Cursor, required: number) {
  if (cursor.y + required <= cursor.pageHeight - 58) return;
  finishPage(cursor);
  addPage(cursor);
}

function addPage(cursor: Cursor) {
  cursor.pdf.addPage("a4", "portrait");
  cursor.pageNumber += 1;
  cursor.y = cursor.margin;
  cursor.pdf.setFillColor(255, 255, 255);
  cursor.pdf.rect(0, 0, cursor.pageWidth, cursor.pageHeight, "F");
}

function finishPage(cursor: Cursor) {
  const { pdf } = cursor;
  pdf.setDrawColor(...BORDER);
  pdf.line(cursor.margin, cursor.pageHeight - 38, cursor.pageWidth - cursor.margin, cursor.pageHeight - 38);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(135, 128, 145);
  pdf.text("HEYY STUDIO / MARKETING CAMPAIGN PACK", cursor.margin, cursor.pageHeight - 22);
  pdf.text(String(pdf.getNumberOfPages()), cursor.pageWidth - cursor.margin, cursor.pageHeight - 22, { align: "right" });
}

function recordOf(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function records(value: unknown): Array<Record<string, any>> {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Array<Record<string, any>>
    : [];
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return text(value) ? [text(value)] : [];
  return value
    .map((item) => typeof item === "string" ? item.trim() : text(item))
    .filter(Boolean);
}

function listText(value: unknown) {
  return strings(value).join(" / ");
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return "";
  return String(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .trim();
}

function connectedBrandName(brief: Record<string, any>) {
  const connected = recordOf(brief.connectedBrand);
  return text(connected.name) || text(connected.businessName) || text(brief.brandProjectId);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "marketing-campaign";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read campaign image."));
    reader.readAsDataURL(blob);
  });
}

function imageFormat(contentType: string) {
  return /jpe?g/i.test(contentType) ? "JPEG" : "PNG";
}
