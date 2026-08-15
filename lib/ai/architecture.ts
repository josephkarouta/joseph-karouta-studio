import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { toFile } from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAI } from "@/lib/ai/openai-server";
import { imageQualityForTier, type AiPlanConfig, type ImageGenerationTier } from "@/lib/ai/config";
import { renderArchitecturalDrawingSvg } from "@/lib/ai/architecture-drawing";
import {
  getArchitectureProjectTemplate,
  getArchitectureVisualViews,
} from "@/lib/architecture/project-templates";

export type LiveDirection = {
  title: string;
  philosophy: string;
  site_response: string;
  form_strategy: string;
  spatial_strategy: string;
  facade_strategy: string;
  materials: Array<{ name: string; role: string; description: string }>;
  roof_strategy: string;
  landscape_strategy: string;
  sustainability: string;
  natural_light_strategy: string;
  privacy_strategy: string;
  cost_level: string;
  image_prompt: string;
};

export type ArchitectureDna = {
  identity_name: string;
  design_summary: string;
  storeys: number;
  massing: string;
  roof_form: string;
  facade_rhythm: string;
  window_language: string;
  entry_expression: string;
  landscape_relationship: string;
  pool_relationship: string;
  material_placement: Array<{ material: string; location: string }>;
  signature_elements: string[];
  must_preserve: string[];
  prohibited_changes: string[];
  visual_prompt_anchor: string;
};

export type CanonicalPlanRoom = {
  id: string;
  name: string;
  zone: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanonicalPlanSectionCut = {
  id: string;
  label: string;
  orientation: "longitudinal" | "transverse";
  axis: number;
  direction: "north" | "south" | "east" | "west";
  level_id: string;
  passes_through_room_ids: string[];
  passes_through_stair: boolean;
};

export type CanonicalPlanLevel = {
  id: string;
  label: string;
  rooms: CanonicalPlanRoom[];
  circulation: Array<{ from_room_id: string; to_room_id: string; label: string }>;
  stairs?: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    connects_to_level_id: string;
  }>;
  openings?: Array<{
    id: string;
    type: "door" | "window" | "sliding_door" | "garage_door";
    room_id: string;
    wall: "north" | "south" | "east" | "west";
    position: number;
    width_m: number;
    connects_to: string;
  }>;
  fixtures?: Array<{
    room_id: string;
    fixture_type: string;
    count: number;
  }>;
};

export type CanonicalPlanSpec = {
  site: {
    width_m: number;
    depth_m: number;
    north_label: string;
    access_edge: string;
  };
  footprint: { x: number; y: number; width: number; height: number };
  pool: { present: boolean; x: number; y: number; width: number; height: number };
  driveway: { present: boolean; x: number; y: number; width: number; height: number };
  entry: { x: number; y: number; label: string };
  section_cuts?: CanonicalPlanSectionCut[];
  levels: CanonicalPlanLevel[];
};

export type LiveConcept = {
  title: string;
  summary: string;
  site_response: string;
  functional_zoning: string;
  circulation: string;
  entry_sequence: string;
  public_private_zones: string;
  indoor_outdoor_relationship: string;
  natural_light: string;
  ventilation: string;
  privacy: string;
  material_language: string;
  landscape_integration: string;
  sustainability: string;
  image_prompt: string;
};

export type LivePlanSet = {
  title: string;
  planning_assumptions: string[];
  area_schedule: Array<{ space: string; level: string; approx_area_m2: number }>;
  room_relationships: Array<{ from: string; to: string; relationship: string }>;
  conceptual_dimensions: Array<{ label: string; value: string }>;
  total_estimated_area: number;
  canonical_plan: CanonicalPlanSpec;
  plan_images: Array<{ visual_type: string; title: string; prompt: string }>;
};

export type LiveVisualPrompt = {
  visual_type: string;
  title: string;
  prompt: string;
};

export type ArchitectureImageReference = {
  label: string;
  storagePath?: string | null;
  url?: string | null;
};

export type StoredArchitectureImage = {
  imageUrl: string;
  storagePath: string;
  masterImageUrl: string;
  masterStoragePath: string;
  thumbnailImageUrl: string;
  thumbnailStoragePath: string;
};

const directionSchema = {
  name: "architecture_direction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title", "philosophy", "site_response", "form_strategy", "spatial_strategy",
      "facade_strategy", "materials", "roof_strategy", "landscape_strategy",
      "sustainability", "natural_light_strategy", "privacy_strategy", "cost_level", "image_prompt",
    ],
    properties: {
      title: { type: "string" },
      philosophy: { type: "string" },
      site_response: { type: "string" },
      form_strategy: { type: "string" },
      spatial_strategy: { type: "string" },
      facade_strategy: { type: "string" },
      materials: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "role", "description"],
          properties: {
            name: { type: "string" },
            role: { type: "string" },
            description: { type: "string" },
          },
        },
      },
      roof_strategy: { type: "string" },
      landscape_strategy: { type: "string" },
      sustainability: { type: "string" },
      natural_light_strategy: { type: "string" },
      privacy_strategy: { type: "string" },
      cost_level: { type: "string" },
      image_prompt: { type: "string" },
    },
  },
} as const;

const architectureDnaSchema = {
  name: "architecture_visual_identity",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "identity_name", "design_summary", "storeys", "massing", "roof_form",
      "facade_rhythm", "window_language", "entry_expression", "landscape_relationship",
      "pool_relationship", "material_placement", "signature_elements", "must_preserve",
      "prohibited_changes", "visual_prompt_anchor",
    ],
    properties: {
      identity_name: { type: "string" },
      design_summary: { type: "string" },
      storeys: { type: "integer", minimum: 1, maximum: 8 },
      massing: { type: "string" },
      roof_form: { type: "string" },
      facade_rhythm: { type: "string" },
      window_language: { type: "string" },
      entry_expression: { type: "string" },
      landscape_relationship: { type: "string" },
      pool_relationship: { type: "string" },
      material_placement: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["material", "location"],
          properties: {
            material: { type: "string" },
            location: { type: "string" },
          },
        },
      },
      signature_elements: { type: "array", minItems: 3, maxItems: 10, items: { type: "string" } },
      must_preserve: { type: "array", minItems: 5, maxItems: 14, items: { type: "string" } },
      prohibited_changes: { type: "array", minItems: 4, maxItems: 12, items: { type: "string" } },
      visual_prompt_anchor: { type: "string" },
    },
  },
} as const;

const conceptSchema = {
  name: "architecture_concept",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title", "summary", "site_response", "functional_zoning", "circulation",
      "entry_sequence", "public_private_zones", "indoor_outdoor_relationship",
      "natural_light", "ventilation", "privacy", "material_language",
      "landscape_integration", "sustainability", "image_prompt",
    ],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      site_response: { type: "string" },
      functional_zoning: { type: "string" },
      circulation: { type: "string" },
      entry_sequence: { type: "string" },
      public_private_zones: { type: "string" },
      indoor_outdoor_relationship: { type: "string" },
      natural_light: { type: "string" },
      ventilation: { type: "string" },
      privacy: { type: "string" },
      material_language: { type: "string" },
      landscape_integration: { type: "string" },
      sustainability: { type: "string" },
      image_prompt: { type: "string" },
    },
  },
} as const;

const coordinateProperty = { type: "number", minimum: 0, maximum: 100 } as const;

const planSchema = {
  name: "architecture_plan_set",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title", "planning_assumptions", "area_schedule", "room_relationships",
      "conceptual_dimensions", "total_estimated_area", "canonical_plan", "plan_images",
    ],
    properties: {
      title: { type: "string" },
      planning_assumptions: { type: "array", minItems: 3, maxItems: 10, items: { type: "string" } },
      area_schedule: {
        type: "array",
        minItems: 1,
        maxItems: 40,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["space", "level", "approx_area_m2"],
          properties: {
            space: { type: "string" },
            level: { type: "string" },
            approx_area_m2: { type: "number" },
          },
        },
      },
      room_relationships: {
        type: "array",
        minItems: 3,
        maxItems: 16,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["from", "to", "relationship"],
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            relationship: { type: "string" },
          },
        },
      },
      conceptual_dimensions: {
        type: "array",
        minItems: 3,
        maxItems: 18,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "value"],
          properties: {
            label: { type: "string" },
            value: { type: "string" },
          },
        },
      },
      total_estimated_area: { type: "number" },
      canonical_plan: {
        type: "object",
        additionalProperties: false,
        required: ["site", "footprint", "pool", "driveway", "entry", "section_cuts", "levels"],
        properties: {
          site: {
            type: "object",
            additionalProperties: false,
            required: ["width_m", "depth_m", "north_label", "access_edge"],
            properties: {
              width_m: { type: "number" },
              depth_m: { type: "number" },
              north_label: { type: "string" },
              access_edge: { type: "string" },
            },
          },
          footprint: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "width", "height"],
            properties: {
              x: coordinateProperty,
              y: coordinateProperty,
              width: coordinateProperty,
              height: coordinateProperty,
            },
          },
          pool: {
            type: "object",
            additionalProperties: false,
            required: ["present", "x", "y", "width", "height"],
            properties: {
              present: { type: "boolean" },
              x: coordinateProperty,
              y: coordinateProperty,
              width: coordinateProperty,
              height: coordinateProperty,
            },
          },
          driveway: {
            type: "object",
            additionalProperties: false,
            required: ["present", "x", "y", "width", "height"],
            properties: {
              present: { type: "boolean" },
              x: coordinateProperty,
              y: coordinateProperty,
              width: coordinateProperty,
              height: coordinateProperty,
            },
          },
          entry: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "label"],
            properties: {
              x: coordinateProperty,
              y: coordinateProperty,
              label: { type: "string" },
            },
          },
          section_cuts: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "id", "label", "orientation", "axis", "direction",
                "level_id", "passes_through_room_ids", "passes_through_stair",
              ],
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                orientation: { type: "string", enum: ["longitudinal", "transverse"] },
                axis: coordinateProperty,
                direction: { type: "string", enum: ["north", "south", "east", "west"] },
                level_id: { type: "string" },
                passes_through_room_ids: { type: "array", maxItems: 16, items: { type: "string" } },
                passes_through_stair: { type: "boolean" },
              },
            },
          },
          levels: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "label", "rooms", "circulation", "stairs", "openings", "fixtures"],
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                rooms: {
                  type: "array",
                  minItems: 1,
                  maxItems: 30,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "name", "zone", "x", "y", "width", "height"],
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      zone: { type: "string" },
                      x: coordinateProperty,
                      y: coordinateProperty,
                      width: coordinateProperty,
                      height: coordinateProperty,
                    },
                  },
                },
                circulation: {
                  type: "array",
                  maxItems: 24,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["from_room_id", "to_room_id", "label"],
                    properties: {
                      from_room_id: { type: "string" },
                      to_room_id: { type: "string" },
                      label: { type: "string" },
                    },
                  },
                },
                stairs: {
                  type: "array",
                  maxItems: 4,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "x", "y", "width", "height", "connects_to_level_id"],
                    properties: {
                      id: { type: "string" },
                      x: coordinateProperty,
                      y: coordinateProperty,
                      width: coordinateProperty,
                      height: coordinateProperty,
                      connects_to_level_id: { type: "string" },
                    },
                  },
                },
                openings: {
                  type: "array",
                  maxItems: 80,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "type", "room_id", "wall", "position", "width_m", "connects_to"],
                    properties: {
                      id: { type: "string" },
                      type: { type: "string", enum: ["door", "window", "sliding_door", "garage_door"] },
                      room_id: { type: "string" },
                      wall: { type: "string", enum: ["north", "south", "east", "west"] },
                      position: coordinateProperty,
                      width_m: { type: "number", minimum: 0.6, maximum: 8 },
                      connects_to: { type: "string" },
                    },
                  },
                },
                fixtures: {
                  type: "array",
                  maxItems: 80,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["room_id", "fixture_type", "count"],
                    properties: {
                      room_id: { type: "string" },
                      fixture_type: { type: "string" },
                      count: { type: "integer", minimum: 1, maximum: 20 },
                    },
                  },
                },
              },
            },
          },
        },
      },
      plan_images: {
        type: "array",
        minItems: 4,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["visual_type", "title", "prompt"],
          properties: {
            visual_type: {
              type: "string",
              enum: ["functional_zoning", "ground_floor", "upper_floor", "site_plan", "circulation"],
            },
            title: { type: "string" },
            prompt: { type: "string" },
          },
        },
      },
    },
  },
} as const;

