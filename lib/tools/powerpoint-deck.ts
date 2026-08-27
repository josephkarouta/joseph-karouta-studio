import PptxGenJS from "pptxgenjs";

export type PresentationThemeId = "editorial" | "corporate" | "bold" | "minimal" | "luxury";
export type PresentationStyle = "auto" | PresentationThemeId;
export type PresentationSlideLayout =
  | "cover"
  | "section"
  | "statement"
  | "editorial"
  | "two-column"
  | "timeline"
  | "process"
  | "metrics"
  | "closing";

export type PresentationSlideItem = {
  label: string;
  title: string;
  body: string;
  value: string;
};

export type PresentationSlideModel = {
  layout: PresentationSlideLayout;
  kicker: string;
  title: string;
  subtitle: string;
  items: PresentationSlideItem[];
  speakerNotes: string;
  visualType: "none" | "generated" | "attachment";
  visualPrompt: string;
  visualAssetName: string;
  visualPosition: "none" | "background" | "left" | "right";
  sourceUrls: string[];
};

export type PresentationPlan = {
  deckSubtitle: string;
  theme: PresentationThemeId;
  slides: PresentationSlideModel[];
};

type Theme = {
  background: string;
  surface: string;
  ink: string;
  muted: string;
  primary: string;
  accent: string;
  soft: string;
  dark: string;
  onDark: string;
  onAccent: string;
};

const THEMES: Record<PresentationThemeId, Theme> = {
  editorial: {
    background: "F4F1EA",
    surface: "FFFEFB",
    ink: "16181C",
    muted: "626871",
    primary: "183B56",
    accent: "D85B47",
    soft: "E7DED0",
    dark: "101820",
    onDark: "F8F4EC",
    onAccent: "FFFFFF",
  },
  corporate: {
    background: "F2F6FA",
    surface: "FFFFFF",
    ink: "132033",
    muted: "5C697A",
    primary: "164E78",
    accent: "1A9CB0",
    soft: "DCEAF2",
    dark: "0B2239",
    onDark: "F4FAFF",
    onAccent: "FFFFFF",
  },
  bold: {
    background: "F6F1E8",
    surface: "FFFDF8",
    ink: "15120F",
    muted: "655E55",
    primary: "15120F",
    accent: "F05A28",
    soft: "F2D7C8",
    dark: "12100E",
    onDark: "FFF8ED",
    onAccent: "FFFFFF",
  },
  minimal: {
    background: "F7F7F5",
    surface: "FFFFFF",
    ink: "171717",
    muted: "6B6B68",
    primary: "283593",
    accent: "5B6CFF",
    soft: "E3E6F6",
    dark: "15171C",
    onDark: "FAFAF7",
    onAccent: "FFFFFF",
  },
  luxury: {
    background: "F3EFE7",
    surface: "FFFCF6",
    ink: "191713",
    muted: "6D665C",
    primary: "29251F",
    accent: "A98345",
    soft: "DED1BB",
    dark: "11100E",
    onDark: "F7F0E4",
    onAccent: "FFFFFF",
  },
};

const ALLOWED_LAYOUTS: PresentationSlideLayout[] = [
  "cover",
  "section",
  "statement",
  "editorial",
  "two-column",
  "timeline",
  "process",
  "metrics",
  "closing",
];

const ALLOWED_THEMES: PresentationThemeId[] = ["editorial", "corporate", "bold", "minimal", "luxury"];

