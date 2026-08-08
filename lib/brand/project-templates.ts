export type BrandJourneyId =
  | "new-brand"
  | "rebrand"
  | "existing-logo"
  | "logo-only"
  | "single-item"
  | "stationery"
  | "full-identity"
  | "guidelines-only"
  | "custom";

export type BrandLogoAction = "create" | "refine" | "keep" | "none";
export type BrandDirectionMode = "explore" | "keep-current";
export type BrandWorkspaceSection =
  | "brief"
  | "directions"
  | "logo"
  | "applications"
  | "guidelines"
  | "assets"
  | "export";

export type BrandApplicationBriefs = Record<string, Record<string, string>>;

export type BrandJourneyConfig = {
  id: BrandJourneyId;
  title: string;
  shortTitle: string;
  description: string;
  helper: string;
  defaultDeliverables: string[];
  logoAction: BrandLogoAction;
  directionMode: BrandDirectionMode;
  includeGuidelines: boolean;
  requiresExistingLogo: boolean;
  allowLogoChoice: boolean;
  allowDirectionChoice: boolean;
  accent: string;
  icon: string;
};

export type BrandDeliverable = {
  id: string;
  label: string;
  category: "Strategy" | "Identity" | "Stationery" | "Digital" | "Campaign" | "Environment";
  description: string;
  requiresLogo: boolean;
};

export type BrandApplicationField = {
  id: string;
  label: string;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
};

export type NormalisedBrandJourney = {
  workspaceVersion: number;
  journeyId: BrandJourneyId;
  journeyTitle: string;
  selectedDeliverables: string[];
  logoAction: BrandLogoAction;
  directionMode: BrandDirectionMode;
  includeCreativeDirections: boolean;
  includeGuidelines: boolean;
  workspaceSections: BrandWorkspaceSection[];
  hasExistingLogo: boolean;
  existingLogoUrl: string | null;
  preserveNotes: string;
  changeNotes: string;
  currentBrandNotes: string;
  customScope: string;
  applicationBriefs: BrandApplicationBriefs;
  contactDetails: Record<string, string>;
  projectName: string;
};

const CORE_DELIVERABLES = new Set(["strategy", "creative-direction", "logo", "guidelines"]);
const APPLICATION_DELIVERABLES = new Set([
  "business-card",
  "letterhead",
  "envelope",
  "email-signature",
  "presentation",
  "social-system",
  "website",
  "packaging",
  "signage",
  "merchandise",
]);
const STATIONERY_DELIVERABLES = new Set(["business-card", "letterhead", "envelope", "email-signature"]);
const VALID_JOURNEYS = new Set<BrandJourneyId>([
  "new-brand",
  "rebrand",
  "existing-logo",
  "logo-only",
  "single-item",
  "stationery",
  "full-identity",
  "guidelines-only",
  "custom",
]);
const VALID_SECTIONS = new Set<BrandWorkspaceSection>([
  "brief",
  "directions",
  "logo",
  "applications",
  "guidelines",
  "assets",
  "export",
]);

