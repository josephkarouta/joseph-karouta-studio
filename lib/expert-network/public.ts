export type ExpertNetworkPosition = {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employment_type?: string | null;
  summary?: string | null;
  description?: {
    paragraphs?: unknown[];
    sections?: Array<{ title?: unknown; paragraphs?: unknown[]; bullets?: unknown[] }>;
  } | null;
  closes_at?: string | null;
};

export function expertRoleSlug(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function expertStudioLabel(position: Pick<ExpertNetworkPosition, "department" | "title">) {
  const raw = `${position.department || ""} ${position.title || ""}`.toLowerCase();
  if (raw.includes("architect")) return "Architecture Studio";
  if (raw.includes("interior")) return "Interior Studio";
  if (raw.includes("marketing")) return "Marketing Studio";
  if (raw.includes("brand") || raw.includes("graphic")) return "Brand Studio";
  return position.department || "Heyy Studio";
}

export function expertRoleSections(position: ExpertNetworkPosition) {
  const description = position.description;
  if (!description || typeof description !== "object") return [];
  if (Array.isArray(description.sections) && description.sections.length) {
    return description.sections.map((section) => ({
      title: String(section.title || "Role details"),
      paragraphs: Array.isArray(section.paragraphs) ? section.paragraphs.map(String).filter(Boolean) : [],
      bullets: Array.isArray(section.bullets) ? section.bullets.map(String).filter(Boolean) : [],
    }));
  }
  const paragraphs = Array.isArray(description.paragraphs)
    ? description.paragraphs.map(String).filter(Boolean)
    : [];
  return paragraphs.length ? [{ title: "About this opportunity", paragraphs, bullets: [] }] : [];
}
