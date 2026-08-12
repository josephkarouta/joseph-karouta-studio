import { generateLogos } from "@/services/ai/image";
import { AI_CONFIG } from "@/services/ai/config";
import { runBrandImageJob } from "@/services/workspace/brand-image-job.service";

export async function generateBrandLogos({
  project,
  brand,
  logoDirection,
  creativeDirection,
  existingLogoUrl,
  tier = "preview",
  directionIndex = 0,
  existingConcepts = {},
  selectedLogoDirection = null,
}: {
  project: any;
  brand: any;
  logoDirection: any;
  creativeDirection?: any;
  existingLogoUrl?: string | null;
  tier?: "preview" | "final";
  directionIndex?: number;
  existingConcepts?: Record<number, any>;
  selectedLogoDirection?: number | null;
}) {
  if (AI_CONFIG.mockImages) {
    const mock = await generateLogos();
    if (mock) return mock;
  }

  const data = await runBrandImageJob(
    "/api/brand-studio/logo",
    {
      project,
      brand,
      logoDirection,
      creativeDirection,
      existingLogoUrl,
      tier,
      directionIndex,
      existingConcepts,
      selectedLogoDirection,
    },
    "Logo generation failed.",
  );

  return Array.isArray(data?.logos)
    ? data.logos.map((item: any) => ({ ...item, assetId: data.assetId || null }))
    : [];
}