export const BRAND_JOURNEYS: BrandJourneyConfig[] = [
  {
    id: "new-brand",
    title: "Create a new brand",
    shortTitle: "New brand",
    description: "Build the strategy, creative direction, logo and identity from the beginning.",
    helper: "Best when the business has no established identity yet.",
    defaultDeliverables: ["strategy", "creative-direction", "logo", "guidelines"],
    logoAction: "create",
    directionMode: "explore",
    includeGuidelines: true,
    requiresExistingLogo: false,
    allowLogoChoice: false,
    allowDirectionChoice: true,
    accent: "#6c00ff",
    icon: "✦",
  },
  {
    id: "rebrand",
    title: "Rebrand an existing business",
    shortTitle: "Rebrand",
    description: "Keep the strongest brand equity while changing what no longer works.",
    helper: "Upload the current logo and choose whether to keep, refine or replace it.",
    defaultDeliverables: ["strategy", "creative-direction", "logo", "guidelines"],
    logoAction: "refine",
    directionMode: "explore",
    includeGuidelines: true,
    requiresExistingLogo: true,
    allowLogoChoice: true,
    allowDirectionChoice: true,
    accent: "#c51f7c",
    icon: "↻",
  },
  {
    id: "existing-logo",
    title: "Develop an existing logo",
    shortTitle: "Existing logo",
    description: "Keep the approved logo and build a stronger visual identity and usage system around it.",
    helper: "No new logo directions are forced unless you explicitly request refinement or replacement.",
    defaultDeliverables: ["guidelines"],
    logoAction: "keep",
    directionMode: "keep-current",
    includeGuidelines: true,
    requiresExistingLogo: true,
    allowLogoChoice: true,
    allowDirectionChoice: true,
    accent: "#1766c2",
    icon: "◆",
  },
  {
    id: "logo-only",
    title: "Create or refine a logo only",
    shortTitle: "Logo only",
    description: "Explore three logo concepts without adding a separate creative-direction or guideline project.",
    helper: "The logo briefs are generated directly from the business context.",
    defaultDeliverables: ["logo"],
    logoAction: "create",
    directionMode: "keep-current",
    includeGuidelines: false,
    requiresExistingLogo: false,
    allowLogoChoice: true,
    allowDirectionChoice: false,
    accent: "#0b9854",
    icon: "◇",
  },
  {
    id: "single-item",
    title: "Create one brand item",
    shortTitle: "One item",
    description: "Use the existing identity to create one focused application.",
    helper: "For a business card, presentation, social template, packaging concept and more.",
    defaultDeliverables: ["business-card"],
    logoAction: "keep",
    directionMode: "keep-current",
    includeGuidelines: false,
    requiresExistingLogo: true,
    allowLogoChoice: false,
    allowDirectionChoice: false,
    accent: "#a45c00",
    icon: "▣",
  },
  {
    id: "stationery",
    title: "Create a stationery set",
    shortTitle: "Stationery",
    description: "Prepare a coordinated business card, letterhead, envelope and email signature using the current identity.",
    helper: "No rebrand, logo directions or guidelines are forced.",
    defaultDeliverables: ["business-card", "letterhead", "envelope", "email-signature"],
    logoAction: "keep",
    directionMode: "keep-current",
    includeGuidelines: false,
    requiresExistingLogo: true,
    allowLogoChoice: false,
    allowDirectionChoice: false,
    accent: "#087e9d",
    icon: "▤",
  },
  {
    id: "full-identity",
    title: "Create a complete identity",
    shortTitle: "Full identity",
    description: "Build the complete identity system and the applications needed for launch.",
    helper: "The broadest journey for a new or evolving business.",
    defaultDeliverables: [
      "strategy",
      "creative-direction",
      "logo",
      "guidelines",
      "business-card",
      "email-signature",
      "social-system",
      "presentation",
    ],
    logoAction: "create",
    directionMode: "explore",
    includeGuidelines: true,
    requiresExistingLogo: false,
    allowLogoChoice: true,
    allowDirectionChoice: true,
    accent: "#5b21b6",
    icon: "◎",
  },
  {
    id: "guidelines-only",
    title: "Create brand guidelines",
    shortTitle: "Guidelines",
    description: "Turn an existing identity into a clear, usable rule system.",
    helper: "Upload the approved logo and generate only the relevant guideline modules.",
    defaultDeliverables: ["guidelines"],
    logoAction: "keep",
    directionMode: "keep-current",
    includeGuidelines: true,
    requiresExistingLogo: true,
    allowLogoChoice: false,
    allowDirectionChoice: false,
    accent: "#52606f",
    icon: "▥",
  },
  {
    id: "custom",
    title: "Other / custom scope",
    shortTitle: "Custom",
    description: "Describe the exact brand support or deliverables you need.",
    helper: "Only the modules explicitly selected are shown in the workspace.",
    defaultDeliverables: [],
    logoAction: "none",
    directionMode: "keep-current",
    includeGuidelines: false,
    requiresExistingLogo: false,
    allowLogoChoice: true,
    allowDirectionChoice: true,
    accent: "#7c3aed",
    icon: "+",
  },
];

