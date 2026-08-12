"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useAssets } from "@/hooks/use-assets";
import { useActivity } from "@/hooks/use-activity";
import {
  getProjectSettings,
  saveSelectedMoodboard,
} from "@/services/workspace/project-settings.service";
import {
  generateBrandCreativeDirections,
  generateBrandDirectionImage,
  generateBrandMoodboardVariations,
} from "@/services/workspace/moodboard.service";

function readPayload(asset: any) {
  const payload = asset?.output_payload;
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return payload;
}

function latestAsset(assets: any[], types: string[]) {
  return assets.find((asset) => types.includes(asset.asset_type));
}

function list(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => String(item).trim()).filter(Boolean)),
  );
}

function normaliseDirection(direction: any, index: number) {
  return {
    title: direction?.title || `Creative Direction ${index + 1}`,
    conceptIdea: direction?.conceptIdea || direction?.idea || direction?.summary || "A distinct creative idea.",
    strategicRole: direction?.strategicRole || direction?.strategy || "A clear strategic role for the brand.",
    brandStory: direction?.brandStory || direction?.story || direction?.visualDirection || "A concise direction story.",
    emotionalTone: list(direction?.emotionalTone || direction?.toneWords),
    visualWorld: direction?.visualWorld || direction?.visualDirection || "A coherent visual world.",
    imageStyle: direction?.imageStyle || "Consistent image art direction.",
    colourBehaviour: direction?.colourBehaviour || "A purposeful palette hierarchy.",
    graphicLanguage: direction?.graphicLanguage || "A repeatable graphic system.",
    differentiation: direction?.differentiation || "A meaningful point of difference.",
    bestFor: list(direction?.bestFor || direction?.applications),
    keywords: list(direction?.keywords),
    imagePrompt: direction?.imagePrompt || "Premium square brand creative-direction board.",
    imageUrl: direction?.imageUrl || null,
    imageTier: direction?.imageTier || null,
    variation: direction?.variation || null,
  };
}

function initialDirections(brand: any) {
  const source = Array.isArray(brand?.creativeDirections)
    ? brand.creativeDirections
    : Array.isArray(brand?.moodboardPrompts)
      ? brand.moodboardPrompts.slice(0, 3).map((prompt: string, index: number) => ({
          title: brand?.logoDirections?.[index]?.title || `Creative Direction ${index + 1}`,
          conceptIdea: prompt,
          brandStory: prompt,
          visualWorld: prompt,
          imagePrompt: prompt,
        }))
      : [];

  return source.slice(0, 3).map(normaliseDirection);
}

