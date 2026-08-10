import "server-only";
import { NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError, withCreditReservation } from "@/lib/credits/server";
import { storeGeneratedAsset } from "@/lib/assets-server";

export const runtime = "nodejs";
export const maxDuration = 180;

type SlideLayout = "title" | "section" | "content" | "two-column" | "statement" | "closing";
type SlideModel = {
  title: string;
  subtitle?: string;
  bullets?: string[];
  highlight?: string;
  speakerNotes?: string;
  layout?: SlideLayout;
};

function extractOutputText(data: any): string | null {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  for (const output of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(output?.content) ? output.content : []) {
      if (typeof content?.text === "string" && content.text.trim()) return content.text.trim();
    }
  }
  return null;
}

function parseJson(text: string | null) {
  if (!text) throw new Error("AI returned no presentation outline.");
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Presentation outline could not be read.");
    return JSON.parse(match[0]);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const body = await request.json();
    const title = String(body?.title || "").trim();
    const objective = String(body?.objective || "").trim();
    const source = String(body?.source || "").trim();
    const audience = String(body?.audience || "General audience").trim();
    const tone = String(body?.tone || "Premium and concise").trim();
    const slideCount = Math.max(5, Math.min(20, Number(body?.slideCount) || 10));
    const mode = body?.mode === "draft" ? "draft" : "full";

    if (!title || !objective || source.length < 30) {
      return NextResponse.json({ error: "Title, objective and source content are required." }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is missing." }, { status: 503 });
    }

    const model = mode === "draft"
      ? process.env.PRESENTATION_TEXT_MODEL_DRAFT || process.env.PRESENTATION_TEXT_MODEL || "gpt-5.6-luna"
      : process.env.PRESENTATION_TEXT_MODEL_FULL || process.env.PRESENTATION_TEXT_MODEL || "gpt-5.6-terra";

    const { result, reservation } = await withCreditReservation({
      admin: auth.admin,
      userId: auth.user.id,
      action: mode === "full" ? "powerpointFull" : "powerpointDraft",
      metadata: { tool: "powerpoint_generator", title, slide_count: slideCount, mode, model },
      work: async (creditReservation) => {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            reasoning: { effort: mode === "full" ? "medium" : "low" },
            safety_identifier: `heyy-user-${auth.user.id}`,
            input: buildPresentationPrompt({ title, objective, source, audience, tone, slideCount, mode }),
            max_output_tokens: 9000,
            text: { format: { type: "json_object" } },
          }),
        });
        const provider = await response.json();
        if (!response.ok) {
          throw new Error(provider?.error?.message || "AI could not structure the presentation.");
        }

        const parsed = parseJson(extractOutputText(provider));
        const slides = (Array.isArray(parsed?.slides) ? parsed.slides : [])
          .slice(0, slideCount)
          .map(normalizeSlide);
        if (slides.length < 3) throw new Error("The presentation outline was incomplete.");

        const buffer = await buildPptx({ title, audience, objective, tone, slides });
        const asset = await storeGeneratedAsset({
          admin: auth.admin,
          userId: auth.user.id,
          studio: "ai_tools",
          assetType: "powerpoint",
          title,
          buffer,
          extension: "pptx",
          contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          payload: { title, audience, objective, tone, mode, slides },
          metadata: {
            provider: "openai",
            model: provider?.model || model,
            credit_reservation_id: creditReservation.id,
          },
        });

        return { fileUrl: asset.file_url, asset, slides, model: provider?.model || model };
      },
    });

    return NextResponse.json({ success: true, ...result, creditsUsed: reservation.amount });
  } catch (error) {
    console.error("PowerPoint generation error:", error);
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CreditError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Presentation generation failed." },
      { status: 500 },
    );
  }
}

function buildPresentationPrompt({
  title,
  objective,
  source,
  audience,
  tone,
  slideCount,
  mode,
}: {
  title: string;
  objective: string;
  source: string;
  audience: string;
  tone: string;
  slideCount: number;
  mode: "draft" | "full";
}) {
  return `You are Heyy Studio's senior presentation strategist and information designer.

Create a ${slideCount}-slide ${mode === "full" ? "professional" : "draft"} presentation.

PRESENTATION
Title: ${title}
Audience: ${audience}
Objective: ${objective}
Tone: ${tone}

SOURCE MATERIAL
${source}

RULES
- Build a clear narrative with a beginning, development and decisive ending.
- Preserve the meaning of the supplied source. Do not invent statistics, clients, quotations, dates, evidence, product capabilities or financial claims.
- If the source does not support a claim, omit it rather than filling the gap.
- Avoid repeating the same point on multiple slides.
- Use short, strong slide titles.
- Bullets must be concise and presentation-ready, not paragraphs.
- Use a statement slide when one supported idea deserves emphasis.
- Use two-column only when the content genuinely contains two comparable groups.
- First slide must use layout "title". Last slide must use layout "closing".
- For section breaks, use layout "section" and very little text.
- Provide an optional "highlight" only when the source contains a short, factual phrase or number worth emphasizing.
- Speaker notes can add useful context but must stay grounded in the source.

Return ONLY this JSON structure:
{
  "slides": [
    {
      "title": "...",
      "subtitle": "optional",
      "bullets": ["0-5 concise bullets"],
      "highlight": "optional short supported phrase or number",
      "speakerNotes": "optional",
      "layout": "title|section|content|two-column|statement|closing"
    }
  ]
}`;
}