export const PRESENTATION_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    deckSubtitle: { type: "string" },
    theme: { type: "string", enum: ALLOWED_THEMES },
    slides: {
      type: "array",
      minItems: 3,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          layout: { type: "string", enum: ALLOWED_LAYOUTS },
          kicker: { type: "string" },
          title: { type: "string" },
          subtitle: { type: "string" },
          items: {
            type: "array",
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string" },
                title: { type: "string" },
                body: { type: "string" },
                value: { type: "string" },
              },
              required: ["label", "title", "body", "value"],
            },
          },
          speakerNotes: { type: "string" },
          visualType: { type: "string", enum: ["none", "generated", "attachment"] },
          visualPrompt: { type: "string" },
          visualAssetName: { type: "string" },
          visualPosition: { type: "string", enum: ["none", "background", "left", "right"] },
          sourceUrls: {
            type: "array",
            maxItems: 4,
            items: { type: "string" },
          },
        },
        required: [
          "layout",
          "kicker",
          "title",
          "subtitle",
          "items",
          "speakerNotes",
          "visualType",
          "visualPrompt",
          "visualAssetName",
          "visualPosition",
          "sourceUrls",
        ],
      },
    },
  },
  required: ["deckSubtitle", "theme", "slides"],
} as const;

export function normalizePresentationPlan(
  value: unknown,
  requestedSlides: number,
  requestedStyle: PresentationStyle,
): PresentationPlan {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawSlides = Array.isArray(record.slides) ? record.slides : [];
  const slides = rawSlides
    .slice(0, requestedSlides)
    .map((slide, index) => normalizeSlide(slide, index, Math.min(rawSlides.length, requestedSlides)));

  if (slides.length) slides[0].layout = "cover";
  if (slides.length > 1) slides[slides.length - 1].layout = "closing";
  for (let index = 2; index < slides.length - 1; index += 1) {
    if (slides[index].layout === slides[index - 1].layout && !["section", "statement"].includes(slides[index].layout)) {
      slides[index].layout = "editorial";
    }
  }

  const generatedTheme = ALLOWED_THEMES.includes(record.theme as PresentationThemeId)
    ? record.theme as PresentationThemeId
    : "editorial";
  return {
    deckSubtitle: cleanText(record.deckSubtitle, 160),
    theme: requestedStyle === "auto" ? generatedTheme : requestedStyle,
    slides,
  };
}