const visualPromptsSchema = {
  name: "architecture_visual_prompts",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["visuals"],
    properties: {
      visuals: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["visual_type", "title", "prompt"],
          properties: {
            visual_type: { type: "string" },
            title: { type: "string" },
            prompt: { type: "string" },
          },
        },
      },
    },
  },
} as const;

type ArchitectureSchema =
  | typeof directionSchema
  | typeof architectureDnaSchema
  | typeof conceptSchema
  | typeof planSchema
  | typeof visualPromptsSchema;

async function structuredCompletion<T>(args: {
  plan: AiPlanConfig;
  schema: ArchitectureSchema;
  system: string;
  payload: Record<string, unknown>;
}) {
  const openai = getOpenAI();
  const fallbackModel = process.env.OPENAI_TEXT_FALLBACK_MODEL?.trim() || "gpt-4.1-mini";

  async function requestStructured(model: string, maxCompletionTokens: number) {
    const request: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: JSON.stringify(args.payload) },
      ],
      response_format: { type: "json_schema", json_schema: args.schema },
      max_completion_tokens: maxCompletionTokens,
    };

    // GPT-5 models can spend the whole completion allowance on hidden reasoning
    // before producing visible JSON. Keep reasoning minimal when a GPT-5 model
    // is intentionally configured. GPT-4.1 nano does not use a reasoning step.
    if (/^gpt-5(?:[.-]|$)/i.test(model)) {
      request.reasoning_effort = "minimal";
      request.verbosity = "low";
    }

    return openai.chat.completions.create(request as never);
  }

  let modelUsed = args.plan.textModel;
  let completion = await requestStructured(modelUsed, args.plan.maxOutputTokens);
  let choice = completion.choices[0];
  let content = choice?.message?.content?.trim() || "";

  // A reasoning model can return finish_reason=length with no visible text when
  // hidden reasoning consumes the token allowance. Retry once with the cheap,
  // non-reasoning fallback so the user does not lose the Architecture stage.
  if (!content && fallbackModel !== modelUsed) {
    modelUsed = fallbackModel;
    completion = await requestStructured(
      modelUsed,
      Math.max(args.plan.maxOutputTokens, 16000),
    );
    choice = completion.choices[0];
    content = choice?.message?.content?.trim() || "";
  }

  if (!content) {
    const refusal = choice?.message?.refusal;
    const finishReason = choice?.finish_reason || "unknown";
    const usage = completion.usage
      ? JSON.stringify(completion.usage)
      : "unavailable";

    throw new Error(
      refusal
        ? `OpenAI refused the architecture request: ${refusal}`
        : `OpenAI returned no visible architecture JSON using ${modelUsed}. Finish reason: ${finishReason}. Usage: ${usage}.`,
    );
  }

  try {
    return {
      value: JSON.parse(content) as T,
      usage: {
        ...(completion.usage || {}),
        model_used: modelUsed,
      },
    };
  } catch {
    throw new Error(
      `OpenAI returned architecture content that was not valid JSON using ${modelUsed}.`,
    );
  }
}

const safetyInstruction = [
  "All output is conceptual architecture only.",
  "Treat planning data as unverified assumptions, never confirmed legal or technical advice.",
  "Do not claim structural, fire, accessibility, planning, engineering or construction compliance.",
  "State practical assumptions clearly and require local professional verification.",
].join(" ");

const imagePromptInstruction = [
  "Every image prompt must preserve the supplied Architecture DNA exactly.",
  "Do not invent a new building identity, roof form, facade language, material placement, storey count or landscape relationship.",
  "Request professional architectural visualisation, believable geometry, realistic scale and construction logic in concept.",
  "No text, labels, dimensions, logos, signatures or watermarks inside photorealistic images.",
].join(" ");

export async function generateArchitectureDirection(args: {
  plan: AiPlanConfig;
  directionNumber: number;
  project: Record<string, unknown>;
  site: Record<string, unknown> | null;
  planning: Record<string, unknown> | null;
  selectedMaterials: Array<Record<string, unknown>>;
}) {
  const letter = String.fromCharCode(64 + args.directionNumber);
  const projectType = String(args.project.project_type || "Other");
  const template = getArchitectureProjectTemplate(projectType);

  return structuredCompletion<LiveDirection>({
    plan: args.plan,
    schema: directionSchema,
    system: [
      "You are Heyy Studio's senior conceptual architect.",
      "Create one clearly differentiated architectural direction from the supplied project data.",
      `This is a ${projectType} project. Never default to residential language unless the project type is residential.`,
      `Focus on the correct users, operations and spatial priorities: ${template.directionFocus.join(", ")}.`,
      "Write concise but complete professional content suitable for an architecture design pack.",
      safetyInstruction,
      "The direction image prompt must clearly define a single repeatable building identity, including massing, roof geometry, facade rhythm, openings, material placement, pool and landscape relationship.",
    ].join(" "),
    payload: {
      requested_direction: `Direction ${letter}`,
      differentiation_rule:
        args.directionNumber === 1
          ? "calm, restrained, practical and context-led"
          : args.directionNumber === 2
            ? "layered, landscape-integrated and spatially expressive"
            : "bold, sculptural and landmark-oriented while remaining credible as a concept",
      project: args.project,
      site: args.site,
      planning_assumptions: args.planning,
      selected_materials: args.selectedMaterials,
      project_type_template: template,
      mandatory_disclaimer: "Conceptual architecture only; professional local verification is required.",
    },
  }).then(({ value, usage }) => ({ direction: value, usage }));
}

export async function generateArchitectureDna(args: {
  plan: AiPlanConfig;
  project: Record<string, unknown>;
  direction: Record<string, unknown>;
  site: Record<string, unknown> | null;
  selectedMaterials: Array<Record<string, unknown>>;
}) {
  return structuredCompletion<ArchitectureDna>({
    plan: args.plan,
    schema: architectureDnaSchema,
    system: [
      "You are Heyy Studio's visual continuity architect.",
      "Convert the selected Architecture Direction into one strict Architecture DNA record.",
      "This record is a non-negotiable identity lock for every later concept image, floor-plan diagram and architectural visual.",
      "Use the selected direction as the source of truth. Resolve ambiguity into specific, repeatable visual rules.",
      "The prohibited_changes list must explicitly prevent redesigning the property into a different building.",
      safetyInstruction,
    ].join(" "),
    payload: {
      project: args.project,
      selected_direction: args.direction,
      site: args.site,
      selected_materials: args.selectedMaterials,
    },
  }).then(({ value, usage }) => ({ architectureDna: value, usage }));
}

export async function generateArchitectureConcept(args: {
  plan: AiPlanConfig;
  project: Record<string, unknown>;
  direction: Record<string, unknown>;
  architectureDna: ArchitectureDna;
  site: Record<string, unknown> | null;
  planning: Record<string, unknown> | null;
  selectedMaterials: Array<Record<string, unknown>>;
  spaceProgram: Array<Record<string, unknown>>;
}) {
  return structuredCompletion<LiveConcept>({
    plan: args.plan,
    schema: conceptSchema,
    system: [
      "You are Heyy Studio's senior conceptual architect preparing a selected-direction concept strategy.",
      "Translate the selected direction into a clear spatial, environmental and material concept without redesigning the building.",
      "Use the saved Space Program as client intent, not as an approved schedule.",
      "The concept image prompt must request an architectural concept presentation board, not another standalone facade render.",
      "The board should combine the exact Master Architecture Reference with clear visual studies such as massing evolution, site response, zoning, circulation, sun/orientation, material palette and indoor-outdoor relationships.",
      "It must preserve the Architecture DNA, including massing, roof geometry, facade rhythm, window language, material locations and signature elements.",
      safetyInstruction,
      imagePromptInstruction,
    ].join(" "),
    payload: {
      project: args.project,
      selected_direction: args.direction,
      architecture_dna: args.architectureDna,
      site: args.site,
      planning_assumptions: args.planning,
      selected_materials: args.selectedMaterials,
      saved_space_program: args.spaceProgram,
    },
  }).then(({ value, usage }) => ({ concept: value, usage }));
}

function expandedPlanViews(planSet: LivePlanSet, architectureDna: ArchitectureDna) {
  const hasUpperLevel = Array.isArray(planSet.canonical_plan?.levels) && planSet.canonical_plan.levels.length > 1;
  const identity = architectureDna.identity_name || "Selected Architecture Direction";
  const views: LivePlanSet["plan_images"] = [
    { visual_type: "functional_zoning", title: "Functional Zoning", prompt: "Colour-coded functional zones derived from the same canonical floor-plan geometry." },
    { visual_type: "ground_floor", title: "Ground Floor Plan", prompt: "Coordinated ground-floor plan with room names, approximate areas, entry, openings and outdoor relationships." },
    ...(hasUpperLevel ? [{ visual_type: "upper_floor", title: "Upper Floor Plan", prompt: "Coordinated upper-floor plan aligned with the same footprint, structure and vertical circulation." }] : []),
    { visual_type: "site_plan", title: "Site Plan", prompt: "Coordinated site plan showing the same footprint, access, driveway, pool, landscape, orientation and conceptual setbacks." },
    { visual_type: "circulation", title: "Circulation Diagram", prompt: "Guest, resident, staff, service and outdoor movement derived from the same canonical room relationships." },
    { visual_type: "north_elevation", title: "North Elevation", prompt: `Orthographic north elevation of ${identity}, preserving the selected massing, roof, facade rhythm, openings and materials.` },
    { visual_type: "south_elevation", title: "South Elevation", prompt: `Orthographic south elevation of ${identity}, preserving the selected massing, roof, facade rhythm, openings and materials.` },
    { visual_type: "east_elevation", title: "East Elevation", prompt: `Orthographic east elevation of ${identity}, preserving the selected massing, roof, facade rhythm, openings and materials.` },
    { visual_type: "west_elevation", title: "West Elevation", prompt: `Orthographic west elevation of ${identity}, preserving the selected massing, roof, facade rhythm, openings and materials.` },
    { visual_type: "section_longitudinal", title: "Longitudinal Section A—A", prompt: `True vertical longitudinal building section A—A through ${identity}. The cut line must be marked on every relevant floor plan with architectural section symbols and direction arrows. Pass through the stair/vertical circulation where possible and show foundations, slabs, floor-to-floor heights, clear ceiling heights, doors, windows, stair flight and landings, roof build-up and site levels.` },
    { visual_type: "section_transverse", title: "Transverse Section B—B", prompt: `True vertical transverse building section B—B through ${identity}, perpendicular to A—A. The cut line must be marked on every relevant floor plan with architectural section symbols and direction arrows. Show cut walls and slabs, projected interior elements, floor levels, door/window heights, roof, foundations and the relationship between principal spaces.` },
    { visual_type: "perspective_front", title: "Front Perspective", prompt: `Front three-quarter perspective of the exact same ${identity}.` },
    { visual_type: "perspective_rear", title: "Rear Perspective", prompt: `Rear three-quarter perspective of the exact same ${identity}, showing the primary outdoor relationship.` },
    { visual_type: "perspective_aerial", title: "Aerial Perspective", prompt: `Oblique aerial perspective of the exact same ${identity}, coordinated with the canonical site plan.` },
  ];
  return views;
}

