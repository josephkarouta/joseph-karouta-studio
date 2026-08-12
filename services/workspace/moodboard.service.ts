import {
  generateBrandMoodboards as generateMockBrandMoodboards,
  generateMoodboardVariations as generateMockMoodboardVariations,
} from "@/services/ai/image";
import { AI_CONFIG } from "@/services/ai/config";
import { runBrandImageJob } from "@/services/workspace/brand-image-job.service";

export async function generateBrandCreativeDirections({
  project,
  brand,
}: {
  project: any;
  brand: any;
}) {
  const response = await fetch("/api/brand-studio/directions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, brand }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Creative-direction generation failed.");
  return data?.directions || [];
}

export async function generateBrandDirectionImage({
  project,
  brand,
  direction,
  tier = "preview",
  directionIndex = 0,
  directions = [],
  selectedMoodboard = null,
}: {
  project: any;
  brand: any;
  direction: any;
  tier?: "preview" | "final";
  directionIndex?: number;
  directions?: any[];
  selectedMoodboard?: number | null;
}) {
  if (AI_CONFIG.mockImages) {
    const mock = await generateMockBrandMoodboards();
    const first = mock?.[0];
    if (first) return first;
  }

  const data = await runBrandImageJob(
    "/api/brand-studio/moodboard",
    { project, brand, direction, tier, directionIndex, directions, selectedMoodboard },
    "Creative-direction image generation failed.",
  );
  return data;
}

export async function generateBrandMoodboardVariations({
  project,
  brand,
  selectedMoodboard,
  directionIndex = 0,
  directions = [],
  selectedMoodboardIndex = null,
}: {
  project: any;
  brand: any;
  selectedMoodboard: any;
  directionIndex?: number;
  directions?: any[];
  selectedMoodboardIndex?: number | null;
}) {
  if (AI_CONFIG.mockImages) {
    const mock = await generateMockMoodboardVariations();
    if (mock) return mock;
  }

  const data = await runBrandImageJob(
    "/api/brand-studio/moodboard-variations",
    {
      project,
      brand,
      direction: selectedMoodboard,
      currentImageUrl: selectedMoodboard?.imageUrl || null,
      directionIndex,
      directions,
      selectedMoodboard: selectedMoodboardIndex,
    },
    "Direction variation generation failed.",
  );

  return Array.isArray(data?.variations)
    ? data.variations.map((item: any) => ({ ...item, assetId: data.assetId || null }))
    : [];
}