function normalizeSlide(value: unknown, index: number, total: number): PresentationSlideModel {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const requestedLayout = ALLOWED_LAYOUTS.includes(record.layout as PresentationSlideLayout)
    ? record.layout as PresentationSlideLayout
    : "editorial";
  const layout = index === 0 ? "cover" : index === total - 1 ? "closing" : requestedLayout;
  const items = (Array.isArray(record.items) ? record.items : [])
    .slice(0, 6)
    .map((item) => normalizeItem(item))
    .filter((item) => item.title || item.body || item.value);

  return {
    layout,
    kicker: cleanText(record.kicker, 55),
    title: cleanText(record.title, layout === "statement" ? 150 : 95) || `Slide ${index + 1}`,
    subtitle: cleanText(record.subtitle, 180),
    items,
    speakerNotes: cleanText(record.speakerNotes, 1800),
    visualType: record.visualType === "generated" ? "generated" : record.visualType === "attachment" ? "attachment" : "none",
    visualPrompt: cleanText(record.visualPrompt, 700),
    visualAssetName: cleanText(record.visualAssetName, 180),
    visualPosition: ["background", "left", "right"].includes(String(record.visualPosition))
      ? record.visualPosition as "background" | "left" | "right"
      : "none",
    sourceUrls: (Array.isArray(record.sourceUrls) ? record.sourceUrls : [])
      .map((url) => String(url || "").trim())
      .filter((url) => /^https?:\/\//i.test(url))
      .slice(0, 4),
  };
}

function normalizeItem(value: unknown): PresentationSlideItem {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    label: cleanText(record.label, 35),
    title: cleanText(record.title, 65),
    body: cleanText(record.body, 150),
    value: cleanText(record.value, 35),
  };
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildSpeakerNotes(model: PresentationSlideModel) {
  const notes = model.speakerNotes.trim();
  const sources = model.sourceUrls.length
    ? `[Sources]\n${model.sourceUrls.map((url) => `- ${url}`).join("\n")}`
    : "";
  return [notes, sources].filter(Boolean).join("\n\n");
}

function addFullBleedVisual(slide: any, visual: string) {
  // Crop the generated 3:2 canvas into the 16:9 slide while keeping every
  // object inside the PowerPoint canvas.
  slide.addImage({
    data: visual,
    x: 0,
    y: 0,
    w: 13.33,
    h: 7.5,
    sizing: { type: "cover", w: 13.33, h: 7.5 },
  });
}

export async function buildProfessionalPptx({
  title,
  audience,
  objective,
  plan,
  visuals = {},
  logo,
}: {
  title: string;
  audience: string;
  objective: string;
  plan: PresentationPlan;
  visuals?: Record<number, string>;
  logo?: string;
}) {
  const pptx: any = new PptxGenJS();
  const theme = THEMES[plan.theme];
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Heyy Studio";
  pptx.company = "Heyy Studio";
  pptx.subject = objective;
  pptx.title = title;
  pptx.lang = "en-US";
  pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };
  pptx.defineSlideMaster({
    title: "HEYY_CONTENT",
    background: { color: theme.background },
    objects: [
      { line: { x: 0.66, y: 7.08, w: 12.0, h: 0, line: { color: theme.soft, width: 0.8 } } },
      { text: { text: "Created with Heyy Studio", options: { x: 0.68, y: 7.16, w: 2.4, h: 0.14, fontFace: "Aptos", fontSize: 7.5, color: theme.muted, margin: 0, charSpacing: 0.6 } } },
    ],
    slideNumber: { x: 12.1, y: 7.14, w: 0.52, h: 0.16, fontFace: "Aptos", fontSize: 8, color: theme.muted, align: "right", margin: 0 },
  });

  plan.slides.forEach((model, index) => {
    const darkLayout = ["cover", "section", "statement", "closing"].includes(model.layout);
    const slide = darkLayout ? pptx.addSlide() : pptx.addSlide("HEYY_CONTENT");
    const visual = visuals[index];
    if (model.layout === "cover") addCoverSlide({ pptx, slide, model, title, audience, theme, total: plan.slides.length, visual });
    else if (model.layout === "section") addSectionSlide({ pptx, slide, model, index, theme, visual });
    else if (model.layout === "statement") addStatementSlide({ pptx, slide, model, index, theme, visual });
    else if (model.layout === "two-column") addTwoColumnSlide({ pptx, slide, model, index, theme });
    else if (model.layout === "timeline") addTimelineSlide({ pptx, slide, model, index, theme });
    else if (model.layout === "process") addProcessSlide({ pptx, slide, model, index, theme });
    else if (model.layout === "metrics") addMetricsSlide({ pptx, slide, model, index, theme });
    else if (model.layout === "closing") addClosingSlide({ pptx, slide, model, index, theme, visual });
    else addEditorialSlide({ pptx, slide, model, index, theme, visual });

    if (logo) addPresentationLogo({ pptx, slide, logo, darkLayout, layout: model.layout, theme });

    if (slide.addNotes) {
      const notes = buildSpeakerNotes(model);
      if (notes) slide.addNotes(notes);
    }
  });

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer);
}

function addPresentationLogo({ pptx, slide, logo, darkLayout, layout, theme }: { pptx: any; slide: any; logo: string; darkLayout: boolean; layout: PresentationSlideLayout; theme: Theme }) {
  if (layout === "cover" && !darkLayout) return;

  const x = darkLayout ? 10.72 : 10.92;
  const y = darkLayout ? 0.48 : 0.34;
  const w = darkLayout ? 1.82 : 1.58;
  const h = darkLayout ? 0.78 : 0.66;
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: theme.dark, transparency: darkLayout ? 10 : 0 },
    line: { color: darkLayout ? theme.onDark : theme.dark, transparency: 82, width: 0.6 },
  });
  slide.addImage({
    data: logo,
    x: x + 0.13,
    y: y + 0.1,
    w: w - 0.26,
    h: h - 0.2,
  });
}

