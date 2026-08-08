import "server-only";

import { NextResponse } from "next/server";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { toFile } from "openai";
import { getOpenAI } from "@/lib/ai/openai-server";
import {
  requireBrandImageProject,
  storeGeneratedBrandImage,
} from "@/lib/brand/generated-image-storage";
import { CreditError, withCreditReservation } from "@/lib/credits/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type OpenAiSize = "1024x1024" | "1536x1024" | "1024x1536";


type BrandApplicationImageProvider = "openai" | "gemini";
type GeminiAspectRatio = "1:1" | "3:2" | "2:3";
type GeminiImageSize = "1K" | "2K" | "4K";

function getBrandApplicationImageProvider(): BrandApplicationImageProvider {
  return process.env.BRAND_APPLICATION_IMAGE_PROVIDER?.toLowerCase() === "gemini"
    ? "gemini"
    : "openai";
}

function getGeminiAspectRatio(size: OpenAiSize): GeminiAspectRatio {
  if (size === "1536x1024") return "3:2";
  if (size === "1024x1536") return "2:3";
  return "1:1";
}

function getGeminiImageSize(): GeminiImageSize {
  const configured = process.env.GEMINI_IMAGE_SIZE?.toUpperCase();
  return configured === "1K" || configured === "4K" ? configured : "2K";
}

type GeneratedOutput = {
  id: string;
  label: string;
  filename: string;
  imageUrl: string;
  storagePath: string;
  width: number;
  height: number;
  format: "webp";
};

type VisualProfile = {
  width: number;
  height: number;
  aiSize: OpenAiSize;
  label: string;
};

const APPLICATION_SCENE_SPECS: Record<string, VisualProfile> = {
  signage: {
    width: 1920,
    height: 1080,
    aiSize: "1536x1024",
    label: "Signage Mockup — 1920 × 1080",
  },
  merchandise: {
    width: 1600,
    height: 1200,
    aiSize: "1536x1024",
    label: "Merchandise Mockup — 1600 × 1200",
  },
  packaging: {
    width: 1600,
    height: 1600,
    aiSize: "1024x1024",
    label: "Packaging Mockup — 1600 × 1600",
  },
  website: {
    width: 1600,
    height: 1000,
    aiSize: "1536x1024",
    label: "Website Mockup — 1600 × 1000",
  },
  presentation: {
    width: 1600,
    height: 1000,
    aiSize: "1536x1024",
    label: "Presentation Mockup — 1600 × 1000",
  },
};

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function xml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeFilename(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "brand-application"
  );
}

function compactBrandContext(brand: Record<string, unknown>) {
  return {
    summary: brand?.summary || null,
    foundation: brand?.foundation || null,
    brandStrategy: brand?.brandStrategy || null,
    brandVoice: brand?.brandVoice || null,
    personality: brand?.personality || null,
    colourPalette: brand?.colourPalette || null,
    typography: brand?.typography || null,
  };
}

function splitList(value: unknown) {
  return safeText(value)
    .split(/\r?\n|\s*[|•,;]\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectHexColours(value: unknown, result: string[] = []) {
  if (result.length >= 6) return result;
  if (typeof value === "string") {
    const matches = value.match(/#[0-9a-fA-F]{6}\b/g) || [];
    for (const colour of matches) {
      if (!result.includes(colour)) result.push(colour);
      if (result.length >= 6) break;
    }
  } else if (Array.isArray(value)) {
    for (const item of value) collectHexColours(item, result);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectHexColours(item, result);
    }
  }
  return result;
}

function wrapText(value: string, maxChars: number, maxLines = 3) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    } else {
      current = candidate;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);
  const usedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (usedWords < words.length && lines.length) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].replace(/[.,;:!?-]+$/, "")}…`;
  }
  return lines.slice(0, maxLines);
}

function shortCopy(value: string, maxLength = 92) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const clipped = clean.slice(0, maxLength + 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, Math.max(1, lastSpace)).replace(/[.,;:!?-]+$/, "")}…`;
}

