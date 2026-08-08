import "server-only";

import sharp from "sharp";

export type LogoPaletteColour = {
  name: string;
  hex: string;
  rgb: string;
  cmyk: string;
  role: "Primary" | "Secondary" | "Accent" | "Neutral" | "Support";
  usage: string;
  source: "logo";
};

type Candidate = {
  r: number;
  g: number;
  b: number;
  count: number;
  saturation: number;
  luminance: number;
};

function clamp(value: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => clamp(Math.round(value)).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function rgbToCmyk(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const key = 1 - Math.max(red, green, blue);
  if (key >= 0.999) return "0, 0, 0, 100";
  const cyan = Math.round(((1 - red - key) / (1 - key)) * 100);
  const magenta = Math.round(((1 - green - key) / (1 - key)) * 100);
  const yellow = Math.round(((1 - blue - key) / (1 - key)) * 100);
  return `${cyan}, ${magenta}, ${yellow}, ${Math.round(key * 100)}`;
}

function colourMetrics(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { saturation, luminance };
}

function distance(a: Candidate, b: Candidate) {
  return Math.sqrt(
    (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2,
  );
}

function hueName(r: number, g: number, b: number, luminance: number, saturation: number) {
  if (luminance < 42) return "Logo Black";
  if (saturation < 0.12) {
    if (luminance > 210) return "Logo White";
    if (luminance > 145) return "Logo Light Grey";
    return "Logo Charcoal";
  }

  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;

  if (hue < 18 || hue >= 345) return "Logo Red";
  if (hue < 45) return "Logo Orange";
  if (hue < 70) return "Logo Yellow";
  if (hue < 165) return "Logo Green";
  if (hue < 195) return "Logo Teal";
  if (hue < 250) return "Logo Blue";
  if (hue < 305) return "Logo Purple";
  return "Logo Magenta";
}

function paletteItem(candidate: Candidate, index: number): LogoPaletteColour {
  const roles: LogoPaletteColour["role"][] = [
    "Primary",
    "Secondary",
    "Accent",
    "Neutral",
    "Support",
  ];
  const usages = [
    "Primary brand colour taken directly from the approved logo.",
    "Secondary logo colour for supporting hierarchy and contrast.",
    "Accent colour extracted from the logo for highlights and calls to action.",
    "Neutral logo colour for backgrounds, typography and contrast.",
    "Supporting colour derived from the approved logo artwork.",
  ];
  return {
    name: hueName(
      candidate.r,
      candidate.g,
      candidate.b,
      candidate.luminance,
      candidate.saturation,
    ),
    hex: toHex(candidate.r, candidate.g, candidate.b),
    rgb: `${Math.round(candidate.r)}, ${Math.round(candidate.g)}, ${Math.round(candidate.b)}`,
    cmyk: rgbToCmyk(candidate.r, candidate.g, candidate.b),
    role: roles[index] || "Support",
    usage: usages[index] || usages[4],
    source: "logo",
  };
}

export async function extractLogoPalette(buffer: Buffer): Promise<LogoPaletteColour[]> {
  const { data, info } = await sharp(buffer)
    .rotate()
    .ensureAlpha()
    .resize(220, 220, { fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bins = new Map<
    string,
    { count: number; r: number; g: number; b: number }
  >();
  const step = 20;

  for (let offset = 0; offset < data.length; offset += info.channels) {
    const r = data[offset] || 0;
    const g = data[offset + 1] || 0;
    const b = data[offset + 2] || 0;
    const alpha = info.channels >= 4 ? data[offset + 3] || 0 : 255;
    if (alpha < 45) continue;

    // Ignore paper/transparent-background whites while preserving intentional greys.
    if (r > 242 && g > 242 && b > 242) continue;

    const key = `${Math.round(r / step)}-${Math.round(g / step)}-${Math.round(b / step)}`;
    const current = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    current.count += 1;
    current.r += r;
    current.g += g;
    current.b += b;
    bins.set(key, current);
  }

  const candidates: Candidate[] = Array.from(bins.values())
    .filter((entry) => entry.count >= 2)
    .map((entry) => {
      const r = entry.r / entry.count;
      const g = entry.g / entry.count;
      const b = entry.b / entry.count;
      const metrics = colourMetrics(r, g, b);
      return { r, g, b, count: entry.count, ...metrics };
    })
    .sort((a, b) => b.count - a.count);

  if (!candidates.length) return [];

  const selected: Candidate[] = [];
  const add = (candidate: Candidate | undefined) => {
    if (!candidate) return;
    if (selected.some((current) => distance(current, candidate) < 48)) return;
    selected.push(candidate);
  };

  // Keep the dominant logo colour first, then deliberately retain a small vivid accent.
  add(candidates[0]);
  add(
    [...candidates]
      .filter((candidate) => candidate.saturation > 0.24)
      .sort(
        (a, b) =>
          b.saturation * 100000 + b.count -
          (a.saturation * 100000 + a.count),
      )[0],
  );

  for (const candidate of candidates) {
    if (selected.length >= 4) break;
    add(candidate);
  }

  // Logo systems need a usable light neutral, but it is added after real logo colours.
  if (selected.length < 5) {
    const neutral: Candidate = {
      r: 248,
      g: 248,
      b: 250,
      count: 1,
      saturation: 0.01,
      luminance: 248,
    };
    add(neutral);
  }

  return selected.slice(0, 5).map(paletteItem);
}

export async function extractLogoPaletteFromUrl(url: string) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error("Unsupported logo URL.");
  }
  const response = await fetch(parsed.toString(), { cache: "no-store" });
  if (!response.ok) throw new Error("The selected logo could not be loaded.");
  return extractLogoPalette(Buffer.from(await response.arrayBuffer()));
}
