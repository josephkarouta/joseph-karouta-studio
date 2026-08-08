import type {
  PresentationDocument,
  PresentationImage,
  PresentationMaterialItem,
  PresentationSlide,
} from "@/lib/presentation/types";
import {
  cleanText,
  safeFilename,
  splitRows,
  truncateText,
  uniqueStrings,
} from "@/lib/presentation/utils";

function image(url: unknown, label: string, fit: "cover" | "contain" = "cover"): PresentationImage | null {
  const value = cleanText(url);
  return value ? { url: value, label, fit } : null;
}

function measurement(value: unknown, suffix: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? `${numeric.toLocaleString()} ${suffix}` : "Not added";
}

function directionMaterials(direction: any, materials: any[]) {
  if (Array.isArray(materials) && materials.length > 0) {
    return materials.map((item) => cleanText(item?.name)).filter(Boolean);
  }

  if (!Array.isArray(direction?.materials)) return [];
  return direction.materials.map((item: any) => cleanText(item?.name)).filter(Boolean);
}

function architectureGallery(visuals: any[]) {
  if (!Array.isArray(visuals)) return [];

  const approved = visuals.filter(
    (visual) => visual?.metadata?.group === "visuals" && visual?.is_approved,
  );
  const allGallery = visuals.filter((visual) => visual?.metadata?.group === "visuals");
  const chosen = approved.length > 0 ? approved : allGallery;

  return chosen
    .map((visual) =>
      image(
        visual?.image_url,
        cleanText(visual?.title || visual?.visual_type, "Architecture visual"),
        "cover",
      ),
    )
    .filter(Boolean) as PresentationImage[];
}

function planImages(visuals: any[]) {
  const types = new Set(["functional_zoning", "ground_floor", "upper_floor", "circulation"]);

  return (Array.isArray(visuals) ? visuals : [])
    .filter((visual) => types.has(visual?.visual_type))
    .map((visual) =>
      image(
        visual?.image_url,
        cleanText(visual?.title || visual?.visual_type, "Concept plan"),
        "contain",
      ),
    )
    .filter(Boolean) as PresentationImage[];
}

function materialItems(materials: any[]): PresentationMaterialItem[] {
  if (!Array.isArray(materials)) return [];

  return materials.slice(0, 8).map((material) => ({
    name: cleanText(material?.name, "Material"),
    category: cleanText(material?.category, "Material"),
    finish: cleanText(material?.finish, "Finish to verify"),
    application: cleanText(material?.application, "Application to define"),
    imageUrl: cleanText(material?.image_url) || null,
  }));
}

function spaceRows(spaceProgram: any[], planSet: any): string[][] {
  if (Array.isArray(spaceProgram) && spaceProgram.length > 0) {
    return spaceProgram.map((item) => [
      cleanText(item?.space_name || item?.space, "Space"),
      cleanText(item?.level, "To define"),
      String(item?.quantity || 1),
      measurement(item?.total_area_m2 || item?.approx_area_m2, "m²"),
      cleanText(item?.priority, "Standard"),
    ]);
  }

  if (Array.isArray(planSet?.area_schedule)) {
    return planSet.area_schedule.map((item: any) => [
      cleanText(item?.space, "Space"),
      cleanText(item?.level, "To define"),
      "1",
      measurement(item?.approx_area_m2, "m²"),
      "Concept",
    ]);
  }

  return [];
}

