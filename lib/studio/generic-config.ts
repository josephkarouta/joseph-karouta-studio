import type { CreditAction } from "@/lib/credits/config";

export type GuidedStudioId = "interior" | "marketing";

export type StudioField = {
  id: string;
  label: string;
  placeholder?: string;
  type: "text" | "textarea" | "select" | "multiselect";
  required?: boolean;
  options?: string[];
  helper?: string;
};

export type GuidedStudioConfig = {
  id: GuidedStudioId;
  databaseId: "interior_studio" | "marketing_studio";
  title: string;
  eyebrow: string;
  description: string;
  accent: string;
  soft: string;
  creditAction: CreditAction;
  creditCost: number;
  professionalCreditAction?: CreditAction;
  professionalCreditCost?: number;
  projectNameField: string;
  projectTypeField: string;
  steps: Array<{ title: string; description: string; fields: StudioField[] }>;
  professionalSteps?: Array<{ title: string; description: string; fields: StudioField[] }>;
  resultSections: Array<{ key: string; title: string; description: string }>;
  disclaimer: string;
  productionService: string;
  productionServiceId: string;
  professionalProductionServiceId?: string;
};

export const GUIDED_STUDIOS: Record<GuidedStudioId, GuidedStudioConfig> = {
  interior: {
    id: "interior",
    databaseId: "interior_studio",
    title: "Interior Design Studio",
    eyebrow: "Space planning & creative direction",
    description: "Turn a room, floor or property brief into a practical interior concept with layout, materials, furniture, lighting and a visual direction.",
    accent: "#d06b14",
    soft: "rgba(255,177,81,.15)",
    creditAction: "interiorConcept",
    creditCost: 8,
    professionalCreditAction: "interiorProfessionalConcept",
    professionalCreditCost: 16,
    projectNameField: "projectName",
    projectTypeField: "roomType",
    // Guided Mode is intentionally short. It is for people who want professional direction
    // without having to understand technical interior-design terminology.
    steps: [
      {
        title: "Tell us about the space",
        description: "A few simple details are enough for Heyy Studio to prepare the first direction.",
        fields: [
          { id: "projectName", label: "Project name", type: "text", required: true, placeholder: "e.g. New York apartment living room" },
          { id: "roomType", label: "What are you designing?", type: "select", required: true, options: ["Living room", "Kitchen", "Bedroom", "Bathroom", "Home office", "Restaurant", "Cafe", "Retail", "Office", "Whole home", "Other"] },
          { id: "location", label: "Project location", type: "text", placeholder: "City and country" },
          { id: "goal", label: "What should the space feel like and do better?", type: "textarea", required: true, placeholder: "Tell us who uses it, what is not working and what you would love to achieve." },
        ],
      },
      {
        title: "Choose the feel",
        description: "Pick the style, atmosphere and investment level. Heyy Studio will structure the rest.",
        fields: [
          { id: "styles", label: "Preferred styles", type: "multiselect", required: true, options: ["Contemporary", "Minimal", "Warm modern", "Mediterranean", "Organic", "Japandi", "Scandinavian", "Luxury", "Industrial", "Classic", "Eclectic"] },
          { id: "mood", label: "Desired mood", type: "select", required: true, options: ["Calm and refined", "Warm and welcoming", "Bold and expressive", "Light and airy", "Dark and cinematic", "Natural and tactile", "Premium and dramatic"] },
          { id: "budget", label: "Investment level", type: "select", required: true, options: ["Smart refresh", "Mid-range", "Premium", "Luxury", "Not decided"] },
          { id: "colors", label: "Colours you like or want to avoid", type: "text", placeholder: "e.g. warm neutrals, avoid bright red" },
        ],
      },
    ],
    // Professional Mode captures the information needed for a complete fit-out proposal,
    // procurement register, quantity schedule and delivery plan.
    professionalSteps: [
      {
        title: "Project foundation",
        description: "Define the property, scope and existing information before design development begins.",
        fields: [
          { id: "projectName", label: "Project name", type: "text", required: true, placeholder: "e.g. New York townhouse full fit-out" },
          { id: "projectScope", label: "Project scope", type: "select", required: true, options: ["Single room", "Multiple rooms", "Whole apartment", "Whole house", "Hospitality venue", "Retail fit-out", "Office fit-out", "Other"] },
          { id: "roomType", label: "Primary space type", type: "select", required: true, options: ["Living room", "Kitchen", "Bedroom", "Bathroom", "Home office", "Restaurant", "Cafe", "Retail", "Office", "Whole home", "Other"] },
          { id: "location", label: "Project location", type: "text", required: true, placeholder: "City and country" },
          { id: "siteStatus", label: "Current site status", type: "select", required: true, options: ["New build shell", "Existing occupied property", "Existing vacant property", "Under construction", "Renovation in progress", "Not confirmed"] },
          { id: "dimensions", label: "Approximate area and ceiling height", type: "text", placeholder: "e.g. 420 m² total, 2.9 m ceiling" },
          { id: "floors", label: "Floors / levels included", type: "text", placeholder: "e.g. Ground, first and second floors" },
          { id: "existingInformation", label: "Existing plans and site information", type: "textarea", placeholder: "List available floor plans, reflected ceiling plans, surveys, photos, measurements and anything still missing." },
        ],
      },
      {
        title: "Design direction",
        description: "Set the visual language, quality level and finish expectations for the complete project.",
        fields: [
          { id: "styles", label: "Preferred styles", type: "multiselect", required: true, options: ["Contemporary", "Minimal", "Warm modern", "Mediterranean", "Organic", "Japandi", "Scandinavian", "Luxury", "Industrial", "Classic", "Eclectic"] },
          { id: "mood", label: "Desired mood", type: "select", required: true, options: ["Calm and refined", "Warm and welcoming", "Bold and expressive", "Light and airy", "Dark and cinematic", "Natural and tactile", "Premium and dramatic"] },
          { id: "colors", label: "Colour direction", type: "text", placeholder: "Preferred colours, finishes and colours to avoid" },
          { id: "budget", label: "Investment level", type: "select", required: true, options: ["Mid-range", "Premium", "Luxury", "Bespoke luxury", "Not decided"] },
          { id: "materials", label: "Material and finish preferences", type: "textarea", placeholder: "Stone, timber, metal, upholstery, tiles, sanitary finishes, paint, joinery and anything to avoid." },
          { id: "visualPriorities", label: "Priority spaces and visual moments", type: "textarea", placeholder: "Which rooms, feature walls, joinery elements or views must receive the most design attention?" },
        ],
      },
      {
        title: "Technical & functional brief",
        description: "Capture the operational, accessibility, coordination and installation requirements.",
        fields: [
          { id: "goal", label: "Project objectives", type: "textarea", required: true, placeholder: "Describe the users, operations, atmosphere, performance requirements and desired outcome." },
          { id: "functionalNeeds", label: "Functional requirements", type: "textarea", required: true, placeholder: "Storage, seating, accessibility, children, pets, entertaining, work zones, acoustics and equipment." },
          { id: "keepItems", label: "Existing items and finishes to retain", type: "textarea", placeholder: "Furniture, flooring, joinery, artwork, appliances or architectural elements." },
          { id: "services", label: "Services and specialist coordination", type: "textarea", placeholder: "Electrical, lighting, plumbing, mechanical, smart home, AV, security, fire, kitchen or equipment requirements." },
          { id: "accessibility", label: "Accessibility and safety requirements", type: "textarea", placeholder: "Mobility, clearances, children, elderly users, slip resistance, handrails or other requirements." },
          { id: "constraints", label: "Site, programme and approval constraints", type: "textarea", placeholder: "Building rules, landlord approval, working hours, structural limits, lead times and anything to avoid." },
        ],
      },
      {
        title: "Procurement & delivery",
        description: "Define the sourcing market, programme and professional package the project should produce.",
        fields: [
          { id: "procurementMarket", label: "Procurement market", type: "text", required: true, placeholder: "Country or city where products should be sourced" },
          { id: "timeline", label: "Target delivery programme", type: "text", placeholder: "e.g. 8-week fit-out, handover before 15 December" },
          { id: "supplierPreference", label: "Supplier and brand preferences", type: "textarea", placeholder: "Preferred retailers, local suppliers, imported brands, custom makers or exclusions." },
          { id: "professionalDeliverables", label: "Professional package required", type: "multiselect", required: true, options: ["Executive proposal", "Design direction", "Floor plans", "Furniture plan", "Lighting / ceiling plan", "Material schedule", "Furniture schedule", "Lighting schedule", "Sanitary schedule", "Appliance schedule", "Joinery schedule", "Quantity take-off", "Procurement register", "Work programme", "Delivery milestones", "Close-out checklist"] },
          { id: "commercialNotes", label: "Commercial and procurement notes", type: "textarea", placeholder: "Budget allowances, quotation rules, taxes, shipping, installation, warranties and purchase approval process." },
        ],
      },
    ],
    resultSections: [
      { key: "conceptSummary", title: "Concept summary", description: "The central idea and experience of the space." },
      { key: "layoutPlan", title: "Layout & zoning", description: "Recommended zones, circulation and functional arrangement." },
      { key: "materialPalette", title: "Materials & finishes", description: "A coordinated palette with where and why to use each material." },
      { key: "furniturePlan", title: "Furniture direction", description: "Key pieces, proportions and placement priorities." },
      { key: "lightingPlan", title: "Lighting plan", description: "Ambient, task and accent-light strategy." },
      { key: "procurementPriorities", title: "Procurement priorities", description: "What to decide or buy first to protect the concept and budget." },
    ],
    disclaimer: "Interior Studio outputs are concept and procurement-planning directions. Dimensions, quantities, prices, supplier availability, codes and technical decisions must be verified by qualified professionals before ordering, fabrication or construction.",
    productionService: "Interior Concept Package",
    productionServiceId: "interior-concept-package",
    professionalProductionServiceId: "interior-professional-fit-out",
  },
  marketing: {
    id: "marketing",
    databaseId: "marketing_studio",
    title: "Marketing Studio",
    eyebrow: "Campaign strategy & creative system",
    description: "Turn a business objective into a focused campaign with audience insight, a big idea, channel plan, content system and production-ready creative brief.",
    accent: "#eb3d87",
    soft: "rgba(255,94,167,.14)",
    creditAction: "marketingCampaign",
    creditCost: 6,
    professionalCreditAction: "marketingCreativePack",
    professionalCreditCost: 12,
    projectNameField: "campaignName",
    projectTypeField: "objective",
    steps: [
      {
        title: "Set the campaign goal",
        description: "Define the business, offer and result the campaign must create.",
        fields: [
          { id: "campaignName", label: "Campaign name", type: "text", required: true, placeholder: "e.g. Summer launch campaign" },
          { id: "business", label: "Business or brand", type: "text", required: true, placeholder: "Business name and what it sells" },
          { id: "objective", label: "Primary objective", type: "select", required: true, options: ["Brand awareness", "Product launch", "Lead generation", "Online sales", "Store visits", "App installs", "Event registrations", "Customer retention"] },
          { id: "offer", label: "Offer or key proposition", type: "textarea", required: true, placeholder: "What exactly are people being asked to consider, buy, book or do?" },
        ],
      },
      {
        title: "Understand the audience",
        description: "Give the campaign a specific person, problem and motivation.",
        fields: [
          { id: "audience", label: "Target audience", type: "textarea", required: true, placeholder: "Who they are, where they are and what matters to them." },
          { id: "problem", label: "Audience problem or desire", type: "textarea", required: true, placeholder: "What tension, need or aspiration should the campaign speak to?" },
          { id: "proof", label: "Proof points", type: "textarea", placeholder: "Reasons to believe: results, features, testimonials, expertise, guarantee or differentiation." },
          { id: "callToAction", label: "Desired action", type: "text", required: true, placeholder: "e.g. Book a consultation, shop now, register" },
        ],
      },
      {
        title: "Choose channels & tone",
        description: "Set where the campaign appears and how it should feel.",
        fields: [
          { id: "channels", label: "Channels", type: "multiselect", required: true, options: ["Instagram", "Facebook", "TikTok", "YouTube", "Google Ads", "LinkedIn", "Email", "Website / landing page", "Outdoor", "In-store", "PR"] },
          { id: "tone", label: "Tone", type: "select", required: true, options: ["Confident and direct", "Premium and refined", "Warm and human", "Playful and energetic", "Bold and disruptive", "Educational and trustworthy"] },
          { id: "timeline", label: "Timeline", type: "text", placeholder: "Launch date and campaign duration" },
          { id: "budget", label: "Media / production level", type: "select", options: ["Organic-first", "Lean paid campaign", "Balanced campaign", "High-production launch", "Not decided"] },
          { id: "constraints", label: "Requirements or restrictions", type: "textarea", placeholder: "Mandatory claims, legal wording, assets, brand rules, regions or anything to avoid." },
        ],
      },
    ],
    professionalSteps: [
      {
        title: "Campaign foundation",
        description: "Define the commercial objective, offer, market, brand connection and campaign boundaries.",
        fields: [
          { id: "campaignName", label: "Campaign name", type: "text", required: true, placeholder: "e.g. North America product launch" },
          { id: "business", label: "Business or brand", type: "text", required: true, placeholder: "Business name, category and offer" },
          { id: "objective", label: "Primary objective", type: "select", required: true, options: ["Brand awareness", "Product launch", "Lead generation", "Online sales", "Store visits", "App installs", "Event registrations", "Customer retention"] },
          { id: "offer", label: "Offer architecture", type: "textarea", required: true, placeholder: "The proposition, price or incentive, urgency, exclusions and the exact customer action." },
          { id: "market", label: "Markets and regions", type: "text", required: true, placeholder: "Countries, cities or service areas" },
          { id: "timeline", label: "Campaign timeline", type: "text", required: true, placeholder: "Launch date, phases and campaign duration" },
          { id: "budget", label: "Media and production level", type: "select", required: true, options: ["Organic-first", "Lean paid campaign", "Balanced campaign", "High-production launch", "Enterprise / multi-market", "Not decided"] },
          { id: "constraints", label: "Mandatory requirements and restrictions", type: "textarea", placeholder: "Claims, legal wording, platform rules, brand requirements, regions, exclusions and approval steps." },
        ],
      },
      {
        title: "Audience & market intelligence",
        description: "Build specific audience segments, motivations, objections, triggers and competitive context.",
        fields: [
          { id: "audience", label: "Primary audience", type: "textarea", required: true, placeholder: "Who they are, where they are, what they already believe and what matters now." },
          { id: "secondaryAudience", label: "Secondary audience", type: "textarea", placeholder: "A second valuable segment, influencer or decision-maker." },
          { id: "problem", label: "Customer tension or desire", type: "textarea", required: true, placeholder: "The problem, aspiration or moment that creates relevance." },
          { id: "objections", label: "Main objections", type: "textarea", placeholder: "Price, trust, effort, timing, switching, risk or other barriers." },
          { id: "proof", label: "Reasons to believe", type: "textarea", required: true, placeholder: "Evidence, product advantages, expertise, testimonials, demonstrations or guarantees." },
          { id: "competitors", label: "Competitors and category conventions", type: "textarea", placeholder: "Who else competes for attention and what should this campaign do differently?" },
        ],
      },
      {
        title: "Channel & creative system",
        description: "Define channel roles, funnel stages, formats, content volume and creative requirements.",
        fields: [
          { id: "channels", label: "Campaign channels", type: "multiselect", required: true, options: ["Instagram", "Facebook", "TikTok", "YouTube", "Google Ads", "LinkedIn", "Email", "Website / landing page", "Outdoor", "In-store", "PR"] },
          { id: "funnelStages", label: "Funnel stages", type: "multiselect", required: true, options: ["Awareness", "Consideration", "Conversion", "Retargeting", "Retention", "Advocacy"] },
          { id: "tone", label: "Campaign tone", type: "select", required: true, options: ["Confident and direct", "Premium and refined", "Warm and human", "Playful and energetic", "Bold and disruptive", "Educational and trustworthy"] },
          { id: "callToAction", label: "Primary call to action", type: "text", required: true, placeholder: "e.g. Book a consultation, shop now, register" },
          { id: "deliverables", label: "Required deliverables", type: "multiselect", required: true, options: ["Campaign key visual", "Social feed ads", "Story / reel covers", "Carousel system", "Landing-page hero", "Email headers", "Display ads", "Outdoor / poster", "Campaign copy bank", "Content calendar", "Testing matrix", "Measurement plan"] },
          { id: "contentVolume", label: "Content volume or cadence", type: "text", placeholder: "e.g. 4 weeks, 3 posts and 2 stories per week" },
        ],
      },
      {
        title: "Measurement & launch operations",
        description: "Set tracking, conversion events, success thresholds, production requirements and approval ownership.",
        fields: [
          { id: "conversionEvents", label: "Conversion events", type: "textarea", required: true, placeholder: "Purchases, leads, bookings, registrations, downloads or other tracked actions." },
          { id: "successMetrics", label: "Success metrics", type: "textarea", required: true, placeholder: "KPIs, benchmarks or signals that matter for this campaign." },
          { id: "tracking", label: "Tracking and analytics setup", type: "textarea", placeholder: "Pixels, analytics, CRM, UTMs, call tracking, dashboards or missing setup." },
          { id: "testingPriorities", label: "Testing priorities", type: "textarea", placeholder: "Which audience, offer, message, visual, CTA or landing-page variables should be tested first?" },
          { id: "approvals", label: "Review and approval workflow", type: "textarea", placeholder: "Who reviews strategy, claims, creative and final launch assets?" },
          { id: "productionNotes", label: "Production and delivery notes", type: "textarea", placeholder: "File formats, platform specs, localisation, motion, video, photography, deadlines or agency handoff." },
        ],
      },
    ],
    resultSections: [
      { key: "campaignSummary", title: "Campaign summary", description: "The objective, audience and strategic role in one view." },
      { key: "bigIdea", title: "Big idea", description: "The campaign platform and why it can connect." },
      { key: "campaignAngles", title: "Campaign angles", description: "Distinct message routes for testing and creative variation." },
      { key: "channelPlan", title: "Channel plan", description: "How each selected channel contributes to the journey." },
      { key: "contentPillars", title: "Content system", description: "Repeatable themes that prevent random posting." },
      { key: "measurementPlan", title: "Measurement plan", description: "The practical signals to monitor and learn from." },
    ],
    disclaimer: "Marketing Studio provides creative and strategic direction, not guaranteed performance, legal approval or platform-policy clearance. Review claims, targeting, budgets and regulations before launch.",
    productionService: "Marketing Campaign Creative Package",
    productionServiceId: "marketing-campaign-creative-package",
  },
};
