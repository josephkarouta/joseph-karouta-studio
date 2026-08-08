import "server-only";

import { NextResponse } from "next/server";
import sharp from "sharp";
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

type DirectApplicationSpec = {
  width: number;
  height: number;
  aiSize: OpenAiSize;
  label: string;
  direction: string;
};

const DIRECT_APPLICATION_SPECS: Record<string, DirectApplicationSpec> = {
  "business-card": {
    width: 1050,
    height: 600,
    aiSize: "1536x1024",
    label: "Business Card — 1050 × 600",
    direction:
      "Create a flat front-facing business-card artwork canvas. Do not show hands, desks, stacks of cards or perspective mockups.",
  },
  letterhead: {
    width: 1240,
    height: 1754,
    aiSize: "1024x1536",
    label: "Letterhead — 1240 × 1754",
    direction:
      "Create a flat front-facing letterhead artwork canvas with a generous usable writing area. Do not show paper mockups or desk scenes.",
  },
  envelope: {
    width: 1900,
    height: 900,
    aiSize: "1536x1024",
    label: "Envelope — 1900 × 900",
    direction:
      "Create a flat front-facing envelope artwork canvas. Do not show a perspective mockup, hands or stationery scene.",
  },
  presentation: {
    width: 1920,
    height: 1080,
    aiSize: "1536x1024",
    label: "Presentation Cover — 1920 × 1080",
    direction:
      "Create a flat presentation-cover artwork canvas with a strong hero composition and clean space for exact title content. Do not show laptops or slide mockups.",
  },
  website: {
    width: 1440,
    height: 900,
    aiSize: "1536x1024",
    label: "Website Hero — 1440 × 900",
    direction:
      "Create a flat website-hero artwork canvas with strong visual hierarchy and clean navigation-safe space. Do not show a laptop, browser frame or device mockup.",
  },
  packaging: {
    width: 1600,
    height: 1600,
    aiSize: "1024x1024",
    label: "Packaging Front Panel — 1600 × 1600",
    direction:
      "Create a flat front-panel packaging artwork concept. Do not show a box, bottle, pouch or three-dimensional mockup. Do not imply a final dieline.",
  },
  signage: {
    width: 1920,
    height: 1080,
    aiSize: "1536x1024",
    label: "Signage Artwork — 1920 × 1080",
    direction:
      "Create a flat front-facing signage artwork canvas. Do not show a building, wall, storefront or environmental mockup.",
  },
  merchandise: {
    width: 1600,
    height: 1600,
    aiSize: "1024x1024",
    label: "Merchandise Graphic — 1600 × 1600",
    direction:
      "Create a flat merchandise graphic artwork canvas with transparent-design logic. Do not show clothing, bags, products or model mockups.",
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "brand-application";
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

async function directionFile(directionBuffer: Buffer) {
  return toFile(
    await sharp(directionBuffer).rotate().png().toBuffer(),
    "selected-creative-direction.png",
    { type: "image/png" },
  );
}

async function generateArtwork(args: {
  openai: ReturnType<typeof getOpenAI>;
  directionBuffer: Buffer | null;
  size: OpenAiSize;
  prompt: string;
}) {
  const generated = args.directionBuffer
    ? await args.openai.images.edit({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        image: await directionFile(args.directionBuffer),
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

function baseArtworkPrompt(args: {
  project: any;
  brand: any;
  selectedDirection: any;
  applicationLabel: string;
  extra: string;
}) {
  return `
Create ONLY the visual artwork/background for a ${args.applicationLabel}.

Brand: ${safeText(args.project?.project_name, "Brand Project")}
Industry: ${safeText(args.project?.industry, "Not provided")}
Audience: ${safeText(args.project?.audience, "Not provided")}
Preferred style: ${safeText(args.project?.style, "Not provided")}
Brand system: ${JSON.stringify(compactBrandContext(args.brand))}
Selected creative direction: ${JSON.stringify(args.selectedDirection || null)}

${args.extra}

Mandatory rules:
- Follow the selected creative-direction image extremely closely: palette, imagery treatment, lighting, depth, shapes, texture, atmosphere and visual energy must feel like the same campaign.
- Generate artwork only. Do not include any text, letters, numbers, logos, wordmarks, monograms, social icons, UI labels, placeholder boxes, screens, devices, browser frames, email windows, presentation boards or mockup scenes.
- Do not add watermarks, signatures, supplier marks or unrelated identities.
- Keep important focal details away from the exact-logo and exact-text safe areas described above.
- The website will add the exact logo and exact content after generation.
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
      <text x="292" y="326" fill="#dbe7ff" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="600">${xml(safeText(args.project?.project_name, "Brand"))} · Create with AI. Build with Experts.</text>
      <rect x="680" y="0" width="120" height="400" fill="url(#base)" transform="rotate(180 740 200)"/>
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
  index: number;
  total: number;
  projectName: string;
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
  const logo = await monochromeLogo(args.logoBuffer, "white", logoWidth, logoHeight);
  const logoMeta = await sharp(logo).metadata();
  const actualLogoWidth = logoMeta.width || logoWidth;
  const actualLogoHeight = logoMeta.height || logoHeight;
  const margin = Math.round(width * 0.065);
  const portrait = height / width > 1.35;
  const titleSize = Math.round(width * (portrait ? 0.072 : 0.062));
  const subtitleSize = Math.max(20, Math.round(titleSize * 0.38));
  const availableWidth = width - margin * 2;
  const titleMaxChars = Math.max(12, Math.floor(availableWidth / (titleSize * 0.61)));
  const subtitleMaxChars = Math.max(18, Math.floor(availableWidth / (subtitleSize * 0.58)));
  const titleLines = wrapText(args.title, titleMaxChars, portrait ? 3 : 2);
  const subtitleLines = wrapText(shortCopy(args.subtitle, portrait ? 120 : 96), subtitleMaxChars, portrait ? 3 : 2);
  const accent = args.colours[0] || "#8b5cf6";
  const accentTwo = args.colours[1] || "#38bdf8";
  const titleLineSpacing = Math.round(titleSize * 1.06);
  const subtitleLineSpacing = Math.round(subtitleSize * 1.35);
  const blockHeight =
    titleSize +
    Math.max(0, titleLines.length - 1) * titleLineSpacing +
    Math.round(subtitleSize * 1.3) +
    subtitleLines.length * subtitleLineSpacing;
  const safeBottom = height - Math.round(margin * 1.8);
  const preferredTitleY = Math.round(height * (portrait ? 0.60 : 0.58));
  const titleY = Math.min(preferredTitleY, safeBottom - blockHeight);
  const subtitleY =
    titleY +
    Math.max(1, titleLines.length) * titleLineSpacing +
    Math.round(subtitleSize * 1.15);
  const titleTspans = titleLines
    .map(
      (line, index) =>
        `<tspan x="${margin}" dy="${index === 0 ? 0 : titleLineSpacing}">${xml(line)}</tspan>`,
    )
    .join("");
  const subtitleTspans = subtitleLines
    .map(
      (line, index) =>
        `<tspan x="${margin}" dy="${index === 0 ? 0 : subtitleLineSpacing}">${xml(line)}</tspan>`,
    )
    .join("");

  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#041027" stop-opacity="0.08"/>
          <stop offset="0.48" stop-color="#041027" stop-opacity="0.18"/>
          <stop offset="1" stop-color="#041027" stop-opacity="0.94"/>
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${xml(accent)}"/>
          <stop offset="1" stop-color="${xml(accentTwo)}"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shade)"/>
      <rect x="${margin}" y="${Math.round(height * 0.09)}" width="${Math.round(width * 0.12)}" height="${Math.max(5, Math.round(width * 0.008))}" rx="4" fill="url(#accent)"/>
      <text x="${width - margin}" y="${Math.round(height * 0.1)}" text-anchor="end" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(width * 0.026)}" font-weight="700">${String(args.index).padStart(2, "0")} / ${String(args.total).padStart(2, "0")}</text>
      <text x="${margin}" y="${titleY}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="800">${titleTspans}</text>
      <text x="${margin}" y="${subtitleY}" fill="#dbe7ff" font-family="Arial, Helvetica, sans-serif" font-size="${subtitleSize}" font-weight="600">${subtitleTspans}</text>
      <text x="${width - margin}" y="${height - margin}" text-anchor="end" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(width * 0.027)}" font-weight="700">${xml(args.projectName)}</text>
    </svg>
  `);

  return sharp(art)
    .composite([
      { input: overlay, left: 0, top: 0 },
      {
        input: logo,
        left: margin,
        top: Math.round(height * 0.115),
      },
    ])
    .png()
    .toBuffer();
}

function socialOutputDefinitions(brief: any) {
  const formats = safeText(brief?.formats).toLowerCase();
  const platforms = safeText(brief?.platforms).toLowerCase();
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

  if (!formats || /post|square|carousel/.test(formats)) {
    add({ id: "instagram-post", label: "Instagram Post — 1080 × 1080", width: 1080, height: 1080, aiSize: "1024x1024" });
  }
  if (/carousel|portrait/.test(formats)) {
    add({ id: "instagram-portrait", label: "Instagram Portrait / Carousel — 1080 × 1350", width: 1080, height: 1350, aiSize: "1024x1536" });
  }
  if (/story|reel|tiktok|vertical/.test(`${formats} ${platforms}`)) {
    add({ id: "story-reel", label: "Story / Reel — 1080 × 1920", width: 1080, height: 1920, aiSize: "1024x1536" });
  }
  if (/linkedin|facebook/.test(platforms)) {
    add({ id: "linkedin-facebook", label: "LinkedIn / Facebook Post — 1200 × 1200", width: 1200, height: 1200, aiSize: "1024x1024" });
  }
  if (!outputs.length) {
    add({ id: "instagram-post", label: "Instagram Post — 1080 × 1080", width: 1080, height: 1080, aiSize: "1024x1024" });
    add({ id: "story-reel", label: "Story / Reel — 1080 × 1920", width: 1080, height: 1920, aiSize: "1024x1536" });
  }
  return outputs.slice(0, 4);
}

async function buildDirectApplication(args: {
  artwork: Buffer;
  logoBuffer: Buffer;
  spec: DirectApplicationSpec;
  projectName: string;
  applicationLabel: string;
  colours: string[];
}) {
  const art = await sharp(args.artwork)
    .resize(args.spec.width, args.spec.height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  const logo = await monochromeLogo(
    args.logoBuffer,
    "white",
    Math.round(args.spec.width * 0.18),
    Math.round(args.spec.height * 0.1),
  );
  const accent = args.colours[0] || "#8b5cf6";
  const overlay = Buffer.from(`
    <svg width="${args.spec.width}" height="${args.spec.height}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#041027" stop-opacity="0.06"/><stop offset="1" stop-color="#041027" stop-opacity="0.88"/></linearGradient></defs>
      <rect width="${args.spec.width}" height="${args.spec.height}" fill="url(#g)"/>
      <rect x="${Math.round(args.spec.width * 0.06)}" y="${Math.round(args.spec.height * 0.82)}" width="${Math.round(args.spec.width * 0.16)}" height="6" rx="3" fill="${xml(accent)}"/>
      <text x="${Math.round(args.spec.width * 0.06)}" y="${Math.round(args.spec.height * 0.9)}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(args.spec.width * 0.035)}" font-weight="800">${xml(args.applicationLabel)}</text>
      <text x="${Math.round(args.spec.width * 0.94)}" y="${Math.round(args.spec.height * 0.9)}" text-anchor="end" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(args.spec.width * 0.024)}" font-weight="700">${xml(args.projectName)}</text>
    </svg>
  `);
  return sharp(art)
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: logo, left: Math.round(args.spec.width * 0.06), top: Math.round(args.spec.height * 0.06) },
    ])
    .png()
    .toBuffer();
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
      },
      work: async () => {
        const [logoBuffer, directionBuffer] = await Promise.all([
          fetchReferenceBuffer(logoReferenceUrl),
          directionReferenceUrl ? fetchReferenceBuffer(directionReferenceUrl) : Promise.resolve(null),
        ]);
        if (!logoBuffer) {
          throw new Error("The selected logo could not be loaded. Re-upload or reselect it and try again.");
        }

        const openai = getOpenAI();
        const colours = collectHexColours({ brand, selectedDirection });
        let outputs: GeneratedOutput[] = [];
        let usage: unknown = null;

        if (applicationId === "email-signature") {
          const generated = await generateArtwork({
            openai,
            directionBuffer,
            size: "1536x1024",
            prompt: baseArtworkPrompt({
              project,
              brand,
              selectedDirection,
              applicationLabel,
              extra:
                "Create a premium ultra-wide horizontal brand artwork. Put the strongest imagery and graphic detail on the RIGHT 42% of the canvas. Keep the LEFT 58% calm, dark, low-detail and suitable for exact white logo and contact typography. This is the direct email-signature artwork, not an email-client preview.",
            }),
          });
          usage = generated.usage;
          const signature = await buildEmailSignature({
            artwork: generated.buffer,
            logoBuffer,
            project,
            brief,
            colours,
          });
          outputs = [
            await storeOutput(storageContext, {
              buffer: signature,
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
          const pillars = splitList(brief?.contentPillars);
          const fallbackTitles = ["Launch Campaign", "Create with AI", "Build with experts", "One connected brand"];
          const generated = await Promise.all(
            definitions.map(async (definition, index) => {
              const art = await generateArtwork({
                openai,
                directionBuffer,
                size: definition.aiSize,
                prompt: baseArtworkPrompt({
                  project,
                  brand,
                  selectedDirection,
                  applicationLabel,
                  extra: `Create one full-bleed social campaign artwork for ${definition.label}. Make this variation visually distinct from the other formats while clearly belonging to one campaign family. Keep the upper-left area clean for the exact logo and keep the lower third readable for exact campaign typography. Variation ${index + 1} of ${definitions.length}.`,
                }),
              });
              const final = await buildSocialAsset({
                artwork: art.buffer,
                logoBuffer,
                width: definition.width,
                height: definition.height,
                title: pillars[index] || fallbackTitles[index] || fallbackTitles[0],
                subtitle: shortCopy(
                  safeText(
                    brief?.campaignMessage || brief?.message || plan?.objective,
                    "One connected campaign family.",
                  ),
                  112,
                ),
                index: index + 1,
                total: definitions.length,
                projectName,
                colours,
              });
              const stored = await storeOutput(storageContext, {
                buffer: final,
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
        } else {
          const spec = DIRECT_APPLICATION_SPECS[applicationId];
          if (!spec) {
            throw new Error("This application does not have a direct-size visual format yet.");
          }
          const art = await generateArtwork({
            openai,
            directionBuffer,
            size: spec.aiSize,
            prompt: baseArtworkPrompt({
              project,
              brand,
              selectedDirection,
              applicationLabel,
              extra: `${spec.direction} Use the saved application brief: ${JSON.stringify(brief)}. Objective: ${safeText(plan?.objective, safeText(application?.description))}.`,
            }),
          });
          usage = art.usage;
          const final = await buildDirectApplication({
            artwork: art.buffer,
            logoBuffer,
            spec,
            projectName,
            applicationLabel,
            colours,
          });
          outputs = [
            await storeOutput(storageContext, {
              buffer: final,
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
          exactSize: true,
          mockup: false,
          usage,
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
