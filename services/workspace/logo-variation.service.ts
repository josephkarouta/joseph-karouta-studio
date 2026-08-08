import { generateLogos } from "@/services/ai/image";
import { AI_CONFIG } from "@/services/ai/config";

export async function generateBrandLogoVariations({
  project,
  brand,
  selectedLogo,
  logoDirection,
}: {
  project: any;
  brand: any;
  selectedLogo: any;
  logoDirection?: any;
}) {
  if (AI_CONFIG.mockImages) {
    const mock = await generateLogos();
    if (mock) return mock;
  }

  const response = await fetch("/api/brand-studio/logo-variations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, brand, selectedLogo, logoDirection }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Logo variation generation failed.");
  return data?.variations || [];
}