function addCoverSlide({ pptx, slide, model, title, audience, theme, total, visual }: any) {
  slide.background = { color: theme.dark };
  if (visual) {
    addFullBleedVisual(slide, visual);
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: theme.dark, transparency: 38 }, line: { transparency: 100 } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 7.75, h: 7.5, fill: { color: theme.dark, transparency: 5 }, line: { transparency: 100 } });
  } else {
    slide.addShape(pptx.ShapeType.rect, { x: 9.72, y: 0, w: 3.62, h: 7.5, fill: { color: theme.accent }, line: { transparency: 100 } });
  }
  slide.addShape(pptx.ShapeType.line, { x: 0.82, y: 0.72, w: 1.28, h: 0, line: { color: theme.accent, width: 5 } });
  slide.addText((model.kicker || audience || "PRESENTATION").toUpperCase(), {
    x: 0.84, y: 0.92, w: 6.9, h: 0.3, fontFace: "Aptos", fontSize: 11, bold: true,
    charSpacing: 2.4, color: theme.accent, margin: 0,
  });
  slide.addText(model.title || title, {
    x: 0.82, y: 1.62, w: 8.25, h: 2.32, fontFace: "Aptos Display", fontSize: 54,
    bold: true, color: theme.onDark, margin: 0, breakLine: false, fit: "shrink", valign: "mid",
  });
  if (model.subtitle) {
    slide.addText(model.subtitle, {
      x: 0.86, y: 4.28, w: 7.3, h: 0.88, fontFace: "Aptos", fontSize: 20,
      color: theme.onDark, transparency: 14, margin: 0, fit: "shrink", valign: "mid",
    });
  }
  if (!visual) {
    slide.addText(String((model.title || title).trim().charAt(0) || "H").toUpperCase(), {
      x: 9.76, y: 1.3, w: 3.3, h: 3.8, fontFace: "Aptos Display", fontSize: 190, bold: true,
      color: theme.onAccent, transparency: 78, align: "center", margin: 0, fit: "shrink",
    });
  }
  slide.addText(`${total} SLIDES`, {
    x: 10.15, y: 6.56, w: 2.8, h: 0.24, fontFace: "Aptos", fontSize: 9.5,
    bold: true, charSpacing: 1.4, color: theme.onAccent, align: "center", margin: 0,
  });
  slide.addText("Created with Heyy Studio", {
    x: 0.84, y: 6.92, w: 2.5, h: 0.18, fontFace: "Aptos", fontSize: 8,
    color: theme.onDark, transparency: 36, margin: 0,
  });
}

function addSectionSlide({ pptx, slide, model, index, theme, visual }: any) {
  slide.background = { color: theme.primary };
  if (visual) {
    addFullBleedVisual(slide, visual);
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: theme.dark, transparency: 24 }, line: { transparency: 100 } });
  }
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: 7.5, fill: { color: theme.accent }, line: { transparency: 100 } });
  slide.addText(String(index).padStart(2, "0"), {
    x: 0.84, y: 0.68, w: 1.25, h: 0.7, fontFace: "Aptos Display", fontSize: 35,
    bold: true, color: theme.accent, margin: 0,
  });
  slide.addText((model.kicker || "SECTION").toUpperCase(), {
    x: 2.26, y: 0.82, w: 5.8, h: 0.28, fontFace: "Aptos", fontSize: 10.5,
    bold: true, charSpacing: 2.2, color: theme.onDark, transparency: 30, margin: 0,
  });
  slide.addText(model.title, {
    x: 2.24, y: 1.72, w: 9.25, h: 2.4, fontFace: "Aptos Display", fontSize: 48,
    bold: true, color: theme.onDark, margin: 0, fit: "shrink", valign: "mid",
  });
  if (model.subtitle) {
    slide.addText(model.subtitle, {
      x: 2.28, y: 4.48, w: 7.8, h: 0.9, fontFace: "Aptos", fontSize: 20,
      color: theme.onDark, transparency: 12, margin: 0, fit: "shrink",
    });
  }
}

