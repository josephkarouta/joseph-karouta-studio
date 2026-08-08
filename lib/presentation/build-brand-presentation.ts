import type {
  PresentationDocument,
  PresentationImage,
  PresentationPaletteItem,
  PresentationTypographyItem,
} from "@/lib/presentation/types";
import {
  cleanText,
  firstAsset,
  hexToCmyk,
  hexToRgb,
  normaliseHex,
  readAssetPayload,
  safeFilename,
} from "@/lib/presentation/utils";

function pickSelectedItem(payload: Record<string, any>, collectionNames: string[], indexNames: string[]) {
  for (const collectionName of collectionNames) {
    const collection = payload?.[collectionName];
    if (!Array.isArray(collection) || collection.length === 0) continue;

    const rawIndex = indexNames
      .map((key) => payload?.[key])
      .find((value) => typeof value === "number");
    const index = typeof rawIndex === "number" ? rawIndex : 0;

    return collection[index] || collection[0] || null;
  }

  return null;
}

function imageFromAssetItem(item: any, label: string, fit: "cover" | "contain" = "cover"): PresentationImage | null {
  const url =
    cleanText(item?.imageUrl) ||
    cleanText(item?.image_url) ||
    cleanText(item?.url) ||
    cleanText(item?.file_url);

  if (!url) return null;
  return { url, label, fit };
}

function selectedMoodboard(assets: any[]) {
  const asset = firstAsset(assets, [
    "moodboard_selected",
    "moodboard_variations",
    "moodboard",
    "creative_direction_selected",
  ]);
  const payload = readAssetPayload(asset);
  const selected =
    pickSelectedItem(payload, ["moodboards", "variations"], ["selectedMoodboard", "selectedVariation"]) ||
    payload?.selectedConcept ||
    null;

  return imageFromAssetItem(
    selected || (asset?.file_url ? { file_url: asset.file_url } : null),
    "Selected moodboard",
    "contain",
  );
}

function selectedLogo(assets: any[]) {
  const asset = firstAsset(assets, ["logo_selected", "logo_variation", "logo_concept"]);
  const payload = readAssetPayload(asset);
  const selectedDirection = [payload?.selectedDirection, payload?.directionIndex, payload?.selectedLogo]
    .find((value) => typeof value === "number");
  const selected =
    pickSelectedItem(payload, ["logos", "variations"], ["selectedLogo", "selectedVariation"]) ||
    (typeof selectedDirection === "number"
      ? payload?.conceptsByDirection?.[selectedDirection]
      : null) ||
    null;

  return imageFromAssetItem(
    selected || (asset?.file_url ? { file_url: asset.file_url } : null),
    "Selected logo",
    "contain",
  );
}

function selectedConcept(assets: any[], brand: any) {
  const asset = firstAsset(assets, [
    "creative_direction_selected",
    "moodboard_selected",
    "moodboard",
  ]);
  const payload = readAssetPayload(asset);
  const selected =
    payload?.selectedConcept ||
    pickSelectedItem(payload, ["concepts", "moodboards", "variations"], [
      "selectedConcept",
      "selectedMoodboard",
      "selectedVariation",
    ]) ||
    null;

  if (selected && typeof selected === "object") return selected;

  const selectedIndex = [
    payload?.selectedConcept,
    payload?.selectedMoodboard,
    payload?.selectedVariation,
  ].find((value) => typeof value === "number");
  const directions = Array.isArray(brand?.creativeDirections)
    ? brand.creativeDirections
    : [];

  return (
    (typeof selectedIndex === "number" ? directions[selectedIndex] : null) ||
    directions[0] ||
    {}
  );
}

function selectedLogoDirection(assets: any[], brand: any) {
  const asset = firstAsset(assets, ["logo_selected", "logo_variation", "logo_concept"]);
  const payload = readAssetPayload(asset);
  const selectedIndex = [payload?.selectedDirection, payload?.directionIndex, payload?.selectedLogo]
    .find((value) => typeof value === "number");
  const directions = Array.isArray(brand?.logoDirections) ? brand.logoDirections : [];
  return (
    (typeof selectedIndex === "number" ? directions[selectedIndex] : null) ||
    directions[0] ||
    {}
  );
}

