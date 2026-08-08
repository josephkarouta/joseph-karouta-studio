import { generateLogos } from "@/services/ai/image";
import { AI_CONFIG } from "@/services/ai/config";

export async function generateBrandLogos({
  project,
  brand,
  logoDirection,
  creativeDirection,
  existingLogoUrl,
  tier = "preview",
}: {
  project: any;
  brand: any;
  logoDirection: any;
  creativeDirection?: any;
  existingLogoUrl?: string | null;
  tier?: "preview" | "final";
}) {
  if (AI_CONFIG.mockImages) {
    const mock = await generateLogos();
    if (mock) return mock;
  }

  const response = await fetch("/api/brand-studio/logo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project,
      brand,
      logoDirection,
      creativeDirection,
      existingLogoUrl,
      tier,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Logo generation failed.");
  return data?.logos || [];
}