function addStatementSlide({ pptx, slide, model, index, theme, visual }: any) {
  slide.background = { color: theme.accent };
  if (visual) {
    addFullBleedVisual(slide, visual);
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: theme.dark, transparency: 30 }, line: { transparency: 100 } });
  }
  slide.addText((model.kicker || `IDEA ${String(index).padStart(2, "0")}`).toUpperCase(), {
    x: 0.86, y: 0.72, w: 5.0, h: 0.3, fontFace: "Aptos", fontSize: 10.5,
    bold: true, charSpacing: 2.2, color: theme.onAccent, transparency: 10, margin: 0,
  });
  slide.addText(model.title, {
    x: 0.84, y: 1.48, w: 11.25, h: 3.7, fontFace: "Aptos Display", fontSize: 50,
    bold: true, color: theme.onAccent, margin: 0, fit: "shrink", valign: "mid",
  });
  if (model.subtitle) {
    slide.addShape(pptx.ShapeType.line, { x: 0.88, y: 5.62, w: 1.0, h: 0, line: { color: theme.onAccent, width: 3 } });
    slide.addText(model.subtitle, {
      x: 2.12, y: 5.3, w: 8.2, h: 0.74, fontFace: "Aptos", fontSize: 18,
      color: theme.onAccent, transparency: 8, margin: 0, fit: "shrink", valign: "mid",
    });
  }
}

function addSlideHeader({ pptx, slide, model, index, theme }: any) {
  slide.addText((model.kicker || `CHAPTER ${String(index).padStart(2, "0")}`).toUpperCase(), {
    x: 0.7, y: 0.45, w: 4.8, h: 0.24, fontFace: "Aptos", fontSize: 9.5,
    bold: true, charSpacing: 1.8, color: theme.accent, margin: 0,
  });
  slide.addText(model.title, {
    x: 0.68, y: 0.82, w: 11.8, h: 0.78, fontFace: "Aptos Display", fontSize: 36,
    bold: true, color: theme.ink, margin: 0, fit: "shrink", valign: "mid",
  });
  if (model.subtitle) {
    slide.addText(model.subtitle, {
      x: 0.72, y: 1.64, w: 10.9, h: 0.48, fontFace: "Aptos", fontSize: 17,
      color: theme.muted, margin: 0, fit: "shrink",
    });
  }
}