function normalizeSlide(value: any, index: number): SlideModel {
  const allowedLayouts: SlideLayout[] = ["title", "section", "content", "two-column", "statement", "closing"];
  return {
    title: String(value?.title || `Slide ${index + 1}`).slice(0, 120),
    subtitle: value?.subtitle ? String(value.subtitle).slice(0, 180) : undefined,
    bullets: Array.isArray(value?.bullets)
      ? value.bullets.filter((item: unknown) => typeof item === "string").map((item: string) => item.slice(0, 220)).slice(0, 6)
      : [],
    highlight: value?.highlight ? String(value.highlight).slice(0, 120) : undefined,
    speakerNotes: value?.speakerNotes ? String(value.speakerNotes).slice(0, 1800) : undefined,
    layout: allowedLayouts.includes(value?.layout) ? value.layout : index === 0 ? "title" : "content",
  };
}

async function buildPptx({
  title,
  audience,
  objective,
  tone,
  slides,
}: {
  title: string;
  audience: string;
  objective: string;
  tone: string;
  slides: SlideModel[];
}) {
  const pptx: any = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Heyy Studio";
  pptx.company = "Heyy Studio";
  pptx.subject = objective;
  pptx.title = title;
  pptx.lang = "en-US";
  pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };

  slides.forEach((model, index) => {
    const slide = pptx.addSlide();
    const isCover = index === 0 || model.layout === "title";
    const isClosing = index === slides.length - 1 || model.layout === "closing";
    const isSection = model.layout === "section";
    const isStatement = model.layout === "statement";

    if (isCover || isClosing || isSection || isStatement) {
      addHeroSlide({ pptx, slide, model, index, slides, audience, objective, tone, isCover, isClosing, isSection });
    } else {
      addContentSlide({ pptx, slide, model, index, slides });
    }

    if (model.speakerNotes && slide.addNotes) slide.addNotes(model.speakerNotes);
  });

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer);
}

function addHeroSlide({
  pptx,
  slide,
  model,
  index,
  slides,
  audience,
  objective,
  tone,
  isCover,
  isClosing,
  isSection,
}: any) {
  slide.background = { color: "170D24" };
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 8.2,
    y: -2.0,
    w: 6.8,
    h: 6.8,
    fill: { color: "6F2DFF", transparency: 10 },
    line: { transparency: 100 },
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 9.6,
    y: 3.0,
    w: 4.8,
    h: 4.8,
    fill: { color: "EF3FB4", transparency: 20 },
    line: { transparency: 100 },
  });
  slide.addText("HEYY STUDIO", {
    x: 0.72,
    y: 0.45,
    w: 2.5,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 10,
    bold: true,
    charSpacing: 3,
    color: "C7A8FF",
    margin: 0,
  });

  if (!isCover) {
    slide.addText(String(index).padStart(2, "0"), {
      x: 0.74,
      y: 1.58,
      w: 0.7,
      h: 0.3,
      fontFace: "Aptos",
      fontSize: 11,
      bold: true,
      color: "9F77FF",
      margin: 0,
    });
  }

  slide.addText(model.title, {
    x: 0.74,
    y: isCover ? 1.95 : isSection ? 2.2 : 2.0,
    w: isCover ? 8.4 : 8.9,
    h: isCover ? 1.7 : 1.55,
    fontFace: "Aptos Display",
    fontSize: isCover ? 42 : isSection ? 38 : 36,
    bold: true,
    color: "FFFFFF",
    fit: "shrink",
    margin: 0,
    valign: "mid",
  });

  const supporting = model.subtitle || (isCover ? `${audience} · ${tone}` : model.highlight || "");
  if (supporting) {
    slide.addText(supporting, {
      x: 0.78,
      y: isCover ? 3.78 : 3.72,
      w: 7.8,
      h: 0.72,
      fontFace: "Aptos",
      fontSize: isSection ? 17 : 15,
      color: "D9CBEA",
      margin: 0,
      fit: "shrink",
    });
  }

  if (model.highlight && model.subtitle) {
    slide.addText(model.highlight, {
      x: 0.78,
      y: 4.58,
      w: 7.5,
      h: 0.78,
      fontFace: "Aptos Display",
      fontSize: 23,
      bold: true,
      color: "EF9AD3",
      margin: 0,
      fit: "shrink",
    });
  }

  if (isCover) {
    slide.addText(objective, {
      x: 0.78,
      y: 5.72,
      w: 7.5,
      h: 0.62,
      fontFace: "Aptos",
      fontSize: 11,
      color: "BFAED1",
      margin: 0,
      fit: "shrink",
    });
  } else if (!isSection && model.bullets?.length) {
    slide.addText(model.bullets.slice(0, 3).map((item: string) => `• ${item}`).join("\n"), {
      x: 0.8,
      y: 5.2,
      w: 7.4,
      h: 1.15,
      fontFace: "Aptos",
      fontSize: 11,
      color: "D9CBEA",
      breakLine: false,
      margin: 0,
      fit: "shrink",
    });
  }

  if (!isCover) {
    slide.addText(`${index + 1} / ${slides.length}`, {
      x: 11.7,
      y: 7.02,
      w: 0.8,
      h: 0.2,
      fontFace: "Aptos",
      fontSize: 7,
      color: "A99ABB",
      align: "right",
      margin: 0,
    });
  }
  if (isClosing) {
    slide.addText("Create with AI. Build with Experts.", {
      x: 0.78,
      y: 6.82,
      w: 3.7,
      h: 0.2,
      fontFace: "Aptos",
      fontSize: 7,
      bold: true,
      charSpacing: 1.2,
      color: "A99ABB",
      margin: 0,
    });
  }
}

