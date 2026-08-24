import { CREDIT_COSTS } from "@/lib/credits/config";

export type StudioAvailability = "live" | "coming_soon" | "hidden";
export type ToolAvailability = "live" | "coming_soon" | "hidden";

export type PlatformStudio = {
  id: string;
  label: string;
  shortLabel: string;
  initials: string;
  description: string;
  href?: string;
  availability: StudioAvailability;
  visible: boolean;
  prompt: string;
  activePrefixes: string[];
  accent: string;
  accentDark: string;
  soft: string;
  border: string;
  gradient: string;
};

export type PlatformTool = {
  id:
    | "text_to_image"
    | "image_to_video"
    | "ai_upscaler"
    | "powerpoint_generator"
    | "digital_adaptations";
  label: string;
  description: string;
  href: string;
  availability: ToolAvailability;
  visible: true;
  accent: string;
  soft: string;
  creditLabel: string;
};

export const PLATFORM_STUDIOS: PlatformStudio[] = [
  {
    id: "brand_studio",
    label: "Brand Studio",
    shortLabel: "Brand",
    initials: "BR",
    description: "Strategy, identity, applications and production-ready direction.",
    href: "/brand-studio",
    availability: "live",
    visible: true,
    prompt: "I need a brand identity and creative direction.",
    activePrefixes: ["/brand-studio", "/dashboard/brand"],
    accent: "#9f2ce0",
    accentDark: "#d39bff",
    soft: "rgba(221, 157, 255, .16)",
    border: "rgba(190, 89, 235, .36)",
    gradient: "linear-gradient(135deg, #fbe8ff 0%, #f5edff 45%, #ffffff 100%)",
  },
  {
    id: "marketing_studio",
    label: "Marketing Studio",
    shortLabel: "Marketing",
    initials: "MK",
    description: "Campaign strategy, content systems and performance creative.",
    href: "/marketing-studio",
    availability: "live",
    visible: true,
    prompt: "I need help planning a marketing campaign.",
    activePrefixes: ["/marketing-studio", "/dashboard/marketing"],
    accent: "#eb3d87",
    accentDark: "#ff91c3",
    soft: "rgba(255, 94, 167, .14)",
    border: "rgba(235, 61, 135, .32)",
    gradient: "linear-gradient(135deg, #ffe8f4 0%, #fff0f7 48%, #ffffff 100%)",
  },
  {
    id: "architecture_studio",
    label: "Architecture Studio",
    shortLabel: "Architecture",
    initials: "AR",
    description: "Sites, briefs, planning, materials, concept plans and visuals.",
    href: "/architecture-studio",
    availability: "live",
    visible: true,
    prompt: "I need help developing an architecture project.",
    activePrefixes: ["/architecture-studio", "/dashboard/architecture"],
    accent: "#1676e8",
    accentDark: "#7eb6ff",
    soft: "rgba(73, 146, 255, .14)",
    border: "rgba(60, 139, 242, .34)",
    gradient: "linear-gradient(135deg, #e8f2ff 0%, #eef4ff 48%, #ffffff 100%)",
  },
  {
    id: "interior_studio",
    label: "Interior Design Studio",
    shortLabel: "Interior",
    initials: "IN",
    description: "Room layouts, materials, furniture, lighting and visual concepts.",
    href: "/interior-studio",
    availability: "live",
    visible: true,
    prompt: "I need help planning an interior design project.",
    activePrefixes: ["/interior-studio", "/dashboard/interior"],
    accent: "#d06b14",
    accentDark: "#ffbd75",
    soft: "rgba(255, 177, 81, .16)",
    border: "rgba(232, 137, 44, .34)",
    gradient: "linear-gradient(135deg, #fff0df 0%, #fff7ed 48%, #ffffff 100%)",
  },
  {
    id: "website_studio",
    label: "Website Studio",
    shortLabel: "Website",
    initials: "WB",
    description: "Web strategy, UX and digital production.",
    availability: "hidden",
    visible: false,
    prompt: "I need help with a website project.",
    activePrefixes: ["/website-studio", "/dashboard/website"],
    accent: "#059669",
    accentDark: "#6ee7b7",
    soft: "rgba(16,185,129,.12)",
    border: "rgba(16,185,129,.30)",
    gradient: "linear-gradient(135deg, #d1fae5 0%, #ffffff 100%)",
  },
  {
    id: "event_studio",
    label: "Event Studio",
    shortLabel: "Event",
    initials: "EV",
    description: "Event concepts, campaigns and experiences.",
    availability: "hidden",
    visible: false,
    prompt: "I need event branding and creative direction.",
    activePrefixes: ["/event-studio", "/dashboard/event"],
    accent: "#db2777",
    accentDark: "#f9a8d4",
    soft: "rgba(219,39,119,.12)",
    border: "rgba(219,39,119,.30)",
    gradient: "linear-gradient(135deg, #fce7f3 0%, #ffffff 100%)",
  },
  {
    id: "video_studio",
    label: "Video Studio",
    shortLabel: "Video",
    initials: "VD",
    description: "Video concepts, storyboards and production.",
    availability: "hidden",
    visible: false,
    prompt: "I need help planning a video project.",
    activePrefixes: ["/video-studio", "/dashboard/video"],
    accent: "#dc2626",
    accentDark: "#fca5a5",
    soft: "rgba(220,38,38,.12)",
    border: "rgba(220,38,38,.30)",
    gradient: "linear-gradient(135deg, #fee2e2 0%, #ffffff 100%)",
  },
  {
    id: "ai_studio",
    label: "AI Studio",
    shortLabel: "AI",
    initials: "AI",
    description: "Legacy AI-assisted creative workspace.",
    availability: "hidden",
    visible: false,
    prompt: "I need help structuring a creative project.",
    activePrefixes: ["/ai-studio"],
    accent: "#4f46e5",
    accentDark: "#a5b4fc",
    soft: "rgba(79,70,229,.12)",
    border: "rgba(79,70,229,.30)",
    gradient: "linear-gradient(135deg, #e0e7ff 0%, #ffffff 100%)",
  },
];