export const BRAND_DELIVERABLES: BrandDeliverable[] = [
  { id: "strategy", label: "Brand Strategy", category: "Strategy", description: "Positioning, audience, promise, personality and voice.", requiresLogo: false },
  { id: "creative-direction", label: "Creative Directions", category: "Strategy", description: "Three distinct conceptual and visual routes.", requiresLogo: false },
  { id: "logo", label: "Logo Direction", category: "Identity", description: "Three logo concepts and refinement routes.", requiresLogo: false },
  { id: "guidelines", label: "Brand Guidelines", category: "Identity", description: "Foundation, identity rules, relevant applications and checklist.", requiresLogo: false },
  { id: "business-card", label: "Business Card", category: "Stationery", description: "Front and back business-card concept with production pathway.", requiresLogo: true },
  { id: "letterhead", label: "Letterhead", category: "Stationery", description: "Professional letterhead and document hierarchy.", requiresLogo: true },
  { id: "envelope", label: "Envelope", category: "Stationery", description: "Coordinated envelope and mailing identity.", requiresLogo: true },
  { id: "email-signature", label: "Email Signature", category: "Stationery", description: "Team-ready email identity direction.", requiresLogo: true },
  { id: "presentation", label: "Presentation System", category: "Digital", description: "Branded presentation direction and slide hierarchy.", requiresLogo: true },
  { id: "social-system", label: "Social Media System", category: "Campaign", description: "Post, story and campaign layout direction.", requiresLogo: true },
  { id: "website", label: "Website Direction", category: "Digital", description: "Homepage and digital visual-system direction.", requiresLogo: true },
  { id: "packaging", label: "Packaging", category: "Campaign", description: "Packaging or label direction for product brands.", requiresLogo: true },
  { id: "signage", label: "Signage", category: "Environment", description: "Storefront, office or environmental branding direction.", requiresLogo: true },
  { id: "merchandise", label: "Merchandise", category: "Campaign", description: "Apparel, uniforms or branded product direction.", requiresLogo: true },
];

