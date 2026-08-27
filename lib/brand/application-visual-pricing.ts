import { CREDIT_COSTS } from "@/lib/credits/config";

export type BrandSocialFormatDefinition = {
  id: string;
  label: string;
  width: number;
  height: number;
  aiSize: "1024x1024" | "1536x1024" | "1024x1536";
};

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function getBrandSocialFormatDefinitions(brief: any): BrandSocialFormatDefinition[] {
  const formats = safeText(brief?.formats).toLowerCase();
  const outputs: BrandSocialFormatDefinition[] = [];
  const add = (item: BrandSocialFormatDefinition) => {
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

export function getBrandApplicationCreditCost(applicationId: unknown, brief: any) {
  const outputCount = String(applicationId || "") === "social-system"
    ? getBrandSocialFormatDefinitions(brief).length
    : 1;
  return Math.max(1, outputCount) * CREDIT_COSTS.brandApplicationVisual;
}