export async function generateArchitecturePlanSet(args: {
  plan: AiPlanConfig;
  project: Record<string, unknown>;
  direction: Record<string, unknown>;
  architectureDna: ArchitectureDna;
  concept: Record<string, unknown> | null;
  site: Record<string, unknown> | null;
  planning: Record<string, unknown> | null;
  selectedMaterials: Array<Record<string, unknown>>;
  spaceProgram: Array<Record<string, unknown>>;
  existingPlan?: LivePlanSet;
  adjustmentInstruction?: string;
  adjustmentScope?: "local_area" | "current_floor" | "all_connected";
}) {
  const adjustmentInstruction = args.adjustmentInstruction?.trim();
  const isAdjustment = Boolean(args.existingPlan && adjustmentInstruction);

  return structuredCompletion<LivePlanSet>({
    plan: args.plan,
    schema: planSchema,
    system: [
      "You are Heyy Studio's senior conceptual architect preparing one internally coordinated, non-construction concept plan set.",
      "Create exactly one Canonical Plan Specification. Every plan view must derive from this same site, footprint, room coordinates, circulation and entry.",
      "Coordinates use a 0 to 100 site grid. All rooms, pool, driveway, entry and footprint must fit within that grid.",
      "Use the full coordinate canvas: distribute each level between approximately 8 and 92 rather than clustering rooms in one small corner.",
      "Rooms on the same level must not overlap. Align shared walls, keep circulation legible and give every room a practical minimum width and height.",
      "Create a mostly contiguous architectural footprint. Avoid isolated floating room boxes; gaps are allowed only for real courtyards, patios, light wells or separated garages.",
      "Place kitchens beside dining spaces, bathrooms near plumbing zones, bedrooms in private zones, garages at vehicle access and entries beside circulation halls.",
      "For every level, define a real opening schedule. Include the main entry door, internal doors for every enclosed room, exterior windows for habitable rooms, and sliding or hinged doors to terraces, balconies, gardens, patios and pool decks where relevant.",
      "Every room must be reachable through the circulation graph and opening schedule. Do not leave isolated rooms, inaccessible outdoor spaces or a main entrance that does not connect to a foyer or hall.",
      "Define stairs whenever the project has more than one level. Stairs must align vertically between connected levels and must open into usable halls or landings.",
      "Define representative fixtures for kitchens, bathrooms, bedrooms, living, dining, laundry, utility and garage spaces so the detailed concept plan can show professional interior information.",
      "Define at least two perpendicular architectural section cuts in canonical_plan.section_cuts. Label them A—A and B—B, specify the cut axis and viewing direction, and list the rooms crossed by each cut.",
      "At least one section cut must pass through the principal stair or other vertical circulation so the section can show stair flights, landings, slab openings and floor-to-floor relationships.",
      "The A—A and B—B cut lines must be suitable for drawing on every applicable floor plan with standard architectural section symbols and arrows.",
      "Ground and upper levels must align vertically where appropriate and describe the same building represented by the selected Architecture Direction.",
      "Align stairs, wet areas, primary structural zones and major facade openings between levels. Upper floors must respond to the ground-floor geometry rather than becoming unrelated layouts. Treat the building as one coordinated object: all stairs, lifts, shafts, major service cores and principal corridor spines must remain in the same position on every connected level unless the brief explicitly requires termination. Use one shared building outline logic across every floor so the overall footprint and massing remain consistent with the selected Architecture Direction. Every enclosed room must have at least one real door opening and must connect to a corridor, hall, landing or appropriate external access. Avoid dead-end inaccessible rooms. Maintain the same public, private, service and emergency circulation logic across the full project rather than redesigning circulation independently on each floor. For healthcare projects, keep public circulation and service circulation separate where practical, keep critical departments accessible by clear corridors, give every inpatient bedroom a directly accessible ensuite bathroom, and encode the inpatient room mix clearly when the brief asks for one-bed, two-bed or three-bed rooms.",
      "Use realistic room proportions and circulation widths. Avoid extremely long, narrow or oversized spaces unless the brief explicitly requires them.",
      "Do not create alternative floor plans. Do not allow each diagram to invent a different property.",
      "The plan_images prompts are labels and presentation notes only. Heyy Studio will use GPT Image 2 with canonical_plan, the selected direction and related approved floors to create detailed concept plans.",
      "Include functional_zoning, ground_floor, upper_floor when two or more storeys exist, site_plan and circulation.",
      ...(isAdjustment
        ? [
            "This request is a controlled adjustment to an existing coordinated plan set, not a new design.",
            "Use existing_plan as the source of truth and preserve every unaffected room, coordinate, opening, stair, fixture, section cut, footprint, site element, area and relationship.",
            "Apply only adjustment_request.instruction at the requested scope. Make the smallest coordinated change that satisfies it.",
            "For local_area, change only the directly requested room or local relationship unless a minimal connected adjustment is unavoidable.",
            "For current_floor, preserve every other level and keep stairs, wet cores, structure, section cuts and major openings aligned.",
            "For all_connected, update all dependent levels and views only where coordination requires it, while preserving the approved Architecture DNA.",
            "Return the complete updated plan set in the normal schema, including all unchanged data as well as the adjusted data.",
          ]
        : []),
      safetyInstruction,
    ].join(" "),
    payload: {
      project: args.project,
      selected_direction: args.direction,
      architecture_dna: args.architectureDna,
      concept: args.concept,
      site: args.site,
      planning_assumptions: args.planning,
      selected_materials: args.selectedMaterials,
      saved_space_program: args.spaceProgram,
      ...(isAdjustment
        ? {
            existing_plan: args.existingPlan,
            adjustment_request: {
              instruction: adjustmentInstruction,
              scope: args.adjustmentScope || "all_connected",
            },
          }
        : {}),
      canonical_plan_rules: {
        coordinate_system: "0-100 relative site grid using most of the available canvas",
        room_geometry: "No overlapping room rectangles. Shared walls should align. Keep coordinates and dimensions practical and readable.",
        same_property_rule: "Every level and diagram is the same property and uses one footprint and one site arrangement.",
        opening_rules: "Every enclosed room has an internal door; habitable rooms have exterior windows; relevant public rooms have explicit outdoor access.",
        vertical_rules: "Stairs, lifts, shafts, wet cores, structural zones, corridor spines and major openings align between levels and keep the same core positions across the building.",
        accessibility_rules: "Every enclosed room has a door opening and a valid access path from circulation or external entry.",
        building_outline_rules: "Every floor belongs to the same building and keeps a coordinated overall outline consistent with the selected direction.",
        healthcare_rules: "For hospital and healthcare projects, maintain clear public, clinical and service circulation logic and give inpatient bedrooms direct ensuite access.",
        section_rules: "Provide perpendicular A—A and B—B section cuts. At least one passes through the stair; both are marked on floor plans and produce true vertical sections with level and height information.",
        fixture_rules: "Include representative architectural fixtures and furniture so plans can be checked for usability.",
        diagram_renderer: "GPT Image 2 detailed concept drawing using the canonical model as the source",
      },
    },
  }).then(({ value, usage }) => ({
    planSet: { ...value, plan_images: expandedPlanViews(value, args.architectureDna) },
    usage,
  }));
}

export async function generateArchitectureVisualPrompts(args: {
  plan: AiPlanConfig;
  project: Record<string, unknown>;
  direction: Record<string, unknown>;
  architectureDna: ArchitectureDna;
  canonicalPlan: CanonicalPlanSpec | null;
  concept: Record<string, unknown> | null;
  site: Record<string, unknown> | null;
  selectedMaterials: Array<Record<string, unknown>>;
  requestedViews: string[];
}) {
  const projectType = String(args.project.project_type || "Other");
  const template = getArchitectureProjectTemplate(projectType);
  const requestedViews = args.requestedViews.length
    ? args.requestedViews
    : getArchitectureVisualViews(projectType);
  const existingDesignSource = String(args.project.workflow_mode || "") === "plan_to_render";

  return structuredCompletion<{ visuals: LiveVisualPrompt[] }>({
    plan: args.plan,
    schema: visualPromptsSchema,
    system: [
      "You are Heyy Studio's architecture visual director.",
      "Prepare one coordinated image prompt for each requested view of the exact same property.",
      `This is a ${projectType} project. Include the appropriate interior experiences and operational spaces rather than using a residential-only gallery.`,
      `The gallery must reflect these priorities: ${template.directionFocus.join(", ")}.`,
      existingDesignSource
        ? "This is an Existing Design / Plan-to-Visual workflow. The uploaded drawings will be supplied directly to the image editor as authoritative geometry. Do not describe or invent a specific footprint, room layout, stair position, opening pattern, roof geometry or massing that is not explicitly stated by the user."
        : "The selected direction image is the Master Architecture Reference and will be supplied to the image editor.",
      existingDesignSource
        ? "Prompts should describe only the requested camera/view, material character, atmosphere, lighting, landscape treatment and functional experience. Always say to reconstruct the exact uploaded design."
        : "Every prompt must explicitly preserve the Architecture DNA and must not redesign the building.",
      existingDesignSource
        ? "Do not rely on a generated canonical plan, concept render or direction render to define geometry."
        : "Aerial and site-related views must respect the Canonical Plan Specification.",
      "Night views must be a lighting transformation of the same day-time architecture, not a new design.",
      "Use stable snake_case visual_type values.",
      safetyInstruction,
      imagePromptInstruction,
    ].join(" "),
    payload: existingDesignSource
      ? {
          project: args.project,
          selected_direction_style: {
            title: args.direction.title,
            philosophy: args.direction.philosophy,
            materials: args.direction.materials,
            landscape_strategy: args.direction.landscape_strategy,
            natural_light_strategy: args.direction.natural_light_strategy,
          },
          site: args.site,
          selected_materials: args.selectedMaterials,
          requested_views: requestedViews,
          project_type_template: template,
          geometry_rule: "Uploaded source drawings are authoritative; do not invent geometry in prompt text.",
        }
      : {
          project: args.project,
          selected_direction: args.direction,
          architecture_dna: args.architectureDna,
          canonical_plan: args.canonicalPlan,
          concept: args.concept,
          site: args.site,
          selected_materials: args.selectedMaterials,
          requested_views: requestedViews,
          project_type_template: template,
        },
  }).then(({ value, usage }) => ({
    visuals: existingDesignSource
      ? value.visuals.map((visual) => ({
          ...visual,
          prompt: [
            `Create the ${visual.title || visual.visual_type.replace(/_/g, " ")} view of the exact uploaded existing design.`,
            "Reconstruct the building from the supplied source plans/elevations/sections. Source geometry overrides every generated reference.",
            visual.prompt,
            "Do not invent a different footprint, storey arrangement, stair position, opening pattern or massing.",
          ].join(" "),
        }))
      : value.visuals,
    usage,
  }));
}

function safeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "architecture";
}

function supportedImageMime(value: string | null | undefined) {
  if (value === "image/jpeg" || value === "image/jpg") return "image/jpeg";
  if (value === "image/webp") return "image/webp";
  return "image/png";
}

type ArchitectureReferenceAsset = {
  bytes: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  filename: string;
};