export const BRAND_APPLICATION_FIELDS: Record<string, BrandApplicationField[]> = {
  "business-card": [
    { id: "name", label: "Name on the card", placeholder: "Joseph Karouta", required: true },
    { id: "jobTitle", label: "Job title", placeholder: "Founder / Creative Director" },
    { id: "phone", label: "Phone", placeholder: "+61 ..." },
    { id: "email", label: "Email", placeholder: "hello@business.com" },
    { id: "website", label: "Website", placeholder: "business.com" },
    { id: "address", label: "Address", placeholder: "Optional business address", multiline: true },
    { id: "format", label: "Preferred format", placeholder: "Standard, square, vertical or not sure" },
    { id: "notes", label: "Print or finish notes", placeholder: "Paper, foil, embossing, QR code or other requirements", multiline: true },
  ],
  letterhead: [
    { id: "legalName", label: "Legal business name", placeholder: "Registered business name" },
    { id: "address", label: "Business address", placeholder: "Address shown on the document", multiline: true },
    { id: "contact", label: "Phone, email and website", placeholder: "Contact details", multiline: true },
    { id: "footer", label: "Legal or footer information", placeholder: "ABN, registration, disclaimer or optional footer", multiline: true },
  ],
  envelope: [
    { id: "size", label: "Envelope size", placeholder: "DL, C4, C5 or not sure" },
    { id: "returnAddress", label: "Return address", placeholder: "Address printed on the envelope", multiline: true },
    { id: "notes", label: "Mailing requirements", placeholder: "Window position, postage area or finish", multiline: true },
  ],
  "email-signature": [
    { id: "name", label: "Name", placeholder: "Name shown in the signature" },
    { id: "jobTitle", label: "Job title", placeholder: "Role" },
    { id: "contact", label: "Phone, email and website", placeholder: "Contact details", multiline: true },
    { id: "social", label: "Social links", placeholder: "LinkedIn, Instagram or other links", multiline: true },
    { id: "disclaimer", label: "Disclaimer", placeholder: "Optional legal or confidentiality text", multiline: true },
  ],
  presentation: [
    { id: "purpose", label: "Presentation purpose", placeholder: "Sales deck, proposal, investor deck, company profile...", required: true },
    { id: "audience", label: "Presentation audience", placeholder: "Who will view it?" },
    { id: "slides", label: "Required slide types", placeholder: "Cover, agenda, services, charts, case studies, closing...", multiline: true },
  ],
  "social-system": [
    { id: "platforms", label: "Platforms", placeholder: "Instagram, LinkedIn, TikTok...", required: true },
    { id: "contentPillars", label: "Content pillars", placeholder: "Education, products, testimonials, campaigns...", multiline: true },
    { id: "formats", label: "Required formats", placeholder: "Posts, stories, reels covers, carousels...", multiline: true },
  ],
  website: [
    { id: "goal", label: "Primary website goal", placeholder: "Generate leads, sell products, explain services...", required: true },
    { id: "cta", label: "Primary call to action", placeholder: "Book a call, buy now, request a quote..." },
    { id: "pages", label: "Key pages or sections", placeholder: "Home, about, services, portfolio, contact...", multiline: true },
  ],
  packaging: [
    { id: "product", label: "Product name", placeholder: "Product or range name", required: true },
    { id: "packType", label: "Packaging type", placeholder: "Box, bottle, pouch, label..." },
    { id: "dimensions", label: "Dimensions or dieline", placeholder: "Known dimensions or not sure" },
    { id: "mandatory", label: "Mandatory content", placeholder: "Ingredients, legal text, barcode, nutrition, warnings...", multiline: true },
  ],
  signage: [
    { id: "location", label: "Sign location", placeholder: "Storefront, reception, vehicle, wayfinding...", required: true },
    { id: "dimensions", label: "Approximate dimensions", placeholder: "Width × height or not sure" },
    { id: "material", label: "Preferred material", placeholder: "Metal, acrylic, vinyl, illuminated..." },
    { id: "notes", label: "Viewing and installation notes", placeholder: "Distance, lighting, mounting or site restrictions", multiline: true },
  ],
  merchandise: [
    { id: "items", label: "Merchandise items", placeholder: "T-shirt, uniform, tote bag, cap...", required: true },
    { id: "method", label: "Production method", placeholder: "Print, embroidery, transfer or not sure" },
    { id: "placement", label: "Logo placement", placeholder: "Front, back, sleeve or multiple positions" },
  ],
};

export const BRAND_INDUSTRIES = [
  "Architecture",
  "Beauty / Wellness",
  "Café",
  "E-commerce",
  "Education",
  "Fashion",
  "Food / Beverage",
  "Healthcare",
  "Hospitality",
  "Interior Design",
  "Professional Services",
  "Real Estate",
  "Restaurant",
  "Retail",
  "Startup / Technology",
  "Other",
];

export const BRAND_AUDIENCES = [
  "Businesses",
  "Creatives",
  "Families",
  "Global customers",
  "Investors",
  "Local customers",
  "Premium clients",
  "Students",
  "Tourists",
  "Young professionals",
  "Other",
];

export const BRAND_STYLES = [
  "Bold",
  "Corporate",
  "Editorial",
  "Luxury",
  "Minimal",
  "Organic",
  "Playful",
  "Premium",
  "Technical",
  "Warm",
  "Other",
];

export const LOGO_DECISIONS: Array<{ id: BrandLogoAction; label: string; helper: string }> = [
  { id: "keep", label: "Keep my existing logo", helper: "Do not redesign it. Build around the approved mark." },
  { id: "refine", label: "Refine my existing logo", helper: "Preserve recognition while improving proportion and execution." },
  { id: "create", label: "Create a new logo", helper: "Explore three logo directions." },
  { id: "none", label: "No logo work required", helper: "Focus only on the selected applications or guidelines." },
];

