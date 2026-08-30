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

let cachedLogo: Promise<HeyyRasterLogo | null> | null = null;

export function getHeyyEmailLogoPng() {
  if (!cachedLogo) cachedLogo = loadHeyyEmailLogoPng();
  return cachedLogo;
}

async function loadHeyyEmailLogoPng(): Promise<HeyyRasterLogo | null> {
  try {
    const source = await readFile(
      path.join(
        process.cwd(),
        "public",
        "brand",
        "heyy",
        "heyy-full-colour-light.svg",
      ),
    );
    const { data, info } = await sharp(source)
      .resize({ width: 320, withoutEnlargement: false })
      .png()
      .toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height) return null;

    return {
      buffer: data,
      width: info.width,
      height: info.height,
      filename: "heyy-studio-logo.png",
      contentId: HEYY_EMAIL_LOGO_CID,
    };
  } catch (error) {
    cachedLogo = null;
    console.error("Heyy Studio email logo could not be prepared:", error);
    return null;
  }
}