async function loadReferenceAsset(
  supabase: SupabaseClient,
  reference: ArchitectureImageReference,
  index: number,
): Promise<ArchitectureReferenceAsset | null> {
  let bytes: Buffer | null = null;
  let mimeType: "image/png" | "image/jpeg" | "image/webp" = "image/png";

  if (reference.storagePath) {
    const { data, error } = await supabase.storage
      .from("architecture-files")
      .download(reference.storagePath);
    if (!error && data) {
      bytes = Buffer.from(await data.arrayBuffer());
      mimeType = supportedImageMime(data.type);
    }
  }

  if (!bytes && reference.url && /^https?:\/\//i.test(reference.url)) {
    const response = await fetch(reference.url);
    if (response.ok) {
      bytes = Buffer.from(await response.arrayBuffer());
      mimeType = supportedImageMime(response.headers.get("content-type"));
    }
  }

  if (!bytes) return null;
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
  return {
    bytes,
    mimeType,
    filename: `${index + 1}-${safeFilePart(reference.label)}.${extension}`,
  };
}

async function loadReferenceFile(
  supabase: SupabaseClient,
  reference: ArchitectureImageReference,
  index: number,
) {
  const asset = await loadReferenceAsset(supabase, reference, index);
  return asset ? toFile(asset.bytes, asset.filename, { type: asset.mimeType }) : null;
}

function continuityPrompt(args: {
  prompt: string;
  architectureDna?: ArchitectureDna | null;
  sourceGeometryReferences?: ArchitectureImageReference[];
  referenceImages: ArchitectureImageReference[];
  targetRole?: string;
  preserveSourceGeometry?: boolean;
}) {
  const sourceReferences = args.sourceGeometryReferences || [];
  const sourceList = sourceReferences
    .map((reference, index) => `SOURCE GEOMETRY ${index + 1}: ${reference.label}.`)
    .join(" ");
  const referenceList = args.referenceImages
    .map((reference, index) => `STYLE / CONTINUITY ${index + 1}: ${reference.label}.`)
    .join(" ");

  const sourceLocked = Boolean(args.preserveSourceGeometry && sourceReferences.length);

  return [
    sourceLocked
      ? "EXISTING DESIGN MODE. THE SOURCE DRAWINGS ARE THE ABSOLUTE GEOMETRY SOURCE OF TRUTH."
      : "VISUAL CONTINUITY IS THE HIGHEST PRIORITY.",
    sourceList,
    referenceList,
    sourceLocked
      ? "The SOURCE GEOMETRY references come first and override every later style, direction, concept or previous-render reference if there is any conflict. Preserve the visible footprint, storey count, floor relationships, stairs, external walls, openings, roof/profile information, setbacks and spatial arrangement. Do not copy geometry from STYLE / CONTINUITY references."
      : args.referenceImages.length
        ? "Reference 1 is the Master Architecture Reference unless explicitly labelled otherwise. Preserve the same property identity."
        : "",
    sourceLocked
      ? "Use later references only for materials, colour, landscape character, lighting, atmosphere and camera continuity. They are NEVER permission to redesign the building."
      : args.architectureDna
        ? `ARCHITECTURE DNA — ${JSON.stringify(args.architectureDna)}`
        : "",
    args.targetRole ? `TARGET ROLE — ${args.targetRole}` : "",
    sourceLocked
      ? "Translate the existing technical drawings into the requested architectural visual. If information is not shown in the drawings, keep the interpretation conservative and do not invent a different building."
      : "Do not invent a new house. Preserve the same massing, storey count, roof geometry, facade rhythm, window proportions, material placement, terraces, entry expression, pool relationship and landscape language.",
    "Only change the requested camera, diagram role, lighting, atmosphere or presentation treatment.",
    args.prompt,
    "Professional architecture presentation, coherent geometry, realistic scale and materials, refined lighting. No text, labels, logo, signature or watermark inside photorealistic images.",
  ].filter(Boolean).join("\n\n");
}

async function uploadGeneratedFile(args: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  folder: "directions" | "concept" | "plans" | "visuals";
  filenamePrefix: string;
  bytes: Buffer;
  extension: "png" | "svg" | "webp";
  contentType: "image/png" | "image/svg+xml" | "image/webp";
}) {
  const path = `${args.userId}/${args.projectId}/${args.folder}/${safeFilePart(args.filenamePrefix)}-${Date.now()}.${args.extension}`;
  const { error: uploadError } = await args.supabase.storage
    .from("architecture-files")
    .upload(path, args.bytes, {
      contentType: args.contentType,
      cacheControl: "31536000",
      upsert: false,
    });
  if (uploadError) throw new Error(`Architecture image upload failed: ${uploadError.message}`);

  const { data: signed, error: signedError } = await args.supabase.storage
    .from("architecture-files")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signedError) {
    await args.supabase.storage.from("architecture-files").remove([path]);
    throw new Error(`Architecture image URL failed: ${signedError.message}`);
  }
  return { imageUrl: signed.signedUrl, storagePath: path };
}

async function storeArchitectureImageVariants(args: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  folder: "directions" | "concept" | "plans" | "visuals";
  filenamePrefix: string;
  sourceBytes: Buffer;
  tier: ImageGenerationTier;
}): Promise<StoredArchitectureImage> {
  const source = sharp(args.sourceBytes).rotate();
  const masterQuality = args.tier === "final" ? 96 : 90;
  const [masterBytes, previewBytes, thumbnailBytes] = await Promise.all([
    source.clone().webp({ quality: masterQuality, effort: 5, smartSubsample: true }).toBuffer(),
    source.clone().resize({ width: 960, withoutEnlargement: true }).webp({ quality: 74, effort: 5, smartSubsample: true }).toBuffer(),
    source.clone().resize({ width: 420, withoutEnlargement: true }).webp({ quality: 66, effort: 5, smartSubsample: true }).toBuffer(),
  ]);

  const uploaded: string[] = [];
  try {
    const master = await uploadGeneratedFile({
      supabase: args.supabase,
      userId: args.userId,
      projectId: args.projectId,
      folder: args.folder,
      filenamePrefix: `${args.filenamePrefix}-${args.tier}-master`,
      bytes: masterBytes,
      extension: "webp",
      contentType: "image/webp",
    });
    uploaded.push(master.storagePath);

    const preview = await uploadGeneratedFile({
      supabase: args.supabase,
      userId: args.userId,
      projectId: args.projectId,
      folder: args.folder,
      filenamePrefix: `${args.filenamePrefix}-${args.tier}-preview`,
      bytes: previewBytes,
      extension: "webp",
      contentType: "image/webp",
    });
    uploaded.push(preview.storagePath);

    const thumbnail = await uploadGeneratedFile({
      supabase: args.supabase,
      userId: args.userId,
      projectId: args.projectId,
      folder: args.folder,
      filenamePrefix: `${args.filenamePrefix}-${args.tier}-thumbnail`,
      bytes: thumbnailBytes,
      extension: "webp",
      contentType: "image/webp",
    });
    uploaded.push(thumbnail.storagePath);

    return {
      imageUrl: preview.imageUrl,
      storagePath: preview.storagePath,
      masterImageUrl: master.imageUrl,
      masterStoragePath: master.storagePath,
      thumbnailImageUrl: thumbnail.imageUrl,
      thumbnailStoragePath: thumbnail.storagePath,
    };
  } catch (error) {
    if (uploaded.length) await args.supabase.storage.from("architecture-files").remove(uploaded);
    throw error;
  }
}

export async function generateAndStoreArchitectureImage(args: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  folder: "directions" | "concept" | "plans" | "visuals";
  filenamePrefix: string;
  prompt: string;
  plan: AiPlanConfig;
  tier?: ImageGenerationTier;
  architectureDna?: ArchitectureDna | null;
  referenceImages?: ArchitectureImageReference[];
  sourceGeometryReferences?: ArchitectureImageReference[];
  preserveSourceGeometry?: boolean;
  targetRole?: string;
}) {
  const openai = getOpenAI();
  const tier = args.tier || "preview";
  const sourceGeometryReferences = (args.sourceGeometryReferences || []).filter(
    (reference) => Boolean(reference.storagePath || reference.url),
  ).slice(0, 5);
  const referenceImages = (args.referenceImages || []).filter(
    (reference) => Boolean(reference.storagePath || reference.url),
  ).slice(0, Math.max(0, 6 - sourceGeometryReferences.length));

  const sourceFiles = (
    await Promise.all(sourceGeometryReferences.map((reference, index) => loadReferenceFile(args.supabase, reference, index)))
  ).filter((file): file is NonNullable<typeof file> => Boolean(file));
  const styleFiles = (
    await Promise.all(referenceImages.map((reference, index) => loadReferenceFile(args.supabase, reference, index + sourceFiles.length)))
  ).filter((file): file is NonNullable<typeof file> => Boolean(file));
  const uploadables = [...sourceFiles, ...styleFiles].slice(0, 6);

  const prompt = continuityPrompt({
    prompt: args.prompt,
    architectureDna: args.architectureDna,
    sourceGeometryReferences: sourceGeometryReferences.slice(0, sourceFiles.length),
    referenceImages: referenceImages.slice(0, styleFiles.length),
    preserveSourceGeometry: args.preserveSourceGeometry,
    targetRole: args.targetRole,
  });
  const quality = imageQualityForTier(args.plan, tier);

  const result = uploadables.length
    ? await openai.images.edit({
        model: args.plan.imageModel,
        image: uploadables,
        prompt,
        size: "1536x1024",
        quality,
        output_format: "png",
      })
    : await openai.images.generate({
        model: args.plan.imageModel,
        prompt,
        size: "1536x1024",
        quality,
        output_format: "png",
      });

  const base64 = result.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI returned no architecture image data.");
  const stored = await storeArchitectureImageVariants({
    supabase: args.supabase,
    userId: args.userId,
    projectId: args.projectId,
    folder: args.folder,
    filenamePrefix: args.filenamePrefix,
    sourceBytes: Buffer.from(base64, "base64"),
    tier,
  });

  return {
    ...stored,
    tier,
    quality,
    referenceCount: uploadables.length,
    sourceReferenceCount: sourceFiles.length,
    styleReferenceCount: styleFiles.length,
    usage: result.usage || null,
    generationMethod: uploadables.length ? "reference-edit" : "text-generation",
  };
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}

function levelForType(plan: CanonicalPlanSpec, visualType: string) {
  const levels = Array.isArray(plan.levels) ? plan.levels : [];
  if (visualType === "upper_floor") {
    return levels.find((level) => /upper|first|second|level\s*1|level\s*2/i.test(`${level.id} ${level.label}`))
      || levels[1]
      || levels[0];
  }
  return levels.find((level) => /ground|lower|level\s*0/i.test(`${level.id} ${level.label}`))
    || levels[0];
}

const zoneColours: Record<string, string> = {
  public: "#DBEAFE",
  private: "#EDE9FE",
  service: "#E2E8F0",
  outdoor: "#DCFCE7",
  flexible: "#FEF3C7",
  wellness: "#CCFBF1",
  entertainment: "#FCE7F3",
  circulation: "#E0E7FF",
};

function zoneKey(zone: string) {
  const lower = zone.toLowerCase();
  return Object.keys(zoneColours).find((item) => lower.includes(item)) || "flexible";
}

function roomColour(zone: string) {
  return zoneColours[zoneKey(zone)] || "#F8FAFC";
}

type ScreenRoom = {
  room: CanonicalPlanRoom;
  x: number;
  y: number;
  width: number;
  height: number;
};