function svgMultilineText({
  x,
  y,
  lines,
  lineHeight,
}: {
  x: number;
  y: number;
  lines: string[];
  lineHeight: number;
}) {
  return lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${xml(line)}</tspan>`,
    )
    .join("");
}

async function fetchReferenceBuffer(url: string): Promise<Buffer | null> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function removeWhiteBackground(logoBuffer: Buffer) {
  const { data, info } = await sharp(logoBuffer)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let offset = 0; offset < data.length; offset += info.channels) {
    const alphaIndex = offset + 3;
    const r = data[offset] || 0;
    const g = data[offset + 1] || 0;
    const b = data[offset + 2] || 0;
    const whiteness = Math.min(r, g, b);
    if (whiteness > 238) {
      const fade = Math.max(0, Math.min(1, (255 - whiteness) / 17));
      data[alphaIndex] = Math.round((data[alphaIndex] ?? 255) * fade);
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}


async function transparentLogo(
  logoBuffer: Buffer,
  width: number,
  height: number,
) {
  const transparent = await removeWhiteBackground(logoBuffer);
  return sharp(transparent)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width, height, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}
async function monochromeLogo(
  logoBuffer: Buffer,
  colour: "white" | "dark",
  width: number,
  height: number,
) {
  const transparent = await removeWhiteBackground(logoBuffer);
  const { data, info } = await sharp(transparent)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgb = colour === "white" ? [255, 255, 255] : [8, 18, 38];

  for (let offset = 0; offset < data.length; offset += info.channels) {
    if ((data[offset + 3] ?? 255) < 10) continue;
    data[offset] = rgb[0];
    data[offset + 1] = rgb[1];
    data[offset + 2] = rgb[2];
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width, height, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function prepareDirectionReference(
  directionBuffer: Buffer,
  preserveDetail = false,
) {
  const reference = sharp(directionBuffer)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true });

  return (preserveDetail
    ? reference
    : reference.blur(4.8).modulate({ saturation: 1.04, brightness: 1.02 }))
    .png()
    .toBuffer();
}

async function prepareLogoReference(logoBuffer: Buffer) {
  return sharp(logoBuffer)
    .rotate()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function directionFile(
  directionBuffer: Buffer,
  preserveDetail = false,
) {
  const visualReference = await prepareDirectionReference(
    directionBuffer,
    preserveDetail,
  );
  return toFile(
    visualReference,
    "selected-creative-direction-visual-reference.png",
    { type: "image/png" },
  );
}

async function logoFile(logoBuffer: Buffer) {
  const visualReference = await prepareLogoReference(logoBuffer);
  return toFile(
    visualReference,
    "approved-brand-logo-reference.png",
    { type: "image/png" },
  );
}

async function generateGeminiArtwork(args: {
  directionBuffer: Buffer | null;
  logoBuffer: Buffer | null;
  size: OpenAiSize;
  prompt: string;
  preserveDirectionDetail?: boolean;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini is selected for Brand Studio applications, but GEMINI_API_KEY is missing.",
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (args.directionBuffer) {
    const visualReference = await prepareDirectionReference(
      args.directionBuffer,
      args.preserveDirectionDetail,
    );
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: visualReference.toString("base64"),
      },
    });
  }

  if (args.logoBuffer) {
    const approvedLogoReference = await prepareLogoReference(args.logoBuffer);
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: approvedLogoReference.toString("base64"),
      },
    });
  }

  parts.push({ text: args.prompt });

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image",
    contents: [{ role: "user", parts }] as any,
    config: {
      responseModalities: ["IMAGE"],
      responseFormat: {
        image: {
          aspectRatio: getGeminiAspectRatio(args.size),
          imageSize: getGeminiImageSize(),
        },
      },
    } as any,
  });

  const responseParts = response.candidates?.[0]?.content?.parts || [];
  for (const part of responseParts) {
    const inlineData = (part as {
      inlineData?: { data?: string; mimeType?: string };
    }).inlineData;
    if (inlineData?.data) {
      return {
        buffer: Buffer.from(inlineData.data, "base64"),
        usage: response.usageMetadata || null,
      };
    }
  }

  throw new Error(
    "Gemini returned no application artwork. Check the Gemini model access and billing for this API key.",
  );
}

async function generateArtwork(args: {
  openai: ReturnType<typeof getOpenAI> | null;
  directionBuffer: Buffer | null;
  logoBuffer: Buffer | null;
  size: OpenAiSize;
  prompt: string;
  preserveDirectionDetail?: boolean;
}) {
  if (getBrandApplicationImageProvider() === "gemini") {
    return generateGeminiArtwork({
      directionBuffer: args.directionBuffer,
      logoBuffer: args.logoBuffer,
      size: args.size,
      prompt: args.prompt,
      preserveDirectionDetail: args.preserveDirectionDetail,
    });
  }

  if (!args.openai) {
    throw new Error("OpenAI is selected but the OpenAI image client is unavailable.");
  }

  const editImages: any[] = [];
  if (args.directionBuffer) {
    editImages.push(
      await directionFile(args.directionBuffer, args.preserveDirectionDetail),
    );
  }
  if (args.logoBuffer) editImages.push(await logoFile(args.logoBuffer));

  const generated = editImages.length
    ? await args.openai.images.edit({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        image: editImages.length === 1 ? editImages[0] : editImages,
        prompt: args.prompt,
        size: args.size,
        quality: "medium",
        output_format: "png",
      })
    : await args.openai.images.generate({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        prompt: args.prompt,
        size: args.size,
        quality: "medium",
        output_format: "png",
      });

  const base64 = generated.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI returned no application artwork.");
  return { buffer: Buffer.from(base64, "base64"), usage: generated.usage || null };
}

function summariseDirection(direction: any) {
  if (!direction || typeof direction !== "object") return "No visual direction summary provided.";
  const parts = [
    safeText(direction?.title),
    safeText(direction?.conceptName),
    safeText(direction?.style),
    safeText(direction?.mood),
    safeText(direction?.vibe),
    safeText(direction?.description),
  ].filter(Boolean);
  return shortCopy(parts.join(" · "), 220) || "Use the selected visual direction as the style reference.";
}

function summariseBrandSystem(brand: any) {
  const colours = collectHexColours(brand).slice(0, 6).join(", ");
  const parts = [
    safeText(brand?.summary),
    safeText(brand?.brandStrategy),
    safeText(brand?.brandVoice),
    safeText(brand?.personality),
    colours ? `Key colours: ${colours}` : "",
  ].filter(Boolean);
  return shortCopy(parts.join(" · "), 260) || "Keep the overall brand feeling premium, clear and on-brand.";
}

function baseArtworkPrompt(args: {
  project: any;
  brand: any;
  selectedDirection: any;
  applicationLabel: string;
  extra: string;
}) {
  return `
Create one polished ${args.applicationLabel} concept.

Reference handling:
- Image A is the selected creative-direction reference. Use it only for colour palette, image treatment, composition language, texture, shapes and mood.
- Image B is the approved logo reference. Use it only to understand the brand identity and proportions. Do not copy, redraw or distort the logo inside the artwork unless the instructions explicitly say a logo area will later be composited.

Project context:
- Brand: ${safeText(args.project?.project_name, "Brand Project")}
- Industry: ${safeText(args.project?.industry, "Not provided")}
- Audience: ${safeText(args.project?.audience, "Not provided")}
- Preferred style: ${safeText(args.project?.style, "Not provided")}
- Brand system summary: ${summariseBrandSystem(args.brand)}
- Direction summary: ${summariseDirection(args.selectedDirection)}

Application brief:
${args.extra}

Mandatory rules:
- Design the requested application itself, not a generic artwork panel and not a written brief sheet.
- The result must clearly read as the requested application at first glance.
- Keep the composition premium, believable, clean and client-ready.
- Never place raw brief text, prompt wording, instructions, JSON, UI copy, step labels, page counters, captions or internal notes inside the design.
- Do not copy readable text from the creative-direction reference.
- Avoid placeholder lorem ipsum, fake contact blocks, fake slogans and random numbers unless those exact details are intentionally being composited later.
- Respect production logic, hierarchy and spacing for the application type.
`;
}

async function storeOutput(
  storageContext: Awaited<ReturnType<typeof requireBrandImageProject>>,
  args: {
    buffer: Buffer;
    applicationId: string;
    outputId: string;
    label: string;
    width: number;
    height: number;
    projectName: string;
  },
): Promise<GeneratedOutput> {
  const webp = await sharp(args.buffer)
    .resize(args.width, args.height, { fit: "cover", position: "centre" })
    .webp({ quality: 90, effort: 5 })
    .toBuffer();
  const stored = await storeGeneratedBrandImage(storageContext, {
    buffer: webp,
    kind: `application-${args.applicationId}-${args.outputId}`,
    tier: "preview",
  });
  return {
    id: args.outputId,
    label: args.label,
    filename: `${safeFilename(args.projectName)}-${safeFilename(args.applicationId)}-${safeFilename(args.outputId)}.webp`,
    imageUrl: stored.imageUrl,
    storagePath: stored.storagePath,
    width: args.width,
    height: args.height,
    format: "webp",
  };
}

async function buildEmailSignature(args: {
  artwork: Buffer;
  logoBuffer: Buffer;
  project: any;
  brief: any;
  colours: string[];
}) {
  const width = 1200;
  const height = 400;
  const artWidth = 520;
  const art = await sharp(args.artwork)
    .resize(artWidth, height, { fit: "cover", position: "centre" })
    .modulate({ saturation: 1.16, brightness: 1.12 })
    .png()
    .toBuffer();
  const logo = await monochromeLogo(args.logoBuffer, "white", 190, 125);
  const logoMeta = await sharp(logo).metadata();
  const logoWidth = logoMeta.width || 190;
  const logoHeight = logoMeta.height || 125;

  const name = safeText(args.brief?.name, safeText(args.project?.project_name, "Name"));
  const jobTitle = safeText(args.brief?.jobTitle, "");
  const contacts = splitList(args.brief?.contact).slice(0, 3);
  const social = splitList(args.brief?.social).slice(0, 3);
  const accent = args.colours[0] || "#8b5cf6";
  const accentTwo = args.colours[1] || "#38bdf8";

  const contactText = contacts.length ? contacts.join("   •   ") : "";
  const socialText = social.length ? social.join("   •   ") : "";
  const detailsSvg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="base" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#07142b"/>
          <stop offset="0.62" stop-color="#091936"/>
          <stop offset="1" stop-color="#091936" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${xml(accent)}"/>
          <stop offset="1" stop-color="${xml(accentTwo)}"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="28" fill="#07142b"/>
      <rect width="780" height="${height}" rx="28" fill="url(#base)"/>
      <rect x="250" y="72" width="3" height="256" rx="2" fill="url(#accent)"/>
      <text x="292" y="105" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="37" font-weight="700">${xml(name)}</text>
      ${jobTitle ? `<text x="292" y="143" fill="${xml(accent)}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">${xml(jobTitle)}</text>` : ""}
      ${contactText ? `<text x="292" y="198" fill="#dbe7ff" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="500">${xml(contactText)}</text>` : ""}
      ${socialText ? `<text x="292" y="244" fill="#a9b8d5" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600">${xml(socialText)}</text>` : ""}
      <rect x="292" y="286" width="300" height="4" rx="2" fill="url(#accent)"/>
    </svg>
  `);

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 7, g: 20, b: 43, alpha: 1 },
    },
  })
    .composite([
      { input: art, left: width - artWidth, top: 0 },
      { input: detailsSvg, left: 0, top: 0 },
      {
        input: logo,
        left: 30 + Math.max(0, Math.round((190 - logoWidth) / 2)),
        top: Math.max(20, Math.round((height - logoHeight) / 2)),
      },
    ])
    .png()
    .toBuffer();
}

async function buildSocialAsset(args: {
  artwork: Buffer;
  logoBuffer: Buffer;
  width: number;
  height: number;
  title: string;
  subtitle: string;
  colours: string[];
}) {
  const width = args.width;
  const height = args.height;
  const art = await sharp(args.artwork)
    .resize(width, height, { fit: "cover", position: "centre" })
    .modulate({ saturation: 1.05 })
    .png()
    .toBuffer();
  const logoWidth = Math.round(width * 0.19);
  const logoHeight = Math.round(height * 0.09);
  const logo = await transparentLogo(args.logoBuffer, logoWidth, logoHeight);
  const margin = Math.round(width * 0.065);
  const hasTitle = Boolean(args.title.trim());
  const hasSubtitle = Boolean(args.subtitle.trim());
  const portrait = height / width > 1.35;
  const titleSize = Math.round(width * (portrait ? 0.068 : 0.058));
  const subtitleSize = Math.max(20, Math.round(titleSize * 0.36));
  const availableWidth = width - margin * 2;
  const titleMaxChars = Math.max(12, Math.floor(availableWidth / (titleSize * 0.61)));
  const subtitleMaxChars = Math.max(18, Math.floor(availableWidth / (subtitleSize * 0.58)));
  const titleLines = hasTitle ? wrapText(args.title, titleMaxChars, portrait ? 3 : 2) : [];
  const subtitleLines = hasSubtitle
    ? wrapText(shortCopy(args.subtitle, portrait ? 120 : 96), subtitleMaxChars, portrait ? 3 : 2)
    : [];
  const accent = args.colours[0] || "#8b5cf6";
  const accentTwo = args.colours[1] || "#38bdf8";
  const titleLineSpacing = Math.round(titleSize * 1.06);
  const subtitleLineSpacing = Math.round(subtitleSize * 1.35);
  const copyHeight =
    (titleLines.length ? titleSize + Math.max(0, titleLines.length - 1) * titleLineSpacing : 0) +
    (subtitleLines.length ? Math.round(subtitleSize * 1.35) + subtitleLines.length * subtitleLineSpacing : 0);
  const safeBottom = height - Math.round(margin * 1.35);
  const preferredTitleY = Math.round(height * (portrait ? 0.67 : 0.65));
  const titleY = Math.min(preferredTitleY, safeBottom - copyHeight);
  const subtitleY = titleY + Math.max(1, titleLines.length) * titleLineSpacing + Math.round(subtitleSize * 1.15);
  const titleTspans = svgMultilineText({ x: margin, y: titleY, lines: titleLines, lineHeight: titleLineSpacing });
  const subtitleTspans = svgMultilineText({ x: margin, y: subtitleY, lines: subtitleLines, lineHeight: subtitleLineSpacing });

  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#041027" stop-opacity="0.02"/>
          <stop offset="0.60" stop-color="#041027" stop-opacity="0.08"/>
          <stop offset="1" stop-color="#041027" stop-opacity="${hasTitle || hasSubtitle ? '0.86' : '0.30'}"/>
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${xml(accent)}"/>
          <stop offset="1" stop-color="${xml(accentTwo)}"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shade)"/>
      ${hasTitle || hasSubtitle ? `<rect x="${margin}" y="${Math.round(height * 0.09)}" width="${Math.round(width * 0.12)}" height="${Math.max(5, Math.round(width * 0.008))}" rx="4" fill="url(#accent)"/>` : ""}
      ${titleLines.length ? `<text x="${margin}" y="${titleY}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="800">${titleTspans}</text>` : ""}
      ${subtitleLines.length ? `<text x="${margin}" y="${subtitleY}" fill="#dbe7ff" font-family="Arial, Helvetica, sans-serif" font-size="${subtitleSize}" font-weight="600">${subtitleTspans}</text>` : ""}
    </svg>
  `);

  return sharp(art)
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: logo, left: margin, top: Math.round(height * 0.115) },
    ])
    .png()
    .toBuffer();
}

function socialOutputDefinitions(brief: any) {
  const formats = safeText(brief?.formats).toLowerCase();
  const outputs: Array<{
    id: string;
    label: string;
    width: number;
    height: number;
    aiSize: OpenAiSize;
  }> = [];
  const add = (item: (typeof outputs)[number]) => {
    if (!outputs.some((current) => current.id === item.id)) outputs.push(item);
  };

  if (!formats || /\bpost\b|\bposts\b|poster|square|feed/.test(formats)) {
    add({
      id: "social-post",
      label: "Social Post — 1080 × 1080",
      width: 1080,
      height: 1080,
      aiSize: "1024x1024",
    });
  }
  if (/carousel|portrait/.test(formats)) {
    add({
      id: "social-carousel-cover",
      label: "Carousel Cover — 1080 × 1350",
      width: 1080,
      height: 1350,
      aiSize: "1024x1536",
    });
  }
  if (/story|stories|reel|reels|tiktok|vertical/.test(formats)) {
    add({
      id: "social-story",
      label: "Story / Reel Cover — 1080 × 1920",
      width: 1080,
      height: 1920,
      aiSize: "1024x1536",
    });
  }

  if (!outputs.length) {
    add({
      id: "social-post",
      label: "Social Post — 1080 × 1080",
      width: 1080,
      height: 1080,
      aiSize: "1024x1024",
    });
  }

  return outputs.slice(0, 3);
}

async function buildLetterheadMockup(args: {
  artwork: Buffer;
  logoBuffer: Buffer;
  brief: any;
  projectName: string;
  colours: string[];
}) {
  const width = 1400;
  const height = 1800;
  const art = await sharp(args.artwork).resize(width, 360, { fit: "cover", position: "centre" }).png().toBuffer();
  const logo = await monochromeLogo(args.logoBuffer, "white", 240, 120);
  const darkLogo = await monochromeLogo(args.logoBuffer, "dark", 200, 100);
  const accent = args.colours[0] || "#8b5cf6";
  const accentTwo = args.colours[1] || "#38bdf8";
  const contact = splitList(args.brief?.contact).join("   •   ");
  const footer = safeText(args.brief?.footer, "");
  const address = splitList(args.brief?.address).join(" · ");
  const bodyLines = Array.from({ length: 12 }, (_, index) => 520 + index * 72)
    .map((y) => `<line x1="140" y1="${y}" x2="1260" y2="${y}" stroke="#d9deea" stroke-width="2"/>`)
    .join("");
  const sheet = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${xml(accent)}"/>
          <stop offset="1" stop-color="${xml(accentTwo)}"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="38" fill="#ffffff"/>
      <rect x="0" y="0" width="${width}" height="300" rx="38" fill="#0a1427"/>
      <rect x="140" y="350" width="220" height="4" rx="2" fill="url(#accent)"/>
      <text x="1060" y="160" text-anchor="end" fill="#dbe7ff" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700">${xml(safeText(args.brief?.legalName, args.projectName))}</text>
      ${address ? `<text x="1060" y="196" text-anchor="end" fill="#a9b8d5" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="600">${xml(shortCopy(address, 68))}</text>` : ""}
      ${contact ? `<text x="1060" y="228" text-anchor="end" fill="#a9b8d5" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="600">${xml(shortCopy(contact, 68))}</text>` : ""}
      ${bodyLines}
      ${footer ? `<text x="140" y="1680" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="600">${xml(shortCopy(footer, 110))}</text>` : ""}
      <rect x="140" y="1710" width="1120" height="3" rx="1.5" fill="#e3e7f1"/>
    </svg>
  `);
  return sharp({
    create: {
      width: 1700,
      height: 2100,
      channels: 4,
      background: { r: 241, g: 245, b: 250, alpha: 1 },
    },
  })
    .composite([
      { input: sheet, left: 150, top: 140 },
      { input: art, left: 150, top: 140 },
      { input: logo, left: 260, top: 220 },
      { input: darkLogo, left: 290, top: 430 },
    ])
    .png()
    .toBuffer();
}