export function buildArchitecturePresentation({
  project,
  site,
  planning,
  direction,
  concept,
  planSet,
  visuals,
  materials,
  spaceProgram,
}: {
  project: any;
  site: any;
  planning: any;
  direction: any;
  concept: any;
  planSet: any;
  visuals: any[];
  materials: any[];
  spaceProgram: any[];
}): PresentationDocument {
  const projectName = cleanText(project?.project_name, "Architecture Project");
  const location =
    [project?.city, project?.region, project?.country]
      .map((value) => cleanText(value))
      .filter(Boolean)
      .join(", ") || "Location not added";
  const directionTitle = cleanText(direction?.title, "Selected Architecture Direction");
  const selectedMaterialNames = uniqueStrings(directionMaterials(direction, materials));
  const selectedMaterials = materialItems(materials);
  const plans = planImages(visuals);
  const gallery = architectureGallery(visuals);
  const rows = spaceRows(spaceProgram, planSet);
  const rowGroups = splitRows(rows, 9);
  const galleryGroups = splitRows(gallery, 6);

  const slides: PresentationSlide[] = [
    {
      id: "architecture-cover",
      kind: "cover",
      eyebrow: "Heyy Studio · Architecture Concept Design Pack",
      title: projectName,
      subtitle: directionTitle,
      meta: location,
      image: image(direction?.image_url, directionTitle, "cover"),
      tone: "blue",
    },
    {
      id: "architecture-foundation",
      kind: "content",
      number: "01",
      eyebrow: "Project Foundation",
      title: "Brief, site and planning",
      lead: truncateText(project?.notes, 430, "No additional project requirements were added."),
      metrics: [
        { label: "Project Type", value: cleanText(project?.project_type, "Not added") },
        { label: "Scope", value: cleanText(project?.scope, "Not added") },
        { label: "Style", value: cleanText(project?.architectural_style, "Not added") },
        { label: "Location", value: truncateText(location, 70) },
        { label: "Plot Area", value: measurement(site?.plot_area, "m²") },
        {
          label: "Floors",
          value: site?.desired_floors ? String(site.desired_floors) : "Not added",
        },
        {
          label: "Planning",
          value: cleanText(planning?.verification_status, "Needs verification"),
        },
        {
          label: "Working Mode",
          value:
            project?.working_mode === "professional"
              ? "Professional"
              : "Guided",
        },
      ],
      cards: [
        {
          title: "Planning Status",
          body:
            "Planning information is a conceptual, user-supplied guide and must be verified by local authorities and qualified professionals.",
          tone: "amber",
        },
        {
          title: "Project Position",
          body: truncateText(
            project?.professional_brief?.design_development_notes ||
              project?.source_notes ||
              "The project is ready for concept development based on the saved brief, site and selected design direction.",
            300,
          ),
          tone: "blue",
        },
      ],
      footer: "Conceptual architecture only - not for permit, construction or engineering use.",
      tone: "blue",
    },
    {
      id: "architecture-direction",
      kind: "imageText",
      number: "02",
      eyebrow: "Selected Direction",
      title: directionTitle,
      image: image(direction?.image_url, directionTitle, "cover"),
      lead: truncateText(direction?.philosophy, 440),
      cards: [
        {
          title: "Form & Massing",
          body: truncateText(direction?.form_strategy, 300),
          tone: "blue",
        },
        {
          title: "Spatial Strategy",
          body: truncateText(direction?.spatial_strategy, 300),
          tone: "purple",
        },
        {
          title: "Façade Strategy",
          body: truncateText(direction?.facade_strategy, 300),
          tone: "green",
        },
      ],
      footer:
        selectedMaterialNames.length > 0
          ? `Selected palette: ${selectedMaterialNames.join(" · ")}`
          : "Material direction to be professionally verified.",
      tone: "blue",
    },
  ];

  if (concept) {
    slides.push({
      id: "architecture-concept",
      kind: "imageText",
      number: "03",
      eyebrow: "Architecture Strategy",
      title: cleanText(concept?.title, `${directionTitle} - Architecture Strategy`),
      image: image(concept?.image_url, "Architecture concept strategy", "contain"),
      lead: truncateText(concept?.summary, 440),
      cards: [
        {
          title: "Site Response",
          body: truncateText(concept?.site_response, 250),
          tone: "blue",
        },
        {
          title: "Functional Zoning",
          body: truncateText(concept?.functional_zoning, 250),
          tone: "purple",
        },
        {
          title: "Natural Light",
          body: truncateText(concept?.natural_light, 250),
          tone: "amber",
        },
        {
          title: "Privacy",
          body: truncateText(concept?.privacy, 250),
          tone: "green",
        },
      ],
      footer: "Architecture strategy is conceptual and requires expert design development.",
      tone: "blue",
    });
  }

  if (plans.length > 0) {
    slides.push({
      id: "architecture-plans",
      kind: "gallery",
      number: "04",
      eyebrow: "Concept Plans",
      title: "Plans and diagrams",
      images: plans,
      footer: "All plans and diagrams are conceptual and are not measured construction drawings.",
      tone: "blue",
    });
  }

  rowGroups.forEach((group, index) => {
    slides.push({
      id: `architecture-program-${index + 1}`,
      kind: "table",
      number: String(5 + index).padStart(2, "0"),
      eyebrow: "Space Program",
      title:
        rowGroups.length > 1
          ? `Area schedule - ${index + 1} of ${rowGroups.length}`
          : "Area schedule",
      lead:
        index === 0
          ? "Approximate areas are shown before circulation, structure, services and professional verification."
          : undefined,
      table: {
        columns: ["Space", "Level", "Qty", "Approx.", "Priority"],
        rows: group,
      },
      footer: "Area schedule is an early planning aid only.",
      tone: "blue",
    });
  });

  const materialsNumber = 5 + rowGroups.length;
  if (selectedMaterials.length > 0) {
    slides.push({
      id: "architecture-materials",
      kind: "materials",
      number: String(materialsNumber).padStart(2, "0"),
      eyebrow: "Material System",
      title: "Selected concept palette",
      items: selectedMaterials,
      lead:
        "Selected materials guide the concept imagery, façade language and production brief. Products, finishes and suppliers require professional confirmation.",
      footer: "Material imagery is indicative and may not represent a final supplier product.",
    });
  }

  const galleryStartNumber = materialsNumber + (selectedMaterials.length > 0 ? 1 : 0);
  galleryGroups.forEach((group, index) => {
    slides.push({
      id: `architecture-gallery-${index + 1}`,
      kind: "gallery",
      number: String(galleryStartNumber + index).padStart(2, "0"),
      eyebrow: "Architectural Visuals",
      title:
        galleryGroups.length > 1
          ? `Selected project gallery - ${index + 1} of ${galleryGroups.length}`
          : "Selected project gallery",
      images: group,
      footer: "Visuals communicate concept intent and are not verified construction representations.",
      tone: "blue",
    });
  });

  const disclaimerNumber = galleryStartNumber + galleryGroups.length;
  slides.push({
    id: "architecture-disclaimer",
    kind: "disclaimer",
    number: String(disclaimerNumber).padStart(2, "0"),
    eyebrow: "Important Notice",
    title: "Concept design disclaimer",
    paragraphs: [
      "This Architecture Design Pack communicates an early design direction only. It is not a planning application, permit set, engineering package, construction document, quantity survey, supplier specification or professional certification.",
      "Before any design, pricing, approval or construction decision, the project must be reviewed and developed by appropriately registered local architects, planners, engineers, surveyors and other required consultants.",
      "Expert production can develop verified drawings, professional visualisation, coordination and project-specific deliverables under an approved quote.",
    ],
    footer: "Create with AI. Build with Experts.",
    tone: "blue",
  });

  return {
    id: `architecture-${cleanText(project?.id, "project")}`,
    title: `${projectName} Architecture Concept Design Pack`,
    filenameBase: `${safeFilename(projectName)}-architecture-design-pack`,
    studioLabel: "Architecture Studio",
    accentHex: "#1769D2",
    slides,
  };
}
