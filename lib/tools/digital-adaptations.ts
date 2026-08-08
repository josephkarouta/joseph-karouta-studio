export type AdaptationFamily =
  | "square"
  | "portrait"
  | "story"
  | "landscape"
  | "wide"
  | "banner";

export type DigitalAdaptationPreset = {
  id: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  family: AdaptationFamily;
  category: "Social" | "Web" | "Display";
};

export type DigitalAdaptationFormat = Pick<
  DigitalAdaptationPreset,
  "id" | "label" | "platform" | "width" | "height" | "family"
>;

export const DIGITAL_ADAPTATION_PRESETS: DigitalAdaptationPreset[] = [
  { id: "instagram-square", label: "Instagram Square", platform: "Instagram", width: 1080, height: 1080, family: "square", category: "Social" },
  { id: "instagram-portrait", label: "Instagram Portrait", platform: "Instagram", width: 1080, height: 1350, family: "portrait", category: "Social" },
  { id: "instagram-story", label: "Instagram Story / Reel", platform: "Instagram", width: 1080, height: 1920, family: "story", category: "Social" },
  { id: "facebook-feed", label: "Facebook Feed Portrait", platform: "Facebook", width: 1200, height: 1500, family: "portrait", category: "Social" },
  { id: "facebook-cover", label: "Facebook Cover", platform: "Facebook", width: 1640, height: 624, family: "wide", category: "Social" },
  { id: "linkedin-square", label: "LinkedIn Square", platform: "LinkedIn", width: 1200, height: 1200, family: "square", category: "Social" },
  { id: "linkedin-landscape", label: "LinkedIn Landscape", platform: "LinkedIn", width: 1200, height: 627, family: "wide", category: "Social" },
  { id: "linkedin-banner", label: "LinkedIn Company Banner", platform: "LinkedIn", width: 1584, height: 396, family: "banner", category: "Social" },
  { id: "youtube-thumbnail", label: "YouTube Thumbnail", platform: "YouTube", width: 1280, height: 720, family: "landscape", category: "Social" },
  { id: "x-landscape", label: "X / Twitter Landscape", platform: "X", width: 1600, height: 900, family: "landscape", category: "Social" },
  { id: "website-hero", label: "Website Hero", platform: "Website", width: 1920, height: 1080, family: "landscape", category: "Web" },
  { id: "website-wide-banner", label: "Website Wide Banner", platform: "Website", width: 1920, height: 600, family: "wide", category: "Web" },
  { id: "display-medium-rectangle", label: "Display Medium Rectangle", platform: "Google Display", width: 300, height: 250, family: "square", category: "Display" },
  { id: "display-leaderboard", label: "Display Leaderboard", platform: "Google Display", width: 728, height: 90, family: "banner", category: "Display" },
  { id: "display-half-page", label: "Display Half Page", platform: "Google Display", width: 300, height: 600, family: "story", category: "Display" },
  { id: "display-mobile-banner", label: "Display Mobile Banner", platform: "Google Display", width: 320, height: 100, family: "banner", category: "Display" },
];

export const ADAPTATION_FAMILY_LABELS: Record<AdaptationFamily, string> = {
  square: "square composition",
  portrait: "4:5 portrait composition",
  story: "9:16 vertical story composition",
  landscape: "16:9 landscape composition",
  wide: "wide horizontal composition",
  banner: "extra-wide banner composition",
};

export function familyForDimensions(width: number, height: number): AdaptationFamily {
  const ratio = width / height;
  if (ratio >= 4) return "banner";
  if (ratio >= 1.7) return "wide";
  if (ratio > 1.12) return "landscape";
  if (ratio <= 0.62) return "story";
  if (ratio < 0.9) return "portrait";
  return "square";
}

export function validateAdaptationFormat(value: unknown): DigitalAdaptationFormat | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<DigitalAdaptationFormat>;
  const width = Number(item.width);
  const height = Number(item.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 100 || height < 100 || width > 5000 || height > 5000) return null;
  const family = familyForDimensions(width, height);
  const id = String(item.id || `custom-${width}x${height}`).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  return {
    id,
    label: String(item.label || `${width} × ${height}`).slice(0, 100),
    platform: String(item.platform || "Custom").slice(0, 60),
    width,
    height,
    family,
  };
}

export function uniqueFamilies(formats: DigitalAdaptationFormat[]) {
  return Array.from(new Set(formats.map((format) => format.family)));
}
