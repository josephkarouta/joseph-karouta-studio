"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useAssets } from "@/hooks/use-assets";
import { useActivity } from "@/hooks/use-activity";
import { generateBrandLogos } from "@/services/workspace/logo.service";
import { generateBrandLogoVariations } from "@/services/workspace/logo-variation.service";

function readPayload(asset: any) {
  const payload = asset?.output_payload;
  if (!payload) return {};
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch { return {}; }
  }
  return payload;
}

function latestAsset(assets: any[], types: string[]) {
  return assets.find((asset) => types.includes(asset.asset_type));
}

export function useLogos({ project, brand }: { project: any; brand: any }) {
  const { refreshAccount } = useAuth();
  const { assets, addAsset } = useAssets();
  const { addActivity } = useActivity();
  const [loadingDirection, setLoadingDirection] = useState<number | null>(null);
  const [variationLoading, setVariationLoading] = useState<number | null>(null);
  const [selectedLogoDirection, setSelectedLogoDirection] = useState<number | null>(null);
  const [concepts, setConcepts] = useState<Record<number, any>>({});
  const [error, setError] = useState("");

  const existingLogoAsset = useMemo(() => latestAsset(assets, ["existing_logo"]), [assets]);
  const selectedCreativeAsset = useMemo(
    () => latestAsset(assets, ["creative_direction_selected", "moodboard_selected", "moodboard"]),
    [assets],
  );
  const latestLogoAsset = useMemo(
    () => latestAsset(assets, ["logo_selected", "logo_variation", "logo_concept"]),
    [assets],
  );

  const existingLogoUrl = existingLogoAsset?.file_url || brand?.projectJourney?.existingLogoUrl || null;
  const selectedCreativeDirection = useMemo(() => {
    const payload = readPayload(selectedCreativeAsset);
    const directions = payload?.directions || payload?.moodboards || [];
    const selected = payload?.selectedMoodboard;
    return typeof selected === "number" ? directions[selected] : payload?.selectedConcept || null;
  }, [selectedCreativeAsset]);

  useEffect(() => {
    const payload = readPayload(latestLogoAsset);
    if (payload?.conceptsByDirection && typeof payload.conceptsByDirection === "object") {
      setConcepts(payload.conceptsByDirection);
    } else if (Array.isArray(payload?.logos) && typeof payload?.directionIndex === "number") {
      setConcepts({ [payload.directionIndex]: payload.logos[0] || null });
    }
    if (typeof payload?.selectedDirection === "number") setSelectedLogoDirection(payload.selectedDirection);
    else if (typeof payload?.directionIndex === "number") setSelectedLogoDirection(payload.directionIndex);
  }, [latestLogoAsset?.id]);

  function generatedImage(item: any) {
    if (!item?.imageUrl) {
      throw new Error("The generated logo was not saved by the server.");
    }
    return item;
  }


  async function save(nextConcepts: Record<number, any>, assetType: string, title: string, selectedDirection = selectedLogoDirection) {
    const selected = selectedDirection !== null ? nextConcepts[selectedDirection] : null;
    return addAsset({
      user_id: project.user_id,
      project_id: project.id,
      project_type: "brand",
      asset_type: assetType,
      title,
      input_payload: { projectName: project.project_name },
      output_payload: {
        conceptsByDirection: nextConcepts,
        selectedDirection,
        directionIndex: selectedDirection,
        selectedLogo: selectedDirection,
        logos: selected ? [selected] : [],
      },
      file_url: selected?.imageUrl || null,
      thumbnail_url: selected?.imageUrl || null,
    });
  }

  async function selectLogoDirection(index: number) {
    setSelectedLogoDirection(index);
    try {
      const saved = await save(concepts, "logo_selected", `Selected Logo Direction - ${index + 1}`, index);
      addActivity({ id: saved.id, title: "Logo direction selected", description: `Logo direction ${index + 1} is selected.`, createdAt: "Now" });
    } catch (selectionError) {
      console.error(selectionError);
    }
  }

  async function generateLogos(direction: any, index: number, tier: "preview" | "final" = "preview") {
    try {
      setLoadingDirection(index);
      setError("");
      const generated = await generateBrandLogos({
        project,
        brand,
        logoDirection: direction,
        creativeDirection: selectedCreativeDirection,
        existingLogoUrl,
        tier,
        directionIndex: index,
        existingConcepts: concepts,
        selectedLogoDirection,
      });
      const uploaded = generated?.[0] ? generatedImage(generated[0]) : null;
      if (!uploaded?.imageUrl) throw new Error("No logo image was returned.");
      const next = { ...concepts, [index]: { ...uploaded, directionIndex: index, tier, variation: null } };
      setConcepts(next);
      setSelectedLogoDirection(index);
      const saved = uploaded.assetId
        ? { id: uploaded.assetId }
        : await save(next, "logo_concept", `Logo Concept - ${direction.title || `Direction ${index + 1}`}`, index);
      addActivity({ id: saved.id, title: "Logo concept generated", description: `${direction.title || `Direction ${index + 1}`} now has a ${tier} logo concept.`, createdAt: "Now" });
      await refreshAccount();
    } catch (generationError) {
      console.error(generationError);
      setError(generationError instanceof Error ? generationError.message : "Logo generation failed.");
    } finally {
      setLoadingDirection(null);
    }
  }

  async function generateLogoVariations(index: number, direction: any) {
    const selected = concepts[index];
    if (!selected?.imageUrl) return;
    try {
      setVariationLoading(index);
      setError("");
      const generated = await generateBrandLogoVariations({
        project,
        brand,
        selectedLogo: selected,
        logoDirection: direction,
        directionIndex: index,
        existingConcepts: concepts,
        selectedLogoDirection,
      });
      const uploaded = generated?.[0] ? generatedImage(generated[0]) : null;
      if (!uploaded?.imageUrl) throw new Error("No logo variation was returned.");
      const next = { ...concepts, [index]: { ...selected, variation: { imageUrl: uploaded.imageUrl } } };
      setConcepts(next);
      if (!uploaded.assetId) {
        await save(next, "logo_variation", `Logo Variation - ${direction.title || `Direction ${index + 1}`}`, selectedLogoDirection);
      }
      await refreshAccount();
    } catch (variationError) {
      console.error(variationError);
      setError(variationError instanceof Error ? variationError.message : "Logo variation failed.");
    } finally {
      setVariationLoading(null);
    }
  }

  async function chooseLogoVariation(index: number) {
    const current = concepts[index];
    if (!current?.variation?.imageUrl) return;
    const next = { ...concepts, [index]: { ...current, imageUrl: current.variation.imageUrl, variation: null } };
    setConcepts(next);
    setSelectedLogoDirection(index);
    const saved = await save(next, "logo_selected", `Selected Logo - Direction ${index + 1}`, index);
    addActivity({ id: saved.id, title: "Logo variation selected", description: `The refined logo was applied inside direction ${index + 1}.`, createdAt: "Now" });
  }

  function discardLogoVariation(index: number) {
    setConcepts((current) => ({ ...current, [index]: { ...(current[index] || {}), variation: null } }));
  }

  return {
    concepts,
    loadingDirection,
    variationLoading,
    selectedLogoDirection,
    existingLogoUrl,
    selectedCreativeDirection,
    error,
    selectLogoDirection,
    generateLogos,
    generateLogoVariations,
    chooseLogoVariation,
    discardLogoVariation,
  };
}