export function useMoodboards({ project, brand }: { project: any; brand: any }) {
  const { refreshAccount } = useAuth();
  const { assets, addAsset } = useAssets();
  const { addActivity } = useActivity();

  const [loading, setLoading] = useState(false);
  const [loadingDirection, setLoadingDirection] = useState<number | null>(null);
  const [variationLoading, setVariationLoading] = useState<number | null>(null);
  const [selecting, setSelecting] = useState<number | null>(null);
  const [selectedMoodboard, setSelectedMoodboard] = useState<number | null>(null);
  const [moodboards, setMoodboards] = useState<any[]>(() => initialDirections(brand));
  const [error, setError] = useState("");

  const latestDirectionAsset = useMemo(
    () => latestAsset(assets, ["creative_direction_selected", "moodboard_selected", "moodboard", "creative_directions"]),
    [assets],
  );

  useEffect(() => {
    async function loadSettings() {
      const settings = await getProjectSettings(project.id);
      setSelectedMoodboard(settings?.selected_moodboard ?? null);
    }
    if (project?.id) void loadSettings();
  }, [project?.id]);

  useEffect(() => {
    const payload = readPayload(latestDirectionAsset);
    const saved = payload?.directions || payload?.moodboards;
    if (Array.isArray(saved) && saved.length) {
      setMoodboards(saved.slice(0, 3).map(normaliseDirection));
    } else {
      setMoodboards(initialDirections(brand));
    }
    if (typeof payload?.selectedMoodboard === "number") {
      setSelectedMoodboard(payload.selectedMoodboard);
    }
  }, [latestDirectionAsset?.id, brand]);

  function generatedImage(item: any) {
    if (!item?.imageUrl) {
      throw new Error("The generated creative-direction image was not saved by the server.");
    }
    return item;
  }


  async function saveDirections(nextDirections: any[], assetType: string, title: string, selectedIndex = selectedMoodboard) {
    return addAsset({
      user_id: project.user_id,
      project_id: project.id,
      project_type: "brand",
      asset_type: assetType,
      title,
      input_payload: {
        projectName: project.project_name,
        industry: project.industry,
        audience: project.audience,
        style: project.style,
      },
      output_payload: {
        selectedMoodboard: selectedIndex,
        directions: nextDirections,
        moodboards: nextDirections,
        selectedConcept: selectedIndex !== null ? nextDirections[selectedIndex] : null,
      },
      file_url: selectedIndex !== null ? nextDirections[selectedIndex]?.imageUrl || null : nextDirections.find((item) => item.imageUrl)?.imageUrl || null,
      thumbnail_url: selectedIndex !== null ? nextDirections[selectedIndex]?.imageUrl || null : nextDirections.find((item) => item.imageUrl)?.imageUrl || null,
    });
  }

  async function generateMoodboards() {
    try {
      setLoading(true);
      setError("");
      const directions = await generateBrandCreativeDirections({ project, brand });
      const next = directions.slice(0, 3).map(normaliseDirection);
      setMoodboards(next);
      setSelectedMoodboard(null);
      await saveDirections(next, "creative_directions", `Creative Directions - ${project.project_name}`, null);
      addActivity({
        id: crypto.randomUUID(),
        title: "Creative directions generated",
        description: "Three text-first creative directions were prepared.",
        createdAt: "Now",
      });
    } catch (generationError) {
      console.error(generationError);
      setError(generationError instanceof Error ? generationError.message : "Creative directions could not be generated.");
    } finally {
      setLoading(false);
    }
  }

  async function selectDirection(index: number) {
    try {
      setSelecting(index);
      setError("");
      await saveSelectedMoodboard(project.id, index);
      setSelectedMoodboard(index);
      const saved = await saveDirections(
        moodboards,
        "creative_direction_selected",
        `Selected Creative Direction - ${moodboards[index]?.title || `Direction ${index + 1}`}`,
        index,
      );
      addActivity({
        id: saved.id,
        title: "Creative direction selected",
        description: `${moodboards[index]?.title || `Direction ${index + 1}`} is now the selected route.`,
        createdAt: "Now",
      });
    } catch (selectionError) {
      console.error(selectionError);
      setError("The creative direction could not be selected.");
    } finally {
      setSelecting(null);
    }
  }

  async function generateDirectionVisual(index: number, tier: "preview" | "final" = "preview") {
    try {
      setLoadingDirection(index);
      setError("");
      const generated = await generateBrandDirectionImage({
        project,
        brand,
        direction: moodboards[index],
        tier,
        directionIndex: index,
        directions: moodboards,
        selectedMoodboard,
      });
      const uploaded = generatedImage(generated);
      const next = moodboards.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, imageUrl: uploaded.imageUrl, imageTier: tier, variation: null }
          : item,
      );
      setMoodboards(next);
      const saved = uploaded.assetId
        ? { id: uploaded.assetId }
        : await saveDirections(next, "moodboard", `Creative Direction Visual - ${next[index]?.title}`, selectedMoodboard);
      await refreshAccount();
      addActivity({
        id: saved.id,
        title: "Creative-direction visual generated",
        description: `${next[index]?.title} now has a ${tier} visual board.`,
        createdAt: "Now",
      });
    } catch (generationError) {
      console.error(generationError);
      setError(generationError instanceof Error ? generationError.message : "The direction visual could not be generated.");
    } finally {
      setLoadingDirection(null);
    }
  }

  async function generateVariations(index: number) {
    try {
      setVariationLoading(index);
      setError("");
      const generated = await generateBrandMoodboardVariations({
        project,
        brand,
        selectedMoodboard: moodboards[index],
        directionIndex: index,
        directions: moodboards,
        selectedMoodboardIndex: selectedMoodboard,
      });
      const uploaded = generated?.[0] ? generatedImage(generated[0]) : null;
      if (!uploaded?.imageUrl) throw new Error("No direction variation image was returned.");
      const next = moodboards.map((item, itemIndex) =>
        itemIndex === index ? { ...item, variation: { imageUrl: uploaded.imageUrl } } : item,
      );
      setMoodboards(next);
      if (!uploaded.assetId) {
        await saveDirections(next, "moodboard_variations", `Creative Direction Variation - ${next[index]?.title}`, selectedMoodboard);
      }
      await refreshAccount();
    } catch (variationError) {
      console.error(variationError);
      setError(variationError instanceof Error ? variationError.message : "The variation could not be generated.");
    } finally {
      setVariationLoading(null);
    }
  }

  async function chooseVariation(index: number) {
    const variation = moodboards[index]?.variation;
    if (!variation?.imageUrl) return;
    const next = moodboards.map((item, itemIndex) =>
      itemIndex === index
        ? { ...item, imageUrl: variation.imageUrl, imageTier: "preview", variation: null }
        : item,
    );
    setMoodboards(next);
    const saved = await saveDirections(next, "moodboard_selected", `Selected Direction Variation - ${next[index]?.title}`, selectedMoodboard);
    addActivity({
      id: saved.id,
      title: "Direction variation selected",
      description: `The refined visual was applied inside ${next[index]?.title}.`,
      createdAt: "Now",
    });
  }

  function discardVariation(index: number) {
    setMoodboards((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, variation: null } : item));
  }

  return {
    loading,
    loadingDirection,
    variationLoading,
    selecting,
    selectedMoodboard,
    moodboards,
    error,
    generateMoodboards,
    selectDirection,
    generateDirectionVisual,
    generateVariations,
    chooseVariation,
    discardVariation,
  };
}