async function buildEnvelopeMockup(args: {
  artwork: Buffer;
  logoBuffer: Buffer;
  brief: any;
  colours: string[];
}) {
  const width = 1800;
  const height = 1000;
  const envW = 760;
  const envH = 380;
  const art = await sharp(args.artwork).resize(envW, envH, { fit: "cover", position: "centre" }).png().toBuffer();
  const darkLogo = await monochromeLogo(args.logoBuffer, "dark", 180, 80);
  const frontSvg = Buffer.from(`
    <svg width="${envW}" height="${envH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${envW}" height="${envH}" rx="28" fill="#ffffff"/>
      <rect x="0" y="0" width="${Math.round(envW * 0.33)}" height="${envH}" fill="#f5f8ff"/>
      <text x="${Math.round(envW * 0.58)}" y="${Math.round(envH * 0.46)}" fill="#334155" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">${xml(safeText(args.brief?.size, "DL / Standard"))}</text>
      ${safeText(args.brief?.returnAddress) ? `<text x="${Math.round(envW * 0.58)}" y="${Math.round(envH * 0.60)}" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="600">${xml(shortCopy(safeText(args.brief?.returnAddress), 60))}</text>` : ""}
      <rect x="${Math.round(envW * 0.50)}" y="${Math.round(envH * 0.70)}" width="220" height="70" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="8 6"/>
    </svg>
  `);
  const backSvg = Buffer.from(`
    <svg width="${envW}" height="${envH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${envW}" height="${envH}" rx="28" fill="#ffffff"/>
      <polygon points="0,0 ${envW},0 ${Math.round(envW * 0.5)},${Math.round(envH * 0.55)}" fill="#eef4ff"/>
      <polyline points="0,0 ${Math.round(envW * 0.5)},${Math.round(envH * 0.55)} ${envW},0" fill="none" stroke="#d9deea" stroke-width="2"/>
    </svg>
  `);
  const front = await sharp({ create: { width: envW, height: envH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([
      { input: art, left: 0, top: 0 },
      { input: frontSvg, left: 0, top: 0 },
      { input: darkLogo, left: 44, top: 40 },
    ])
    .png()
    .toBuffer();
  const back = await sharp({ create: { width: envW, height: envH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([
      { input: backSvg, left: 0, top: 0 },
      { input: darkLogo, left: 44, top: 42 },
    ])
    .png()
    .toBuffer();
  const frontRot = await sharp(front).rotate(-7, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const backRot = await sharp(back).rotate(6, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 245, g: 247, b: 252, alpha: 1 },
    },
  })
    .composite([
      { input: frontRot, left: 120, top: 210 },
      { input: backRot, left: 900, top: 340 },
    ])
    .png()
    .toBuffer();
}

async function compositeExactLogoOnScene(args: {
  artwork: Buffer;
  logoBuffer: Buffer;
  width: number;
  height: number;
  placements: Array<{ x: number; y: number; width: number; height: number }>;
  monochrome?: "white" | "dark";
}) {
  const scene = await sharp(args.artwork)
    .resize(args.width, args.height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  const overlays = await Promise.all(
    args.placements.map(async (placement) => {
      const logo = args.monochrome
        ? await monochromeLogo(
            args.logoBuffer,
            args.monochrome,
            Math.round(args.width * placement.width),
            Math.round(args.height * placement.height),
          )
        : await transparentLogo(
            args.logoBuffer,
            Math.round(args.width * placement.width),
            Math.round(args.height * placement.height),
          );
      const metadata = await sharp(logo).metadata();
      const logoWidth = metadata.width || Math.round(args.width * placement.width);
      const logoHeight = metadata.height || Math.round(args.height * placement.height);
      const areaWidth = Math.round(args.width * placement.width);
      const areaHeight = Math.round(args.height * placement.height);
      return {
        input: logo,
        left:
          Math.round(args.width * placement.x) +
          Math.max(0, Math.round((areaWidth - logoWidth) / 2)),
        top:
          Math.round(args.height * placement.y) +
          Math.max(0, Math.round((areaHeight - logoHeight) / 2)),
      };
    }),
  );

  return sharp(scene).composite(overlays).png().toBuffer();
}

async function buildSignageMockup(args: {
  artwork: Buffer;
  logoBuffer: Buffer;
}) {
  return compositeExactLogoOnScene({
    artwork: args.artwork,
    logoBuffer: args.logoBuffer,
    width: 1920,
    height: 1080,
    placements: [{ x: 0.34, y: 0.10, width: 0.32, height: 0.16 }],
  });
}

async function buildMerchandiseMockup(args: {
  artwork: Buffer;
  logoBuffer: Buffer;
}) {
  return compositeExactLogoOnScene({
    artwork: args.artwork,
    logoBuffer: args.logoBuffer,
    width: 1600,
    height: 1200,
    placements: [
      { x: 0.11, y: 0.44, width: 0.18, height: 0.11 },
      { x: 0.41, y: 0.36, width: 0.18, height: 0.12 },
      { x: 0.71, y: 0.44, width: 0.18, height: 0.11 },
    ],
  });
}

async function buildPackagingMockup(args: {
  artwork: Buffer;
  logoBuffer: Buffer;
}) {
  return compositeExactLogoOnScene({
    artwork: args.artwork,
    logoBuffer: args.logoBuffer,
    width: 1600,
    height: 1600,
    placements: [{ x: 0.36, y: 0.35, width: 0.28, height: 0.17 }],
  });
}

async function buildWebsiteMockup(args: {
  artwork: Buffer;
  logoBuffer: Buffer;
}) {
  return compositeExactLogoOnScene({
    artwork: args.artwork,
    logoBuffer: args.logoBuffer,
    width: 1600,
    height: 1000,
    placements: [{ x: 0.09, y: 0.09, width: 0.17, height: 0.09 }],
  });
}

async function buildPresentationMockup(args: {
  artwork: Buffer;
  logoBuffer: Buffer;
}) {
  return compositeExactLogoOnScene({
    artwork: args.artwork,
    logoBuffer: args.logoBuffer,
    width: 1600,
    height: 1000,
    placements: [{ x: 0.12, y: 0.12, width: 0.18, height: 0.10 }],
  });
}

async function buildSceneOutput(args: {
  artwork: Buffer;
  width: number;
  height: number;
}) {
  return sharp(args.artwork)
    .resize(args.width, args.height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

function applicationSceneExtra(args: {
  applicationId: string;
  brief: any;
  plan: any;
  application: any;
  projectName: string;
}) {
  switch (args.applicationId) {
    case "signage":
      return `Create a realistic ${safeText(args.brief?.location, "storefront")} signage mockup. Show a premium storefront exterior with one large, clean, blank illuminated sign panel centred above the entrance. The blank sign panel must occupy the upper middle of the image and remain free of all text, logos and symbols because the exact selected logo will be composited there. Use believable materials such as ${safeText(args.brief?.material, "premium fabricated signage")}. Respect practical scale (${safeText(args.brief?.dimensions, "not specified")}) and installation notes (${safeText(args.brief?.notes, "none")}). This must clearly read as installed signage, not a poster.`;
    case "merchandise":
      return `Create a realistic merchandise mockup scene for these requested items: ${safeText(args.brief?.items, "t-shirt, tote bag and cap")}. Arrange three front-facing products in three clear columns: one item on the left, one in the centre and one on the right. Use light or neutral product colours and leave a large clean blank print area on the front of every product. Do not add any logo, wordmark, text, letters or symbols. The exact selected logo will be composited onto each product after generation. Respect production method (${safeText(args.brief?.method, "not specified")}) and placement notes (${safeText(args.brief?.placement, "not specified")}). This must look like real photographed or rendered merchandise, not a flat design sheet.`;
    case "packaging":
      return `Create a realistic packaging mockup for ${safeText(args.brief?.product, "the selected product")}. Show the actual ${safeText(args.brief?.packType, "packaging format")} in a premium product scene. Keep one large, clean, front-facing blank brand panel centred on the main package. Do not add any logo, wordmark, brand name, product name or readable text. The exact selected logo will be composited on the blank front panel. Respect known dimensions (${safeText(args.brief?.dimensions, "not specified")}) and mandatory-content notes (${safeText(args.brief?.mandatory, "not specified")}).`;
    case "website":
      return `Create a realistic desktop website mockup showing a polished homepage or hero section. Use the selected direction for colour, imagery and composition. Keep the top-left header area clean and blank for the exact selected logo. Do not add readable copy, fake brand names, logos, words or UI labels. Use believable visual blocks and interface structure only. Website goal: ${safeText(args.brief?.goal, "not specified")}. Primary CTA intent: ${safeText(args.brief?.cta, "not specified")}. Suggested sections: ${safeText(args.brief?.pages, "not specified")}.`;
    case "presentation":
      return `Create a realistic presentation mockup showing one cover slide and one inside slide in a premium scene. Keep the upper-left area of the cover slide clean and blank for the exact selected logo. Do not add readable words, fake brand names, logos, slide titles or placeholder text. Use only visual blocks, imagery and graphic devices from the selected direction. Purpose: ${safeText(args.brief?.purpose, "not specified")}. Audience: ${safeText(args.brief?.audience, "not specified")}. Suggested slide types: ${safeText(args.brief?.slides, "not specified")}.`;
    default:
      return `Use the saved application brief only as design context: ${JSON.stringify(args.brief)}. Do not copy the brief text into the artwork.`;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body?.project || {};
    const brand = body?.brand || {};
    const application = body?.application || {};
    const plan = body?.plan || {};
    const brief = body?.brief || {};
    const logoReferenceUrl = safeText(body?.logoReferenceUrl);
    const directionReferenceUrl = safeText(body?.directionReferenceUrl);
    const selectedDirection = body?.selectedDirection || null;
    const applicationId = safeText(application?.id);
    const applicationLabel = safeText(application?.label, "Brand application");
    const projectName = safeText(project?.project_name, "Brand Project");

    if (!project?.id || !applicationId) {
      return NextResponse.json(
        { error: "A Brand project and application are required." },
        { status: 400 },
      );
    }
    if (!logoReferenceUrl) {
      return NextResponse.json(
        { error: "Select or upload the project logo before generating this application." },
        { status: 400 },
      );
    }

    const storageContext = await requireBrandImageProject(project.id);
    const { result, reservation } = await withCreditReservation({
      admin: storageContext.admin,
      userId: storageContext.userId,
      action: "brandApplicationVisual",
      metadata: {
        project_id: storageContext.projectId,
        studio: "brand_studio",
        tool: "brand_application_visual",
        application_id: applicationId,
        image_provider: getBrandApplicationImageProvider(),
      },
      work: async () => {
        const [logoBuffer, directionBuffer] = await Promise.all([
          fetchReferenceBuffer(logoReferenceUrl),
          directionReferenceUrl ? fetchReferenceBuffer(directionReferenceUrl) : Promise.resolve(null),
        ]);
        if (!logoBuffer) {
          throw new Error("The selected logo could not be loaded. Re-upload or reselect it and try again.");
        }

        const imageProvider = getBrandApplicationImageProvider();
        const openai = imageProvider === "openai" ? getOpenAI() : null;
        let outputs: GeneratedOutput[] = [];
        let usage: unknown = null;
        if (applicationId === "email-signature") {
          const exactDetails = [
            ["Name", safeText(brief?.name)],
            ["Job title", safeText(brief?.jobTitle)],
            ["Contact details", safeText(brief?.contact)],
            ["Social links", safeText(brief?.social)],
            ["Disclaimer", safeText(brief?.disclaimer)],
          ]
            .filter(([, value]) => Boolean(value))
            .map(([label, value]) => `- ${label}: ${value}`)
            .join("\n");
          const variationId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const signature = await generateArtwork({
            openai,
            directionBuffer,
            logoBuffer,
            size: "1536x1024",
            preserveDirectionDetail: true,
            prompt: `Create ONE polished email-signature preview.

Reference rules:
- Image A is the selected creative direction. Follow its palette, composition language, tone, textures and brand atmosphere.
- Image B is the exact approved logo. Reproduce that exact logo faithfully. Do not redesign, redraw or replace it.

Create a clean, professional email signature block that is ready to use, shown as one final preview only.
Print only these exact details:
${exactDetails || "- No signature details were entered."}

Requirements:
- The result must look like a real branded email signature, not a background artwork, not a moodboard and not a UI screenshot.
- Use the exact logo and preserve all entered details accurately.
- Keep the information hierarchy clear, elegant and readable.
- Do not add fake contact details, lorem ipsum, extra people names, extra phone numbers, page counters or internal brief text.
- Show one signature preview only. No multiple options, no template sheet and no design-board layout.
- Produce a fresh composition for this regeneration while preserving the approved identity. Internal variation reference: ${variationId}. Never print this reference.`,
          });
          usage = signature.usage;
          outputs = [
            await storeOutput(storageContext, {
              buffer: signature.buffer,
              applicationId,
              outputId: "email-signature-1200x400",
              label: "Email Signature — 1200 × 400",
              width: 1200,
              height: 400,
              projectName,
            }),
          ];
        } else if (applicationId === "social-system") {
          const definitions = socialOutputDefinitions(brief);
          const projectOrBrandName = safeText(project?.project_name, "The brand");
          const platformSummary = safeText(brief?.platforms, "social media");
          const pillarSummary = safeText(brief?.contentPillars, "general brand content");
          const generated = await Promise.all(
            definitions.map(async (definition) => {
              const variationId = `${definition.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
              const art = await generateArtwork({
                openai,
                directionBuffer,
                logoBuffer,
                size: definition.aiSize,
                preserveDirectionDetail: true,
                prompt: `Create ONE final branded social media graphic for ${definition.label}.

Reference rules:
- Image A is the selected creative direction. Use it for the visual language, colour palette, typography character, graphic treatment, imagery treatment and mood.
- Image B is the exact approved logo. Reproduce that exact logo faithfully. Do not redesign, redraw or replace it.

Brand context:
- Brand name: ${projectOrBrandName}
- Industry: ${safeText(project?.industry, "not provided")}
- Audience: ${safeText(project?.audience, "not provided")}
- Platforms: ${platformSummary}
- Content pillars: ${pillarSummary}
- Requested formats: ${safeText(brief?.formats, definition.label)}

Requirements:
- Design a real post/story creative that looks ready to publish, not a blank template, not a generic illustration panel and not a brief board.
- Use the exact logo naturally in the composition.
- Create short, polished marketing copy that is appropriate for the brand and the stated content pillars. Limit the copy to one main headline, one short supporting line and an optional short CTA.
- Keep all text clean, readable and professionally typeset.
- Do not show social-platform UI chrome, design-sheet counters, page numbers, placeholder text, lorem ipsum, prompt text or copied brief text.
- Return exactly one finished social media creative for this format.
- Produce a fresh composition for this regeneration while preserving the approved identity. Internal variation reference: ${variationId}. Never print this reference.`,
              });
              const stored = await storeOutput(storageContext, {
                buffer: art.buffer,
                applicationId,
                outputId: definition.id,
                label: definition.label,
                width: definition.width,
                height: definition.height,
                projectName,
              });
              return { stored, usage: art.usage };
            }),
          );
          outputs = generated.map((item) => item.stored);
          usage = generated.map((item) => item.usage);
        } else if (applicationId === "business-card") {
          const exactDetails = [
            ["Name", safeText(brief?.name)],
            ["Job title", safeText(brief?.jobTitle)],
            ["Phone", safeText(brief?.phone)],
            ["Email", safeText(brief?.email)],
            ["Website", safeText(brief?.website)],
            ["Address", safeText(brief?.address)],
          ]
            .filter(([, value]) => Boolean(value))
            .map(([label, value]) => `- ${label}: ${value}`)
            .join("\n");
          const preferredFormat = safeText(brief?.format, "standard horizontal");
          const finishNotes = safeText(brief?.notes, "none");
          const variationId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const cardPreview = await generateArtwork({
            openai,
            directionBuffer,
            logoBuffer,
            size: "1536x1024",
            preserveDirectionDetail: true,
            prompt: `Create ONE professional presentation image containing exactly TWO views of the same business card: the front and the back shown together in one coordinated premium mockup scene.

Use a true 90 × 50 mm-style horizontal card proportion unless the preferred format below clearly requests another orientation. The two card faces must feel like one finished design system and must be fully visible, large, readable and not overlapping important content.

Reference rules:
- The first supplied image is the approved creative direction. Follow its palette, typography character, graphic language, textures, shapes, imagery treatment and overall atmosphere.
- The second supplied image is the exact approved logo. Reproduce that exact logo visibly and faithfully. Do not redesign it, redraw it, replace it, invent another mark, alter its wording or distort its proportions.

Print only these exact user-entered details, preserving spelling, punctuation and numbers:
${exactDetails || "- No contact details were entered."}

Preferred card format: ${preferredFormat}
Print / finish direction: ${finishNotes}

Composition requirements:
- Show exactly one front face and one back face together in the single final image.
- Use the exact logo on the cards and integrate it naturally into the design.
- Keep every supplied contact detail legible and unchanged.
- Do not add any other names, slogans, contact details, placeholder copy, lorem ipsum, fake QR codes, counters, page numbers or random characters.
- Do not show labels such as FRONT, BACK, OPTION, MOCKUP or 01/02.
- Do not show a third card, a separate flat artwork, detail crop, design board, specification sheet, ruler, dimensions, internal brief, prompt text, instructions or UI text.
- Present the cards as a believable high-end brand-design preview on a clean neutral surface with restrained lighting and realistic materials.
- Produce a fresh composition for this regeneration while preserving the approved identity and exact content. Internal variation reference: ${variationId}. Never print this reference.

Return only the single combined front-and-back business-card preview.`,
          });
          usage = cardPreview.usage;
          outputs = [
            await storeOutput(storageContext, {
              buffer: cardPreview.buffer,
              applicationId,
              outputId: "business-card-preview",
              label: "Business Card Preview — Front & Back",
              width: 1536,
              height: 1024,
              projectName,
            }),
          ];
        } else if (applicationId === "letterhead") {
          const exactDetails = [
            ["Legal business name", safeText(brief?.legalName, projectName)],
            ["Business address", safeText(brief?.address)],
            ["Contact details", safeText(brief?.contact)],
            ["Footer information", safeText(brief?.footer)],
          ]
            .filter(([, value]) => Boolean(value))
            .map(([label, value]) => `- ${label}: ${value}`)
            .join("\n");
          const variationId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const art = await generateArtwork({
            openai,
            directionBuffer,
            logoBuffer,
            size: "1024x1536",
            preserveDirectionDetail: true,
            prompt: `Create ONE professional letterhead preview.

Reference rules:
- Image A is the selected creative direction. Follow its palette, graphic language, spacing and atmosphere.
- Image B is the exact approved logo. Reproduce that exact logo faithfully. Do not redesign or replace it.

Print only these exact details:
${exactDetails || "- No letterhead details were entered."}

Requirements:
- Show one clean branded letterhead page in a believable presentation view.
- Keep the document body mostly open and usable.
- Use the exact logo and exact entered details accurately and legibly.
- Do not add fake business details, internal brief text, page counters, placeholder paragraphs or random document copy.
- Return one final letterhead preview only.
- Produce a fresh composition for this regeneration while preserving the approved identity. Internal variation reference: ${variationId}. Never print this reference.`,
          });
          usage = art.usage;
          outputs = [
            await storeOutput(storageContext, {
              buffer: art.buffer,
              applicationId,
              outputId: applicationId,
              label: "Letterhead Preview",
              width: 1700,
              height: 2100,
              projectName,
            }),
          ];
        } else if (applicationId === "envelope") {
          const exactDetails = [
            ["Envelope size", safeText(brief?.size)],
            ["Return address", safeText(brief?.returnAddress)],
            ["Mailing requirements", safeText(brief?.notes)],
          ]
            .filter(([, value]) => Boolean(value))
            .map(([label, value]) => `- ${label}: ${value}`)
            .join("\n");
          const variationId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const art = await generateArtwork({
            openai,
            directionBuffer,
            logoBuffer,
            size: "1536x1024",
            preserveDirectionDetail: true,
            prompt: `Create ONE professional envelope presentation image showing exactly TWO views of the same envelope: front and back together.

Reference rules:
- Image A is the selected creative direction. Follow its palette, visual language and atmosphere.
- Image B is the exact approved logo. Reproduce that exact logo faithfully. Do not redesign or replace it.

Print only these exact details:
${exactDetails || "- No envelope details were entered."}

Requirements:
- Show one envelope front and one envelope back together in one polished preview.
- Use the exact logo and exact return-address information accurately.
- Keep the presentation clean, premium and believable.
- Do not add fake postage details, fake addresses, extra names, counters, labels or internal brief text.
- Return one final combined envelope preview only.
- Produce a fresh composition for this regeneration while preserving the approved identity. Internal variation reference: ${variationId}. Never print this reference.`,
          });
          usage = art.usage;
          outputs = [
            await storeOutput(storageContext, {
              buffer: art.buffer,
              applicationId,
              outputId: applicationId,
              label: "Envelope Preview — Front & Back",
              width: 1800,
              height: 1000,
              projectName,
            }),
          ];
        } else {
          const spec = APPLICATION_SCENE_SPECS[applicationId];
          if (!spec) {
            throw new Error("This application does not have a visual format yet.");
          }
          const variationId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const prompt =
            applicationId === "signage"
              ? `Create ONE realistic signage mockup for ${safeText(brief?.location, "the selected location")}.

Reference rules:
- Image A is the selected creative direction. Follow its palette, material feeling and visual language.
- Image B is the exact approved logo. Reproduce that exact logo faithfully and install it on the sign. Do not redesign or replace it.

Practical details:
- Approximate dimensions: ${safeText(brief?.dimensions, "not specified")}
- Material: ${safeText(brief?.material, "not specified")}
- Installation or viewing notes: ${safeText(brief?.notes, "none")}

Requirements:
- Show one believable real-world signage preview only.
- The result must clearly read as signage, not a poster or moodboard.
- Keep the exact logo visible and credible.
- Do not add extra fake contact details, brief text, labels or multiple options.
- Produce a fresh composition for this regeneration while preserving the approved identity. Internal variation reference: ${variationId}. Never print this reference.`
              : applicationId === "merchandise"
                ? `Create ONE coordinated merchandise preview scene.

Reference rules:
- Image A is the selected creative direction. Follow its colour palette, styling and brand mood.
- Image B is the exact approved logo. Reproduce that exact logo faithfully on the products. Do not redesign or replace it.

Requested items and production notes:
- Items: ${safeText(brief?.items, "t-shirt, tote bag and cap")}
- Method: ${safeText(brief?.method, "not specified")}
- Placement: ${safeText(brief?.placement, "not specified")}

Requirements:
- Show the requested products together in one polished merchandise scene.
- Apply the exact logo clearly and consistently.
- Do not add extra fake slogans, extra logos, design-board labels or multiple option rows.
- Return one final coordinated merchandise preview only.
- Produce a fresh composition for this regeneration while preserving the approved identity. Internal variation reference: ${variationId}. Never print this reference.`
                : applicationId === "packaging"
                  ? `Create ONE professional packaging concept preview.

Reference rules:
- Image A is the selected creative direction. Follow its palette, graphic language and premium feel.
- Image B is the exact approved logo. Reproduce that exact logo faithfully on the packaging. Do not redesign or replace it.

Product details:
- Product name: ${safeText(brief?.product, "the selected product")}
- Packaging type: ${safeText(brief?.packType, "not specified")}
- Dimensions or dieline notes: ${safeText(brief?.dimensions, "not specified")}
- Mandatory content notes: ${safeText(brief?.mandatory, "not specified")}

Requirements:
- Show one believable package concept for the requested pack type.
- Use the exact logo and the exact product name.
- Keep the layout premium and client-ready.
- Do not turn the artwork into a spec sheet, dieline sheet, prompt board or multiple-option board.
- Return one final packaging preview only.
- Produce a fresh composition for this regeneration while preserving the approved identity. Internal variation reference: ${variationId}. Never print this reference.`
                  : applicationId === "website"
                    ? `Create ONE polished branded website homepage preview.

Reference rules:
- Image A is the selected creative direction. Follow its palette, layout style, imagery treatment and overall atmosphere.
- Image B is the exact approved logo. Reproduce that exact logo faithfully in the interface. Do not redesign or replace it.

Website brief:
- Primary goal: ${safeText(brief?.goal, "not specified")}
- Primary call to action: ${safeText(brief?.cta, "not specified")}
- Key pages or sections: ${safeText(brief?.pages, "not specified")}

Requirements:
- Show one high-end desktop homepage or landing-page screen only.
- Include polished, minimal, believable UI copy that supports the stated goal and CTA.
- Do not show browser chrome, wireframe labels, lorem ipsum walls, prompt text or multiple page boards.
- Return one final website preview only.
- Produce a fresh composition for this regeneration while preserving the approved identity. Internal variation reference: ${variationId}. Never print this reference.`
                    : applicationId === "presentation"
                      ? `Create ONE presentation-system preview showing exactly TWO slides together: a cover slide and one inside slide.

Reference rules:
- Image A is the selected creative direction. Follow its palette, visual language and brand mood.
- Image B is the exact approved logo. Reproduce that exact logo faithfully in the presentation. Do not redesign or replace it.

Presentation brief:
- Purpose: ${safeText(brief?.purpose, "not specified")}
- Audience: ${safeText(brief?.audience, "not specified")}
- Requested slide types: ${safeText(brief?.slides, "not specified")}

Requirements:
- Show one cover slide and one inside slide together in one professional preview.
- Use clean, minimal, believable headings and layout.
- Do not create a multi-slide contact sheet, wireframe board, lorem ipsum deck or prompt board.
- Return one final combined presentation preview only.
- Produce a fresh composition for this regeneration while preserving the approved identity. Internal variation reference: ${variationId}. Never print this reference.`
                      : `Create ONE professional ${applicationLabel} preview using the selected creative direction and the exact approved logo. Use this application brief as design context only: ${JSON.stringify(brief)}. Do not print the JSON or internal brief text. Produce a fresh composition for this regeneration while preserving the approved identity. Internal variation reference: ${variationId}. Never print this reference.`;
          const art = await generateArtwork({
            openai,
            directionBuffer,
            logoBuffer,
            size: spec.aiSize,
            preserveDirectionDetail: true,
            prompt,
          });
          usage = art.usage;
          outputs = [
            await storeOutput(storageContext, {
              buffer: art.buffer,
              applicationId,
              outputId: applicationId,
              label: spec.label,
              width: spec.width,
              height: spec.height,
              projectName,
            }),
          ];
        }

        const first = outputs[0];
        if (!first) throw new Error("No application outputs were created.");
        return {
          applicationId,
          applicationLabel,
          imageUrl: first.imageUrl,
          storagePath: first.storagePath,
          width: first.width,
          height: first.height,
          outputs,
          tier: "concept",
          logoPreserved: true,
          creativeDirectionApplied: Boolean(selectedDirection || directionReferenceUrl),
          exactSize: false,
          mockup: true,
          usage,
          imageProvider,
          imageModel:
            imageProvider === "gemini"
              ? process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image"
              : process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        };
      },
    });

    return NextResponse.json({ ...result, creditsUsed: reservation.amount });
  } catch (error) {
    console.error("Brand application visual error:", error);
    if (error instanceof CreditError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate the application visual.",
      },
      { status: 500 },
    );
  }
}