function fitRoomsToRect(
  rooms: CanonicalPlanRoom[],
  target: { x: number; y: number; width: number; height: number },
): ScreenRoom[] {
  if (!rooms.length) return [];

  const minX = Math.min(...rooms.map((room) => clamp(room.x)));
  const minY = Math.min(...rooms.map((room) => clamp(room.y)));
  const maxX = Math.max(...rooms.map((room) => clamp(room.x + Math.max(room.width, 2))));
  const maxY = Math.max(...rooms.map((room) => clamp(room.y + Math.max(room.height, 2))));
  const sourceWidth = Math.max(8, maxX - minX);
  const sourceHeight = Math.max(8, maxY - minY);
  const padding = 22;
  const usableWidth = Math.max(100, target.width - padding * 2);
  const usableHeight = Math.max(100, target.height - padding * 2);
  const scale = Math.min(usableWidth / sourceWidth, usableHeight / sourceHeight);
  const fittedWidth = sourceWidth * scale;
  const fittedHeight = sourceHeight * scale;
  const offsetX = target.x + (target.width - fittedWidth) / 2;
  const offsetY = target.y + (target.height - fittedHeight) / 2;

  return rooms.map((room) => ({
    room,
    x: offsetX + (clamp(room.x) - minX) * scale,
    y: offsetY + (clamp(room.y) - minY) * scale,
    width: Math.max(54, Math.max(room.width, 2) * scale),
    height: Math.max(44, Math.max(room.height, 2) * scale),
  }));
}

function wrapLabel(value: string, maxCharacters: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharacters && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function roomTextSvg(screenRoom: ScreenRoom, showZone: boolean) {
  const { room, x, y, width, height } = screenRoom;
  const fontSize = Math.max(12, Math.min(22, Math.min(width / 8, height / 4.2)));
  const maxCharacters = Math.max(8, Math.floor(width / (fontSize * 0.56)));
  const lines = wrapLabel(room.name, maxCharacters);
  const lineHeight = fontSize * 1.08;
  const totalHeight = lines.length * lineHeight + (showZone ? 18 : 0);
  const startY = y + height / 2 - totalHeight / 2 + fontSize;

  return `
    <text x="${x + width / 2}" y="${startY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#0F172A">
      ${lines.map((line, index) => `<tspan x="${x + width / 2}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join("")}
    </text>
    ${showZone ? `<text x="${x + width / 2}" y="${y + height - 13}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="1.1" fill="#64748B">${escapeXml(room.zone.toUpperCase())}</text>` : ""}`;
}

function roomWindowSvg(screenRoom: ScreenRoom, target: { x: number; y: number; width: number; height: number }) {
  const { x, y, width, height } = screenRoom;
  const threshold = 18;
  const windowSegments: string[] = [];
  if (Math.abs(y - target.y) < threshold) {
    windowSegments.push(`<line x1="${x + width * 0.22}" y1="${y}" x2="${x + width * 0.78}" y2="${y}" stroke="#38BDF8" stroke-width="7"/>`);
  }
  if (Math.abs(y + height - (target.y + target.height)) < threshold) {
    windowSegments.push(`<line x1="${x + width * 0.22}" y1="${y + height}" x2="${x + width * 0.78}" y2="${y + height}" stroke="#38BDF8" stroke-width="7"/>`);
  }
  if (Math.abs(x - target.x) < threshold) {
    windowSegments.push(`<line x1="${x}" y1="${y + height * 0.22}" x2="${x}" y2="${y + height * 0.78}" stroke="#38BDF8" stroke-width="7"/>`);
  }
  if (Math.abs(x + width - (target.x + target.width)) < threshold) {
    windowSegments.push(`<line x1="${x + width}" y1="${y + height * 0.22}" x2="${x + width}" y2="${y + height * 0.78}" stroke="#38BDF8" stroke-width="7"/>`);
  }
  return windowSegments.join("");
}

function planLegendSvg(items: string[]) {
  const unique = Array.from(new Set(items.map(zoneKey)));
  return unique.map((key, index) => {
    const x = 78 + index * 195;
    return `
      <rect x="${x}" y="928" width="20" height="20" rx="5" fill="${zoneColours[key]}"/>
      <text x="${x + 30}" y="944" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#334155">${escapeXml(key.toUpperCase())}</text>`;
  }).join("");
}

function normaliseSiteElement(
  element: { x: number; y: number; width: number; height: number },
  siteRect: { x: number; y: number; width: number; height: number },
) {
  return {
    x: siteRect.x + (clamp(element.x) / 100) * siteRect.width,
    y: siteRect.y + (clamp(element.y) / 100) * siteRect.height,
    width: Math.max(30, (clamp(element.width) / 100) * siteRect.width),
    height: Math.max(24, (clamp(element.height) / 100) * siteRect.height),
  };
}

function renderSitePlanSvg(plan: CanonicalPlanSpec) {
  const site = { x: 170, y: 155, width: 1196, height: 700 };
  const footprint = normaliseSiteElement(plan.footprint || { x: 20, y: 20, width: 60, height: 55 }, site);
  const pool = normaliseSiteElement(plan.pool || { x: 65, y: 30, width: 22, height: 38 }, site);
  const driveway = normaliseSiteElement(plan.driveway || { x: 5, y: 65, width: 25, height: 25 }, site);
  const entryX = site.x + (clamp(plan.entry?.x || 50) / 100) * site.width;
  const entryY = site.y + (clamp(plan.entry?.y || 85) / 100) * site.height;

  const contours = Array.from({ length: 8 }, (_, index) => {
    const y = site.y + 70 + index * 72;
    return `<path d="M ${site.x + 32} ${y} C ${site.x + 300} ${y - 32}, ${site.x + 700} ${y + 38}, ${site.x + site.width - 32} ${y - 10}" fill="none" stroke="#D1FAE5" stroke-width="3"/>`;
  }).join("");

  return `
    <rect x="${site.x}" y="${site.y}" width="${site.width}" height="${site.height}" rx="18" fill="#F0FDF4" stroke="#0F172A" stroke-width="5"/>
    ${contours}
    <rect x="${site.x + 52}" y="${site.y + 52}" width="${site.width - 104}" height="${site.height - 104}" rx="14" fill="none" stroke="#94A3B8" stroke-width="3" stroke-dasharray="11 9"/>
    <text x="${site.x + 66}" y="${site.y + 82}" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#64748B">CONCEPTUAL SETBACK ENVELOPE</text>
    <rect x="${footprint.x}" y="${footprint.y}" width="${footprint.width}" height="${footprint.height}" rx="12" fill="#E2E8F0" stroke="#111827" stroke-width="5"/>
    <text x="${footprint.x + footprint.width / 2}" y="${footprint.y + footprint.height / 2 - 4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="#111827">BUILDING FOOTPRINT</text>
    <text x="${footprint.x + footprint.width / 2}" y="${footprint.y + footprint.height / 2 + 26}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#475569">${escapeXml(plan.levels?.length || 1)} LEVEL${plan.levels?.length === 1 ? "" : "S"}</text>
    ${plan.pool?.present ? `
      <rect x="${pool.x}" y="${pool.y}" width="${pool.width}" height="${pool.height}" rx="11" fill="#BAE6FD" stroke="#0284C7" stroke-width="4"/>
      <line x1="${pool.x + 18}" y1="${pool.y + pool.height / 2}" x2="${pool.x + pool.width - 18}" y2="${pool.y + pool.height / 2}" stroke="#7DD3FC" stroke-width="4" stroke-dasharray="12 8"/>
      <text x="${pool.x + pool.width / 2}" y="${pool.y + pool.height / 2 + 6}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="#075985">POOL</text>` : ""}
    ${plan.driveway?.present ? `
      <rect x="${driveway.x}" y="${driveway.y}" width="${driveway.width}" height="${driveway.height}" rx="8" fill="#CBD5E1" stroke="#64748B" stroke-width="3"/>
      <text x="${driveway.x + driveway.width / 2}" y="${driveway.y + driveway.height / 2 + 5}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#334155">DRIVEWAY</text>` : ""}
    <circle cx="${entryX}" cy="${entryY}" r="15" fill="#6D28D9" stroke="#FFFFFF" stroke-width="5"/>
    <text x="${entryX}" y="${entryY - 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#5B21B6">${escapeXml(plan.entry?.label || "MAIN ENTRY")}</text>
    <g transform="translate(${site.x + site.width - 96} ${site.y + 48})">
      <path d="M 0 72 L 28 0 L 56 72 L 28 55 Z" fill="#111827"/>
      <text x="28" y="101" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="800">${escapeXml(plan.site?.north_label || "N")}</text>
    </g>
    <text x="${site.x}" y="${site.y + site.height + 32}" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#64748B">SITE ${escapeXml(plan.site?.width_m || "—")} m × ${escapeXml(plan.site?.depth_m || "—")} m</text>
    <text x="${site.x + site.width}" y="${site.y + site.height + 32}" text-anchor="end" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#64748B">ACCESS EDGE · ${escapeXml(plan.site?.access_edge || "TO VERIFY")}</text>`;
}

function renderElevationSvg(
  plan: CanonicalPlanSpec,
  visualType: string,
  architectureDna?: ArchitectureDna | null,
) {
  const storeys = Math.max(1, Math.min(4, Number(architectureDna?.storeys || plan.levels?.length || 2)));
  const elevationName = visualType.replace("_elevation", "").toUpperCase();
  const x = 165;
  const baseline = 820;
  const width = 1206;
  const totalHeight = Math.min(560, 190 + storeys * 118);
  const floorHeight = totalHeight / storeys;
  const roofY = baseline - totalHeight;
  const bays = 8;
  const bayWidth = width / bays;
  const facade = Array.from({ length: storeys }, (_, floorIndex) => {
    const floorY = baseline - (floorIndex + 1) * floorHeight;
    const openings = Array.from({ length: bays }, (_, bayIndex) => {
      const inset = 17;
      const openingX = x + bayIndex * bayWidth + inset;
      const openingY = floorY + 26;
      const openingWidth = bayWidth - inset * 2;
      const openingHeight = Math.max(42, floorHeight - 48);
      const isSolid = (bayIndex + floorIndex + elevationName.length) % 4 === 0;
      return isSolid
        ? `<rect x="${openingX}" y="${openingY}" width="${openingWidth}" height="${openingHeight}" rx="3" fill="#E7E5E4" stroke="#78716C" stroke-width="2"/>`
        : `<rect x="${openingX}" y="${openingY}" width="${openingWidth}" height="${openingHeight}" rx="3" fill="#DBEAFE" stroke="#0F172A" stroke-width="3"/><line x1="${openingX + openingWidth / 2}" y1="${openingY}" x2="${openingX + openingWidth / 2}" y2="${openingY + openingHeight}" stroke="#64748B" stroke-width="2"/>`;
    }).join("");
    return `<g><line x1="${x}" y1="${floorY}" x2="${x + width}" y2="${floorY}" stroke="#0F172A" stroke-width="5"/>${openings}</g>`;
  }).join("");
  const roofForm = String(architectureDna?.roof_form || "Coordinated roof form");
  const roof = /pitch|gable|hip/i.test(roofForm)
    ? `<path d="M ${x - 18} ${roofY + 26} L ${x + width * .48} ${roofY - 55} L ${x + width + 18} ${roofY + 26}" fill="#E2E8F0" stroke="#0F172A" stroke-width="7" stroke-linejoin="round"/>`
    : `<rect x="${x - 18}" y="${roofY - 10}" width="${width + 36}" height="35" rx="4" fill="#CBD5E1" stroke="#0F172A" stroke-width="6"/>`;
  const dimensions = Array.from({ length: storeys }, (_, index) => {
    const y1 = baseline - index * floorHeight;
    const y2 = baseline - (index + 1) * floorHeight;
    return `<line x1="95" y1="${y1}" x2="95" y2="${y2}" stroke="#6D28D9" stroke-width="2"/><line x1="84" y1="${y1}" x2="106" y2="${y1}" stroke="#6D28D9" stroke-width="2"/><line x1="84" y1="${y2}" x2="106" y2="${y2}" stroke="#6D28D9" stroke-width="2"/><text x="78" y="${(y1 + y2) / 2}" text-anchor="end" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#5B21B6">LEVEL ${index + 1}</text>`;
  }).join("");
  return `
    <rect x="${x - 40}" y="${roofY - 85}" width="${width + 80}" height="${baseline - roofY + 120}" rx="18" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="3"/>
    <line x1="${x - 70}" y1="${baseline}" x2="${x + width + 70}" y2="${baseline}" stroke="#0F172A" stroke-width="7"/>
    ${facade}
    ${roof}
    ${dimensions}
    <text x="${x}" y="${baseline + 52}" font-family="Arial, sans-serif" font-size="20" font-weight="800" fill="#111827">${escapeXml(elevationName)} ELEVATION</text>
    <text x="${x + width}" y="${baseline + 52}" text-anchor="end" font-family="Arial, sans-serif" font-size="14" fill="#64748B">${escapeXml(architectureDna?.facade_rhythm || "Facade rhythm coordinated to the selected direction")}</text>`;
}

