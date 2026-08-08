import {
  PLATFORM_STUDIOS,
  getPlatformStudio,
  normalizeStudioId,
} from "../platform/platform-registry";

export type StudioIdentity = {
  id: string;
  label: string;
  shortLabel: string;
  initials: string;
  description: string;
  accent: string;
  accentDark: string;
  soft: string;
  border: string;
  gradient: string;
};

const STUDIO_IDENTITIES: Record<string, StudioIdentity> = Object.fromEntries(
  PLATFORM_STUDIOS.map((studio) => [
    studio.id,
    {
      id: studio.id,
      label: studio.label,
      shortLabel: studio.shortLabel,
      initials: studio.initials,
      description: studio.description,
      accent: studio.accent,
      accentDark: studio.accentDark,
      soft: studio.soft,
      border: studio.border,
      gradient: studio.gradient,
    },
  ]),
);

const FALLBACK_IDENTITY: StudioIdentity = {
  id: "studio",
  label: "Heyy Studio",
  shortLabel: "Studio",
  initials: "HS",
  description: "Heyy Studio creative production",
  accent: "#6c00ff",
  accentDark: "#4c00b4",
  soft: "#f3e8ff",
  border: "#c4b5fd",
  gradient: "linear-gradient(135deg, #f3e8ff 0%, #ffffff 100%)",
};

export { normalizeStudioId };

export function getStudioIdentity(value: unknown): StudioIdentity {
  const normalized = normalizeStudioId(value);
  const configuredStudio = getPlatformStudio(normalized);

  if (configuredStudio) {
    return STUDIO_IDENTITIES[configuredStudio.id];
  }

  return {
    ...FALLBACK_IDENTITY,
    id: normalized || FALLBACK_IDENTITY.id,
  };
}

export function getStudioLabel(value: unknown): string {
  return getStudioIdentity(value).label;
}
