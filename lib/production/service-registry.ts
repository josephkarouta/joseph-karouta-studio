import { normalizeStudioId } from "@/lib/platform/platform-registry";

export type ProductionServiceDefinition = {
  id: string;
  studio: string;
  label: string;
  aliases: string[];
  workspaceScope?: string;
  defaultScope: string;
  supportedFinalFiles: string[];
  requiredProjectContext: string[];
};

export type ResolvedProductionService = ProductionServiceDefinition & {
  registered: boolean;
};

const BRAND_COMMON_FILES = [
  "Editable source files",
  "Production-ready PDF",
  "PNG and JPG previews",
  "Linked brand assets and specifications",
];

export const PRODUCTION_SERVICES: ProductionServiceDefinition[] = [
  {
    id: "brand-strategy-finalisation",
    studio: "brand_studio",
    label: "Brand Strategy Finalisation",
    aliases: ["Brand Strategy", "Strategy Finalisation", "Strategy Finalization"],
    workspaceScope: "strategy",
    defaultScope: "Refine the approved brand strategy into a polished, editable and presentation-ready document.",
    supportedFinalFiles: ["Editable strategy document", "Presentation-ready PDF", "Final proofread copy"],
    requiredProjectContext: ["Approved strategy", "Audience", "Positioning", "Voice", "Messaging"],
  },
  {
    id: "brand-creative-direction-production",
    studio: "brand_studio",
    label: "Creative Direction Production",
    aliases: ["Creative Direction", "Brand Creative Direction"],
    workspaceScope: "creative-direction",
    defaultScope: "Refine the selected creative route into a coherent, production-safe art-direction system.",
    supportedFinalFiles: ["Editable direction board", "High-resolution PDF", "Linked reference list"],
    requiredProjectContext: ["Selected direction", "Palette", "Typography", "Imagery", "Composition"],
  },
  {
    id: "brand-logo-finalisation",
    studio: "brand_studio",
    label: "Logo Finalisation and Master Files",
    aliases: [
      "Logo Finalization and Master Files",
      "Logo Finalisation",
      "Logo Finalization",
      "Logo Master Files",
      "Logo Production",
      "Logo",
    ],
    workspaceScope: "logo",
    defaultScope: "Professionally redraw, refine and prepare the approved logo as a complete master-file package.",
    supportedFinalFiles: ["AI", "EPS", "SVG", "PDF", "PNG", "JPG", "RGB and CMYK variants"],
    requiredProjectContext: ["Selected logo concept", "Approved colours", "Usage requirements", "Existing logo files"],
  },
  {
    id: "brand-guidelines-production",
    studio: "brand_studio",
    label: "Brand Guidelines Production",
    aliases: ["Brand Guidelines", "Guidelines Production", "Guidelines"],
    workspaceScope: "guidelines",
    defaultScope: "Turn the approved identity system into a professionally designed and editable brand-guidelines document.",
    supportedFinalFiles: ["Brand-guidelines PDF", "Editable source document", "Linked logo, colour and font assets"],
    requiredProjectContext: ["Brand strategy", "Logo system", "Colour palette", "Typography", "Applications"],
  },
  {
    id: "brand-business-card",
    studio: "brand_studio",
    label: "Business Card Production",
    aliases: ["Business Card", "Business Cards", "Business Card Design"],
    workspaceScope: "business-card",
    defaultScope: "Prepare approved business-card artwork as editable and print-ready files.",
    supportedFinalFiles: BRAND_COMMON_FILES,
    requiredProjectContext: ["Approved identity", "Contact details", "Print specifications"],
  },
  {
    id: "brand-letterhead",
    studio: "brand_studio",
    label: "Letterhead Production",
    aliases: ["Letterhead", "Letterhead Design"],
    workspaceScope: "letterhead",
    defaultScope: "Prepare approved letterhead artwork as editable print and office-use templates.",
    supportedFinalFiles: BRAND_COMMON_FILES,
    requiredProjectContext: ["Approved identity", "Contact details", "Document requirements"],
  },
  {
    id: "brand-envelope",
    studio: "brand_studio",
    label: "Envelope Production",
    aliases: ["Envelope", "Envelope Design"],
    workspaceScope: "envelope",
    defaultScope: "Prepare approved envelope artwork with dieline, bleed and production specifications.",
    supportedFinalFiles: BRAND_COMMON_FILES,
    requiredProjectContext: ["Approved identity", "Envelope size", "Supplier or dieline requirements"],
  },
  {
    id: "brand-email-signature",
    studio: "brand_studio",
    label: "Email Signature Production",
    aliases: ["Email Signature", "HTML Email Signature"],
    workspaceScope: "email-signature",
    defaultScope: "Build the approved email signature as tested HTML with installation guidance and fallback assets.",
    supportedFinalFiles: ["Responsive HTML", "Hosted/local image assets", "Installation guide", "PNG fallback"],
    requiredProjectContext: ["Approved identity", "Contact details", "Email clients", "Required links"],
  },
  {
    id: "brand-presentation",
    studio: "brand_studio",
    label: "Presentation Production",
    aliases: ["Presentation", "Presentation Template", "PowerPoint Presentation"],
    workspaceScope: "presentation",
    defaultScope: "Prepare an editable presentation master and reusable branded layouts.",
    supportedFinalFiles: ["Editable PowerPoint", "PDF reference", "Linked fonts and assets"],
    requiredProjectContext: ["Approved identity", "Presentation purpose", "Required slide types"],
  },
  {
    id: "brand-social-system",
    studio: "brand_studio",
    label: "Social Media System Production",
    aliases: ["Social Media System", "Social System", "Social Media Production", "Social Media"],
    workspaceScope: "social-system",
    defaultScope: "Prepare a flexible set of editable, platform-ready social templates.",
    supportedFinalFiles: ["Editable templates", "Feed/story/carousel sizes", "PNG/JPG exports", "Usage guide"],
    requiredProjectContext: ["Approved identity", "Platforms", "Content categories", "Campaign needs"],
  },
  {
    id: "brand-website",
    studio: "brand_studio",
    label: "Website Production",
    aliases: ["Website", "Website Design", "Web Production"],
    workspaceScope: "website",
    defaultScope: "Develop the approved website direction into a clearly scoped design or design-and-development package.",
    supportedFinalFiles: ["Editable UI files", "Responsive layouts", "Web assets", "Developer handoff notes"],
    requiredProjectContext: ["Approved identity", "Website goals", "Pages", "Content", "Technical scope"],
  },
  {
    id: "brand-packaging",
    studio: "brand_studio",
    label: "Packaging Production",
    aliases: ["Packaging", "Packaging Design", "Package Production"],
    workspaceScope: "packaging",
    defaultScope: "Develop the approved packaging concept into supplier-ready artwork using confirmed dielines and specifications.",
    supportedFinalFiles: ["Editable vector artwork", "Print-ready CMYK PDF", "Finish layers", "3D previews"],
    requiredProjectContext: ["Approved identity", "Dieline", "Product copy", "Legal copy", "Supplier specifications"],
  },
  {
    id: "brand-signage",
    studio: "brand_studio",
    label: "Signage Production",
    aliases: ["Signage", "Signage Design"],
    workspaceScope: "signage",
    defaultScope: "Prepare approved signage concepts as scalable artwork with dimensions and production notes.",
    supportedFinalFiles: ["Editable vector artwork", "Scaled PDF", "Dimension schedule", "Material notes"],
    requiredProjectContext: ["Approved identity", "Dimensions", "Site photographs", "Materials", "Supplier requirements"],
  },
  {
    id: "brand-merchandise",
    studio: "brand_studio",
    label: "Merchandise Production",
    aliases: ["Merchandise", "Merch", "Merchandise Design"],
    workspaceScope: "merchandise",
    defaultScope: "Prepare approved merchandise artwork with placement, size and production variants.",
    supportedFinalFiles: ["Editable vector artwork", "Print/embroidery files", "Placement specifications", "PNG previews"],
    requiredProjectContext: ["Approved identity", "Product types", "Supplier templates", "Colour variants"],
  },
  {
    id: "brand-custom-deliverable",
    studio: "brand_studio",
    label: "Custom Brand Deliverable Production",
    aliases: ["Custom Brand Deliverable", "Custom Brand Production"],
    workspaceScope: "custom",
    defaultScope: "Prepare the agreed custom brand deliverable as correctly sized, editable and production-ready files.",
    supportedFinalFiles: BRAND_COMMON_FILES,
    requiredProjectContext: ["Custom scope", "Approved identity", "Required sizes", "Supplier/platform requirements"],
  },
  {
    id: "brand-selected-package",
    studio: "brand_studio",
    label: "Selected Brand Production Package",
    aliases: ["Selected Brand Items", "Selected Brand Package", "Brand Production Bundle"],
    workspaceScope: "selected-package",
    defaultScope: "Coordinate the selected brand deliverables as one combined final-file package.",
    supportedFinalFiles: BRAND_COMMON_FILES,
    requiredProjectContext: ["Selected deliverables", "Approved identity", "Application briefs", "Final-file requirements"],
  },
  {
    id: "brand-complete-package",
    studio: "brand_studio",
    label: "Complete Brand Production Package",
    aliases: ["Complete Brand Package", "Full Brand Production Package"],
    workspaceScope: "complete-package",
    defaultScope: "Coordinate all selected brand deliverables as one complete final-file package.",
    supportedFinalFiles: BRAND_COMMON_FILES,
    requiredProjectContext: ["All selected deliverables", "Approved identity", "Application briefs", "Final-file requirements"],
  },
  {
    id: "architecture-design-development",
    studio: "architecture_studio",
    label: "Architecture Design Development",
    aliases: ["Architecture Production", "Architecture Design Package", "Architecture Concept Package"],
    defaultScope: "Develop the approved architecture concept into a professionally scoped design-development package.",
    supportedFinalFiles: ["Drawings", "Schedules", "Professional renders", "Coordination notes", "Package PDF"],
    requiredProjectContext: ["Site information", "Space program", "Selected direction", "Plans", "Materials", "Visuals"],
  },
  {
    id: "interior-concept-package",
    studio: "interior_studio",
    label: "Interior Concept Package",
    aliases: ["Interior Production", "Interior Design Package", "Interior Concept Production"],
    defaultScope: "Develop the approved interior concept into a coordinated design and procurement package.",
    supportedFinalFiles: ["Layout plans", "Material palette", "Furniture/lighting schedules", "Visuals", "Package PDF"],
    requiredProjectContext: ["Project brief", "Layout", "Materials", "Furniture", "Lighting", "Approved visuals"],
  },
  {
    id: "interior-professional-fit-out",
    studio: "interior_studio",
    label: "Professional Interior Fit-Out Package",
    aliases: ["Interior Fit-Out Package", "Professional Interior Package", "Interior Fit Out Package"],
    defaultScope: "Develop the professional interior brief into a complete fit-out, procurement and delivery package.",
    supportedFinalFiles: ["Detailed plans", "Schedules", "Quantity take-off", "Procurement register", "Work programme"],
    requiredProjectContext: ["Professional brief", "Site constraints", "Technical requirements", "Procurement market", "Programme"],
  },
  {
    id: "marketing-campaign-creative-package",
    studio: "marketing_studio",
    label: "Marketing Campaign Creative Package",
    aliases: ["Marketing Production", "Campaign Creative Package", "Marketing Campaign Production"],
    defaultScope: "Develop the approved campaign strategy and creative system into channel-ready production assets.",
    supportedFinalFiles: ["Campaign key visual", "Channel assets", "Copy bank", "Content calendar", "Launch package"],
    requiredProjectContext: ["Campaign brief", "Strategy", "Audience", "Big idea", "Channels", "Approved visuals"],
  },
];