function renderSectionSvg(
  plan: CanonicalPlanSpec,
  visualType: string,
  architectureDna?: ArchitectureDna | null,
) {
  const storeys = Math.max(1, Math.min(4, Number(architectureDna?.storeys || plan.levels?.length || 2)));
  const isLongitudinal = visualType === "section_longitudinal";
  const x = 180;
  const baseline = 820;
  const width = 1170;
  const totalHeight = Math.min(560, 190 + storeys * 118);
  const floorHeight = totalHeight / storeys;
  const roofY = baseline - totalHeight;
  const floors = Array.from({ length: storeys }, (_, index) => {
    const y = baseline - (index + 1) * floorHeight;
    const level = plan.levels?.[index];
    const roomNames = (level?.rooms || []).slice(0, isLongitudinal ? 5 : 4).map((room) => room.name);
    const divisions = Math.max(2, roomNames.length || 3);
    const divisionWidth = width / divisions;
    return `<g>
      <rect x="${x}" y="${y}" width="${width}" height="${floorHeight}" fill="${index % 2 ? "#F8FAFC" : "#FFFFFF"}" stroke="#0F172A" stroke-width="5"/>
      ${Array.from({ length: divisions - 1 }, (_, roomIndex) => `<line x1="${x + (roomIndex + 1) * divisionWidth}" y1="${y}" x2="${x + (roomIndex + 1) * divisionWidth}" y2="${y + floorHeight}" stroke="#475569" stroke-width="3"/>`).join("")}
      ${Array.from({ length: divisions }, (_, roomIndex) => `<text x="${x + roomIndex * divisionWidth + divisionWidth / 2}" y="${y + floorHeight / 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#334155">${escapeXml(roomNames[roomIndex] || `SPACE ${roomIndex + 1}`)}</text>`).join("")}
    </g>`;
  }).join("");
  const cutLine = isLongitudinal ? "A—A" : "B—B";
  const siteSlope = `<path d="M 95 ${baseline + 20} C 430 ${baseline - 8}, 900 ${baseline + 42}, 1440 ${baseline - 18}" fill="none" stroke="#65A30D" stroke-width="6"/>`;
  const pool = plan.pool?.present ? `<rect x="${x + width * .72}" y="${baseline + 5}" width="${width * .22}" height="42" fill="#BAE6FD" stroke="#0284C7" stroke-width="3"/><text x="${x + width * .83}" y="${baseline + 32}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="800" fill="#075985">POOL</text>` : "";
  return `
    <rect x="110" y="145" width="1316" height="735" rx="18" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="3"/>
    ${siteSlope}
    ${floors}
    <path d="M ${x - 20} ${roofY + 18} L ${x + width * .52} ${roofY - 45} L ${x + width + 20} ${roofY + 18}" fill="#E2E8F0" stroke="#0F172A" stroke-width="7" stroke-linejoin="round"/>
    ${pool}
    <line x1="${x + width * .18}" y1="${roofY - 70}" x2="${x + width * .18}" y2="${baseline + 72}" stroke="#6D28D9" stroke-width="2" stroke-dasharray="9 7"/>
    <text x="${x + width * .18}" y="${roofY - 88}" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="800" fill="#5B21B6">SECTION ${cutLine}</text>
    <text x="${x}" y="${baseline + 83}" font-family="Arial, sans-serif" font-size="14" fill="#64748B">${escapeXml(isLongitudinal ? "Longitudinal spatial relationship" : "Transverse spatial relationship")}</text>
    <text x="${x + width}" y="${baseline + 83}" text-anchor="end" font-family="Arial, sans-serif" font-size="14" fill="#64748B">${escapeXml(architectureDna?.massing || "Massing coordinated to the selected direction")}</text>`;
}

function renderPerspectiveGuideSvg(
  plan: CanonicalPlanSpec,
  visualType: string,
  architectureDna?: ArchitectureDna | null,
) {
  const label = visualType === "perspective_front" ? "FRONT THREE-QUARTER" : visualType === "perspective_rear" ? "REAR THREE-QUARTER" : "OBLIQUE AERIAL";
  const footprint = normaliseSiteElement(plan.footprint || { x: 20, y: 20, width: 60, height: 55 }, { x: 360, y: 255, width: 820, height: 500 });
  const offset = visualType === "perspective_aerial" ? 115 : 75;
  return `
    <rect x="160" y="155" width="1216" height="700" rx="22" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="3"/>
    <path d="M ${footprint.x} ${footprint.y + offset} L ${footprint.x + footprint.width * .52} ${footprint.y} L ${footprint.x + footprint.width} ${footprint.y + offset} L ${footprint.x + footprint.width * .48} ${footprint.y + offset * 2} Z" fill="#EDE9FE" stroke="#0F172A" stroke-width="5"/>
    <path d="M ${footprint.x} ${footprint.y + offset} L ${footprint.x} ${footprint.y + offset + footprint.height * .48} L ${footprint.x + footprint.width * .48} ${footprint.y + offset * 2 + footprint.height * .48} L ${footprint.x + footprint.width * .48} ${footprint.y + offset * 2} Z" fill="#DDD6FE" stroke="#0F172A" stroke-width="5"/>
    <path d="M ${footprint.x + footprint.width} ${footprint.y + offset} L ${footprint.x + footprint.width} ${footprint.y + offset + footprint.height * .48} L ${footprint.x + footprint.width * .48} ${footprint.y + offset * 2 + footprint.height * .48} L ${footprint.x + footprint.width * .48} ${footprint.y + offset * 2} Z" fill="#C4B5FD" stroke="#0F172A" stroke-width="5"/>
    <circle cx="${visualType === "perspective_rear" ? 1215 : 290}" cy="${visualType === "perspective_aerial" ? 215 : 705}" r="34" fill="#6D28D9"/>
    <path d="M ${visualType === "perspective_rear" ? 1180 : 325} ${visualType === "perspective_aerial" ? 242 : 675} L ${footprint.x + footprint.width / 2} ${footprint.y + offset * 1.5}" stroke="#6D28D9" stroke-width="5" stroke-dasharray="12 9" marker-end="url(#smallArrow)"/>
    <text x="768" y="730" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="800" fill="#111827">${escapeXml(label)} PERSPECTIVE GUIDE</text>
    <text x="768" y="768" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#64748B">${escapeXml(architectureDna?.identity_name || "Selected architecture identity")} · rendered view uses the Master Architecture Reference</text>`;
}

function renderFloorPlanSvg(
  plan: CanonicalPlanSpec,
  level: CanonicalPlanLevel | undefined,
  visualType: string,
) {
  const isZoning = visualType === "functional_zoning";
  const isCirculation = visualType === "circulation";
  const target = { x: 150, y: 170, width: 1236, height: 665 };
  const rooms = fitRoomsToRect(level?.rooms || [], target);
  if (!rooms.length) {
    return `<text x="768" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#64748B">No coordinated rooms were returned for this level.</text>`;
  }

  const minX = Math.min(...rooms.map((item) => item.x));
  const minY = Math.min(...rooms.map((item) => item.y));
  const maxX = Math.max(...rooms.map((item) => item.x + item.width));
  const maxY = Math.max(...rooms.map((item) => item.y + item.height));
  const extents = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

  const baseOpacity = isCirculation ? 0.42 : 1;
  const roomSvg = rooms.map((screenRoom) => {
    const { room, x, y, width, height } = screenRoom;
    const fill = isZoning ? roomColour(room.zone) : "#FFFFFF";
    const stroke = isZoning ? "#475569" : "#0F172A";
    return `
      <g opacity="${baseOpacity}">
        <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${isZoning ? 3 : 4}"/>
        ${roomTextSvg(screenRoom, isZoning)}
        ${!isZoning && !isCirculation ? roomWindowSvg(screenRoom, extents) : ""}
      </g>`;
  }).join("");

  const outerWall = `
    <rect x="${extents.x - 8}" y="${extents.y - 8}" width="${extents.width + 16}" height="${extents.height + 16}" rx="4" fill="none" stroke="#020617" stroke-width="8"/>`;

  const circulationSvg = isCirculation
    ? (level?.circulation || []).map((connection, index) => {
        const from = rooms.find((item) => item.room.id === connection.from_room_id);
        const to = rooms.find((item) => item.room.id === connection.to_room_id);
        if (!from || !to) return "";
        const x1 = from.x + from.width / 2;
        const y1 = from.y + from.height / 2;
        const x2 = to.x + to.width / 2;
        const y2 = to.y + to.height / 2;
        const controlY = (y1 + y2) / 2 + (index % 2 === 0 ? -28 : 28);
        return `
          <path d="M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}" fill="none" stroke="#6D28D9" stroke-width="4" stroke-linecap="round" marker-end="url(#smallArrow)"/>
          <circle cx="${x1}" cy="${y1}" r="7" fill="#FFFFFF" stroke="#6D28D9" stroke-width="4"/>`;
      }).join("")
    : "";

  const entryX = extents.x + extents.width * 0.12;
  const entryY = extents.y + extents.height + 8;
  const poolX = Math.min(1390, extents.x + extents.width + 28);
  const poolLabelX = Math.min(1447, extents.x + extents.width + 85);
  const groundContext = visualType === "ground_floor" || visualType === "functional_zoning"
    ? `
      ${plan.pool?.present ? `<rect x="${poolX}" y="${extents.y + extents.height * 0.28}" width="115" height="${Math.max(100, extents.height * 0.42)}" rx="10" fill="#BAE6FD" stroke="#0284C7" stroke-width="4"/><text x="${poolLabelX}" y="${extents.y + extents.height * 0.5}" text-anchor="middle" transform="rotate(-90 ${poolLabelX} ${extents.y + extents.height * 0.5})" font-family="Arial, sans-serif" font-size="15" font-weight="800" fill="#075985">POOL / WATER</text>` : ""}
      <path d="M ${entryX} ${entryY + 58} L ${entryX} ${entryY + 12}" stroke="#6D28D9" stroke-width="5" marker-end="url(#smallArrow)"/>
      <text x="${entryX}" y="${entryY + 84}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="800" fill="#5B21B6">MAIN ENTRY</text>`
    : "";

  return `
    <rect x="${target.x}" y="${target.y}" width="${target.width}" height="${target.height}" rx="18" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="3"/>
    ${outerWall}
    ${roomSvg}
    ${circulationSvg}
    ${groundContext}
    ${isZoning ? planLegendSvg(rooms.map((item) => item.room.zone)) : ""}
    <g transform="translate(1325 184)">
      <path d="M 0 58 L 22 0 L 44 58 L 22 44 Z" fill="#111827"/>
      <text x="22" y="82" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="800">${escapeXml(plan.site?.north_label || "N")}</text>
    </g>`;
}

export function renderCanonicalPlanSvg(args: {
  plan: CanonicalPlanSpec;
  visualType: string;
  title: string;
  projectName: string;
  architectureDna?: ArchitectureDna | null;
}) {
  return renderArchitecturalDrawingSvg(args);
}