function addEditorialSlide({ pptx, slide, model, index, theme, visual }: any) {
  addSlideHeader({ pptx, slide, model, index, theme });
  const items = model.items.slice(0, 4);
  if (visual) {
    const imageOnLeft = model.visualPosition === "left";
    const imageX = imageOnLeft ? 0.76 : 7.22;
    const copyX = imageOnLeft ? 6.7 : 0.76;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: imageX, y: 2.38, w: 5.35, h: 3.57,
      fill: { color: theme.soft },
      line: { color: theme.soft, width: 0.8 },
    });
    slide.addImage({ data: visual, x: imageX, y: 2.38, w: 5.35, h: 3.57 });

    const visualItems = items.slice(0, 3);
    if (!visualItems.length) {
      slide.addText(model.subtitle || model.title, {
        x: copyX, y: 2.56, w: 5.65, h: 2.35, fontFace: "Aptos Display", fontSize: 29,
        bold: true, color: theme.primary, margin: 0, fit: "shrink", valign: "mid",
      });
      return;
    }
    visualItems.forEach((item: PresentationSlideItem, itemIndex: number) => {
      const y = 2.42 + itemIndex * 1.2;
      slide.addText(String(itemIndex + 1).padStart(2, "0"), {
        x: copyX, y, w: 0.42, h: 0.24, fontFace: "Aptos", fontSize: 9.5,
        bold: true, color: itemIndex % 2 ? theme.primary : theme.accent, margin: 0,
      });
      slide.addText(item.title, {
        x: copyX + 0.56, y: y - 0.05, w: 5.0, h: 0.44, fontFace: "Aptos Display", fontSize: 21,
        bold: true, color: theme.ink, margin: 0, fit: "shrink",
      });
      if (item.body) {
        slide.addText(item.body, {
          x: copyX + 0.56, y: y + 0.42, w: 5.02, h: 0.58, fontFace: "Aptos", fontSize: 14.5,
          color: theme.muted, margin: 0, fit: "shrink", valign: "top",
        });
      }
    });
    return;
  }
  if (!items.length) {
    slide.addText(model.subtitle || model.title, {
      x: 0.82, y: 2.55, w: 10.8, h: 2.1, fontFace: "Aptos Display", fontSize: 30,
      bold: true, color: theme.primary, margin: 0, fit: "shrink", valign: "mid",
    });
    return;
  }
  const columns = items.length <= 2 ? items.length : 2;
  const rows = Math.ceil(items.length / columns);
  const cellW = columns === 1 ? 11.55 : 5.55;
  const cellH = rows === 1 ? 3.65 : 1.82;
  items.forEach((item: PresentationSlideItem, itemIndex: number) => {
    const column = itemIndex % columns;
    const row = Math.floor(itemIndex / columns);
    const x = 0.76 + column * 6.0;
    const y = 2.44 + row * 2.05;
    slide.addShape(pptx.ShapeType.line, { x, y, w: 0.78, h: 0, line: { color: itemIndex % 2 ? theme.primary : theme.accent, width: 4 } });
    if (item.label) {
      slide.addText(item.label.toUpperCase(), {
        x, y: y + 0.2, w: cellW, h: 0.24, fontFace: "Aptos", fontSize: 9.5,
        bold: true, charSpacing: 1.2, color: theme.muted, margin: 0,
      });
    }
    slide.addText(item.title, {
      x, y: y + 0.52, w: cellW, h: 0.52, fontFace: "Aptos Display", fontSize: 24,
      bold: true, color: theme.ink, margin: 0, fit: "shrink",
    });
    if (item.body) {
      slide.addText(item.body, {
        x, y: y + 1.08, w: cellW, h: Math.max(0.55, cellH - 1.12), fontFace: "Aptos", fontSize: 16,
        color: theme.muted, margin: 0, breakLine: false, fit: "shrink", valign: "top",
      });
    }
  });
}

function addTwoColumnSlide({ pptx, slide, model, index, theme }: any) {
  addSlideHeader({ pptx, slide, model, index, theme });
  const items = model.items.slice(0, 2);
  while (items.length < 2) items.push({ label: "", title: "", body: "", value: "" });
  items.forEach((item: PresentationSlideItem, itemIndex: number) => {
    const x = itemIndex === 0 ? 0.76 : 6.86;
    const color = itemIndex === 0 ? theme.primary : theme.accent;
    slide.addShape(pptx.ShapeType.rect, { x, y: 2.46, w: 5.7, h: 0.12, fill: { color }, line: { transparency: 100 } });
    slide.addText((item.label || `PERSPECTIVE ${itemIndex + 1}`).toUpperCase(), {
      x, y: 2.86, w: 5.45, h: 0.28, fontFace: "Aptos", fontSize: 10,
      bold: true, charSpacing: 1.5, color, margin: 0,
    });
    slide.addText(formatTwoColumnTitle(item.title), {
      x, y: 3.34, w: 5.35, h: 1.06, fontFace: "Aptos Display", fontSize: item.title.length > 28 ? 24 : 28,
      bold: true, color: theme.ink, margin: 0, fit: "shrink",
    });
    slide.addText(item.body, {
      x, y: 4.42, w: 5.2, h: 1.38, fontFace: "Aptos", fontSize: 17,
      color: theme.muted, margin: 0, fit: "shrink", valign: "top",
    });
  });
  slide.addShape(pptx.ShapeType.line, { x: 6.54, y: 2.55, w: 0, h: 3.72, line: { color: theme.soft, width: 1.1 } });
}

