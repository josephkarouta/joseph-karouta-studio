import "server-only";

import path from "path";
import { readFile } from "fs/promises";
import sharp from "sharp";

export const HEYY_EMAIL_LOGO_CID = "heyy-studio-logo";

type HeyyRasterLogo = {
  buffer: Buffer;
  width: number;
  height: number;
  filename: string;
  contentId: string;
};

type LogoCandidate = {
  buffer: Buffer;
  width: number;
  height: number;
  darkness: number;
};

let cachedLogo: Promise<HeyyRasterLogo | null> | null = null;

export function getHeyyEmailLogoPng() {
  if (!cachedLogo) cachedLogo = loadHeyyEmailLogoPng();
  return cachedLogo;
}

async function loadHeyyEmailLogoPng(): Promise<HeyyRasterLogo | null> {
  try {
    // Email clients and PDF renderers are much more predictable when the logo
    // is a tightly cropped raster on a white field. Test both official
    // full-colour variants and keep the one with the strongest dark wordmark,
    // so naming differences between "light" and "dark" assets cannot leave us
    // with a white wordmark on a white email/invoice header.
    const sourceNames = [
      "heyy-full-colour-dark.svg",
      "heyy-full-colour-light.svg",
    ];

    const candidates: LogoCandidate[] = [];
    for (const sourceName of sourceNames) {
      try {
        const source = await readFile(
          path.join(process.cwd(), "public", "brand", "heyy", sourceName),
        );
        candidates.push(await rasteriseCandidate(source));
      } catch (error) {
        console.warn(`Heyy Studio logo candidate ${sourceName} could not be prepared:`, error);
      }
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.darkness - a.darkness);
    const selected = candidates[0];

    return {
      buffer: selected.buffer,
      width: selected.width,
      height: selected.height,
      filename: "heyy-studio-logo.png",
      contentId: HEYY_EMAIL_LOGO_CID,
    };
  } catch (error) {
    cachedLogo = null;
    console.error("Heyy Studio email logo could not be prepared:", error);
    return null;
  }
}

async function rasteriseCandidate(source: Buffer): Promise<LogoCandidate> {
  const trimmed = await sharp(source, { density: 300 })
    .flatten({ background: "#ffffff" })
    .trim({ background: "#ffffff", threshold: 12 })
    .resize({ width: 300, height: 92, fit: "inside", withoutEnlargement: false })
    .extend({
      top: 8,
      bottom: 8,
      left: 10,
      right: 10,
      background: "#ffffff",
    })
    .png()
    .toBuffer();

  const image = sharp(trimmed);
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (!width || !height) throw new Error("Logo raster returned invalid dimensions.");

  const mean = stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.mean, 0) / 3;

  return {
    buffer: trimmed,
    width,
    height,
    darkness: 255 - mean,
  };
}
