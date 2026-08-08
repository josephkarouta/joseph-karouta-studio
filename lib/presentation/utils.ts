export function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim() || fallback;
}

export function truncateText(value: unknown, maxLength: number, fallback = "") {
  const text = cleanText(value, fallback);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function safeFilename(value: unknown, fallback = "heyy-studio-export") {
  const text = cleanText(value, fallback)
    .normalize("NFKD")
    .replace(/[^\w\s-]+/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return text || fallback;
}

export function readAssetPayload(asset: any): Record<string, any> {
  const payload = asset?.output_payload;
  if (!payload) return {};

  if (typeof payload === "string") {
    try {
      return JSON.parse(payload) as Record<string, any>;
    } catch {
      return {};
    }
  }

  return typeof payload === "object" ? payload : {};
}

export function firstAsset(assets: any[], types: string[]) {
  return assets.find((asset) => types.includes(asset?.asset_type));
}

export function normaliseHex(value: unknown, fallback = "#6C00FF") {
  const text = cleanText(value);
  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(text)) return `#${text.toUpperCase()}`;
  return fallback;
}

export function hexToRgb(hex: string) {
  const safe = normaliseHex(hex).slice(1);
  const value = Number.parseInt(safe, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

export function hexToCmyk(hex: string) {
  const safe = normaliseHex(hex).slice(1);
  const r = Number.parseInt(safe.slice(0, 2), 16) / 255;
  const g = Number.parseInt(safe.slice(2, 4), 16) / 255;
  const b = Number.parseInt(safe.slice(4, 6), 16) / 255;
  const k = 1 - Math.max(r, g, b);

  if (k >= 0.999) return "0, 0, 0, 100";

  const c = Math.round(((1 - r - k) / (1 - k)) * 100);
  const m = Math.round(((1 - g - k) / (1 - k)) * 100);
  const y = Math.round(((1 - b - k) / (1 - k)) * 100);

  return `${c}, ${m}, ${y}, ${Math.round(k * 100)}`;
}

export function splitRows<T>(rows: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    output.push(rows.slice(index, index + size));
  }
  return output;
}

export function uniqueStrings(values: Array<unknown>) {
  return Array.from(
    new Set(values.map((value) => cleanText(value)).filter(Boolean)),
  );
}