export async function generateAndStoreCanonicalPlanImage(args: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  filenamePrefix: string;
  visualType: string;
  title: string;
  projectName: string;
  canonicalPlan: CanonicalPlanSpec;
  architectureDna?: ArchitectureDna | null;
}) {
  const svg = renderCanonicalPlanSvg({
    plan: args.canonicalPlan,
    visualType: args.visualType,
    title: args.title,
    projectName: args.projectName,
    architectureDna: args.architectureDna,
  });

  const png = await sharp(Buffer.from(svg, "utf8"), { density: 150 })
    .flatten({ background: "#FFFFFF" })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return storeArchitectureImageVariants({
    supabase: args.supabase,
    userId: args.userId,
    projectId: args.projectId,
    folder: "plans",
    filenamePrefix: `${args.filenamePrefix}-technical`,
    sourceBytes: png,
    tier: "preview",
  });
}

async function loadBundledFloorPlanStyleReference() {
  try {
    const bytes = await readFile(
      join(process.cwd(), "public", "architecture", "reference", "detailed-floor-plan-style.webp"),
    );
    return {
      bytes,
      mimeType: "image/webp" as const,
      filename: "detailed-floor-plan-style.webp",
    };
  } catch {
    return null;
  }
}

function architectureDocumentPrompt(args: {
  visualType: string;
  title: string;
  projectName: string;
  canonicalPlan: CanonicalPlanSpec;
  architectureDna: ArchitectureDna;
  sourceGeometryLocked?: boolean;
}) {
  const visualType = args.visualType;
  const isFloorPlan = visualType === "ground_floor" || visualType === "upper_floor";
  const isSitePlan = visualType === "site_plan";
  const isZoning = visualType === "functional_zoning" || visualType === "circulation";
  const isElevation = /_elevation$/.test(visualType);
  const isSection = /^section_/.test(visualType);
  const level = levelForType(args.canonicalPlan, visualType);
  const roomProgram = (level?.rooms || []).map((room) => ({
    name: room.name,
    zone: room.zone,
    relative_position: { x: room.x, y: room.y, width: room.width, height: room.height },
  }));

  const shared = [
    ...(args.sourceGeometryLocked
      ? [
          "EXISTING DESIGN SOURCE LOCK: the first supplied reference image or images are the user's actual uploaded architectural drawings and are the geometry source of truth.",
          "Reproduce the requested drawing from those uploaded sources faithfully. Do not redesign, re-plan, improve, relocate, add or remove walls, rooms, doors, windows, stairs, columns, openings, dimensions or circulation unless the user explicitly requested that change.",
          "If the uploaded sheet contains several drawings, isolate only the requested view while preserving its exact geometry and proportions.",
          "The canonical JSON is supporting project metadata only and must never override visible geometry in the uploaded source drawings.",
        ]
      : []),
    `Project: ${args.projectName}.`,
    `Document: ${args.title}.`,
    `Architecture direction: ${JSON.stringify(args.architectureDna)}.`,
    `Canonical connected project model: ${JSON.stringify(args.canonicalPlan)}.`,
    args.sourceGeometryLocked
      ? "Clean and professionally redraw the uploaded source without changing its design."
      : "The supplied diagram is a spatial guide only. Redraw it as a polished professional architectural concept drawing; do not copy its simplified graphic style.",
    "When a final floor-plan style reference image is supplied, use only its drawing quality, line hierarchy, symbols, fixtures and level of detail. Ignore its project title, exact layout, room count, dimensions and geometry.",
    args.sourceGeometryLocked
      ? "Preserve the uploaded design exactly; use the saved project information only to clarify labels or presentation where it does not conflict with the source."
      : "Keep this exact project, level count, footprint relationship, entry side, pool, driveway, stair/core alignment and room programme.",
    "Use crisp black-and-white architectural linework on a clean white drawing sheet, with subtle grey poche/hatching only where professionally appropriate.",
    "No coloured zoning blocks, no floating room boxes, no perspective distortion, no photorealistic render, no decorative poster layout and no invented unrelated building.",
    "All text must be readable English. Do not add logos, watermarks, long paragraphs or fake consultant stamps.",
    "This remains a detailed AI concept drawing, not permit or construction documentation.",
  ];

  if (isFloorPlan) {
    return [
      "Create a highly detailed, presentation-quality architectural floor plan in true top-down orthographic view.",
      `Required room programme for this level: ${JSON.stringify(roomProgram)}.`,
      "Show a clear main entrance and foyer/entry sequence connected to internal circulation. Every enclosed room must have a logical door and must be reachable without passing through unrelated private rooms.",
      "Show realistic external windows embedded in exterior walls, sized and positioned for daylight and ventilation. Show glazed doors or hinged doors providing real access to terraces, balconies, gardens, patios, pool decks and other outdoor spaces where relevant.",
      "Draw exterior walls heavier than interior partitions. Draw door openings with swing arcs, sliding doors where appropriate, window frames, stairs with direction arrow, landings, wardrobes, storage and built-in cabinetry.",
      "Add professional architectural symbols and detailed fixtures: kitchen counters, island, sink, cooktop, refrigerator, pantry and dishwasher; bathroom toilets, basins, showers and baths; beds, bedside tables, wardrobes; dining table and chairs; living furniture; laundry equipment; garage cars when required.",
      "Label each room clearly and add plausible room dimensions in metres beneath the room name. Add selected overall dimensions, hall widths, north arrow and a simple 0–5 m scale bar.",
      "Keep wet areas coordinated, circulation practical, furniture clear of door swings, and indoor-outdoor connections obvious.",
      "The result should visually match the standard of a polished residential architect's concept floor plan, with the level of detail seen in professional plan brochures.",
      ...shared,
    ].join("\n\n");
  }

  if (isElevation) {
    return [
      "Create a complete professional orthographic architectural elevation drawing of the exact selected facade.",
      "Show the entire building from ground line to roof, including all storeys, roof profile, floor/slab lines, doors, windows, glazing divisions, balconies, terraces, parapets, shading devices, material transitions and key landscape/site levels.",
      "Opening positions and proportions must correspond logically to the approved floor plans. Avoid repeated placeholder windows or blank wall panels.",
      "Add level markers, a few principal vertical dimensions, facade title and a restrained material hatch legend.",
      ...shared,
    ].join("\n\n");
  }

  if (isSection) {
    const sectionLabel = visualType === "section_longitudinal" ? "A—A" : "B—B";
    const sectionCut = (args.canonicalPlan.section_cuts || []).find((cut) =>
      visualType === "section_longitudinal"
        ? cut.orientation === "longitudinal"
        : cut.orientation === "transverse",
    );
    return [
      `Create a true vertical architectural building section ${sectionLabel} through the exact same project. This is not a floor plan, zoning diagram, facade elevation or stack of generic room boxes.`,
      `Use this saved cut definition: ${JSON.stringify(sectionCut || null)}. The section must correspond to the A—A or B—B cut line shown on the approved floor plans and look in the specified direction.`,
      "At least one section must cut through the stair/vertical circulation. Show stair flights, risers and treads, landings, stairwell opening, headroom and the stair slab or stringer relationship.",
      "Show foundations conceptually, natural and finished ground lines, floor slabs with visible thickness, floor-to-floor heights, clear ceiling heights, door heights, window head and sill heights, roof/parapet/ridge height, balconies, voids and principal interior spaces.",
      "Use heavy poche and lineweight for elements physically cut by the section plane. Use lighter projection lines for interior elevations and objects seen beyond the cut. Do not draw the spaces as plan-view rectangles.",
      "Add standard architectural level markers and a vertical dimension chain including ground floor FFL, upper floor FFLs, roof level, floor-to-floor dimensions, clear heights, slab thickness and principal opening heights.",
      "Label the rooms crossed by the section and show the section title, direction and scale note. Coordinate every level, opening and stair with the approved floor plans.",
      ...shared,
    ].join("\n\n");
  }

  if (isSitePlan) {
    return [
      "Create a professional architectural concept site plan in true top-down view.",
      "Show the same building footprint, property boundary, main pedestrian entrance, vehicle entrance, driveway, parking/garage access, pool, terraces, gardens, paths, setbacks, north arrow and scale bar.",
      "Clearly distinguish indoor footprint, covered outdoor areas and landscape without using crude coloured boxes.",
      ...shared,
    ].join("\n\n");
  }

  if (isZoning) {
    return [
      "Create a clean architectural analysis diagram derived from the approved floor-plan geometry.",
      "Keep walls, doors, windows, entrance, outdoor access and main fixtures visible, then overlay restrained transparent zoning or circulation graphics.",
      "Do not replace the plan with coloured rectangles. The underlying architectural plan must remain legible and detailed.",
      ...shared,
    ].join("\n\n");
  }

  return [
    "Create a polished coordinated architectural concept drawing of the requested view.",
    ...shared,
  ].join("\n\n");
}

