import {
  generateBrandMoodboards as generateMockBrandMoodboards,
  generateMoodboardVariations as generateMockMoodboardVariations,
} from "@/services/ai/image";
import { AI_CONFIG } from "@/services/ai/config";

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
}: {
  project: any;
  brand: any;
  direction: any;
  tier?: "preview" | "final";
}) {
  if (AI_CONFIG.mockImages) {
    const mock = await generateMockBrandMoodboards();
    const first = mock?.[0];
    if (first) return first;
  }

  const response = await fetch("/api/brand-studio/moodboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, brand, direction, tier }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Creative-direction image generation failed.");
  return data;
}

export async function generateBrandMoodboardVariations({
  project,
  brand,
  selectedMoodboard,
}: {
  project: any;
  brand: any;
  selectedMoodboard: any;
}) {
  if (AI_CONFIG.mockImages) {
    const mock = await generateMockMoodboardVariations();
    if (mock) return mock;
  }

  const response = await fetch("/api/brand-studio/moodboard-variations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project,
      brand,
      direction: selectedMoodboard,
      currentImageUrl: selectedMoodboard?.imageUrl || null,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Direction variation generation failed.");
  return data?.variations || [];
}