export function isBrandJourneyId(value: unknown): value is BrandJourneyId {
  return typeof value === "string" && VALID_JOURNEYS.has(value as BrandJourneyId);
}

export function getBrandJourney(id?: string | null) {
  return BRAND_JOURNEYS.find((item) => item.id === id) || BRAND_JOURNEYS[0];
}

export function getBrandDeliverable(id: string) {
  return BRAND_DELIVERABLES.find((item) => item.id === id);
}

export function getApplicationDeliverables(ids: string[]) {
  return BRAND_DELIVERABLES.filter((item) => ids.includes(item.id) && APPLICATION_DELIVERABLES.has(item.id));
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)));
}

function inferLegacyJourneyId(stored: Record<string, unknown>, selectedDeliverables: string[], brand: any): BrandJourneyId {
  const applications = selectedDeliverables.filter((id) => APPLICATION_DELIVERABLES.has(id));
  const core = selectedDeliverables.filter((id) => CORE_DELIVERABLES.has(id));
  const hasExistingLogo = Boolean(stored.hasExistingLogo || stored.existingLogoUrl || brand?.existingLogoUrl);

  if (applications.length === 1 && core.length === 0) return "single-item";
  if (applications.length > 1 && core.length === 0 && applications.every((id) => STATIONERY_DELIVERABLES.has(id))) return "stationery";
  if (selectedDeliverables.length === 1 && selectedDeliverables[0] === "logo") return "logo-only";
  if (selectedDeliverables.length === 1 && selectedDeliverables[0] === "guidelines") return "guidelines-only";
  if (hasExistingLogo && selectedDeliverables.includes("guidelines") && !selectedDeliverables.includes("creative-direction") && !selectedDeliverables.includes("logo")) return "existing-logo";

  const storedId = stored.journeyId || stored.id;
  if (isBrandJourneyId(storedId)) return storedId;
  if (selectedDeliverables.includes("strategy") && selectedDeliverables.includes("logo") && applications.length > 0) return "full-identity";
  return "new-brand";
}

export function deriveBrandWorkspaceSections(args: {
  journeyId: BrandJourneyId;
  selectedDeliverables: string[];
  logoAction: BrandLogoAction;
  includeCreativeDirections: boolean;
  includeGuidelines: boolean;
}): BrandWorkspaceSection[] {
  const sections: BrandWorkspaceSection[] = ["brief"];
  const applications = getApplicationDeliverables(args.selectedDeliverables);

  switch (args.journeyId) {
    case "single-item":
    case "stationery":
      if (applications.length) sections.push("applications");
      break;
    case "logo-only":
      sections.push("logo");
      break;
    case "guidelines-only":
      sections.push("guidelines");
      break;
    case "existing-logo":
      if (args.includeCreativeDirections) sections.push("directions");
      sections.push("logo");
      if (applications.length) sections.push("applications");
      if (args.includeGuidelines) sections.push("guidelines");
      break;
    case "custom":
      if (args.includeCreativeDirections) sections.push("directions");
      if (args.logoAction === "create" || args.logoAction === "refine" || args.selectedDeliverables.includes("logo")) sections.push("logo");
      if (applications.length) sections.push("applications");
      if (args.includeGuidelines) sections.push("guidelines");
      break;
    default:
      if (args.includeCreativeDirections) sections.push("directions");
      if (args.logoAction !== "none") sections.push("logo");
      if (applications.length) sections.push("applications");
      if (args.includeGuidelines) sections.push("guidelines");
      break;
  }

  sections.push("assets", "export");
  return Array.from(new Set(sections));
}

