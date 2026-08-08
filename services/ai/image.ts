import { AI_CONFIG } from "./config";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateBrandMoodboards() {
  if (AI_CONFIG.simulateDelay) await wait(AI_CONFIG.simulateDelay);

  if (AI_CONFIG.mockImages) {
    return [
      {
        title: "Premium Direction",
        visualDirection: "Modern premium visual language.",
        applications: ["Website", "Social", "Packaging"],
      },
      {
        title: "Minimal Direction",
        visualDirection: "Minimal Scandinavian identity.",
        applications: ["Website", "Social", "Packaging"],
      },
      {
        title: "Luxury Direction",
        visualDirection: "Luxury editorial identity.",
        applications: ["Website", "Social", "Packaging"],
      },
    ];
  }

  return null;
}

export async function generateMoodboardVariations() {
  if (AI_CONFIG.simulateDelay) await wait(AI_CONFIG.simulateDelay);

  if (AI_CONFIG.mockImages) {
    return [{ imageUrl: "/demo/brand/moodboards/1.png" }];
  }

  return null;
}

export async function generateLogos() {
  if (AI_CONFIG.simulateDelay) await wait(AI_CONFIG.simulateDelay);

  if (AI_CONFIG.mockImages) {
    return [{ imageUrl: "/demo/brand/logos/1.png" }];
  }

  return null;
}