export async function generateAndStoreArchitectureDocumentImage(args: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  filenamePrefix: string;
  visualType: string;
  title: string;
  projectName: string;
  canonicalPlan: CanonicalPlanSpec;
  architectureDna: ArchitectureDna;
  plan: AiPlanConfig;
  tier?: ImageGenerationTier;
  referenceImages?: ArchitectureImageReference[];
  sourceGeometryReferences?: ArchitectureImageReference[];
  preserveSourceGeometry?: boolean;
}) {
  const tier = args.tier || "preview";
  const guideSvg = renderCanonicalPlanSvg({
    plan: args.canonicalPlan,
    visualType: args.visualType,
    title: args.title,
    projectName: args.projectName,
    architectureDna: args.architectureDna,
  });
  const guidePng = await sharp(Buffer.from(guideSvg, "utf8"), { density: 180 })
    .flatten({ background: "#FFFFFF" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const sourceAssets = (
    await Promise.all(
      (args.sourceGeometryReferences || []).slice(0, 4).map((reference, index) =>
        loadReferenceAsset(args.supabase, reference, index),
      ),
    )
  ).filter((asset): asset is ArchitectureReferenceAsset => Boolean(asset));
  const referenceAssets = (
    await Promise.all(
      (args.referenceImages || []).slice(0, 4).map((reference, index) =>
        loadReferenceAsset(args.supabase, reference, index + sourceAssets.length),
      ),
    )
  ).filter((asset): asset is ArchitectureReferenceAsset => Boolean(asset));
  const styleReference = /^(ground_floor|upper_floor)$/.test(args.visualType)
    ? await loadBundledFloorPlanStyleReference()
    : null;
  const guideAsset: ArchitectureReferenceAsset = {
    bytes: guidePng,
    mimeType: "image/png",
    filename: `canonical-guide-${safeFilePart(args.visualType)}.png`,
  };
  const sourceGeometryLocked = Boolean(args.preserveSourceGeometry && sourceAssets.length);
  const allAssets = (
    sourceGeometryLocked
      ? [
          ...sourceAssets,
          ...referenceAssets,
          ...(styleReference ? [styleReference] : []),
        ]
      : [
          ...referenceAssets,
          guideAsset,
          ...(styleReference ? [styleReference] : []),
        ]
  ).slice(0, 6);
  const openai = getOpenAI();
  const referenceFiles = await Promise.all(
    allAssets.map((asset) => toFile(asset.bytes, asset.filename, { type: asset.mimeType })),
  );
  const quality = imageQualityForTier(args.plan, tier);
  const imageSize = /^(ground_floor|upper_floor|site_plan)$/.test(args.visualType)
    ? "1024x1536"
    : "1536x1024";
  const result = await openai.images.edit({
    model: args.plan.imageModel,
    image: referenceFiles,
    prompt: architectureDocumentPrompt({
      visualType: args.visualType,
      title: args.title,
      projectName: args.projectName,
      canonicalPlan: args.canonicalPlan,
      architectureDna: args.architectureDna,
      sourceGeometryLocked,
    }),
    size: imageSize,
    quality,
    output_format: "png",
  });
  const base64 = result.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI returned no detailed architecture document image data.");
  const stored = await storeArchitectureImageVariants({
    supabase: args.supabase,
    userId: args.userId,
    projectId: args.projectId,
    folder: "plans",
    filenamePrefix: `${args.filenamePrefix}-detailed-concept`,
    sourceBytes: Buffer.from(base64, "base64"),
    tier,
  });

  return {
    ...stored,
    tier,
    quality,
    provider: "openai" as const,
    model: args.plan.imageModel,
    referenceCount: allAssets.length,
    usage: result.usage || null,
    generationMethod: sourceGeometryLocked
      ? "openai-existing-source-faithful-document-edit"
      : "openai-detailed-concept-document-reference-edit",
  };
}

function renderedPlanLabelOverlay(args: {
  canonicalPlan: CanonicalPlanSpec;
  visualType: string;
  areaSchedule: Array<{ space: string; level: string; approx_area_m2: number }>;
}) {
  const isDocumentationView = /_elevation$/.test(args.visualType) || /^section_/.test(args.visualType) || /^perspective_/.test(args.visualType);
  if (isDocumentationView) {
    const label = args.visualType.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
    return Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">
        <rect x="28" y="28" width="520" height="48" rx="14" fill="#0F172A" fill-opacity="0.78"/>
        <text x="52" y="59" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#FFFFFF">${escapeXml(label)} · coordinated conceptual view</text>
      </svg>`, "utf8");
  }

  const level = levelForType(args.canonicalPlan, args.visualType);
  const target = { x: 105, y: 90, width: 1326, height: 824 };
  const rooms = fitRoomsToRect(level?.rooms || [], target);
  const areaByName = new Map(
    args.areaSchedule.map((item) => [item.space.trim().toLowerCase(), item.approx_area_m2]),
  );

  const labels = rooms.map(({ room, x, y, width, height }) => {
    const area = areaByName.get(room.name.trim().toLowerCase());
    const label = area ? `${room.name} · ${Math.round(area)} m²` : room.name;
    const boxWidth = Math.max(90, Math.min(width - 10, label.length * 9 + 24));
    const boxHeight = 34;
    const boxX = x + width / 2 - boxWidth / 2;
    const boxY = y + height / 2 - boxHeight / 2;
    return `
      <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="9" fill="#FFFFFF" fill-opacity="0.84" stroke="#0F172A" stroke-opacity="0.28" stroke-width="1.5"/>
      <text x="${x + width / 2}" y="${boxY + 22}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#0F172A">${escapeXml(label)}</text>`;
  }).join("");

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">
      ${labels}
      <rect x="28" y="28" width="430" height="48" rx="14" fill="#0F172A" fill-opacity="0.78"/>
      <text x="52" y="59" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#FFFFFF">Rendered conceptual plan · areas are indicative</text>
    </svg>`, "utf8");
}

function renderedDocumentationPrompt(args: {
  visualType: string;
  title: string;
  architectureDna: ArchitectureDna;
  sourceGeometryLocked?: boolean;
}) {
  const common = [
    args.sourceGeometryLocked
      ? "EXISTING DESIGN SOURCE LOCK: the first supplied reference image or images are the user's actual drawings. Their visible geometry is fixed and must be preserved exactly."
      : "The final supplied reference image is the canonical technical geometry guide and must be respected.",
    args.sourceGeometryLocked
      ? "Do not change the footprint, room layout, stairs, openings, level relationships or facade geometry shown in the uploaded source. Add only materials, lighting, furniture, landscape and presentation treatment."
      : "Earlier reference images define the exact same property's architecture, materials, roof, openings, landscape and identity.",
    `Architecture DNA: ${JSON.stringify(args.architectureDna)}`,
    `Target documentation view: ${args.title}.`,
    "Do not invent another property, another floor count, another roof or unrelated facade geometry.",
    "Do not place paragraph text, logos or watermarks; Heyy Studio adds reliable labels afterwards.",
  ];

  if (/_elevation$/.test(args.visualType)) {
    return [
      "Create a premium photorealistic orthographic architectural elevation presentation.",
      "Keep the camera straight-on with minimal perspective distortion and show the complete facade from ground to roof.",
      "Preserve the technical elevation's storeys, overall width, floor lines and opening rhythm while resolving real materials, glazing, shading and landscape.",
      ...common,
    ].join("\n\n");
  }

  if (/^section_/.test(args.visualType)) {
    return [
      "Create a premium architectural sectional render / sectional perspective of the exact same building.",
      "Use a clear cut plane, coordinated floor levels, roof, main rooms, circulation, daylight, landscape and pool relationship.",
      "Keep the section conceptually legible and architectural rather than producing a random interior collage.",
      ...common,
    ].join("\n\n");
  }

  if (/^perspective_/.test(args.visualType)) {
    const camera = args.visualType === "perspective_front"
      ? "front three-quarter eye-level"
      : args.visualType === "perspective_rear"
        ? "rear three-quarter eye-level"
        : "oblique aerial";
    return [
      `Create a premium photorealistic ${camera} architectural perspective of the exact same property.`,
      "Match the selected Direction image, canonical site relationship, material placement, pool, landscape and massing.",
      "This is a coordinated documentation perspective, not a new design proposal.",
      ...common,
    ].join("\n\n");
  }

  return [
    "Create a premium photorealistic top-down rendered architectural plan presentation.",
    "Preserve the exact footprint, room positions, room proportions, circulation, pool, driveway, entry and site relationship.",
    "Add realistic furniture, floor finishes, glazing, doors, landscaping, cars, pool water, shadows and subtle depth while keeping a true orthographic top-down camera.",
    "Do not change the plan geometry. Do not add or remove rooms.",
    ...common,
  ].join("\n\n");
}

type ArchitectureRenderProvider = "openai" | "gemini";

function resolveArchitectureRenderProvider(): ArchitectureRenderProvider {
  return process.env.ARCHITECTURE_RENDER_PROVIDER?.trim().toLowerCase() === "gemini"
    ? "gemini"
    : "openai";
}

async function generateGeminiArchitectureImage(args: {
  prompt: string;
  assets: ArchitectureReferenceAsset[];
  tier: ImageGenerationTier;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required when ARCHITECTURE_RENDER_PROVIDER=gemini.");
  }
  const model = process.env.ARCHITECTURE_GEMINI_IMAGE_MODEL?.trim() || "gemini-3-pro-image";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: args.prompt },
            ...args.assets.slice(0, 6).map((asset) => ({
              inlineData: {
                mimeType: asset.mimeType,
                data: asset.bytes.toString("base64"),
              },
            })),
          ],
        }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: "3:2",
            imageSize: args.tier === "final" ? "4K" : "2K",
          },
        },
      }),
    },
  );
  const payload = await response.json() as {
    error?: { message?: string };
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
          inline_data?: { data?: string; mime_type?: string };
        }>;
      };
    }>;
    usageMetadata?: unknown;
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || `Gemini image generation failed with HTTP ${response.status}.`);
  }
  const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts || []) || [];
  const image = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  const base64 = image?.inlineData?.data || image?.inline_data?.data;
  if (!base64) throw new Error("Gemini returned no architecture image data.");
  return {
    bytes: Buffer.from(base64, "base64"),
    usage: payload.usageMetadata || null,
    model,
  };
}

export async function generateAndStoreRenderedPlanImage(args: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  filenamePrefix: string;
  visualType: string;
  title: string;
  projectName: string;
  canonicalPlan: CanonicalPlanSpec;
  architectureDna: ArchitectureDna;
  areaSchedule: Array<{ space: string; level: string; approx_area_m2: number }>;
  plan: AiPlanConfig;
  tier?: ImageGenerationTier;
  referenceImages: ArchitectureImageReference[];
  sourceGeometryReferences?: ArchitectureImageReference[];
  preserveSourceGeometry?: boolean;
}) {
  const tier = args.tier || "preview";
  const technicalSvg = renderCanonicalPlanSvg({
    plan: args.canonicalPlan,
    visualType: args.visualType,
    title: args.title,
    projectName: args.projectName,
    architectureDna: args.architectureDna,
  });
  const technicalPng = await sharp(Buffer.from(technicalSvg, "utf8"), { density: 180 })
    .flatten({ background: "#FFFFFF" })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const sourceAssets = (
    await Promise.all(
      (args.sourceGeometryReferences || []).slice(0, 4).map((reference, index) =>
        loadReferenceAsset(args.supabase, reference, index),
      ),
    )
  ).filter((asset): asset is ArchitectureReferenceAsset => Boolean(asset));
  const referenceAssets = (
    await Promise.all(
      args.referenceImages.slice(0, 5).map((reference, index) =>
        loadReferenceAsset(args.supabase, reference, index + sourceAssets.length),
      ),
    )
  ).filter((asset): asset is ArchitectureReferenceAsset => Boolean(asset));
  const technicalAsset: ArchitectureReferenceAsset = {
    bytes: technicalPng,
    mimeType: "image/png",
    filename: `canonical-${safeFilePart(args.visualType)}.png`,
  };
  const sourceGeometryLocked = Boolean(args.preserveSourceGeometry && sourceAssets.length);
  const renderAssets = (
    sourceGeometryLocked
      ? [...sourceAssets, ...referenceAssets]
      : [...referenceAssets, technicalAsset]
  ).slice(0, 6);
  const prompt = renderedDocumentationPrompt({
    visualType: args.visualType,
    title: args.title,
    architectureDna: args.architectureDna,
    sourceGeometryLocked,
  });
  const provider = resolveArchitectureRenderProvider();
  const quality = imageQualityForTier(args.plan, tier);

  let sourceBytes: Buffer;
  let usage: unknown = null;
  let model = args.plan.imageModel;
  if (provider === "gemini") {
    const generated = await generateGeminiArchitectureImage({
      prompt,
      assets: renderAssets,
      tier,
    });
    sourceBytes = generated.bytes;
    usage = generated.usage;
    model = generated.model;
  } else {
    const openai = getOpenAI();
    const referenceFiles = await Promise.all(
      renderAssets.map((asset) =>
        toFile(asset.bytes, asset.filename, { type: asset.mimeType }),
      ),
    );
    const result = await openai.images.edit({
      model: args.plan.imageModel,
      image: referenceFiles,
      prompt,
      size: "1536x1024",
      quality,
      output_format: "png",
    });
    const base64 = result.data?.[0]?.b64_json;
    if (!base64) throw new Error("OpenAI returned no rendered plan image data.");
    sourceBytes = Buffer.from(base64, "base64");
    usage = result.usage || null;
  }

  const renderedBase = sharp(sourceBytes)
    .rotate()
    .resize(1536, 1024, sourceGeometryLocked
      ? { fit: "contain", background: "#FFFFFF" }
      : { fit: "cover" });
  const labelled = sourceGeometryLocked
    ? await renderedBase.png({ compressionLevel: 9 }).toBuffer()
    : await renderedBase
        .composite([{
          input: renderedPlanLabelOverlay({
            canonicalPlan: args.canonicalPlan,
            visualType: args.visualType,
            areaSchedule: args.areaSchedule,
          }),
          top: 0,
          left: 0,
        }])
        .png({ compressionLevel: 9 })
        .toBuffer();

  const stored = await storeArchitectureImageVariants({
    supabase: args.supabase,
    userId: args.userId,
    projectId: args.projectId,
    folder: "plans",
    filenamePrefix: `${args.filenamePrefix}-rendered`,
    sourceBytes: labelled,
    tier,
  });

  return {
    ...stored,
    tier,
    quality,
    provider,
    model,
    referenceCount: renderAssets.length,
    usage,
    generationMethod: sourceGeometryLocked
      ? `${provider}-existing-source-rendered-plan-reference-edit`
      : `${provider}-canonical-plan-reference-edit`,
  };
}