export function normaliseBrandJourney(brand: any, project?: any): NormalisedBrandJourney {
  const stored = (brand?.projectJourney || brand?.journey || {}) as Record<string, any>;
  const storedVersion = Number(stored.workspaceVersion || 0);
  const storedDeliverables = uniqueStrings(stored.selectedDeliverables);
  const provisionalJourneyId = storedVersion >= 2 && isBrandJourneyId(stored.journeyId)
    ? stored.journeyId
    : inferLegacyJourneyId(stored, storedDeliverables, brand);
  const journey = getBrandJourney(provisionalJourneyId);
  const selectedDeliverables = storedDeliverables.length ? storedDeliverables : journey.defaultDeliverables;
  const logoAction = (["create", "refine", "keep", "none"].includes(String(stored.logoAction))
    ? stored.logoAction
    : journey.logoAction) as BrandLogoAction;
  const directionMode = (stored.directionMode === "explore" || stored.directionMode === "keep-current"
    ? stored.directionMode
    : journey.directionMode) as BrandDirectionMode;
  const includeCreativeDirections = typeof stored.includeCreativeDirections === "boolean"
    ? stored.includeCreativeDirections
    : journey.allowDirectionChoice && (directionMode === "explore" || selectedDeliverables.includes("creative-direction"));
  const includeGuidelines = typeof stored.includeGuidelines === "boolean"
    ? stored.includeGuidelines
    : journey.includeGuidelines || selectedDeliverables.includes("guidelines");

  const derivedSections = deriveBrandWorkspaceSections({
    journeyId: journey.id,
    selectedDeliverables,
    logoAction,
    includeCreativeDirections,
    includeGuidelines,
  });
  const storedSections = uniqueStrings(stored.workspaceSections)
    .filter((section): section is BrandWorkspaceSection => VALID_SECTIONS.has(section as BrandWorkspaceSection));
  const workspaceSections = storedVersion >= 2 && storedSections.length
    ? storedSections
    : derivedSections;

  return {
    workspaceVersion: storedVersion || 1,
    journeyId: journey.id,
    journeyTitle: stored.journeyTitle || journey.title,
    selectedDeliverables,
    logoAction,
    directionMode,
    includeCreativeDirections,
    includeGuidelines,
    workspaceSections,
    hasExistingLogo: Boolean(stored.hasExistingLogo || stored.existingLogoUrl),
    existingLogoUrl: stored.existingLogoUrl || null,
    preserveNotes: stored.preserveNotes || "",
    changeNotes: stored.changeNotes || "",
    currentBrandNotes: stored.currentBrandNotes || "",
    customScope: stored.customScope || "",
    applicationBriefs: stored.applicationBriefs && typeof stored.applicationBriefs === "object" ? stored.applicationBriefs : {},
    contactDetails: stored.contactDetails && typeof stored.contactDetails === "object" ? stored.contactDetails : {},
    projectName: project?.project_name || stored.projectName || "Brand Project",
  };
}

export function buildBrandJourneySnapshot(args: {
  journeyId: BrandJourneyId;
  selectedDeliverables: string[];
  logoAction: BrandLogoAction;
  directionMode: BrandDirectionMode;
  hasExistingLogo: boolean;
  preserveNotes?: string;
  changeNotes?: string;
  customScope?: string;
  applicationBriefs?: BrandApplicationBriefs;
  contactDetails?: Record<string, string>;
  projectName?: string;
}) {
  const journey = getBrandJourney(args.journeyId);
  const selectedDeliverables = uniqueStrings(args.selectedDeliverables);
  const includeCreativeDirections = journey.allowDirectionChoice &&
    (args.directionMode === "explore" || selectedDeliverables.includes("creative-direction"));
  const includeGuidelines = journey.includeGuidelines || selectedDeliverables.includes("guidelines");
  const workspaceSections = deriveBrandWorkspaceSections({
    journeyId: journey.id,
    selectedDeliverables,
    logoAction: args.logoAction,
    includeCreativeDirections,
    includeGuidelines,
  });

  return {
    workspaceVersion: 2,
    source: "heyy-brand-journey-v2",
    journeyId: journey.id,
    journeyTitle: journey.title,
    selectedDeliverables,
    logoAction: args.logoAction,
    directionMode: args.directionMode,
    includeCreativeDirections,
    includeGuidelines,
    workspaceSections,
    hasExistingLogo: args.hasExistingLogo,
    preserveNotes: args.preserveNotes?.trim() || "",
    changeNotes: args.changeNotes?.trim() || "",
    customScope: args.customScope?.trim() || "",
    applicationBriefs: args.applicationBriefs || {},
    contactDetails: args.contactDetails || {},
    projectName: args.projectName || "Brand Project",
  };
}