function normaliseToken(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SERVICE_BY_ID = new Map(PRODUCTION_SERVICES.map((service) => [service.id, service]));
const SERVICE_LOOKUP = new Map<string, ProductionServiceDefinition>();

for (const service of PRODUCTION_SERVICES) {
  for (const candidate of [service.id, service.label, ...service.aliases]) {
    const token = normaliseToken(candidate);
    if (token) SERVICE_LOOKUP.set(`${service.studio}:${token}`, service);
  }
}

export function getProductionServiceById(id: unknown) {
  return SERVICE_BY_ID.get(String(id || "").trim());
}

export function resolveProductionService(input: {
  serviceId?: unknown;
  service?: unknown;
  studio?: unknown;
}): ResolvedProductionService {
  const studio = normalizeStudioId(input.studio || "brand_studio");
  const explicitId = String(input.serviceId || "").trim();
  const byId = explicitId ? SERVICE_BY_ID.get(explicitId) : undefined;
  if (byId) return { ...byId, registered: true };

  const serviceToken = normaliseToken(input.service);
  const byStudioAlias = serviceToken
    ? SERVICE_LOOKUP.get(`${studio}:${serviceToken}`)
    : undefined;
  if (byStudioAlias) return { ...byStudioAlias, registered: true };

  const byAnyAlias = serviceToken
    ? PRODUCTION_SERVICES.find((service) =>
        [service.id, service.label, ...service.aliases]
          .map(normaliseToken)
          .includes(serviceToken),
      )
    : undefined;
  if (byAnyAlias) return { ...byAnyAlias, registered: true };

  const label = String(input.service || "Studio Support").trim() || "Studio Support";
  const fallbackId = explicitId || `${studio.replace(/_studio$/, "")}-${normaliseToken(label) || "studio-support"}`;

  return {
    id: fallbackId,
    studio,
    label,
    aliases: [],
    defaultScope: `Professional production support for ${label}.`,
    supportedFinalFiles: ["Final files as defined in the approved quote"],
    requiredProjectContext: ["Project brief", "Approved direction", "Final scope"],
    registered: false,
  };
}

export function productionServiceMatches(
  record: {
    service_id?: unknown;
    service?: unknown;
    studio?: unknown;
    metadata?: any;
  } | null | undefined,
  expected: {
    id?: unknown;
    label?: unknown;
    serviceId?: unknown;
    service?: unknown;
    studio?: unknown;
  },
) {
  if (!record) return false;

  const expectedService = resolveProductionService({
    serviceId: expected.serviceId || expected.id,
    service: expected.service || expected.label,
    studio: expected.studio,
  });
  const recordService = resolveProductionService({
    serviceId:
      record.service_id ||
      record.metadata?.service_id ||
      record.metadata?.serviceId,
    service: record.service,
    studio: record.studio || expected.studio,
  });

  if (expectedService.registered || recordService.registered) {
    return expectedService.id === recordService.id;
  }

  return normaliseToken(expectedService.label) === normaliseToken(recordService.label);
}

export function buildProductionWorkspaceHref(input: {
  projectId: unknown;
  studio?: unknown;
  serviceId?: unknown;
  service?: unknown;
  paymentState?: "success" | "cancelled";
  quoteId?: unknown;
  sessionId?: unknown;
}) {
  const rawProjectId = String(input.projectId || "").trim();
  if (!rawProjectId) return "/dashboard";

  const projectId = encodeURIComponent(rawProjectId);
  const service = resolveProductionService(input);
  const studio = normalizeStudioId(input.studio || service.studio);
  const params = new URLSearchParams();
  params.set("tab", "production");

  if (input.paymentState) params.set("payment", input.paymentState);
  if (input.quoteId) params.set("quote", String(input.quoteId));
  if (input.sessionId) params.set("session_id", String(input.sessionId));

  if (studio === "brand_studio") {
    params.set("scope", service.workspaceScope || service.id);
    return `/dashboard/brand/${projectId}?${params.toString()}`;
  }

  if (studio === "architecture_studio") {
    return `/dashboard/architecture/${projectId}?${params.toString()}`;
  }

  if (studio === "interior_studio") {
    params.set("project", rawProjectId);
    return `/interior-studio?${params.toString()}`;
  }

  if (studio === "marketing_studio") {
    params.set("project", rawProjectId);
    return `/marketing-studio?${params.toString()}`;
  }

  return `/dashboard?${params.toString()}`;
}