export const VISIBLE_STUDIOS = PLATFORM_STUDIOS.filter((studio) => studio.visible);
export const LIVE_STUDIOS = VISIBLE_STUDIOS.filter(
  (studio) => studio.availability === "live",
);
export const VISIBLE_STUDIO_IDS = VISIBLE_STUDIOS.map((studio) => studio.id);

export const PLATFORM_TOOLS: PlatformTool[] = [
  {
    id: "text_to_image",
    label: "Text to Image",
    description: "Generate and refine high-quality images from a prompt.",
    href: "/tools/text-to-image",
    availability: "live",
    visible: true,
    accent: "#7c3aed",
    soft: "rgba(124,58,237,.12)",
    creditLabel: `From ${CREDIT_COSTS.textToImagePreview} credits`,
  },
  {
    id: "image_to_video",
    label: "Image to Video",
    description: "Animate a still image with guided motion and camera direction.",
    href: "/tools/image-to-video",
    availability: "live",
    visible: true,
    accent: "#db2777",
    soft: "rgba(219,39,119,.12)",
    creditLabel: `From ${CREDIT_COSTS.imageToVideoPreview} credits`,
  },
  {
    id: "digital_adaptations",
    label: "Digital Adaptations",
    description: "Adapt one approved key visual across social, web and display sizes.",
    href: "/tools/digital-adaptations",
    availability: "live",
    visible: true,
    accent: "#6f2dff",
    soft: "rgba(111,45,255,.12)",
    creditLabel: `${CREDIT_COSTS.digitalAdaptationFamily} credits per aspect family`,
  },
  {
    id: "ai_upscaler",
    label: "AI Upscaler",
    description: "Increase resolution and recover detail with professional image enhancement.",
    href: "/tools/ai-upscaler",
    availability: "live",
    visible: true,
    accent: "#0284c7",
    soft: "rgba(2,132,199,.12)",
    creditLabel: `From ${CREDIT_COSTS.aiUpscale2x} credits`,
  },
  {
    id: "powerpoint_generator",
    label: "PowerPoint Generator",
    description: "Turn a brief into a structured, editable presentation.",
    href: "/tools/powerpoint-generator",
    availability: "live",
    visible: true,
    accent: "#ea580c",
    soft: "rgba(234,88,12,.12)",
    creditLabel: `From ${CREDIT_COSTS.powerpointDraft} credits`,
  }
];

export function normalizeStudioId(value: unknown): string {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const aliases: Record<string, string> = {
    brand: "brand_studio",
    branding: "brand_studio",
    brand_design: "brand_studio",
    architecture: "architecture_studio",
    architectural: "architecture_studio",
    architect: "architecture_studio",
    interior: "interior_studio",
    interior_design: "interior_studio",
    interior_design_studio: "interior_studio",
    marketing: "marketing_studio",
    campaign: "marketing_studio",
    campaigns: "marketing_studio",
  };

  return aliases[normalized] || normalized;
}

export function getPlatformStudio(value: unknown): PlatformStudio | undefined {
  const normalized = normalizeStudioId(value);
  return PLATFORM_STUDIOS.find((studio) => studio.id === normalized);
}

export function isVisibleStudio(value: unknown): boolean {
  return Boolean(getPlatformStudio(value)?.visible);
}