function formatTwoColumnTitle(value: string) {
  if (value.length <= 24 || !value.includes("-")) return value;
  const parts = value.split("-");
  const last = parts.pop();
  return last ? `${parts.join("-")}-\n${last}` : value;
}

function addTimelineSlide({ pptx, slide, model, index, theme }: any) {
  addSlideHeader({ pptx, slide, model, index, theme });
  const items = model.items.slice(0, 5);
  const count = Math.max(1, items.length);
  const startX = 0.9;
  const endX = 12.4;
  const step = count === 1 ? 0 : (endX - startX) / (count - 1);
  slide.addShape(pptx.ShapeType.line, { x: startX, y: 3.56, w: endX - startX, h: 0, line: { color: theme.soft, width: 2.3 } });
  items.forEach((item: PresentationSlideItem, itemIndex: number) => {
    const x = startX + itemIndex * step;
    const textW = Math.min(2.25, count === 1 ? 5.2 : (endX - startX) / count - 0.1);
    const textX = Math.max(0.72, Math.min(12.58 - textW, x - textW / 2));
    slide.addShape(pptx.ShapeType.ellipse, {
      x: x - 0.13, y: 3.43, w: 0.26, h: 0.26,
      fill: { color: itemIndex % 2 ? theme.primary : theme.accent }, line: { color: theme.background, width: 1.5 },
    });
    slide.addText((item.label || item.value || String(itemIndex + 1)).toUpperCase(), {
      x: textX, y: 2.7, w: textW, h: 0.3, fontFace: "Aptos", fontSize: 10,
      bold: true, charSpacing: 1.1, color: theme.accent, align: "center", margin: 0,
    });
    slide.addText(item.title, {
      x: textX, y: 3.92, w: textW, h: 0.68, fontFace: "Aptos Display", fontSize: count > 4 ? 18 : 21,
      bold: true, color: theme.ink, align: "center", margin: 0, fit: "shrink", valign: "mid",
    });
    if (item.body) {
      slide.addText(item.body, {
        x: textX, y: 4.74, w: textW, h: 1.1, fontFace: "Aptos", fontSize: 16,
        color: theme.muted, align: "center", margin: 0, fit: "shrink", valign: "top",
      });
    }
  });
}

function addProcessSlide({ pptx, slide, model, index, theme }: any) {
  addSlideHeader({ pptx, slide, model, index, theme });
  const items = model.items.slice(0, 5);
  const count = Math.max(1, items.length);
  const gap = 0.28;
  const totalW = 11.86;
  const itemW = (totalW - gap * (count - 1)) / count;
  items.forEach((item: PresentationSlideItem, itemIndex: number) => {
    const x = 0.72 + itemIndex * (itemW + gap);
    if (itemIndex < count - 1) {
      slide.addShape(pptx.ShapeType.line, { x: x + itemW - 0.08, y: 3.05, w: gap + 0.16, h: 0, line: { color: theme.soft, width: 2, beginArrowType: "none", endArrowType: "triangle" } });
    }
    slide.addText(String(itemIndex + 1).padStart(2, "0"), {
      x, y: 2.52, w: 0.72, h: 0.48, fontFace: "Aptos Display", fontSize: 25,
      bold: true, color: itemIndex % 2 ? theme.primary : theme.accent, margin: 0,
    });
    slide.addText(item.title, {
      x, y: 3.38, w: itemW - 0.06, h: 0.84, fontFace: "Aptos Display", fontSize: count > 4 ? 20 : 24,
      bold: true, color: theme.ink, margin: 0, fit: "shrink", valign: "mid",
    });
    slide.addText(item.body, {
      x, y: 4.42, w: itemW - 0.08, h: 1.38, fontFace: "Aptos", fontSize: 16,
      color: theme.muted, margin: 0, fit: "shrink", valign: "top",
    });
  });
}

