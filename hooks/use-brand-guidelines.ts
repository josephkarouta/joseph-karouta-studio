"use client";

import { useState } from "react";
import { useActivity } from "@/hooks/use-activity";
import { useAssets } from "@/hooks/use-assets";
import { useAuth } from "@/components/auth-provider";

type UseBrandGuidelinesArgs = {
  project?: any;
  brand?: any;
};

async function responseMessage(response: Response) {
  try {
    const payload = await response.json();
    return payload?.error || payload?.message || "Failed to generate brand guidelines.";
  } catch {
    return "Failed to generate brand guidelines.";
  }
}

export function useBrandGuidelines(args: UseBrandGuidelinesArgs = {}) {
  const { project, brand } = args;
  const { refreshAccount } = useAuth();
  const { addAsset } = useAssets();
  const { addActivity } = useActivity();

  const [loading, setLoading] = useState(false);
  const [guidelines, setGuidelines] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateGuidelines() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/brand-guidelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, brand }),
      });

      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }

      const data = await response.json();
      const nextGuidelines = data.guidelines || data.sections || data.brandGuidelines || data;

      if (!nextGuidelines || typeof nextGuidelines !== "object") {
        throw new Error("OpenAI returned an empty Brand Guidelines response.");
      }

      setGuidelines(nextGuidelines);
      await refreshAccount();

      if (project?.id && project?.user_id) {
        const savedAsset = await addAsset({
          user_id: project.user_id,
          project_id: project.id,
          project_type: "brand",
          asset_type: "brand_guidelines",
          title: `Brand Guidelines - ${project.project_name || "Brand Project"}`,
          input_payload: {
            projectName: project.project_name,
            industry: project.industry,
            audience: project.audience,
            style: project.style,
            projectJourney: brand?.projectJourney || null,
          },
          output_payload: {
            guidelines: nextGuidelines,
            brandSystem: brand,
          },
          file_url: null,
          thumbnail_url: null,
        });

        addActivity({
          id: savedAsset.id,
          title: "Brand guidelines generated",
          description: "The tailored Foundation, Identity, Applications and Checklist system was saved.",
          createdAt: "Now",
        });
      }

      return nextGuidelines;
    } catch (generationError) {
      const message = generationError instanceof Error
        ? generationError.message
        : "The guideline system could not be generated.";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { loading, guidelines, error, generateGuidelines };
}