function readableApplicationName(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function applicationVisualPages(assets: any[]) {
  const pages: Array<{
    id: string;
    applicationLabel: string;
    outputLabel: string;
    image: PresentationImage;
  }> = [];
  const handledApplications = new Set<string>();

  for (const asset of assets) {
    if (asset?.asset_type !== "brand_application_visual") continue;
    const payload = readAssetPayload(asset);
    const applicationId = cleanText(payload?.applicationId);
    if (!applicationId || handledApplications.has(applicationId)) continue;
    handledApplications.add(applicationId);

    const applicationLabel = cleanText(
      payload?.applicationLabel,
      readableApplicationName(applicationId),
    );
    const outputs = Array.isArray(payload?.outputs) && payload.outputs.length
      ? payload.outputs
      : [
          {
            id: applicationId,
            label: applicationLabel,
            imageUrl: payload?.imageUrl || asset?.file_url,
          },
        ];

    outputs.forEach((output: any, outputIndex: number) => {
      const image = imageFromAssetItem(
        output,
        cleanText(output?.label, `${applicationLabel} preview`),
        "contain",
      );
      if (!image) return;
      const outputLabel = cleanText(output?.label, `${applicationLabel} preview`);
      pages.push({
        id: `${applicationId}-${cleanText(output?.id, String(outputIndex + 1))}`,
        applicationLabel,
        outputLabel,
        image: { ...image, caption: outputLabel, fit: "contain" },
      });
    });
  }

  return pages;
}

function paletteItems(brand: any): PresentationPaletteItem[] {
  const values =
    brand?.colourPalette ||
    brand?.colorPalette ||
    brand?.colors ||
    brand?.colour_system ||
    [];

  if (!Array.isArray(values)) return [];

  return values.slice(0, 8).map((item: any, index: number) => {
    const rawHex =
      typeof item === "string"
        ? item
        : item?.hex || item?.value || item?.color || item?.colour;
    const hex = normaliseHex(rawHex, ["#6C00FF", "#17151F", "#F2E9FF", "#FFFFFF"][index % 4]);

    return {
      name:
        typeof item === "string"
          ? `Colour ${index + 1}`
          : cleanText(item?.name || item?.role, `Colour ${index + 1}`),
      hex,
      rgb: cleanText(item?.rgb, hexToRgb(hex)),
      cmyk: cleanText(item?.cmyk, hexToCmyk(hex)),
    };
  });
}

function typographyItems(brand: any): PresentationTypographyItem[] {
  const values =
    brand?.typography ||
    brand?.typographySystem ||
    brand?.fonts ||
    brand?.type_system ||
    [];

  if (!Array.isArray(values)) return [];

  return values.slice(0, 4).map((item: any, index: number) => ({
    name:
      typeof item === "string"
        ? item
        : cleanText(item?.font || item?.name || item?.family, "Typography"),
    role:
      typeof item === "string"
        ? index === 0
          ? "Primary heading"
          : "Body typography"
        : cleanText(item?.role, index === 0 ? "Primary heading" : "Body typography"),
    sample: cleanText(item?.sample, "Aa Bb Cc 0123"),
    reason: cleanText(item?.reason || item?.description),
  }));
}

function strategyText(brand: any) {
  return (
    cleanText(brand?.brandStrategy?.description) ||
    cleanText(brand?.brandStrategy?.positioning) ||
    cleanText(brand?.strategy?.description) ||
    cleanText(brand?.summary) ||
    "The saved brand strategy will be organised here when the project contains approved strategic content."
  );
}

function voiceText(brand: any) {
  return (
    cleanText(brand?.brandVoice?.description) ||
    cleanText(brand?.brandVoice?.headline) ||
    cleanText(brand?.voice?.description) ||
    "The approved voice, personality and communication principles will appear here."
  );
}

export function buildBrandPresentation({
  project,
  brand,
  assets,
}: {
  project: any;
  brand: any;
  assets: any[];
}): PresentationDocument {
  const projectName = cleanText(project?.project_name, "Brand Project");
  const moodboard = selectedMoodboard(assets);
  const logo = selectedLogo(assets);
  const concept = selectedConcept(assets, brand);
  const logoDirection = selectedLogoDirection(assets, brand);
  const applicationPages = applicationVisualPages(assets);
  const palette = paletteItems(brand);
  const typography = typographyItems(brand);

  const industry = cleanText(project?.industry, "Industry not added");
  const audience = cleanText(project?.audience, "Audience not added");
  const style = cleanText(project?.style, "Style not added");

  const conceptTitle = cleanText(
    concept?.conceptName || concept?.title || concept?.name,
    "Selected Creative Direction",
  );
  const conceptStory =
    cleanText(concept?.story) ||
    cleanText(concept?.visualDirection) ||
    cleanText(concept?.description) ||
    cleanText(brand?.foundation?.summary) ||
    cleanText(brand?.summary) ||
    "The selected creative direction connects the approved strategy, audience and visual system.";
  const logoPhilosophy =
    cleanText(concept?.logoPhilosophy) ||
    cleanText(brand?.logoPhilosophy) ||
    cleanText(logoDirection?.conceptIdea) ||
    cleanText(logoDirection?.symbolLogic) ||
    cleanText(logoDirection?.description) ||
    "Use the approved logo consistently and preserve its proportions, spacing and contrast.";

  const foundationLead =
    cleanText(brand?.foundation?.summary) ||
    cleanText(brand?.summary) ||
    strategyText(brand);

  const baseSlides: PresentationDocument["slides"] = [
    {
      id: "brand-cover",
      kind: "cover",
      eyebrow: "Heyy Studio · Brand Guidelines",
      title: projectName,
      subtitle: conceptTitle,
      meta: [industry, style].filter(Boolean).join(" · "),
      image: moodboard ? { ...moodboard, fit: "cover" } : null,
      logo,
      tone: "purple",
    },
    {
      id: "brand-foundation",
      kind: "content",
      eyebrow: "Brand Foundation",
      title: "Strategy, audience and voice",
      lead: foundationLead,
      metrics: [
        { label: "Industry", value: industry },
        { label: "Audience", value: audience },
        { label: "Style", value: style },
        { label: "Applications", value: String(applicationPages.length) },
      ],
      cards: [
        {
          title: "Brand Strategy",
          body: strategyText(brand),
          tone: "purple",
        },
        {
          title: "Brand Voice",
          body: voiceText(brand),
          tone: "blue",
        },
      ],
      footer: "Heyy Studio Brand Guidelines",
    },
    {
      id: "brand-colours",
      kind: "palette",
      eyebrow: "Colour System",
      title: "Primary and supporting palette",
      items:
        palette.length > 0
          ? palette
          : [
              { name: "Primary", hex: "#6C00FF", rgb: "108, 0, 255", cmyk: "58, 100, 0, 0" },
              { name: "Ink", hex: "#17151F", rgb: "23, 21, 31", cmyk: "26, 32, 0, 88" },
              { name: "Soft Purple", hex: "#F2E9FF", rgb: "242, 233, 255", cmyk: "5, 9, 0, 0" },
            ],
      footer: "Colour values should be professionally verified before print production.",
    },
    {
      id: "brand-typography",
      kind: "typography",
      eyebrow: "Typography",
      title: "Type hierarchy",
      items:
        typography.length > 0
          ? typography
          : [
              {
                name: "Primary Typeface",
                role: "Headings",
                sample: "Aa Bb Cc 0123",
                reason: "The selected heading typeface will appear here.",
              },
              {
                name: "Supporting Typeface",
                role: "Body copy",
                sample: "Aa Bb Cc 0123",
                reason: "The supporting typeface will appear here.",
              },
            ],
      footer: "Use licensed fonts and confirm availability across production environments.",
    },
    {
      id: "brand-direction",
      kind: "imageText",
      eyebrow: "Creative Direction",
      title: conceptTitle,
      image: moodboard,
      lead: conceptStory,
      cards: [
        {
          title: "Concept Story",
          body: conceptStory,
          tone: "purple",
        },
        {
          title: "Logo Philosophy",
          body: logoPhilosophy,
          tone: "green",
        },
      ],
      footer: "Creative direction approved inside Heyy Studio.",
      tone: "purple",
    },
    {
      id: "brand-logo",
      kind: "imageText",
      eyebrow: "Logo System",
      title: "Primary logo",
      image: logo,
      lead: logoPhilosophy,
      cards: [
        {
          title: "Light Background",
          body: "Use the approved primary logo with sufficient clear space and strong contrast.",
          tone: "neutral",
        },
        {
          title: "Dark Background",
          body: "Use the approved reversed or light logo artwork. Do not apply uncontrolled effects.",
          tone: "purple",
        },
      ],
      footer: "Always use approved master artwork for production.",
      tone: "neutral",
    },
    ...applicationPages.map((page) => ({
      id: `brand-application-${page.id}`,
      kind: "gallery" as const,
      eyebrow: "Brand Application",
      title:
        page.outputLabel === page.applicationLabel
          ? page.applicationLabel
          : `${page.applicationLabel} · ${page.outputLabel}`,
      images: [page.image],
      footer: "Approved application concept generated inside Heyy Studio.",
      tone: "purple" as const,
    })),
    {
      id: "brand-disclaimer",
      kind: "disclaimer",
      eyebrow: "Usage Guidance",
      title: "Brand consistency",
      paragraphs: [
        "This Brand Guidelines presentation organises the approved information currently saved in the Heyy Studio project.",
        "Before final production, confirm logo artwork, licensed fonts, colour profiles, accessibility, print specifications and supplier requirements.",
        "Expert production can develop final master artwork, application files and detailed technical specifications.",
      ],
      footer: "Create with AI. Build with Experts.",
      tone: "purple",
    },
  ];

  const slides: PresentationDocument["slides"] = baseSlides.map(
    (slide, index): PresentationDocument["slides"][number] =>
      slide.kind === "cover"
        ? slide
        : { ...slide, number: String(index).padStart(2, "0") },
  );

  return {
    id: `brand-${cleanText(project?.id, "project")}`,
    title: `${projectName} Brand Guidelines`,
    filenameBase: `${safeFilename(projectName)}-brand-guidelines`,
    studioLabel: "Brand Studio",
    accentHex: "#6C00FF",
    slides,
  };
}
