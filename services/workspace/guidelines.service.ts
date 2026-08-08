import { AI_CONFIG } from "@/services/ai/config";

export async function generateBrandGuidelines({
  project,
  brand,
}: {
  project: any;
  brand: any;
}) {
  if (AI_CONFIG.mockChat) {
    if (AI_CONFIG.simulateDelay) {
      await new Promise((resolve) => setTimeout(resolve, AI_CONFIG.simulateDelay));
    }

    return {
      brandOverview:
        "A premium, modern brand system designed to feel clear, confident and memorable across every touchpoint.",
      positioning:
        "A refined creative brand positioned around trust, clarity and premium service delivery.",
      personality: ["Premium", "Clear", "Confident", "Creative", "Reliable"],
      toneOfVoice: {
        headline: "Warm expertise with sharp clarity",
        description:
          "The brand should sound intelligent, approachable and professional, avoiding generic hype or overly technical language.",
        dos: [
          "Use simple confident language",
          "Explain value clearly",
          "Keep messages concise",
        ],
        donts: [
          "Avoid vague marketing clichés",
          "Avoid overpromising",
          "Avoid cold robotic language",
        ],
      },
      logoUsage: {
        primaryUse:
          "Use the logo with generous spacing on clean backgrounds to maintain a premium appearance.",
        clearSpace:
          "Keep clear space around the logo equal to the height of the main wordmark.",
        donts: [
          "Do not stretch the logo",
          "Do not add shadows or effects",
          "Do not place on busy backgrounds",
        ],
      },
      colourUsage:
        "Use the primary colour for key actions and brand moments. Keep neutrals dominant to protect the premium look.",
      typographyUsage:
        "Use strong typography hierarchy with large confident headlines, readable body copy and consistent spacing.",
      imageryStyle:
        "Imagery should feel curated, premium and intentional, with clean composition and strong visual atmosphere.",
      applications: ["Website", "Social Media", "Presentation", "Packaging"],
    };
  }

  const response = await fetch("/api/brand-studio/guidelines", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectName: project.project_name,
      industry: project.industry,
      audience: project.audience,
      style: project.style,
      brandSystem: brand,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Brand guidelines generation failed.");
  }

  return data?.guidelines;
}