function addContentSlide({ pptx, slide, model, index, slides }: any) {
  slide.background = { color: "F8F7FB" };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.11,
    h: 7.5,
    fill: { color: index % 3 === 0 ? "EF3FB4" : "6F2DFF" },
    line: { transparency: 100 },
  });
  slide.addText(String(index).padStart(2, "0"), {
    x: 0.72,
    y: 0.55,
    w: 0.65,
    h: 0.35,
    fontFace: "Aptos",
    fontSize: 14,
    bold: true,
    color: "6F2DFF",
    margin: 0,
  });
  slide.addText(model.title, {
    x: 1.45,
    y: 0.48,
    w: 10.7,
    h: 0.68,
    fontFace: "Aptos Display",
    fontSize: 27,
    bold: true,
    color: "17131F",
    margin: 0,
    fit: "shrink",
  });
  if (model.subtitle) {
    slide.addText(model.subtitle, {
      x: 1.47,
      y: 1.2,
      w: 10.4,
      h: 0.42,
      fontFace: "Aptos",
      fontSize: 11,
      color: "6B6475",
      margin: 0,
      fit: "shrink",
    });
  }
  slide.addShape(pptx.ShapeType.line, {
    x: 0.72,
    y: 1.77,
    w: 11.9,
    h: 0,
    line: { color: "DED6E8", width: 1 },
  });

  const bullets = model.bullets || [];
  if (model.highlight) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 8.92,
      y: 2.18,
      w: 3.55,
      h: 1.42,
      fill: { color: "EEE8FF" },
      line: { color: "D8C9FF", width: 1 },
    });
    slide.addText(model.highlight, {
      x: 9.18,
      y: 2.45,
      w: 3.0,
      h: 0.9,
      fontFace: "Aptos Display",
      fontSize: 21,
      bold: true,
      color: "5C22DE",
      margin: 0,
      align: "center",
      valign: "mid",
      fit: "shrink",
    });
  }

  if (model.layout === "two-column" && bullets.length > 2) {
    const mid = Math.ceil(bullets.length / 2);
    addBulletColumn(slide, bullets.slice(0, mid), 0.8, 2.2, 5.75);
    addBulletColumn(slide, bullets.slice(mid), 6.75, 2.2, 5.75);
  } else {
    addBulletColumn(slide, bullets, 0.95, 2.12, model.highlight ? 7.45 : 11.1);
  }

  slide.addText("Create with AI. Build with Experts.", {
    x: 0.75,
    y: 7.05,
    w: 3.5,
    h: 0.18,
    fontFace: "Aptos",
    fontSize: 6.5,
    bold: true,
    charSpacing: 1.2,
    color: "8A8294",
    margin: 0,
  });
  slide.addText(`${index + 1} / ${slides.length}`, {
    x: 11.7,
    y: 7.02,
    w: 0.8,
    h: 0.2,
    fontFace: "Aptos",
    fontSize: 7,
    color: "8A8294",
    align: "right",
    margin: 0,
  });
}

function addBulletColumn(slide: any, bullets: string[], x: number, y: number, w: number) {
  bullets.slice(0, 6).forEach((bullet, index) => {
    const itemY = y + index * 0.78;
    slide.addShape("ellipse", {
      x,
      y: itemY + 0.13,
      w: 0.18,
      h: 0.18,
      fill: { color: index % 2 === 0 ? "6F2DFF" : "EF3FB4" },
      line: { transparency: 100 },
    });
    slide.addText(bullet, {
      x: x + 0.38,
      y: itemY,
      w: w - 0.38,
      h: 0.57,
      fontFace: "Aptos",
      fontSize: 15,
      color: "3E3847",
      margin: 0,
      fit: "shrink",
      valign: "mid",
    });
  });
}
