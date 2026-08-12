import { generateLogos } from "@/services/ai/image";
import { AI_CONFIG } from "@/services/ai/config";
import { runBrandImageJob } from "@/services/workspace/brand-image-job.service";

export async function generateBrandLogoVariations({
  project,
  brand,
  selectedLogo,
  logoDirection,
  directionIndex = 0,
  existingConcepts = {},
  selectedLogoDirection = null,
}: {
  project: any;
  brand: any;
  selectedLogo: any;
  logoDirection?: any;
  directionIndex?: number;
  existingConcepts?: Record<number, any>;
  selectedLogoDirection?: number | null;
}) {
  if (AI_CONFIG.mockImages) {
    const mock = await generateLogos();
    if (mock) return mock;
  }

  const data = await runBrandImageJob(
    "/api/brand-studio/logo-variations",
    {
      project,
      brand,
      selectedLogo,
      logoDirection,
      directionIndex,
      existingConcepts,
      selectedLogoDirection,
    },
    "Logo variation generation failed.",
  );

  return Array.isArray(data?.variations)
    ? data.variations.map((item: any) => ({ ...item, assetId: data.assetId || null }))
    : [];
}