function addMetricsSlide({ pptx, slide, model, index, theme }: any) {
  addSlideHeader({ pptx, slide, model, index, theme });
  const items = model.items.slice(0, 4);
  const count = Math.max(1, items.length);
  const itemW = 11.9 / count;
  items.forEach((item: PresentationSlideItem, itemIndex: number) => {
    const x = 0.72 + itemIndex * itemW;
    if (itemIndex) slide.addShape(pptx.ShapeType.line, { x: x - 0.15, y: 2.55, w: 0, h: 3.3, line: { color: theme.soft, width: 1.2 } });
    slide.addText(item.value || item.label, {
      x, y: 2.72, w: itemW - 0.3, h: 1.22, fontFace: "Aptos Display", fontSize: count > 3 ? 40 : 48,
      bold: true, color: itemIndex % 2 ? theme.primary : theme.accent, margin: 0, fit: "shrink", valign: "mid",
    });
    slide.addText(item.title, {
      x, y: 4.1, w: itemW - 0.34, h: 0.74, fontFace: "Aptos Display", fontSize: 24,
      bold: true, color: theme.ink, margin: 0, fit: "shrink",
    });
    slide.addText(item.body, {
      x, y: 5.0, w: itemW - 0.38, h: 0.82, fontFace: "Aptos", fontSize: 16,
      color: theme.muted, margin: 0, fit: "shrink", valign: "top",
    });
  });
}

function addClosingSlide({ pptx, slide, model, index, theme, visual }: any) {
  slide.background = { color: theme.dark };
  if (visual) {
    addFullBleedVisual(slide, visual);
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: theme.dark, transparency: 30 }, line: { transparency: 100 } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 8.8, h: 7.5, fill: { color: theme.dark, transparency: 8 }, line: { transparency: 100 } });
  }
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.16, fill: { color: theme.accent }, line: { transparency: 100 } });
  slide.addText((model.kicker || "THE TAKEAWAY").toUpperCase(), {
    x: 0.84, y: 0.74, w: 5.0, h: 0.28, fontFace: "Aptos", fontSize: 10.5,
    bold: true, charSpacing: 2.0, color: theme.accent, margin: 0,
  });
  slide.addText(model.title, {
    x: 0.82, y: 1.46, w: 10.8, h: 2.15, fontFace: "Aptos Display", fontSize: 48,
    bold: true, color: theme.onDark, margin: 0, fit: "shrink", valign: "mid",
  });
  if (model.subtitle) {
    slide.addText(model.subtitle, {
      x: 0.86, y: 3.86, w: 9.4, h: 0.72, fontFace: "Aptos", fontSize: 19,
      color: theme.onDark, transparency: 14, margin: 0, fit: "shrink",
    });
  }
  const items = model.items.slice(0, 3);
  items.forEach((item: PresentationSlideItem, itemIndex: number) => {
    const x = 0.84 + itemIndex * 4.08;
    slide.addText(String(itemIndex + 1).padStart(2, "0"), {
      x, y: 5.12, w: 0.54, h: 0.32, fontFace: "Aptos", fontSize: 11,
      bold: true, color: theme.accent, margin: 0,
    });
    slide.addText(item.title || item.body, {
      x: x + 0.64, y: 5.04, w: 3.12, h: 0.9, fontFace: "Aptos Display", fontSize: 20,
      bold: true, color: theme.onDark, margin: 0, fit: "shrink", valign: "mid",
    });
  });
  slide.addText(`Created with Heyy Studio · ${String(index + 1).padStart(2, "0")}`, {
    x: 0.84, y: 6.94, w: 3.8, h: 0.18, fontFace: "Aptos", fontSize: 8,
    color: theme.onDark, transparency: 38, margin: 0,
  });
}