export function shouldGenerateBrandBlueprint(projectJourney: Record<string, any>) {
  const sections = Array.isArray(projectJourney.workspaceSections) ? projectJourney.workspaceSections : [];
  return (
    sections.includes("directions") ||
    projectJourney.logoAction === "create" ||
    projectJourney.logoAction === "refine" ||
    (Array.isArray(projectJourney.selectedDeliverables) && projectJourney.selectedDeliverables.includes("strategy"))
  );
}

function applicationPlanFor(id: string, applicationBriefs: BrandApplicationBriefs) {
  const deliverable = getBrandDeliverable(id);
  const brief = applicationBriefs[id] || {};
  const contentNeeds = Object.entries(brief)
    .filter(([, value]) => value?.trim())
    .map(([key, value]) => `${BRAND_APPLICATION_FIELDS[id]?.find((field) => field.id === key)?.label || key}: ${value}`);
  return {
    id,
    title: deliverable?.label || id,
    objective: deliverable?.description || "Create the selected brand application using the approved identity.",
    contentNeeds,
    designPriorities: ["Use the approved logo correctly", "Create a clear information hierarchy", "Respect the selected format", "Prepare for professional production"],
    productionNote: "AI may prepare a concept preview. Final editable, correctly sized and production-ready files require expert production.",
  };
}

export function buildLocalBrandSystem(args: {
  businessName: string;
  industry: string;
  audience: string;
  style: string;
  description?: string;
  projectJourney: Record<string, any>;
}) {
  const selectedDeliverables = uniqueStrings(args.projectJourney.selectedDeliverables);
  const applications = selectedDeliverables.filter((id) => APPLICATION_DELIVERABLES.has(id));
  return {
    businessName: args.businessName,
    summary: args.description?.trim() || `${args.businessName} ${getBrandJourney(args.projectJourney.journeyId).shortTitle.toLowerCase()} project.`,
    projectJourney: { ...args.projectJourney, projectName: args.businessName },
    foundation: {
      summary: args.description?.trim() || "The detailed brand foundation can be developed only when it is part of the selected scope.",
      purpose: "",
      positioning: "",
      strategy: "",
      mission: "",
      vision: "",
      brandPromise: "",
      targetAudience: args.audience,
      audienceNeeds: [],
      coreValues: [],
      personality: { headline: args.style, traits: [] },
      brandVoice: { headline: "", description: "", toneWords: [] },
      messagingPillars: [],
      proofPoints: [],
      dos: [],
      donts: [],
      keywords: [],
      recommendations: [],
    },
    brandStrategy: {},
    brandVoice: {},
    personality: {},
    creativeDirections: [],
    moodboardPrompts: [],
    logoDirections: [],
    applicationPlan: applications.map((id) => applicationPlanFor(id, args.projectJourney.applicationBriefs || {})),
    guidelinePlan: {},
    taglines: [],
    colourPalette: [],
    typography: [],
    projectContext: {
      industry: args.industry,
      audience: args.audience,
      style: args.style,
    },
  };
}

export function deliverableLabels(ids: string[]) {
  return ids.map((id) => getBrandDeliverable(id)?.label || id);
}

export function workspaceSectionLabels(journey: Pick<NormalisedBrandJourney, "workspaceSections" | "selectedDeliverables">) {
  const applications = getApplicationDeliverables(journey.selectedDeliverables);
  return journey.workspaceSections.map((section) => {
    if (section === "brief") return applications.length === 1 ? `${applications[0].label} Brief` : "Project Brief";
    if (section === "directions") return "Creative Directions";
    if (section === "logo") return "Logo";
    if (section === "applications") return applications.length === 1 ? applications[0].label : "Applications";
    if (section === "guidelines") return "Guidelines";
    if (section === "assets") return "Assets";
    return "Export";
  });
}
