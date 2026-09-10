import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { toFile } from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAI } from "@/lib/ai/openai-server";
import { imageQualityForTier, type AiPlanConfig, type ImageGenerationTier } from "@/lib/ai/config";
import { renderArchitecturalDrawingSvg, renderPlanFoundationSheetSvg } from "@/lib/ai/architecture-drawing";
import {
  ARCHITECTURE_PROJECT_TYPES,
  getArchitectureProjectTemplate,
} from "@/lib/architecture/project-templates";
import {
  directionGeometryContractFromUnknown,
  directionGeometryContractPrompt,
  validateCanonicalPlanAgainstDirectionContract,
  validateDirectionGeometryContract,
  type DirectionGeometryContract,
} from "@/lib/architecture/direction-geometry-contract";

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
  footprint_shape?: string;
  plan_massing_logic?: string;
  vertical_core_strategy?: string;
  upper_level_setback_strategy?: string;
};

export type CanonicalPlanPoint = { x: number; y: number };

export type CanonicalPlanRoom = {
  id: string;
  name: string;
  zone: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Capacity carried by this room/ward/unit. New plan generations always
   * populate these fields; they remain optional here so older saved projects
   * continue to load safely.
   */
  capacity_type?: string;
  capacity_count?: number;
};

export type CanonicalVerticalCore = {
  id: string;
  type: "stair" | "lift" | "service_lift" | "shaft";
  x: number;
  y: number;
  width: number;
  height: number;
  serves_level_ids: string[];
};

export type CanonicalCirculationRoute = {
  id: string;
  type: "public" | "private" | "staff" | "service" | "clinical" | "emergency" | "mixed";
  width_m: number;
  points: CanonicalPlanPoint[];
  serves_level_ids: string[];
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
  outline?: CanonicalPlanPoint[];
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
  building_outline?: { shape_label: string; points: CanonicalPlanPoint[] };
  vertical_cores?: CanonicalVerticalCore[];
  circulation_routes?: CanonicalCirculationRoute[];
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

const directionGeometryContractSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version", "coordinate_system", "front_edge", "storeys", "massing_summary",
    "site_relationship_summary", "ground_outline", "upper_level_outlines", "entry",
    "garage", "driveway", "pool", "outdoor_living", "vertical_core", "must_preserve",
  ],
  properties: {
    version: { type: "integer", enum: [1] },
    coordinate_system: { type: "string", enum: ["site_grid_0_100"] },
    front_edge: { type: "string", enum: ["north", "south", "east", "west"] },
    storeys: { type: "integer", minimum: 1, maximum: 12 },
    massing_summary: { type: "string" },
    site_relationship_summary: { type: "string" },
    ground_outline: {
      type: "array", minItems: 4, maxItems: 12,
      items: { type: "object", additionalProperties: false, required: ["x", "y"], properties: { x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 } } },
    },
    upper_level_outlines: {
      type: "array", maxItems: 11,
      items: {
        type: "object", additionalProperties: false, required: ["level_index", "relationship", "points"],
        properties: {
          level_index: { type: "integer", minimum: 1, maximum: 11 },
          relationship: { type: "string" },
          points: {
            type: "array", minItems: 4, maxItems: 12,
            items: { type: "object", additionalProperties: false, required: ["x", "y"], properties: { x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 } } },
          },
        },
      },
    },
    entry: {
      type: "object", additionalProperties: false, required: ["edge", "position_0_100", "x", "y", "description"],
      properties: {
        edge: { type: "string", enum: ["north", "south", "east", "west"] },
        position_0_100: { type: "number", minimum: 0, maximum: 100 },
        x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 }, description: { type: "string" },
      },
    },
    garage: {
      type: "object", additionalProperties: false, required: ["present", "edge", "position_0_100", "x", "y", "width", "height", "description"],
      properties: {
        present: { type: "boolean" }, edge: { type: "string", enum: ["north", "south", "east", "west"] },
        position_0_100: { type: "number", minimum: 0, maximum: 100 }, x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 },
        width: { type: "number", minimum: 0, maximum: 100 }, height: { type: "number", minimum: 0, maximum: 100 }, description: { type: "string" },
      },
    },
    driveway: {
      type: "object", additionalProperties: false, required: ["present", "access_edge", "x", "y", "width", "height", "description"],
      properties: {
        present: { type: "boolean" }, access_edge: { type: "string", enum: ["north", "south", "east", "west"] },
        x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 },
        width: { type: "number", minimum: 0, maximum: 100 }, height: { type: "number", minimum: 0, maximum: 100 }, description: { type: "string" },
      },
    },
    pool: {
      type: "object", additionalProperties: false, required: ["present", "x", "y", "width", "height", "relationship_to_entry", "description"],
      properties: {
        present: { type: "boolean" }, x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 },
        width: { type: "number", minimum: 0, maximum: 100 }, height: { type: "number", minimum: 0, maximum: 100 },
        relationship_to_entry: { type: "string", enum: ["left", "right", "front", "rear", "none"] }, description: { type: "string" },
      },
    },
    outdoor_living: {
      type: "object", additionalProperties: false, required: ["present", "x", "y", "width", "height", "description"],
      properties: {
        present: { type: "boolean" }, x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 },
        width: { type: "number", minimum: 0, maximum: 100 }, height: { type: "number", minimum: 0, maximum: 100 }, description: { type: "string" },
      },
    },
    vertical_core: {
      type: "object", additionalProperties: false, required: ["required", "x", "y", "width", "height", "description"],
      properties: {
        required: { type: "boolean" }, x: { type: "number", minimum: 0, maximum: 100 }, y: { type: "number", minimum: 0, maximum: 100 },
        width: { type: "number", minimum: 0, maximum: 100 }, height: { type: "number", minimum: 0, maximum: 100 }, description: { type: "string" },
      },
    },
    must_preserve: { type: "array", minItems: 5, maxItems: 16, items: { type: "string" } },
  },
} as const;

const directionGenerationSchema = {
  name: "architecture_direction_with_geometry_contract",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["direction", "geometry_contract"],
    properties: {
      direction: directionSchema.schema,
      geometry_contract: directionGeometryContractSchema,
    },
  },
} as const;

type LiveDirectionGeneration = {
  direction: LiveDirection;
  geometry_contract: DirectionGeometryContract;
};

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
      "prohibited_changes", "visual_prompt_anchor", "footprint_shape", "plan_massing_logic", "vertical_core_strategy", "upper_level_setback_strategy",
    ],
    properties: {
      identity_name: { type: "string" },
      design_summary: { type: "string" },
      storeys: { type: "integer", minimum: 1, maximum: 12 },
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
      footprint_shape: { type: "string" },
      plan_massing_logic: { type: "string" },
      vertical_core_strategy: { type: "string" },
      upper_level_setback_strategy: { type: "string" },
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
        required: ["site", "footprint", "building_outline", "vertical_cores", "circulation_routes", "pool", "driveway", "entry", "section_cuts", "levels"],
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
          building_outline: {
            type: "object",
            additionalProperties: false,
            required: ["shape_label", "points"],
            properties: {
              shape_label: { type: "string" },
              points: {
                type: "array",
                minItems: 4,
                maxItems: 16,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["x", "y"],
                  properties: { x: coordinateProperty, y: coordinateProperty },
                },
              },
            },
          },
          vertical_cores: {
            type: "array",
            maxItems: 12,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "type", "x", "y", "width", "height", "serves_level_ids"],
              properties: {
                id: { type: "string" },
                type: { type: "string", enum: ["stair", "lift", "service_lift", "shaft"] },
                x: coordinateProperty,
                y: coordinateProperty,
                width: coordinateProperty,
                height: coordinateProperty,
                serves_level_ids: { type: "array", minItems: 1, maxItems: 12, items: { type: "string" } },
              },
            },
          },
          circulation_routes: {
            type: "array",
            maxItems: 20,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "type", "width_m", "points", "serves_level_ids"],
              properties: {
                id: { type: "string" },
                type: { type: "string", enum: ["public", "private", "staff", "service", "clinical", "emergency", "mixed"] },
                width_m: { type: "number", minimum: 0.8, maximum: 12 },
                points: {
                  type: "array",
                  minItems: 2,
                  maxItems: 20,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["x", "y"],
                    properties: { x: coordinateProperty, y: coordinateProperty },
                  },
                },
                serves_level_ids: { type: "array", minItems: 1, maxItems: 12, items: { type: "string" } },
              },
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
            maxItems: 12,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "label", "outline", "rooms", "circulation", "stairs", "openings", "fixtures"],
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                outline: {
                  type: "array",
                  minItems: 4,
                  maxItems: 16,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["x", "y"],
                    properties: { x: coordinateProperty, y: coordinateProperty },
                  },
                },
                rooms: {
                  type: "array",
                  minItems: 1,
                  maxItems: 60,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "name", "zone", "x", "y", "width", "height", "capacity_type", "capacity_count"],
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      zone: { type: "string" },
                      x: coordinateProperty,
                      y: coordinateProperty,
                      width: coordinateProperty,
                      height: coordinateProperty,
                      capacity_type: { type: "string" },
                      capacity_count: { type: "integer", minimum: 0, maximum: 1000 },
                    },
                  },
                },
                circulation: {
                  type: "array",
                  maxItems: 120,
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
                  maxItems: 180,
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
                  maxItems: 180,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["room_id", "fixture_type", "count"],
                    properties: {
                      room_id: { type: "string" },
                      fixture_type: { type: "string" },
                      count: { type: "integer", minimum: 1, maximum: 1000 },
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

const canonicalPlanRepairSchema = {
  name: "architecture_canonical_plan_repair",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["canonical_plan"],
    properties: {
      // Reuse the exact canonical-plan schema from the full Plan Foundation.
      // Correction passes return geometry only, which is faster and prevents
      // the model from rewriting the project narrative on every repair.
      canonical_plan: planSchema.schema.properties.canonical_plan,
    },
  },
} as const;

const architectureRequirementContractSchema = {
  name: "architecture_requirement_contract",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "requirements"],
    properties: {
      summary: { type: "string" },
      requirements: {
        type: "array",
        minItems: 1,
        maxItems: 40,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id", "source", "priority", "validation_scope", "category",
            "statement", "measurable", "metric", "target_value", "unit",
            "comparison", "evidence_hint",
          ],
          properties: {
            id: { type: "string" },
            source: { type: "string" },
            priority: { type: "string", enum: ["hard", "preferred", "assumption"] },
            validation_scope: { type: "string", enum: ["plan", "visual", "project"] },
            category: { type: "string" },
            statement: { type: "string" },
            measurable: { type: "boolean" },
            metric: { type: "string" },
            target_value: { type: "number", minimum: 0 },
            unit: { type: "string" },
            comparison: {
              type: "string",
              enum: ["at_least", "exactly", "at_most", "present", "absent", "qualitative"],
            },
            evidence_hint: { type: "string" },
          },
        },
      },
    },
  },
} as const;

const architectureRequirementAuditSchema = {
  name: "architecture_requirement_audit",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["overall_pass", "checks"],
    properties: {
      overall_pass: { type: "boolean" },
      checks: {
        type: "array",
        minItems: 1,
        maxItems: 40,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["requirement_id", "status", "evidence", "observed_value", "reason"],
          properties: {
            requirement_id: { type: "string" },
            status: { type: "string", enum: ["pass", "fail", "uncertain"] },
            evidence: { type: "string" },
            observed_value: { type: "number", minimum: 0 },
            reason: { type: "string" },
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
  | typeof directionGenerationSchema
  | typeof architectureDnaSchema
  | typeof conceptSchema
  | typeof planSchema
  | typeof canonicalPlanRepairSchema
  | typeof architectureRequirementContractSchema
  | typeof architectureRequirementAuditSchema
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
        ? `The architecture request could not be completed: ${refusal}`
        : `Architecture generation returned no usable project data. Finish reason: ${finishReason}.`,
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
      `Architecture generation returned invalid project data.`,
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

type ArchitectureCapacityConstraint = {
  metric: string;
  requestedCount: number;
  sourceText: string;
};

type ArchitectureRequirementPriority = "hard" | "preferred" | "assumption";
type ArchitectureRequirementScope = "plan" | "visual" | "project";
type ArchitectureRequirementComparison =
  | "at_least"
  | "exactly"
  | "at_most"
  | "present"
  | "absent"
  | "qualitative";

type ArchitectureRequirement = {
  id: string;
  source: string;
  priority: ArchitectureRequirementPriority;
  validation_scope: ArchitectureRequirementScope;
  category: string;
  statement: string;
  measurable: boolean;
  metric: string;
  target_value: number;
  unit: string;
  comparison: ArchitectureRequirementComparison;
  evidence_hint: string;
};

type ArchitectureRequirementContract = {
  summary: string;
  requirements: ArchitectureRequirement[];
};

type ArchitectureRequirementAudit = {
  overall_pass: boolean;
  checks: Array<{
    requirement_id: string;
    status: "pass" | "fail" | "uncertain";
    evidence: string;
    observed_value: number;
    reason: string;
  }>;
};

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function projectCapacityText(project: Record<string, unknown>) {
  const professionalBrief = objectRecord(project.professional_brief);
  const value = professionalBrief.user_capacity;
  return typeof value === "string" ? value.trim() : "";
}

function requestedProjectStoreys(
  project: Record<string, unknown>,
  site: Record<string, unknown> | null,
) {
  const siteValue = Number(site?.desired_floors);
  if (Number.isFinite(siteValue) && siteValue > 0) return Math.round(siteValue);

  const sourceBrief = objectRecord(project.source_brief);
  const sourceValue = Number(sourceBrief.desired_floors);
  if (Number.isFinite(sourceValue) && sourceValue > 0) return Math.round(sourceValue);
  return null;
}

function parseCapacityConstraint(
  projectType: string,
  project: Record<string, unknown>,
): ArchitectureCapacityConstraint | null {
  const sourceText = projectCapacityText(project);
  if (!sourceText) return null;
  const lower = sourceText.toLowerCase();

  const patterns: Array<{ metric: string; regex: RegExp }> = [];
  if (/health|hospital|medical|clinic/i.test(projectType)) {
    patterns.push(
      { metric: "beds", regex: /(\d[\d,]*)\s*(?:hospital\s*)?beds?\b/i },
      { metric: "patients", regex: /(\d[\d,]*)\s*patients?\b/i },
    );
  } else if (/hotel/i.test(projectType)) {
    patterns.push(
      { metric: "guest_rooms", regex: /(\d[\d,]*)\s*(?:guest\s*)?rooms?\b/i },
      { metric: "guests", regex: /(\d[\d,]*)\s*guests?\b/i },
    );
  } else if (/resort/i.test(projectType)) {
    patterns.push(
      { metric: "villas", regex: /(\d[\d,]*)\s*villas?\b/i },
      { metric: "guest_rooms", regex: /(\d[\d,]*)\s*(?:guest\s*)?rooms?\b/i },
      { metric: "guests", regex: /(\d[\d,]*)\s*guests?\b/i },
    );
  } else if (/apartment|mixed/i.test(projectType)) {
    patterns.push(
      { metric: "units", regex: /(\d[\d,]*)\s*(?:apartments?|units?)\b/i },
      { metric: "residents", regex: /(\d[\d,]*)\s*residents?\b/i },
    );
  } else if (/education|school|campus/i.test(projectType)) {
    patterns.push(
      { metric: "students", regex: /(\d[\d,]*)\s*students?\b/i },
      { metric: "staff", regex: /(\d[\d,]*)\s*staff\b/i },
    );
  } else if (/restaurant|café|cafe/i.test(projectType)) {
    patterns.push(
      { metric: "seats", regex: /(\d[\d,]*)\s*seats?\b/i },
      { metric: "guests", regex: /(\d[\d,]*)\s*guests?\b/i },
    );
  } else if (/office/i.test(projectType)) {
    patterns.push({ metric: "staff", regex: /(\d[\d,]*)\s*staff\b/i });
  } else if (/warehouse|industrial/i.test(projectType)) {
    patterns.push(
      { metric: "loading_bays", regex: /(\d[\d,]*)\s*loading\s*bays?\b/i },
      { metric: "staff", regex: /(\d[\d,]*)\s*staff\b/i },
    );
  } else if (/community/i.test(projectType)) {
    patterns.push(
      { metric: "people", regex: /(\d[\d,]*)\s*(?:people|persons?|users?)\b/i },
    );
  }

  for (const pattern of patterns) {
    const match = lower.match(pattern.regex);
    if (!match) continue;
    const requestedCount = Number(match[1].replace(/,/g, ""));
    if (Number.isFinite(requestedCount) && requestedCount > 0) {
      return { metric: pattern.metric, requestedCount, sourceText };
    }
  }
  return null;
}

function capacityTypeMatches(metric: string, candidate: string) {
  const value = candidate.toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, RegExp> = {
    beds: /bed|inpatient/,
    patients: /patient/,
    guest_rooms: /guest.*room|room|key/,
    guests: /guest/,
    villas: /villa/,
    units: /apartment|unit|dwelling/,
    residents: /resident/,
    students: /student/,
    staff: /staff|employee|worker/,
    seats: /seat|cover|diner/,
    loading_bays: /loading.*bay|dock/,
    people: /people|person|user|occupant/,
  };
  return (aliases[metric] || new RegExp(metric, "i")).test(value);
}

function generatedCapacityCount(plan: CanonicalPlanSpec, constraint: ArchitectureCapacityConstraint) {
  const roomCapacity = (plan.levels || []).reduce((total, level) =>
    total + (level.rooms || []).reduce((sum, room) => {
      const count = Number(room.capacity_count || 0);
      return sum + (
        count > 0 && capacityTypeMatches(constraint.metric, String(room.capacity_type || ""))
          ? count
          : 0
      );
    }, 0), 0);

  const fixtureCapacity = (plan.levels || []).reduce((total, level) =>
    total + (level.fixtures || []).reduce((sum, fixture) => {
      const count = Number(fixture.count || 0);
      return sum + (
        count > 0 && capacityTypeMatches(constraint.metric, String(fixture.fixture_type || ""))
          ? count
          : 0
      );
    }, 0), 0);

  // New prompts ask for both room capacity metadata and visible fixtures. Use
  // the larger number rather than double-counting the same beds/seats twice.
  return Math.max(roomCapacity, fixtureCapacity);
}



function planFoundationLevelId(index: number) {
  if (index === 0) return "level_ground";
  if (index === 1) return "level_upper";
  return `level_${index + 1}`;
}

function planFoundationLevelLabel(index: number) {
  if (index === 0) return "Ground Floor";
  if (index === 1) return "Upper Floor";
  return `Level ${index + 1}`;
}

function planFoundationOutlineForIndex(
  contract: DirectionGeometryContract,
  index: number,
): CanonicalPlanPoint[] {
  if (index === 0) return contract.ground_outline.map((point) => ({ x: point.x, y: point.y }));
  const upper = contract.upper_level_outlines.find((item) => item.level_index === index);
  return (upper?.points || contract.ground_outline).map((point) => ({ x: point.x, y: point.y }));
}

function lockedPlanFoundationStructure(
  contract: DirectionGeometryContract | null | undefined,
  requestedStoreys: number | null | undefined,
) {
  if (!contract) return null;
  const storeys = Math.max(1, requestedStoreys || contract.storeys || 1);
  const levelIds = Array.from({ length: storeys }, (_, index) => planFoundationLevelId(index));
  return {
    storeys,
    front_edge: contract.front_edge,
    entry: contract.entry,
    garage_anchor: contract.garage,
    driveway: contract.driveway,
    pool: contract.pool,
    outdoor_living: contract.outdoor_living,
    levels: levelIds.map((id, index) => ({
      level_index: index,
      id,
      label: planFoundationLevelLabel(index),
      outline: planFoundationOutlineForIndex(contract, index),
    })),
    vertical_core: contract.vertical_core.required && storeys > 1
      ? {
          id: "primary-stair-core",
          type: "stair" as const,
          x: contract.vertical_core.x,
          y: contract.vertical_core.y,
          width: contract.vertical_core.width,
          height: contract.vertical_core.height,
          serves_level_ids: levelIds,
        }
      : null,
  };
}

function normalisePlanFoundationLevelSource(
  sourceLevels: CanonicalPlanLevel[],
  index: number,
) {
  const labelPattern = index === 0
    ? /ground|entry|lower/i
    : index === 1
      ? /upper|first|level\s*2|second/i
      : new RegExp(`level\\s*${index + 1}|floor\\s*${index + 1}`, "i");
  const labelled = sourceLevels.find((level) => labelPattern.test(`${level.id || ""} ${level.label || ""}`));
  return labelled || sourceLevels[index] || null;
}

/**
 * Enforce the non-negotiable Plan Foundation skeleton in code.
 *
 * The text model is allowed to design room geometry, but it is not allowed to
 * decide how many floors exist, delete a floor, rename structural level ids,
 * move locked massing outlines, or break the shared vertical core. Those facts
 * already exist in the selected Direction Geometry Contract and are restored
 * deterministically after every model response/correction.
 */
function enforcePlanFoundationStructuralSkeleton(
  planSet: LivePlanSet,
  contract: DirectionGeometryContract | null | undefined,
  requestedStoreys: number | null | undefined,
): LivePlanSet {
  if (!contract) return planSet;
  const repaired = JSON.parse(JSON.stringify(planSet)) as LivePlanSet;
  const plan = repaired.canonical_plan;
  if (!plan) return repaired;

  const structure = lockedPlanFoundationStructure(contract, requestedStoreys);
  if (!structure) return repaired;

  const sourceLevels = Array.isArray(plan.levels) ? plan.levels : [];
  const oldToNewLevelIds = new Map<string, string>();
  sourceLevels.forEach((level, index) => {
    if (level?.id) oldToNewLevelIds.set(level.id, planFoundationLevelId(index));
  });

  const levels: CanonicalPlanLevel[] = structure.levels.map((locked, index) => {
    const source = normalisePlanFoundationLevelSource(sourceLevels, index);
    if (source?.id) oldToNewLevelIds.set(source.id, locked.id);
    return {
      id: locked.id,
      label: locked.label,
      outline: locked.outline.map((point) => ({ ...point })),
      rooms: Array.isArray(source?.rooms) ? source!.rooms : [],
      circulation: Array.isArray(source?.circulation) ? source!.circulation : [],
      stairs: [],
      openings: Array.isArray(source?.openings) ? source!.openings : [],
      fixtures: Array.isArray(source?.fixtures) ? source!.fixtures : [],
    };
  });

  plan.levels = levels;
  const groundOutline = structure.levels[0].outline;
  const groundBounds = pointBounds(groundOutline);
  plan.building_outline = {
    shape_label: plan.building_outline?.shape_label || "Selected Direction massing",
    points: groundOutline.map((point) => ({ ...point })),
  };
  plan.footprint = {
    x: groundBounds.minX,
    y: groundBounds.minY,
    width: Math.max(1, groundBounds.maxX - groundBounds.minX),
    height: Math.max(1, groundBounds.maxY - groundBounds.minY),
  };
  plan.entry = { x: contract.entry.x, y: contract.entry.y, label: plan.entry?.label || "Main Entry" };
  plan.pool = {
    present: contract.pool.present,
    x: contract.pool.x,
    y: contract.pool.y,
    width: contract.pool.width,
    height: contract.pool.height,
  };
  plan.driveway = {
    present: contract.driveway.present,
    x: contract.driveway.x,
    y: contract.driveway.y,
    width: contract.driveway.width,
    height: contract.driveway.height,
  };

  if (structure.vertical_core) {
    const core = structure.vertical_core;
    plan.vertical_cores = [{ ...core }];
    levels.forEach((level, index) => {
      level.stairs = [{
        id: core.id,
        x: core.x,
        y: core.y,
        width: core.width,
        height: core.height,
        connects_to_level_id: levels[index + 1]?.id || levels[index - 1]?.id || level.id,
      }];
    });
  } else {
    plan.vertical_cores = (plan.vertical_cores || []).filter((core) => core.type === "shaft");
  }

  // Re-map any geometric circulation route level references onto the locked ids.
  plan.circulation_routes = (plan.circulation_routes || []).map((route) => ({
    ...route,
    serves_level_ids: (route.serves_level_ids || [])
      .map((id) => oldToNewLevelIds.get(id) || id)
      .filter((id) => levels.some((level) => level.id === id)),
  })).filter((route) => route.serves_level_ids.length > 0);

  // Section cuts are presentation metadata. Keep valid model cuts, but never
  // allow stale/missing level ids to break an otherwise valid structural plan.
  const sectionCuts = (plan.section_cuts || []).map((cut, index) => ({
    ...cut,
    level_id: oldToNewLevelIds.get(cut.level_id) || levels[Math.min(index, levels.length - 1)]?.id || levels[0].id,
  })).filter((cut) => levels.some((level) => level.id === cut.level_id));
  const core = structure.vertical_core;
  while (sectionCuts.length < 2) {
    const index = sectionCuts.length;
    sectionCuts.push({
      id: index === 0 ? "section-a-a" : "section-b-b",
      label: index === 0 ? "A—A" : "B—B",
      orientation: index === 0 ? "longitudinal" : "transverse",
      axis: index === 0 ? (core?.x ?? 50) : (core?.y ?? 50),
      direction: index === 0 ? "south" : "east",
      level_id: levels[0].id,
      passes_through_room_ids: [],
      passes_through_stair: Boolean(core && index === 0),
    });
  }
  if (core && !sectionCuts.some((cut) => cut.passes_through_stair)) {
    sectionCuts[0].passes_through_stair = true;
    sectionCuts[0].axis = core.x;
  }
  plan.section_cuts = sectionCuts.slice(0, 4);

  return repaired;
}

function isOpenPlanCanonicalRoom(room: CanonicalPlanRoom) {
  const text = `${room.name || ""} ${room.zone || ""}`.toLowerCase();
  return /living|family|lounge|dining|kitchen|breakfast|great room|open plan|open-plan/.test(text)
    && !/bath|toilet|powder|bed|office|study|laundry|storage|garage/.test(text);
}

function ensureLockedMainEntryDoor(
  planSet: LivePlanSet,
  contract: DirectionGeometryContract | null | undefined,
): LivePlanSet {
  if (!contract || !planSet.canonical_plan?.levels?.[0]) return planSet;
  const repaired = JSON.parse(JSON.stringify(planSet)) as LivePlanSet;
  const ground = repaired.canonical_plan.levels[0];
  const rooms = (ground.rooms || []).filter((room) => !isOutdoorCanonicalRoom(room));
  if (!rooms.length) return repaired;

  const edge = contract.entry.edge;
  const candidates = rooms
    .map((room) => {
      const touchingEdge = roomTouchesLevelBoundary(room, ground) === edge;
      const center = edge === "north" || edge === "south"
        ? room.x + room.width / 2
        : room.y + room.height / 2;
      const target = edge === "north" || edge === "south" ? contract.entry.x : contract.entry.y;
      const nameBonus = /entry|foyer|vestibule|lobby|hall/i.test(room.name) ? -12 : 0;
      return { room, touchingEdge, score: Math.abs(center - target) + nameBonus };
    })
    .filter((item) => item.touchingEdge)
    .sort((a, b) => a.score - b.score);
  const source = candidates[0]?.room;
  if (!source) return repaired;

  const rawPosition = edge === "north" || edge === "south"
    ? ((contract.entry.x - source.x) / Math.max(source.width, 0.1)) * 100
    : ((contract.entry.y - source.y) / Math.max(source.height, 0.1)) * 100;
  const position = Math.max(8, Math.min(92, rawPosition));
  const openings = Array.isArray(ground.openings) ? ground.openings : [];
  const withoutCompetingMainEntry = openings.filter((opening) =>
    !(opening.id === "locked-main-entry" || (/door/.test(opening.type) && /entry|outside|exterior|street/i.test(String(opening.connects_to || "")) && opening.room_id === source.id)),
  );
  ground.openings = [{
    id: "locked-main-entry",
    type: "door",
    room_id: source.id,
    wall: edge,
    position,
    width_m: 1.2,
    connects_to: "outside-main-entry",
  }, ...withoutCompetingMainEntry];
  return repaired;
}

function canonicalOutlineForLevel(plan: CanonicalPlanSpec, level: CanonicalPlanLevel) {
  if (Array.isArray(level.outline) && level.outline.length >= 4) return level.outline;
  if (Array.isArray(plan.building_outline?.points) && plan.building_outline!.points.length >= 4) {
    return plan.building_outline!.points;
  }
  const footprint = plan.footprint || { x: 20, y: 20, width: 60, height: 55 };
  return [
    { x: footprint.x, y: footprint.y },
    { x: footprint.x + footprint.width, y: footprint.y },
    { x: footprint.x + footprint.width, y: footprint.y + footprint.height },
    { x: footprint.x, y: footprint.y + footprint.height },
  ];
}

function pointBounds(points: CanonicalPlanPoint[]) {
  const safe = points.length ? points : [{ x: 0, y: 0 }];
  return {
    minX: Math.min(...safe.map((point) => Number(point.x) || 0)),
    minY: Math.min(...safe.map((point) => Number(point.y) || 0)),
    maxX: Math.max(...safe.map((point) => Number(point.x) || 0)),
    maxY: Math.max(...safe.map((point) => Number(point.y) || 0)),
  };
}

function nearNumber(a: number, b: number, tolerance = 1.25) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= tolerance;
}

function isOutdoorCanonicalRoom(room: CanonicalPlanRoom) {
  return /outdoor|garden|terrace|balcony|pool|yard|court|landscape|parking/i.test(
    `${room.zone || ""} ${room.name || ""}`,
  );
}

function isPatientBedroom(room: CanonicalPlanRoom) {
  const text = `${room.name || ""} ${room.zone || ""} ${room.capacity_type || ""}`.toLowerCase();
  return /patient.*room|inpatient.*room|patient.*bedroom|bedroom.*patient/.test(text)
    || (/bed/.test(String(room.capacity_type || "").toLowerCase()) && !/ward|icu|recovery|treatment/.test(text));
}


function orientation2d(a: CanonicalPlanPoint, b: CanonicalPlanPoint, c: CanonicalPlanPoint) {
  return (Number(b.y) - Number(a.y)) * (Number(c.x) - Number(b.x))
    - (Number(b.x) - Number(a.x)) * (Number(c.y) - Number(b.y));
}

function segmentsIntersect(
  a1: CanonicalPlanPoint,
  a2: CanonicalPlanPoint,
  b1: CanonicalPlanPoint,
  b2: CanonicalPlanPoint,
) {
  const o1 = orientation2d(a1, a2, b1);
  const o2 = orientation2d(a1, a2, b2);
  const o3 = orientation2d(b1, b2, a1);
  const o4 = orientation2d(b1, b2, a2);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function routeIntersectionCount(a: CanonicalCirculationRoute, b: CanonicalCirculationRoute) {
  let count = 0;
  for (let ai = 0; ai < a.points.length - 1; ai += 1) {
    for (let bi = 0; bi < b.points.length - 1; bi += 1) {
      if (segmentsIntersect(a.points[ai], a.points[ai + 1], b.points[bi], b.points[bi + 1])) count += 1;
    }
  }
  return count;
}

function canonicalOverlap(a1: number, a2: number, b1: number, b2: number) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

function roomsShareOpeningWall(
  source: CanonicalPlanRoom,
  target: CanonicalPlanRoom,
  wall: "north" | "south" | "east" | "west",
) {
  const tolerance = 1.5;
  const sourceX2 = Number(source.x) + Number(source.width);
  const sourceY2 = Number(source.y) + Number(source.height);
  const targetX2 = Number(target.x) + Number(target.width);
  const targetY2 = Number(target.y) + Number(target.height);
  if (wall === "north") {
    return Math.abs(Number(source.y) - targetY2) <= tolerance
      && canonicalOverlap(Number(source.x), sourceX2, Number(target.x), targetX2) > 0.75;
  }
  if (wall === "south") {
    return Math.abs(sourceY2 - Number(target.y)) <= tolerance
      && canonicalOverlap(Number(source.x), sourceX2, Number(target.x), targetX2) > 0.75;
  }
  if (wall === "west") {
    return Math.abs(Number(source.x) - targetX2) <= tolerance
      && canonicalOverlap(Number(source.y), sourceY2, Number(target.y), targetY2) > 0.75;
  }
  return Math.abs(sourceX2 - Number(target.x)) <= tolerance
    && canonicalOverlap(Number(source.y), sourceY2, Number(target.y), targetY2) > 0.75;
}

type CanonicalOpeningWall = "north" | "south" | "east" | "west";

function sharedOpeningWall(
  source: CanonicalPlanRoom,
  target: CanonicalPlanRoom,
): CanonicalOpeningWall | null {
  const walls: CanonicalOpeningWall[] = ["north", "south", "east", "west"];
  return walls.find((wall) => roomsShareOpeningWall(source, target, wall)) || null;
}

function roomTouchesLevelBoundary(
  room: CanonicalPlanRoom,
  level: CanonicalPlanLevel,
): CanonicalOpeningWall | null {
  const outline = Array.isArray(level.outline) && level.outline.length >= 4
    ? level.outline
    : [];
  if (!outline.length) return null;
  const bounds = pointBounds(outline);
  const tolerance = 1.5;
  const roomX2 = Number(room.x) + Number(room.width);
  const roomY2 = Number(room.y) + Number(room.height);
  if (Math.abs(Number(room.y) - bounds.minY) <= tolerance) return "north";
  if (Math.abs(roomY2 - bounds.maxY) <= tolerance) return "south";
  if (Math.abs(Number(room.x) - bounds.minX) <= tolerance) return "west";
  if (Math.abs(roomX2 - bounds.maxX) <= tolerance) return "east";
  return null;
}

function roomAccessPreference(source: CanonicalPlanRoom, target: CanonicalPlanRoom) {
  const sourceName = source.name.toLowerCase();
  const targetName = target.name.toLowerCase();
  if (/corridor|hall|landing|lobby|foyer|entry|circulation/.test(targetName)) return 0;
  if (/bath|toilet|powder|ensuite|wc/.test(sourceName) && /bed|suite/.test(targetName)) return 1;
  if (/storage|pantry/.test(sourceName) && /kitchen|service|utility/.test(targetName)) return 1;
  if (/laundry|utility/.test(sourceName) && /kitchen|garage|service/.test(targetName)) return 1;
  if (/garage|carport/.test(sourceName) && /foyer|entry|hall|mud|utility|laundry/.test(targetName)) return 1;
  if (/living|dining|family|lounge|kitchen/.test(targetName)) return 2;
  if (/bed|office|study|gym/.test(targetName)) return 4;
  return 3;
}

function sharedWallOverlap(
  source: CanonicalPlanRoom,
  target: CanonicalPlanRoom,
  wall: CanonicalOpeningWall,
) {
  const sourceX2 = Number(source.x) + Number(source.width);
  const sourceY2 = Number(source.y) + Number(source.height);
  const targetX2 = Number(target.x) + Number(target.width);
  const targetY2 = Number(target.y) + Number(target.height);
  return wall === "north" || wall === "south"
    ? canonicalOverlap(Number(source.x), sourceX2, Number(target.x), targetX2)
    : canonicalOverlap(Number(source.y), sourceY2, Number(target.y), targetY2);
}

/**
 * Normalise access metadata against the actual canonical rectangles before
 * validation/rendering. The model is good at room programming but can return
 * a correct adjacency with the wrong wall label, or omit a door record even
 * when two rooms physically share a wall. We repair only what the geometry
 * can prove; we never invent a connection between non-adjacent rooms.
 */
function repairCanonicalPlanAccess(planSet: LivePlanSet): LivePlanSet {
  const repaired = JSON.parse(JSON.stringify(planSet)) as LivePlanSet;
  const levels = repaired.canonical_plan?.levels || [];

  levels.forEach((level, levelIndex) => {
    const rooms = level.rooms || [];
    const roomById = new Map(rooms.map((room) => [room.id, room]));
    const externalTarget = /outside|exterior|entry|garden|terrace|balcony|pool|driveway|site/i;

    const validDoorOpenings: NonNullable<CanonicalPlanLevel["openings"]> = [];
    const openingIds = new Set<string>();

    for (const opening of level.openings || []) {
      if (!/door/.test(opening.type)) {
        validDoorOpenings.push(opening);
        openingIds.add(opening.id);
        continue;
      }

      const source = roomById.get(opening.room_id);
      if (!source) continue;
      const destination = String(opening.connects_to || "");
      const target = roomById.get(destination);

      if (target) {
        const actualWall = sharedOpeningWall(source, target);
        if (!actualWall) continue;
        validDoorOpenings.push({ ...opening, wall: actualWall });
        openingIds.add(opening.id);
        continue;
      }

      if (externalTarget.test(destination)) {
        const boundaryWall = roomTouchesLevelBoundary(source, level);
        if (!boundaryWall) continue;
        validDoorOpenings.push({ ...opening, wall: boundaryWall, connects_to: destination || "outside" });
        openingIds.add(opening.id);
      }
    }

    // Keep only circulation relationships that the actual room geometry can support.
    const repairedCirculation = (level.circulation || []).filter((link) => {
      const source = roomById.get(link.from_room_id);
      const target = roomById.get(link.to_room_id);
      return Boolean(source && target && sharedOpeningWall(source, target));
    });
    const circulationKeys = new Set(repairedCirculation.map((link) => `${link.from_room_id}|${link.to_room_id}`));

    function ensureCirculation(source: CanonicalPlanRoom, target: CanonicalPlanRoom) {
      const forward = `${source.id}|${target.id}`;
      const reverse = `${target.id}|${source.id}`;
      if (circulationKeys.has(forward) || circulationKeys.has(reverse)) return;
      repairedCirculation.push({
        from_room_id: source.id,
        to_room_id: target.id,
        label: `${source.name} to ${target.name}`,
      });
      circulationKeys.add(forward);
    }

    // Every valid internal door must also have a circulation relationship so
    // the deterministic renderer draws exactly the same physical opening.
    for (const opening of validDoorOpenings) {
      if (!/door/.test(opening.type)) continue;
      const source = roomById.get(opening.room_id);
      const target = roomById.get(String(opening.connects_to || ""));
      if (source && target) ensureCirculation(source, target);
    }

    for (const room of rooms) {
      if (isOutdoorCanonicalRoom(room)) continue;
      // A door is a bidirectional physical opening. It may be stored with
      // either adjoining room as room_id, so count the room on either side.
      const alreadyAccessible = validDoorOpenings.some((opening) =>
        /door/.test(opening.type) &&
        (opening.room_id === room.id || String(opening.connects_to || "") === room.id),
      );
      if (alreadyAccessible) continue;

      // Living / dining / kitchen zones are often intentionally open-plan and
      // should not be rejected merely because there is no hinged door symbol.
      // When an open-plan room physically shares a wall with another open-plan
      // room, preserve that as an explicit circulation/open-boundary relation.
      if (isOpenPlanCanonicalRoom(room)) {
        const openNeighbor = rooms.find((candidate) =>
          candidate.id !== room.id
          && isOpenPlanCanonicalRoom(candidate)
          && Boolean(sharedOpeningWall(room, candidate)),
        );
        if (openNeighbor) {
          ensureCirculation(room, openNeighbor);
          continue;
        }
      }

      const candidates = rooms
        .filter((candidate) => candidate.id !== room.id)
        .map((candidate) => {
          const wall = sharedOpeningWall(room, candidate);
          return wall ? {
            room: candidate,
            wall,
            score: roomAccessPreference(room, candidate),
            overlap: sharedWallOverlap(room, candidate, wall),
          } : null;
        })
        .filter((candidate): candidate is { room: CanonicalPlanRoom; wall: CanonicalOpeningWall; score: number; overlap: number } => Boolean(candidate))
        .sort((a, b) => a.score - b.score || b.overlap - a.overlap);

      const best = candidates[0];
      if (best) {
        let id = `auto-door-${levelIndex}-${room.id}-${best.room.id}`;
        let suffix = 2;
        while (openingIds.has(id)) id = `auto-door-${levelIndex}-${room.id}-${best.room.id}-${suffix++}`;
        validDoorOpenings.push({
          id,
          type: "door",
          room_id: room.id,
          wall: best.wall,
          position: 0.5,
          width_m: /garage|carport/.test(room.name.toLowerCase()) ? 1.1 : 0.9,
          connects_to: best.room.id,
        });
        openingIds.add(id);
        ensureCirculation(room, best.room);
        continue;
      }

      // Exterior access is a conservative last fallback only when the room
      // demonstrably touches the level perimeter. Internal rooms are left
      // unresolved so the correction pass must repair their geometry.
      const boundaryWall = roomTouchesLevelBoundary(room, level);
      if (boundaryWall) {
        let id = `auto-exterior-door-${levelIndex}-${room.id}`;
        let suffix = 2;
        while (openingIds.has(id)) id = `auto-exterior-door-${levelIndex}-${room.id}-${suffix++}`;
        validDoorOpenings.push({
          id,
          type: "door",
          room_id: room.id,
          wall: boundaryWall,
          position: 0.5,
          width_m: 0.9,
          connects_to: "outside",
        });
        openingIds.add(id);
      }
    }

    level.openings = validDoorOpenings;
    level.circulation = repairedCirculation;
  });

  return repaired;
}

function isStandalonePoolRoom(room: CanonicalPlanRoom) {
  const text = `${room.name || ""} ${room.zone || ""}`.toLowerCase();
  return /\bpool\b/.test(text)
    && !/pool (?:plant|equipment|pump)|plant room|equipment room|pool bath|pool change|pool locker/.test(text);
}

/**
 * Apply only geometry that is already locked by the selected Direction
 * Contract. This is not a layout generator: it prevents the text model from
 * moving the agreed massing/site anchors between correction passes.
 */
function applyDirectionContractLocks(
  planSet: LivePlanSet,
  contract: DirectionGeometryContract | null | undefined,
): LivePlanSet {
  if (!contract) return planSet;
  const repaired = JSON.parse(JSON.stringify(planSet)) as LivePlanSet;
  const plan = repaired.canonical_plan;
  if (!plan) return repaired;

  const groundOutline = contract.ground_outline.map((point) => ({ x: point.x, y: point.y }));
  const groundBounds = pointBounds(groundOutline);
  plan.building_outline = {
    shape_label: plan.building_outline?.shape_label || "Selected Direction massing",
    points: groundOutline,
  };
  plan.footprint = {
    x: groundBounds.minX,
    y: groundBounds.minY,
    width: Math.max(1, groundBounds.maxX - groundBounds.minX),
    height: Math.max(1, groundBounds.maxY - groundBounds.minY),
  };
  plan.entry = {
    x: contract.entry.x,
    y: contract.entry.y,
    label: plan.entry?.label || "Main Entry",
  };
  plan.pool = {
    present: contract.pool.present,
    x: contract.pool.x,
    y: contract.pool.y,
    width: contract.pool.width,
    height: contract.pool.height,
  };
  plan.driveway = {
    present: contract.driveway.present,
    x: contract.driveway.x,
    y: contract.driveway.y,
    width: contract.driveway.width,
    height: contract.driveway.height,
  };

  const levels = plan.levels || [];
  if (levels[0]) levels[0].outline = groundOutline;
  for (const expected of contract.upper_level_outlines) {
    const level = levels[expected.level_index];
    if (level) level.outline = expected.points.map((point) => ({ x: point.x, y: point.y }));
  }

  // The pool is always a site element. Remove only accidental standalone Pool
  // rooms; pool plant/bath/change rooms remain legitimate interior spaces.
  for (const level of levels) {
    level.rooms = (level.rooms || []).filter((room) => !isStandalonePoolRoom(room));
  }

  // Do NOT snap the garage room to the contract rectangle here. The contract
  // garage is a facade/site anchor, not a literal room box. Earlier builds
  // overwrote an otherwise valid AI layout after every correction pass, which
  // could put the locked garage back on top of Laundry / Robe / Bathroom rooms.
  // The validator below already enforces the correct side/zone relationship,
  // while leaving the planner enough tolerance to fit the actual garage cleanly.

  if (contract.vertical_core.required && levels.length > 1) {
    const existingPrimary = (plan.vertical_cores || []).find((core) =>
      core.type === "stair" || core.type === "lift" || core.type === "service_lift",
    );
    const servedLevelIds = levels.slice(0, contract.storeys).map((level) => level.id);
    const primary: CanonicalVerticalCore = {
      id: existingPrimary?.id || "primary-stair-core",
      type: existingPrimary?.type || "stair",
      x: contract.vertical_core.x,
      y: contract.vertical_core.y,
      width: contract.vertical_core.width,
      height: contract.vertical_core.height,
      serves_level_ids: servedLevelIds,
    };
    plan.vertical_cores = [
      primary,
      ...(plan.vertical_cores || []).filter((core) => core.id !== primary.id && core.type === "shaft"),
    ];

    if (primary.type === "stair") {
      levels.slice(0, contract.storeys).forEach((level, levelIndex) => {
        const otherStairs = (level.stairs || []).filter((stair) => stair.id !== primary.id);
        level.stairs = [
          {
            id: primary.id,
            x: primary.x,
            y: primary.y,
            width: primary.width,
            height: primary.height,
            connects_to_level_id:
              levels[levelIndex + 1]?.id || levels[levelIndex - 1]?.id || level.id,
          },
          ...otherStairs,
        ].slice(0, 4);
      });
    }
  }

  return repaired;
}

/**
 * Repair only tiny numeric collisions/edge drift caused by model rounding.
 * Large overlaps remain validation failures and must be replanned by the
 * geometry-only correction model; we never fall back to generic row packing.
 */
function repairMinorCanonicalGeometry(planSet: LivePlanSet): LivePlanSet {
  const repaired = JSON.parse(JSON.stringify(planSet)) as LivePlanSet;
  for (const level of repaired.canonical_plan?.levels || []) {
    const outline = canonicalOutlineForLevel(repaired.canonical_plan, level);
    const bounds = pointBounds(outline);
    const indoorRooms = (level.rooms || []).filter((room) => !isOutdoorCanonicalRoom(room));

    for (const room of indoorRooms) {
      const width = Math.max(0.5, Number(room.width || 0));
      const height = Math.max(0.5, Number(room.height || 0));
      const minX = Number(room.x || 0);
      const minY = Number(room.y || 0);
      const maxX = minX + width;
      const maxY = minY + height;
      const leftDrift = Math.max(0, bounds.minX - minX);
      const rightDrift = Math.max(0, maxX - bounds.maxX);
      const topDrift = Math.max(0, bounds.minY - minY);
      const bottomDrift = Math.max(0, maxY - bounds.maxY);
      if (Math.max(leftDrift, rightDrift, topDrift, bottomDrift) <= 2.25) {
        room.x = Math.min(Math.max(minX, bounds.minX), Math.max(bounds.minX, bounds.maxX - width));
        room.y = Math.min(Math.max(minY, bounds.minY), Math.max(bounds.minY, bounds.maxY - height));
      }
    }

    // Resolve only hairline overlaps. Anything substantial is architectural
    // geometry and is intentionally left for the correction pass.
    for (let iteration = 0; iteration < 3; iteration += 1) {
      let changed = false;
      for (let i = 0; i < indoorRooms.length; i += 1) {
        const a = indoorRooms[i];
        const ax2 = a.x + a.width;
        const ay2 = a.y + a.height;
        for (let j = i + 1; j < indoorRooms.length; j += 1) {
          const b = indoorRooms[j];
          const bx2 = b.x + b.width;
          const by2 = b.y + b.height;
          const overlapX = Math.min(ax2, bx2) - Math.max(a.x, b.x);
          const overlapY = Math.min(ay2, by2) - Math.max(a.y, b.y);
          if (overlapX <= 0 || overlapY <= 0) continue;
          if (overlapX > 1.35 && overlapY > 1.35) continue;

          const moveX = overlapX <= overlapY;
          if (moveX) {
            const amount = overlapX + 0.15;
            const preferPositive = (b.x + b.width / 2) >= (a.x + a.width / 2);
            const candidates = preferPositive ? [amount, -amount] : [-amount, amount];
            for (const delta of candidates) {
              const next = b.x + delta;
              if (next >= bounds.minX && next + b.width <= bounds.maxX) {
                b.x = next;
                changed = true;
                break;
              }
            }
          } else {
            const amount = overlapY + 0.15;
            const preferPositive = (b.y + b.height / 2) >= (a.y + a.height / 2);
            const candidates = preferPositive ? [amount, -amount] : [-amount, amount];
            for (const delta of candidates) {
              const next = b.y + delta;
              if (next >= bounds.minY && next + b.height <= bounds.maxY) {
                b.y = next;
                changed = true;
                break;
              }
            }
          }
        }
      }
      if (!changed) break;
    }
  }
  return repaired;
}

function canonicalPointInPolygon(point: CanonicalPlanPoint, polygon: CanonicalPlanPoint[]) {
  if (polygon.length < 3) return true;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = Number(polygon[i].x);
    const yi = Number(polygon[i].y);
    const xj = Number(polygon[j].x);
    const yj = Number(polygon[j].y);
    const crosses = ((yi > point.y) !== (yj > point.y))
      && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (crosses) inside = !inside;
  }
  return inside;
}

function canonicalRoomInsideOutline(room: CanonicalPlanRoom, outline: CanonicalPlanPoint[]) {
  const inset = 0.12;
  const points = [
    { x: room.x + inset, y: room.y + inset },
    { x: room.x + room.width - inset, y: room.y + inset },
    { x: room.x + room.width - inset, y: room.y + room.height - inset },
    { x: room.x + inset, y: room.y + room.height - inset },
  ];
  return points.every((point) => canonicalPointInPolygon(point, outline));
}

function canonicalRoomsOverlap(a: CanonicalPlanRoom, b: CanonicalPlanRoom, tolerance = 0.72) {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlapX > tolerance && overlapY > tolerance;
}

function canonicalRoomIsLayoutAnchor(room: CanonicalPlanRoom) {
  const text = `${room.name || ""} ${room.zone || ""}`.toLowerCase();
  return /garage|carport|entry|foyer|vestibule|lobby|stair|lift|elevator|core/.test(text);
}

function canonicalRoomDistance(a: CanonicalPlanRoom, b: CanonicalPlanRoom) {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Last-mile constraint repair for an otherwise useful AI plan.
 *
 * This intentionally does NOT redesign the floor into rows or a generic grid.
 * It keeps every room's original size, level and approximate location, fixes
 * only illegal collisions/out-of-outline placement, and searches first for the
 * nearest legal position that touches another room wall. Large moves are not
 * permitted: if a room cannot be repaired locally, validation still fails and
 * the geometry correction model must re-plan it.
 */
function repairLocalCanonicalConflicts(planSet: LivePlanSet): LivePlanSet {
  const repaired = JSON.parse(JSON.stringify(planSet)) as LivePlanSet;
  const plan = repaired.canonical_plan;
  if (!plan) return repaired;

  for (const level of plan.levels || []) {
    const outline = canonicalOutlineForLevel(plan, level);
    const bounds = pointBounds(outline);
    const indoor = (level.rooms || []).filter((room) => !isOutdoorCanonicalRoom(room));
    if (indoor.length < 2) continue;

    const original = new Map(indoor.map((room) => [room.id, { x: room.x, y: room.y }]));
    const anchored = indoor.filter(canonicalRoomIsLayoutAnchor);
    const ordinary = indoor.filter((room) => !canonicalRoomIsLayoutAnchor(room));

    // Keep valid anchors first. Other rooms are checked in descending area so
    // tiny service rooms do not consume the only viable position for a larger
    // bedroom/living space.
    const ordered = [
      ...anchored,
      ...ordinary.sort((a, b) => (b.width * b.height) - (a.width * a.height)),
    ];
    const placed: CanonicalPlanRoom[] = [];

    const isLegal = (room: CanonicalPlanRoom) =>
      canonicalRoomInsideOutline(room, outline)
      && placed.every((other) => !canonicalRoomsOverlap(room, other));

    for (const room of ordered) {
      if (isLegal(room)) {
        placed.push(room);
        continue;
      }

      // Anchors such as Garage and Entry are never moved by this fallback.
      // Their conflicts must be resolved by moving the non-anchor room around
      // them, preserving the selected Direction's facade/site logic.
      if (canonicalRoomIsLayoutAnchor(room)) {
        placed.push(room);
        continue;
      }

      const start = original.get(room.id) || { x: room.x, y: room.y };
      const candidates: Array<{ x: number; y: number; score: number }> = [];
      const seen = new Set<string>();
      const pushCandidate = (x: number, y: number, adjacencyBonus = 0) => {
        const key = `${x.toFixed(2)}:${y.toFixed(2)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const trial = { ...room, x, y };
        if (!canonicalRoomInsideOutline(trial, outline)) return;
        if (placed.some((other) => canonicalRoomsOverlap(trial, other))) return;
        const move = Math.hypot(x - start.x, y - start.y);
        // Refuse a major redesign. A move beyond 18 canonical units is left
        // unresolved for the AI correction pass instead of being hidden.
        if (move > 18) return;
        const neighborDistance = placed.length
          ? Math.min(...placed.map((other) => canonicalRoomDistance(trial, other)))
          : 0;
        candidates.push({ x, y, score: move + neighborDistance * 0.04 - adjacencyBonus });
      };

      // Prefer positions sharing a wall with an already placed room. This is
      // much more useful for circulation than arbitrary empty-space nudging.
      for (const other of placed) {
        pushCandidate(other.x - room.width, other.y, 1.5);
        pushCandidate(other.x + other.width, other.y, 1.5);
        pushCandidate(other.x, other.y - room.height, 1.5);
        pushCandidate(other.x, other.y + other.height, 1.5);
        // Also align opposite ends when room sizes differ.
        pushCandidate(other.x + other.width - room.width, other.y, 0.8);
        pushCandidate(other.x, other.y + other.height - room.height, 0.8);
      }

      // Search a compact local grid around the model's intended position.
      for (let radius = 1; radius <= 18; radius += 1) {
        const steps = [
          [radius, 0], [-radius, 0], [0, radius], [0, -radius],
          [radius, radius], [radius, -radius], [-radius, radius], [-radius, -radius],
        ];
        for (const [dx, dy] of steps) pushCandidate(start.x + dx, start.y + dy);
        if (candidates.length >= 8) break;
      }

      // Edge-aligned fallback stays near the original zone and often gives
      // bedrooms/living spaces a useful exterior wall without changing sides.
      pushCandidate(bounds.minX, Math.min(Math.max(start.y, bounds.minY), bounds.maxY - room.height), 0.5);
      pushCandidate(bounds.maxX - room.width, Math.min(Math.max(start.y, bounds.minY), bounds.maxY - room.height), 0.5);
      pushCandidate(Math.min(Math.max(start.x, bounds.minX), bounds.maxX - room.width), bounds.minY, 0.5);
      pushCandidate(Math.min(Math.max(start.x, bounds.minX), bounds.maxX - room.width), bounds.maxY - room.height, 0.5);

      candidates.sort((a, b) => a.score - b.score);
      const best = candidates[0];
      if (best) {
        room.x = best.x;
        room.y = best.y;
      }
      placed.push(room);
    }
  }

  return repaired;
}


/**
 * Resolve the last few ordinary-room collisions with minimal displacement.
 *
 * This is deliberately different from the rejected row/grid packer: it never
 * invents a new room sequence or normalises the whole floor. It only relaxes
 * rooms that are still colliding after the model correction/local repair,
 * keeps Direction anchors fixed, and chooses the smallest move that reduces
 * total collision area while staying inside the real level outline.
 */
function resolveResidualCanonicalRoomOverlaps(planSet: LivePlanSet): LivePlanSet {
  const repaired = JSON.parse(JSON.stringify(planSet)) as LivePlanSet;
  const plan = repaired.canonical_plan;
  if (!plan) return repaired;

  const rawOverlapArea = (a: CanonicalPlanRoom, b: CanonicalPlanRoom) => {
    const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return overlapX > 0 && overlapY > 0 ? overlapX * overlapY : 0;
  };

  const collisionAreaFor = (room: CanonicalPlanRoom, rooms: CanonicalPlanRoom[]) =>
    rooms.reduce((sum, other) => {
      if (other.id === room.id) return sum;
      return sum + rawOverlapArea(room, other);
    }, 0);

  for (const level of plan.levels || []) {
    const outline = canonicalOutlineForLevel(plan, level);
    const bounds = pointBounds(outline);
    const indoor = (level.rooms || []).filter((room) => !isOutdoorCanonicalRoom(room));
    if (indoor.length < 2) continue;

    const original = new Map(indoor.map((room) => [room.id, { x: room.x, y: room.y }]));

    for (let iteration = 0; iteration < 36; iteration += 1) {
      let conflict: { a: CanonicalPlanRoom; b: CanonicalPlanRoom; area: number } | null = null;

      for (let i = 0; i < indoor.length; i += 1) {
        for (let j = i + 1; j < indoor.length; j += 1) {
          const a = indoor[i];
          const b = indoor[j];
          if (!canonicalRoomsOverlap(a, b)) continue;
          const area = rawOverlapArea(a, b);
          if (!conflict || area > conflict.area) conflict = { a, b, area };
        }
      }

      if (!conflict) break;

      const aAnchor = canonicalRoomIsLayoutAnchor(conflict.a);
      const bAnchor = canonicalRoomIsLayoutAnchor(conflict.b);
      if (aAnchor && bAnchor) break;

      // Prefer moving the smaller non-anchor room. This naturally keeps major
      // living/bedroom zones stable while allowing bathrooms/robes/laundries to
      // resolve local collisions around them.
      const movable = aAnchor
        ? conflict.b
        : bAnchor
          ? conflict.a
          : (conflict.a.width * conflict.a.height <= conflict.b.width * conflict.b.height ? conflict.a : conflict.b);
      const blocker = movable.id === conflict.a.id ? conflict.b : conflict.a;
      const start = original.get(movable.id) || { x: movable.x, y: movable.y };
      const currentArea = collisionAreaFor(movable, indoor);
      const candidates: Array<{ x: number; y: number; score: number; collision: number }> = [];
      const seen = new Set<string>();

      const pushCandidate = (x: number, y: number, adjacencyBonus = 0) => {
        const key = `${x.toFixed(2)}:${y.toFixed(2)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const trial = { ...movable, x, y };
        if (!canonicalRoomInsideOutline(trial, outline)) return;
        const move = Math.hypot(x - movable.x, y - movable.y);
        const totalMove = Math.hypot(x - start.x, y - start.y);
        if (totalMove > 24) return;
        const collision = collisionAreaFor(trial, indoor);
        const score = collision * 1000 + move * 2 + totalMove * 0.25 - adjacencyBonus;
        candidates.push({ x, y, score, collision });
      };

      const gap = 0.18;
      // Exact separating moves around the room causing the current collision.
      pushCandidate(blocker.x - movable.width - gap, movable.y, 1.5);
      pushCandidate(blocker.x + blocker.width + gap, movable.y, 1.5);
      pushCandidate(movable.x, blocker.y - movable.height - gap, 1.5);
      pushCandidate(movable.x, blocker.y + blocker.height + gap, 1.5);

      // Alignment alternatives preserve the same local room cluster while
      // giving the solver a way around a third neighbouring room.
      pushCandidate(blocker.x - movable.width - gap, blocker.y, 1.0);
      pushCandidate(blocker.x + blocker.width + gap, blocker.y, 1.0);
      pushCandidate(blocker.x, blocker.y - movable.height - gap, 1.0);
      pushCandidate(blocker.x, blocker.y + blocker.height + gap, 1.0);
      pushCandidate(blocker.x + blocker.width - movable.width, blocker.y - movable.height - gap, 0.6);
      pushCandidate(blocker.x + blocker.width - movable.width, blocker.y + blocker.height + gap, 0.6);

      // Half-unit local search is intentionally fine-grained. The previous
      // whole-unit search could miss a perfectly valid nearby position and
      // then abort the entire paid generation over one Bedroom/Bathroom clash.
      for (let radius = 0.5; radius <= 24; radius += 0.5) {
        const steps = [
          [radius, 0], [-radius, 0], [0, radius], [0, -radius],
          [radius, radius], [radius, -radius], [-radius, radius], [-radius, -radius],
        ];
        for (const [dx, dy] of steps) pushCandidate(movable.x + dx, movable.y + dy);
      }

      pushCandidate(bounds.minX, Math.min(Math.max(movable.y, bounds.minY), bounds.maxY - movable.height), 0.25);
      pushCandidate(bounds.maxX - movable.width, Math.min(Math.max(movable.y, bounds.minY), bounds.maxY - movable.height), 0.25);
      pushCandidate(Math.min(Math.max(movable.x, bounds.minX), bounds.maxX - movable.width), bounds.minY, 0.25);
      pushCandidate(Math.min(Math.max(movable.x, bounds.minX), bounds.maxX - movable.width), bounds.maxY - movable.height, 0.25);

      candidates.sort((left, right) => left.score - right.score);
      const best = candidates.find((candidate) => candidate.collision + 0.02 < currentArea);
      if (!best) break;

      movable.x = best.x;
      movable.y = best.y;
    }
  }

  return repaired;
}

function prepareCanonicalPlanCandidate(
  planSet: LivePlanSet,
  contract: DirectionGeometryContract | null | undefined,
  requestedStoreys?: number | null,
) {
  const structurallyLocked = enforcePlanFoundationStructuralSkeleton(planSet, contract, requestedStoreys);
  const geometryPrepared = resolveResidualCanonicalRoomOverlaps(
    repairLocalCanonicalConflicts(
      repairMinorCanonicalGeometry(
        applyDirectionContractLocks(structurallyLocked, contract),
      ),
    ),
  );
  return ensureLockedMainEntryDoor(
    repairCanonicalPlanAccess(geometryPrepared),
    contract,
  );
}


function geometryCoordinationIssues(args: {
  planSet: LivePlanSet;
  project: Record<string, unknown>;
}) {
  const issues: string[] = [];
  const plan = args.planSet.canonical_plan;
  const levels = plan?.levels || [];
  if (!plan || !levels.length) return ["The Canonical Plan contains no coordinated levels."];

  const masterOutline = Array.isArray(plan.building_outline?.points) && plan.building_outline!.points.length >= 4
    ? plan.building_outline!.points
    : canonicalOutlineForLevel(plan, levels[0]);
  const masterBounds = pointBounds(masterOutline);

  levels.forEach((level, levelIndex) => {
    const outline = canonicalOutlineForLevel(plan, level);
    const enclosedRooms = (level.rooms || []).filter((room) => !isOutdoorCanonicalRoom(room));
    if (!enclosedRooms.length) {
      issues.push(`${level.label || `Level ${levelIndex}`}: contains no enclosed programme rooms. Every required storey must be explicitly designed, not returned as an empty placeholder.`);
    }
    const bounds = pointBounds(outline);
    if (
      bounds.minX < masterBounds.minX - 1.5 || bounds.minY < masterBounds.minY - 1.5 ||
      bounds.maxX > masterBounds.maxX + 1.5 || bounds.maxY > masterBounds.maxY + 1.5
    ) {
      issues.push(`${level.label || `Level ${levelIndex}`} extends outside the master building outline. Every floor must belong to the same locked massing.`);
    }

    const roomIds = new Set((level.rooms || []).map((room) => room.id));
    const roomList = level.rooms || [];
    for (let roomIndex = 0; roomIndex < roomList.length; roomIndex += 1) {
      const room = roomList[roomIndex];
      const roomMinX = Number(room.x || 0);
      const roomMinY = Number(room.y || 0);
      const roomMaxX = roomMinX + Number(room.width || 0);
      const roomMaxY = roomMinY + Number(room.height || 0);
      const roomIsOutdoor = isOutdoorCanonicalRoom(room);
      if (
        !roomIsOutdoor && (
          roomMinX < bounds.minX - 0.75 || roomMinY < bounds.minY - 0.75 ||
          roomMaxX > bounds.maxX + 0.75 || roomMaxY > bounds.maxY + 0.75
        )
      ) {
        issues.push(`${level.label || `Level ${levelIndex}`}: ${room.name} extends outside the locked level outline.`);
      }
      for (let otherIndex = roomIndex + 1; otherIndex < roomList.length; otherIndex += 1) {
        const other = roomList[otherIndex];
        // Terraces, balconies, outdoor dining and similar attached exterior
        // zones are allowed to sit outside/along the building edge and may
        // intentionally overlap one another as descriptive use-zones. They
        // are not enclosed room rectangles and must not block Plan Foundation.
        if (roomIsOutdoor || isOutdoorCanonicalRoom(other)) continue;
        const overlapWidth = Math.min(roomMaxX, Number(other.x || 0) + Number(other.width || 0)) - Math.max(roomMinX, Number(other.x || 0));
        const overlapHeight = Math.min(roomMaxY, Number(other.y || 0) + Number(other.height || 0)) - Math.max(roomMinY, Number(other.y || 0));
        if (overlapWidth > 0.75 && overlapHeight > 0.75) {
          issues.push(`${level.label || `Level ${levelIndex}`}: ${room.name} overlaps ${other.name}. Rooms must not occupy the same canonical floor area.`);
        }
      }
    }
    const circulationRoomIds = new Set<string>();
    for (const link of level.circulation || []) {
      if (link.from_room_id) circulationRoomIds.add(link.from_room_id);
      if (link.to_room_id) circulationRoomIds.add(link.to_room_id);
    }

    for (const room of level.rooms || []) {
      if (isOutdoorCanonicalRoom(room)) continue;
      // Openings are edges between spaces, not one-sided room properties.
      // A Bedroom reached by a Hall→Bedroom door is accessible even when the
      // opening record is owned by the Hall side.
      const doorOpenings = (level.openings || []).filter((opening) =>
        /door/.test(opening.type) &&
        (opening.room_id === room.id || String(opening.connects_to || "") === room.id),
      );
      if (!doorOpenings.length) {
        const hasValidOpenPlanConnection = isOpenPlanCanonicalRoom(room) && (level.circulation || []).some((link) => {
          const otherId = link.from_room_id === room.id ? link.to_room_id : link.to_room_id === room.id ? link.from_room_id : null;
          if (!otherId) return false;
          const other = roomList.find((candidate) => candidate.id === otherId);
          return Boolean(other && isOpenPlanCanonicalRoom(other) && sharedOpeningWall(room, other));
        });
        if (hasValidOpenPlanConnection) continue;
        issues.push(`${level.label || `Level ${levelIndex}`}: ${room.name} has no explicit door opening. Every enclosed room must be physically accessible.`);
        continue;
      }
      const hasCirculationEvidence = circulationRoomIds.has(room.id) || doorOpenings.some((opening) => {
        const destination = String(opening.connects_to || "");
        return roomIds.has(destination) || /corridor|hall|landing|lobby|foyer|outside|exterior|entry|core|driveway|site|garden|terrace|balcony|pool/i.test(destination);
      });
      if (!hasCirculationEvidence) {
        issues.push(`${level.label || `Level ${levelIndex}`}: ${room.name} has a door but no clear circulation/access connection.`);
      }
    }

    for (const opening of level.openings || []) {
      if (!/door/.test(opening.type)) continue;
      const sourceRoom = roomList.find((room) => room.id === opening.room_id);
      if (!sourceRoom) {
        issues.push(`${level.label || `Level ${levelIndex}`}: opening ${opening.id} references a missing source room.`);
        continue;
      }
      const destination = String(opening.connects_to || "");
      const targetRoom = roomList.find((room) => room.id === destination);
      const isExternal = /outside|exterior|entry|garden|terrace|balcony|pool|driveway|site/i.test(destination);
      if (!targetRoom && !isExternal) {
        issues.push(`${level.label || `Level ${levelIndex}`}: ${sourceRoom.name} has an internal door whose connects_to value "${destination || "empty"}" is not an actual adjacent room id.`);
        continue;
      }
      if (targetRoom && !roomsShareOpeningWall(sourceRoom, targetRoom, opening.wall)) {
        issues.push(`${level.label || `Level ${levelIndex}`}: door from ${sourceRoom.name} to ${targetRoom.name} is placed on the ${opening.wall} wall, but those rooms do not physically share that wall.`);
      }
    }

  });

  const cores = plan.vertical_cores || [];
  if (levels.length > 1 && !cores.some((core) => core.type === "stair" || core.type === "lift" || core.type === "service_lift")) {
    issues.push("A multi-floor building must define at least one master vertical core shared by its connected levels.");
  }

  for (const core of cores) {
    for (const levelId of core.serves_level_ids || []) {
      const level = levels.find((candidate) => candidate.id === levelId);
      if (!level) {
        issues.push(`Vertical core ${core.id} references missing level ${levelId}.`);
        continue;
      }
      if (core.type === "stair") {
        const matchingStair = (level.stairs || []).find((stair) =>
          nearNumber(stair.x, core.x) && nearNumber(stair.y, core.y)
          && nearNumber(stair.width, core.width) && nearNumber(stair.height, core.height),
        );
        if (!matchingStair) {
          issues.push(`${level.label}: stair core ${core.id} is not stacked at the exact master-core position.`);
        }
      }
    }
  }

  const projectType = String(args.project.project_type || "");
  if (/health|hospital|medical/i.test(projectType)) {
    for (const level of levels) {
      for (const room of level.rooms || []) {
        if (!isPatientBedroom(room)) continue;
        const bedCount = Number(room.capacity_count || 0);
        if (bedCount > 3) {
          issues.push(`${level.label}: ${room.name} carries ${bedCount} beds. Inpatient bedrooms must be modeled as individual 1-, 2- or 3-bed rooms rather than one oversized aggregate room.`);
        }
        const ensuiteOpening = (level.openings || []).some((opening) => {
          if (!/door/.test(opening.type)) return false;
          const source = (level.rooms || []).find((candidate) => candidate.id === opening.room_id);
          const target = (level.rooms || []).find((candidate) => candidate.id === opening.connects_to);
          if (opening.room_id === room.id) {
            return target ? /ensuite|bath|toilet|wc/i.test(target.name) : /ensuite|bath|toilet|wc/i.test(String(opening.connects_to || ""));
          }
          if (String(opening.connects_to || "") === room.id) {
            return source ? /ensuite|bath|toilet|wc/i.test(source.name) : false;
          }
          return false;
        });
        if (!ensuiteOpening) {
          issues.push(`${level.label}: ${room.name} does not have direct ensuite bathroom access.`);
        }
      }
    }

    const routes = plan.circulation_routes || [];
    const publicRoutes = routes.filter((route) => route.type === "public");
    const serviceRoutes = routes.filter((route) => route.type === "service");
    if (!publicRoutes.length || !serviceRoutes.length) {
      issues.push("Healthcare plans must explicitly define separate public and service circulation routes at the canonical-geometry level.");
    } else {
      const intersections = publicRoutes.reduce((total, publicRoute) =>
        total + serviceRoutes.reduce((sum, serviceRoute) => sum + routeIntersectionCount(publicRoute, serviceRoute), 0), 0);
      if (intersections > 1) {
        issues.push(`Healthcare public and service circulation cross ${intersections} times. Re-plan the routes to reduce unnecessary intersections, especially through critical clinical areas.`);
      }
    }
  }

  return issues;
}

function planValidationIssues(args: {
  planSet: LivePlanSet;
  project: Record<string, unknown>;
  site: Record<string, unknown> | null;
}) {
  const issues: string[] = [];
  const projectType = String(args.project.project_type || "Other");
  const capacity = parseCapacityConstraint(projectType, args.project);
  const requestedStoreys = requestedProjectStoreys(args.project, args.site);
  const levels = args.planSet.canonical_plan?.levels || [];

  if (requestedStoreys && levels.length !== requestedStoreys) {
    issues.push(
      `The user requested exactly ${requestedStoreys} floor${requestedStoreys === 1 ? "" : "s"}, but the Canonical Plan contains ${levels.length}.`,
    );
  }

  if (capacity) {
    const generated = generatedCapacityCount(args.planSet.canonical_plan, capacity);
    if (generated < capacity.requestedCount) {
      issues.push(
        `The user requested ${capacity.requestedCount} ${capacity.metric.replace(/_/g, " ")}, but the Canonical Plan accounts for only ${generated}.`,
      );
    }

    if (capacity.metric === "beds") {
      const hasInpatientSpace = levels.some((level) =>
        (level.rooms || []).some((room) =>
          /patient|inpatient|ward|icu/i.test(`${room.name} ${room.zone}`),
        ),
      );
      if (!hasInpatientSpace) {
        issues.push("A bed-based healthcare project must contain inpatient wards/patient rooms; an outpatient-only plan is invalid.");
      }
    }
  }

  return issues;
}

function splitArchitectureSpaceProgram(spaceProgram: Array<Record<string, unknown>>) {
  const normalised = spaceProgram.map((row) => ({
    space_name: String(row.space_name || "").trim(),
    zone: String(row.zone || "Flexible"),
    level: String(row.level || "Ground"),
    quantity: Math.max(1, Number(row.quantity) || 1),
    area_each_m2: Math.max(0, Number(row.area_each_m2) || 0),
    total_area_m2: Math.max(0, Number(row.total_area_m2) || 0),
    priority: String(row.priority || "Required"),
    notes: typeof row.notes === "string" ? row.notes : null,
    is_ai_suggested: row.is_ai_suggested === true,
  })).filter((row) => Boolean(row.space_name));

  return {
    user_defined: normalised.filter((row) => !row.is_ai_suggested),
    ai_suggestions: normalised.filter((row) => row.is_ai_suggested),
    all: normalised,
  };
}

function isCustomArchitectureProjectType(projectType: string) {
  return !ARCHITECTURE_PROJECT_TYPES.includes(projectType);
}

function architectureRequirementSource(args: {
  project: Record<string, unknown>;
  site: Record<string, unknown> | null;
  planning: Record<string, unknown> | null;
  spaceProgram: Array<Record<string, unknown>>;
}) {
  const program = splitArchitectureSpaceProgram(args.spaceProgram);
  const projectType = String(args.project.project_type || "Other");
  const customProjectType = isCustomArchitectureProjectType(projectType);

  return {
    project_type: projectType,
    project_type_is_custom: customProjectType,
    project_name: args.project.project_name || null,
    scope: args.project.scope || null,
    architectural_style: args.project.architectural_style || null,
    selected_spaces: args.project.selected_spaces || [],
    project_notes: args.project.notes || null,
    source_notes: args.project.source_notes || null,
    professional_brief: args.project.professional_brief || {},
    source_brief: args.project.source_brief || {},
    site: args.site,
    planning: args.planning,
    saved_space_program: {
      user_defined: program.user_defined,
      ai_suggestions: customProjectType ? [] : program.ai_suggestions,
      ignored_generic_suggestions: customProjectType ? program.ai_suggestions : [],
      policy: customProjectType
        ? "This is a custom project type. Generic template-generated Space Program rows are placeholders only and must not become hard requirements. User-defined rows remain authoritative."
        : "AI-suggested rows are defaults only. They may guide the plan but are never hard unless independently repeated by the user. User-defined rows marked Required may become hard plan requirements.",
    },
  };
}

function requirementLooksLikeBroadCompliance(requirement: ArchitectureRequirement) {
  const value = `${requirement.category} ${requirement.statement} ${requirement.metric}`.toLowerCase();
  return /\b(comply|compliance|code|regulation|regulatory|functional and safety|safety requirements|best practice|all applicable|standards?)\b/.test(value);
}

function requirementSourceLooksUserAuthored(source: string) {
  return /project_notes|source_notes|professional_brief|user_capacity|source_brief|site\.desired_floors|planning\.|user_defined|custom|explicit/i.test(source);
}

function requirementSourceLooksSuggested(source: string) {
  return /ai_suggestions|template|default|smart suggestion|suggested|selected_spaces/i.test(source);
}

function sanitiseArchitectureRequirementContract(args: {
  contract: ArchitectureRequirementContract;
  project: Record<string, unknown>;
  site: Record<string, unknown> | null;
  spaceProgram: Array<Record<string, unknown>>;
}) {
  const program = splitArchitectureSpaceProgram(args.spaceProgram);
  const suggestedNames = program.ai_suggestions.map((row) => row.space_name.toLowerCase());
  const customProjectType = isCustomArchitectureProjectType(String(args.project.project_type || "Other"));

  const requirements = args.contract.requirements.map((requirement) => {
    let next = { ...requirement };
    const source = String(next.source || "");
    const statement = next.statement.toLowerCase();
    const suggestedMatches = suggestedNames.filter((name) => name && statement.includes(name)).length;
    const derivedFromSuggestedProgram =
      requirementSourceLooksSuggested(source) ||
      (/saved_space_program/i.test(source) && !/user_defined/i.test(source)) ||
      (suggestedMatches >= 2 && !requirementSourceLooksUserAuthored(source));

    if (derivedFromSuggestedProgram) {
      next.priority = "preferred";
      if (customProjectType) next.source = `${source || "saved_space_program"} (generic suggestion only)`;
    }

    if (requirementLooksLikeBroadCompliance(next) && !requirementSourceLooksUserAuthored(source)) {
      next = {
        ...next,
        priority: "assumption",
        validation_scope: "project",
        measurable: false,
        target_value: 0,
        comparison: "qualitative",
      };
    }

    return next;
  });

  return { ...args.contract, requirements };
}

async function extractArchitectureRequirementContract(args: {
  plan: AiPlanConfig;
  project: Record<string, unknown>;
  site: Record<string, unknown> | null;
  planning: Record<string, unknown> | null;
  spaceProgram: Array<Record<string, unknown>>;
}) {
  const requestedStoreys = requestedProjectStoreys(args.project, args.site);
  const result = await structuredCompletion<ArchitectureRequirementContract>({
    plan: args.plan,
    schema: architectureRequirementContractSchema,
    system: [
      "You are Heyy Studio's architecture brief requirements analyst.",
      "Convert the supplied project information into a compact Requirement Contract before any plan is accepted.",
      "This must work for any project type, including custom and unusual projects. Never rely on a fixed list such as beds, hotel rooms, students or seats.",
      "Capture explicit user-authored requirements from free text, capacity fields, professional notes, site information, source rules and saved Space Program.",
      "Explicit user statements are HARD unless they are clearly preferences. AI/template defaults and unverified planning assumptions are PREFERRED or ASSUMPTION, never hard merely because they exist in a template.",
      "Rows under saved_space_program.ai_suggestions are NEVER HARD. They are template guidance only. Rows under saved_space_program.ignored_generic_suggestions must be ignored entirely. Only saved_space_program.user_defined rows may become hard when they are marked Required.",
      "Never convert an automatically suggested Space Program into one combined hard requirement. A custom project type must be understood from the user's project_type and free-form brief, not from generic Other-template placeholders.",
      "The project type itself is context, not permission to invent vague obligations such as 'comply with all functional and safety requirements'. Only explicit, testable requirements from the user's inputs may block the plan stage.",
      "Do not invent requirements that the user did not state or that are not directly implied by a selected project setting.",
      "Assign validation_scope=plan only when the Canonical Plan can prove the requirement through levels, spaces, quantities, capacity, access, adjacencies, site layout, preservation or prohibition.",
      "Use validation_scope=visual for appearance/material/style requirements that a plan cannot prove. Use project for broader requirements that must be carried through the workflow but are not plan-verifiable.",
      "For every measurable requirement, normalize the metric into a short reusable noun phrase, set target_value, unit and comparison. Examples are only illustrative: rooms, beds, apartments, classrooms, courts, loading bays, seats, people, parking spaces, treatment rooms, production lines or animal pens.",
      "For non-measurable requirements use measurable=false, target_value=0 and comparison present/absent/qualitative as appropriate.",
      "If an exact floor count was supplied, it is a hard plan requirement.",
      "Return one requirement per independently testable obligation. Preserve the user's wording in statement/source where useful.",
    ].join(" "),
    payload: {
      source_of_truth: architectureRequirementSource(args),
      deterministic_floor_count: requestedStoreys,
    },
  });

  const sanitised = sanitiseArchitectureRequirementContract({
    contract: result.value,
    project: args.project,
    site: args.site,
    spaceProgram: args.spaceProgram,
  });
  const requirements = [...sanitised.requirements];
  if (requestedStoreys && !requirements.some((item) => item.category === "floor_count")) {
    requirements.unshift({
      id: "explicit-floor-count",
      source: "site.desired_floors/source_brief.desired_floors",
      priority: "hard",
      validation_scope: "plan",
      category: "floor_count",
      statement: `The project must contain exactly ${requestedStoreys} floor${requestedStoreys === 1 ? "" : "s"}.`,
      measurable: true,
      metric: "floors",
      target_value: requestedStoreys,
      unit: "floors",
      comparison: "exactly",
      evidence_hint: "canonical_plan.levels.length",
    });
  }

  return {
    contract: { ...sanitised, requirements },
    usage: result.usage,
  };
}

function normaliseRequirementMetric(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function metricTokens(value: string) {
  return normaliseRequirementMetric(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !["the", "and", "for", "with", "room", "rooms", "area", "spaces"].includes(token));
}

function textMatchesRequirementMetric(text: string, metric: string) {
  const candidate = normaliseRequirementMetric(text);
  const tokens = metricTokens(metric);
  if (!candidate || !tokens.length) return false;
  return tokens.every((token) => candidate.includes(token)) || candidate.includes(normaliseRequirementMetric(metric));
}

function planScheduleAreaForMetric(planSet: LivePlanSet, metric: string) {
  const matches = (planSet.area_schedule || []).filter((item) =>
    textMatchesRequirementMetric(String(item.space || ""), metric),
  );
  if (!matches.length) return null;
  return matches.reduce((sum, item) => sum + Math.max(0, Number(item.approx_area_m2 || 0)), 0);
}

function deterministicObservedRequirement(
  planSet: LivePlanSet,
  requirement: ArchitectureRequirement,
): { supported: boolean; observed: number; evidence: string } {
  const plan = planSet.canonical_plan;
  const metric = normaliseRequirementMetric(requirement.metric);
  const unit = normaliseRequirementMetric(requirement.unit);

  // Area must be checked before floor count. A metric such as "gross floor area"
  // contains the word "floor" but is an area requirement, not a storey count.
  if (/m2|sqm|square metre|square meter/.test(unit) || /\barea\b/.test(metric)) {
    const area = planScheduleAreaForMetric(planSet, requirement.metric);
    return area === null
      ? { supported: false, observed: 0, evidence: "No deterministic area-schedule match." }
      : { supported: true, observed: area, evidence: "planSet.area_schedule" };
  }

  const floorCountMetric = /^(floors?|storeys?|stories?|levels?|floor count|storey count|story count|level count)$/i.test(metric);
  if (requirement.category === "floor_count" || floorCountMetric) {
    return { supported: true, observed: plan.levels?.length || 0, evidence: "canonical_plan.levels.length" };
  }

  let capacityTotal = 0;
  let fixtureTotal = 0;
  let matchingRooms = 0;
  for (const level of plan.levels || []) {
    for (const room of level.rooms || []) {
      if (textMatchesRequirementMetric(`${room.capacity_type || ""} ${room.name || ""} ${room.zone || ""}`, requirement.metric)) {
        matchingRooms += 1;
        capacityTotal += Math.max(0, Number(room.capacity_count || 0));
      }
    }
    for (const fixture of level.fixtures || []) {
      if (textMatchesRequirementMetric(String(fixture.fixture_type || ""), requirement.metric)) {
        fixtureTotal += Math.max(0, Number(fixture.count || 0));
      }
    }
  }

  const countLike = /count|unit|units|room|rooms|bed|beds|seat|seats|person|people|student|staff|guest|bay|bays|space|spaces|court|courts|pen|pens|vehicle|parking/.test(`${unit} ${metric}`);
  if (!countLike) {
    return { supported: false, observed: 0, evidence: "Requirement is not safely countable deterministically." };
  }

  if (capacityTotal > 0 || fixtureTotal > 0) {
    return { supported: true, observed: Math.max(capacityTotal, fixtureTotal), evidence: "canonical room capacity metadata / fixtures" };
  }

  return { supported: true, observed: matchingRooms, evidence: "countable canonical room matches" };
}

function deterministicRequirementIssues(
  planSet: LivePlanSet,
  contract: ArchitectureRequirementContract,
) {
  const issues: string[] = [];
  for (const requirement of contract.requirements) {
    if (requirement.priority !== "hard" || requirement.validation_scope !== "plan") continue;
    if (!requirement.measurable || requirement.target_value <= 0) continue;

    const observation = deterministicObservedRequirement(planSet, requirement);
    if (!observation.supported) continue;

    const observed = observation.observed;
    const target = requirement.target_value;
    const passes = requirement.comparison === "at_least"
      ? observed >= target
      : requirement.comparison === "at_most"
        ? observed <= target
        : requirement.comparison === "exactly"
          ? observed === target
          : true;

    if (!passes) {
      issues.push(`${requirement.id}: ${requirement.statement} Deterministic evidence found ${observed} ${requirement.unit || requirement.metric}; target is ${requirement.comparison.replace(/_/g, " ")} ${target}. Evidence source: ${observation.evidence}.`);
    }
  }
  return issues;
}

async function auditArchitecturePlanRequirements(args: {
  plan: AiPlanConfig;
  contract: ArchitectureRequirementContract;
  planSet: LivePlanSet;
}) {
  return structuredCompletion<ArchitectureRequirementAudit>({
    plan: args.plan,
    schema: architectureRequirementAuditSchema,
    system: [
      "You are Heyy Studio's independent Architecture Requirement auditor.",
      "Audit the generated Canonical Plan against the Requirement Contract. You did not generate the plan and must not give it the benefit of the doubt.",
      "Evaluate every requirement independently. For validation_scope=plan, require concrete evidence in canonical levels, rooms, room capacity metadata, fixtures, circulation, openings, site elements, area schedule or relationships.",
      "For validation_scope=visual or project, mark pass only when the supplied plan data genuinely proves it; otherwise mark uncertain rather than inventing evidence. These non-plan requirements do not block this plan stage.",
      "For hard plan requirements, uncertain is not acceptable: if evidence is missing, use fail or uncertain and explain what is absent.",
      "Do not audit AI/template Space Program suggestions as hard requirements. Do not turn broad code/compliance/safety language into a plan failure unless the Requirement Contract contains a specific user-authored, plan-verifiable obligation.",
      "Quantitative requirements must reconcile with explicit counts, capacity metadata or clearly countable spaces. Do not infer a number from a room name alone when the requested quantity is larger than one.",
      "Presence, absence, preservation, access and relationship requirements must point to specific rooms, openings, circulation links, levels or site elements as evidence.",
      "overall_pass means every HARD requirement with validation_scope=plan is pass.",
    ].join(" "),
    payload: {
      requirement_contract: args.contract,
      generated_plan: args.planSet,
    },
  });
}

function hardPlanAuditFailures(
  contract: ArchitectureRequirementContract,
  audit: ArchitectureRequirementAudit,
) {
  const byId = new Map(audit.checks.map((check) => [check.requirement_id, check]));
  return contract.requirements.flatMap((requirement) => {
    if (requirement.priority !== "hard" || requirement.validation_scope !== "plan") return [];
    const check = byId.get(requirement.id);
    // The independent AI audit is a secondary safeguard, not the geometry source of truth.
    // Only an explicit contradiction may block Plan Foundation generation. Missing or
    // uncertain audit evidence must not randomly fail an otherwise deterministic plan.
    if (!check || check.status === "pass" || check.status === "uncertain") return [];
    return [
      `${requirement.id}: ${requirement.statement} Audit status: ${check.status}. ${check.reason || "The audit found explicit conflicting evidence."}`,
    ];
  });
}

function floorVisualTypeForIndex(index: number) {
  if (index <= 0) return "ground_floor";
  if (index === 1) return "upper_floor";
  return `level_${index}_floor`;
}

function floorIndexFromVisualType(visualType: string) {
  if (visualType === "ground_floor") return 0;
  if (visualType === "upper_floor") return 1;
  const match = visualType.match(/^level_(\d+)_floor$/);
  return match ? Number(match[1]) : null;
}

function isFloorPlanVisualType(visualType: string) {
  return floorIndexFromVisualType(visualType) !== null;
}

function floorPlanTitle(level: CanonicalPlanLevel | undefined, index: number) {
  const label = String(level?.label || "").trim();
  if (!label) return index === 0 ? "Ground Floor Plan" : `Level ${index} Plan`;
  if (/\bplan\b/i.test(label)) return label;
  return `${label} Plan`;
}

function rendererPlanForFloor(plan: CanonicalPlanSpec, visualType: string) {
  const index = floorIndexFromVisualType(visualType);
  if (index === null || index <= 1) {
    return { plan, rendererVisualType: visualType };
  }

  const target = plan.levels?.[index];
  const ground = plan.levels?.[0];
  if (!target || !ground) {
    return { plan, rendererVisualType: "upper_floor" };
  }

  return {
    plan: {
      ...plan,
      levels: [ground, target],
    },
    rendererVisualType: "upper_floor",
  };
}

export async function generateArchitectureDirection(args: {
  plan: AiPlanConfig;
  directionNumber: number;
  project: Record<string, unknown>;
  site: Record<string, unknown> | null;
  planning: Record<string, unknown> | null;
  selectedMaterials: Array<Record<string, unknown>>;
  spaceProgram?: Array<Record<string, unknown>>;
  planFoundation?: Record<string, unknown> | null;
}) {
  const letter = String.fromCharCode(64 + args.directionNumber);
  const projectType = String(args.project.project_type || "Other");
  const template = getArchitectureProjectTemplate(projectType);
  const requestedStoreys = requestedProjectStoreys(args.project, args.site);

  const system = [
    "You are Heyy Studio's senior conceptual architect.",
    "Create one clearly differentiated architectural direction from the supplied project data AND one Direction Geometry Contract for that same direction in the same response.",
    args.planFoundation
      ? "EXISTING-GEOMETRY MODE: an approved plan foundation already defines the building geometry. Do not invent, move, rotate, enlarge, shrink or replace the footprint, storeys, vertical cores, pool/site placement, entry relationship or major indoor-outdoor layout. Develop architectural character around that exact plan foundation."
      : "DIRECTION-FIRST MODE: establish the architectural route before exact room geometry is developed. The Direction Geometry Contract must lock the visible site/massing anchors that the future Direction image and Canonical Plan will share: front/street edge, storey count, ground and upper massing outlines, entry position, garage/driveway position, pool position, outdoor-living zone and primary vertical-core zone.",
    "The geometry contract is NOT a detailed floor plan and must not invent hidden room layouts. It is a coarse but spatially explicit 0–100 site-grid skeleton that both the Direction render and future Plan Foundation must obey.",
    "Coordinate system: x increases west→east; y increases north→south. Every geometry-contract point and rectangle uses that same 0–100 site grid.",
    "Keep the ground massing comfortably inside the site grid. Put the main entry anchor on the actual facade edge identified by entry.edge. entry.position_0_100 is measured along that same facade edge from left/top toward right/bottom.",
    "If the brief/programme requires a garage, place the garage rectangle so it intersects the ground building outline and place the driveway next to it with access from the stated site edge. If no garage is requested or reasonably implied, set garage.present=false and driveway.present=false rather than inventing them.",
    "If the brief/programme requires a pool, the pool rectangle MUST be fully outside the ground building outline. Never represent the pool as an internal building room. If no pool is requested, set pool.present=false rather than inventing one.",
    "For multi-storey projects, provide one upper_level_outlines entry for every upper level. Upper outlines may step back, omit wings or cantilever only when that is part of the selected massing idea. Do not simply duplicate the ground outline unless that is genuinely the chosen massing.",
    "For multi-storey projects, vertical_core.required=true and its zone must be plausible inside the ground outline and reusable in the same position on every served level.",
    requestedStoreys
      ? `HARD FLOOR COUNT: the Direction and geometry_contract.storeys must both preserve exactly ${requestedStoreys} storey${requestedStoreys === 1 ? "" : "s"}.`
      : "If floor count is not explicitly supplied, choose a credible storey count from the programme, capacity, site and target area instead of defaulting automatically to two storeys.",
    `This is a ${projectType} project. Never default to residential language unless the project type is residential.`,
    `Focus on the correct users, operations and spatial priorities: ${template.directionFocus.join(", ")}.`,
    "Treat explicit user capacity, floor-count, parking, pool, access and other site inputs as hard design requirements, not optional inspiration.",
    "If a healthcare brief specifies beds, the direction must describe a genuine inpatient hospital strategy with wards/patient rooms and the clinical/service systems needed to support that bed count; do not turn it into an outpatient clinic.",
    "Write concise but complete professional content suitable for an architecture design pack.",
    "The direction.image_prompt must explicitly describe the SAME spatial anchors as geometry_contract in plain visual language. Do not write an image prompt that mirrors, rotates, swaps or relocates the entry, garage, driveway, pool, outdoor living or main massing.",
    "geometry_contract.must_preserve must include the most important spatial anchors that later plan generation and visuals are forbidden to move.",
    safetyInstruction,
  ].join(" ");

  const payload = {
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
    approved_plan_foundation: args.planFoundation || null,
    saved_space_program: args.spaceProgram || [],
    selected_materials: args.selectedMaterials,
    project_type_template: template,
    hard_project_requirements: {
      capacity_text: projectCapacityText(args.project) || null,
      parsed_capacity: parseCapacityConstraint(projectType, args.project),
      requested_storeys: requestedStoreys,
    },
    geometry_contract_rules: {
      source_of_truth: "Create the architectural direction and spatial contract together. The render must be generated from the contract; the future Plan Foundation must use the same contract rather than reverse-engineering the render.",
      site_grid: "0–100; x west→east; y north→south",
      entry: "Lock facade edge + position + anchor.",
      garage_driveway: "Lock side/position and vehicle approach when required.",
      pool: "Exterior-only site element; lock position/relationship when required; never place inside building.",
      upper_levels: "Explicit outline/setback relationship for every upper storey.",
      vertical_core: "One shared core zone for multi-storey projects.",
    },
    mandatory_disclaimer: "Conceptual architecture only; professional local verification is required.",
  };

  const first = await structuredCompletion<LiveDirectionGeneration>({
    plan: args.plan,
    schema: directionGenerationSchema,
    system,
    payload,
  });

  let generation = first.value;
  let geometryContract = directionGeometryContractFromUnknown(generation.geometry_contract);
  let issues = geometryContract
    ? validateDirectionGeometryContract(geometryContract)
    : ["Direction Geometry Contract could not be parsed."];
  let correctionUsage: unknown = null;

  if (issues.length) {
    const corrected = await structuredCompletion<LiveDirectionGeneration>({
      plan: args.plan,
      schema: directionGenerationSchema,
      system: [
        system,
        "The first Direction Geometry Contract failed deterministic spatial validation. Return a complete corrected direction + geometry contract; do not explain the error.",
        ...issues.map((issue, index) => `${index + 1}. ${issue}`),
        "Correct the contract and make direction.image_prompt describe the corrected contract exactly. Preserve explicit user requirements and the requested differentiated design character.",
      ].join(" "),
      payload: {
        ...payload,
        previous_generation_to_correct: generation,
        geometry_validation_failures: issues,
      },
    });
    generation = corrected.value;
    correctionUsage = corrected.usage;
    geometryContract = directionGeometryContractFromUnknown(generation.geometry_contract);
    issues = geometryContract
      ? validateDirectionGeometryContract(geometryContract)
      : ["Corrected Direction Geometry Contract could not be parsed."];
  }

  if (!geometryContract || issues.length) {
    throw new Error(`Architecture Direction geometry validation failed: ${issues.join(" ")}`);
  }

  if (requestedStoreys && geometryContract.storeys !== requestedStoreys) {
    throw new Error(`Architecture Direction geometry validation failed: expected exactly ${requestedStoreys} storeys but received ${geometryContract.storeys}.`);
  }

  return {
    direction: generation.direction,
    geometryContract,
    geometryPrompt: directionGeometryContractPrompt(geometryContract),
    usage: {
      generation: first.usage,
      correction: correctionUsage,
    },
  };
}

export async function generateArchitectureDna(args: {
  plan: AiPlanConfig;
  project: Record<string, unknown>;
  direction: Record<string, unknown>;
  site: Record<string, unknown> | null;
  selectedMaterials: Array<Record<string, unknown>>;
}) {
  const directionJson = objectRecord(args.direction.generation_json);
  const directionGeometryContract = directionGeometryContractFromUnknown(directionJson.direction_geometry_contract);
  return structuredCompletion<ArchitectureDna>({
    plan: args.plan,
    schema: architectureDnaSchema,
    system: [
      "You are Heyy Studio's visual continuity architect.",
      "Convert the selected Architecture Direction into one strict Architecture DNA record.",
      "This record is a non-negotiable identity lock for every later concept image, floor-plan diagram and architectural visual.",
      "Use the selected direction as the source of truth. Resolve ambiguity into specific, repeatable visual rules.",
      directionGeometryContract ? "A Direction Geometry Contract is supplied. Its spatial anchors are stricter than descriptive prose: do not move, mirror or contradict its entry, garage/driveway, pool/outdoor relationship, storey count, upper-level massing or primary core zone." : "",
      "Explicit user programme requirements override a vague storey assumption in the direction text.",
      "If the user supplied desired_floors, architecture_dna.storeys must equal that exact number.",
      "If floors were not supplied, architecture_dna.storeys must be a credible programme-driven number based on requested capacity, target area and site. Do not automatically choose two storeys for large hospitals, hotels, schools or mixed-use projects.",
      "Resolve the selected Direction into explicit plan-facing massing rules: footprint_shape, plan_massing_logic, vertical_core_strategy and upper_level_setback_strategy. These fields must describe the same visible building implied by the selected Direction image_prompt/form strategy so later plans cannot invent a different footprint.",
      "The prohibited_changes list must explicitly prevent redesigning the property into a different building.",
      safetyInstruction,
    ].join(" "),
    payload: {
      project: args.project,
      selected_direction: args.direction,
      direction_geometry_contract: directionGeometryContract,
      site: args.site,
      selected_materials: args.selectedMaterials,
      hard_project_requirements: {
        capacity_text: projectCapacityText(args.project) || null,
        parsed_capacity: parseCapacityConstraint(String(args.project.project_type || "Other"), args.project),
        requested_storeys: requestedProjectStoreys(args.project, args.site),
      },
    },
  }).then(({ value, usage }) => {
    const requestedStoreys = requestedProjectStoreys(args.project, args.site);
    return {
      architectureDna: requestedStoreys
        ? { ...value, storeys: requestedStoreys }
        : value,
      usage,
    };
  });
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
  const directionJson = objectRecord(args.direction.generation_json);
  const directionGeometryContract = directionGeometryContractFromUnknown(directionJson.direction_geometry_contract);
  return structuredCompletion<LiveConcept>({
    plan: args.plan,
    schema: conceptSchema,
    system: [
      "You are Heyy Studio's senior conceptual architect preparing a selected-direction concept strategy.",
      "Translate the selected direction into a clear spatial, environmental and material concept without redesigning the building.",
      directionGeometryContract ? "Preserve the Direction Geometry Contract as a non-negotiable spatial skeleton; do not mirror or relocate its entry, garage/driveway, pool/outdoor relationship, storey count, upper-level massing or primary core zone." : "",
      "Use the saved Space Program as client intent, but never let an incomplete saved programme erase a hard user capacity requirement.",
      "Explicit bed, room, unit, student, staff, seat or other capacity requirements must be carried forward into the spatial strategy.",
      "If a healthcare brief specifies beds, the concept must include inpatient accommodation and supporting clinical/service zoning, not only reception, diagnostics and outpatient rooms.",
      "The concept image prompt must request an architectural concept presentation board, not another standalone facade render.",
      "The board should combine the exact Master Architecture Reference with clear visual studies such as massing evolution, site response, zoning, circulation, sun/orientation, material palette and indoor-outdoor relationships.",
      "It must preserve the Architecture DNA, including massing, roof geometry, facade rhythm, window language, material locations and signature elements.",
      safetyInstruction,
      imagePromptInstruction,
    ].join(" "),
    payload: {
      project: args.project,
      selected_direction: args.direction,
      direction_geometry_contract: directionGeometryContract,
      architecture_dna: args.architectureDna,
      site: args.site,
      planning_assumptions: args.planning,
      selected_materials: args.selectedMaterials,
      saved_space_program: architectureRequirementSource({
        project: args.project,
        site: args.site,
        planning: args.planning,
        spaceProgram: args.spaceProgram,
      }).saved_space_program,
      hard_project_requirements: {
        capacity_text: projectCapacityText(args.project) || null,
        parsed_capacity: parseCapacityConstraint(String(args.project.project_type || "Other"), args.project),
        requested_storeys: requestedProjectStoreys(args.project, args.site),
      },
    },
  }).then(({ value, usage }) => ({ concept: value, usage }));
}

function expandedPlanViews(planSet: LivePlanSet, architectureDna: ArchitectureDna) {
  const levels = Array.isArray(planSet.canonical_plan?.levels)
    ? planSet.canonical_plan.levels
    : [];
  const identity = architectureDna.identity_name || "Selected Architecture Direction";
  const floorViews: LivePlanSet["plan_images"] = levels.map((level, index) => ({
    visual_type: floorVisualTypeForIndex(index),
    title: floorPlanTitle(level, index),
    prompt: index === 0
      ? "Coordinated ground-floor plan with room names, approximate areas, entry, openings, capacity-bearing spaces and outdoor relationships."
      : `Coordinated ${String(level.label || `Level ${index}`).toLowerCase()} plan aligned with the same footprint, structure, vertical circulation and programme. This floor is part of the same canonical multi-floor building.`,
  }));

  const views: LivePlanSet["plan_images"] = [
    { visual_type: "plan_foundation_sheet", title: "Coordinated Plan Foundation", prompt: "One deterministic coordinated sheet containing every canonical floor from the same building model." },
    ...floorViews,
    { visual_type: "functional_zoning", title: "Functional Zoning", prompt: "Colour-coded functional zones derived from the same canonical multi-floor geometry." },
    { visual_type: "site_plan", title: "Site Plan", prompt: "Coordinated site plan showing the same footprint, access, driveway, pool, landscape, orientation and conceptual setbacks." },
    { visual_type: "circulation", title: "Circulation Diagram", prompt: "Public, patient/guest/resident, staff, service and outdoor movement derived from the same canonical room relationships and vertical circulation." },
    { visual_type: "north_elevation", title: "North Elevation", prompt: `Orthographic north elevation of ${identity}, preserving the selected massing, exact canonical storey count, roof, facade rhythm, openings and materials.` },
    { visual_type: "south_elevation", title: "South Elevation", prompt: `Orthographic south elevation of ${identity}, preserving the selected massing, exact canonical storey count, roof, facade rhythm, openings and materials.` },
    { visual_type: "east_elevation", title: "East Elevation", prompt: `Orthographic east elevation of ${identity}, preserving the selected massing, exact canonical storey count, roof, facade rhythm, openings and materials.` },
    { visual_type: "west_elevation", title: "West Elevation", prompt: `Orthographic west elevation of ${identity}, preserving the selected massing, exact canonical storey count, roof, facade rhythm, openings and materials.` },
    { visual_type: "section_longitudinal", title: "Longitudinal Section A—A", prompt: `True vertical longitudinal building section A—A through ${identity}. The cut line must be marked on every relevant floor plan with architectural section symbols and direction arrows. Pass through the stair/vertical circulation where possible and show every canonical level, foundations, slabs, floor-to-floor heights, clear ceiling heights, doors, windows, stair flights and landings, roof build-up and site levels.` },
    { visual_type: "section_transverse", title: "Transverse Section B—B", prompt: `True vertical transverse building section B—B through ${identity}, perpendicular to A—A. The cut line must be marked on every relevant floor plan with architectural section symbols and direction arrows. Show every canonical level, cut walls and slabs, projected interior elements, floor levels, door/window heights, roof, foundations and the relationship between principal spaces.` },
    { visual_type: "perspective_front", title: "Front Perspective", prompt: `Front three-quarter perspective of the exact same ${identity}, preserving the canonical storey count.` },
    { visual_type: "perspective_rear", title: "Rear Perspective", prompt: `Rear three-quarter perspective of the exact same ${identity}, showing the primary outdoor relationship and preserving the canonical storey count.` },
    { visual_type: "perspective_aerial", title: "Aerial Perspective", prompt: `Oblique aerial perspective of the exact same ${identity}, coordinated with the canonical site plan and all canonical floors.` },
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
  directionGeometryContract?: DirectionGeometryContract | null;
  planFoundationMode?: boolean;
  existingPlan?: LivePlanSet;
  adjustmentInstruction?: string;
  adjustmentScope?: "local_area" | "current_floor" | "all_connected";
}) {
  const adjustmentInstruction = args.adjustmentInstruction?.trim();
  const isAdjustment = Boolean(args.existingPlan && adjustmentInstruction);
  const projectType = String(args.project.project_type || "Other");
  const capacityConstraint = parseCapacityConstraint(projectType, args.project);
  const requestedStoreys = requestedProjectStoreys(args.project, args.site);

  // Plan Foundation is intentionally a fast concept-planning stage. Do not run the
  // multi-call Requirement Contract extraction/audit pipeline here; it made a simple
  // concept plan slow and brittle (and could reject otherwise usable plans because
  // inferred metrics were missing). The complete project brief and Space Program are
  // still supplied directly to the plan generator below. Keep the heavier contract
  // workflow only for legacy/non-foundation plan generation.
  const requirementResult = args.planFoundationMode
    ? {
        contract: {
          summary: "Plan Foundation uses the project brief, site and Space Program directly.",
          requirements: requestedStoreys
            ? [{
                id: "explicit-floor-count",
                source: "site.desired_floors/source_brief.desired_floors",
                priority: "hard" as const,
                validation_scope: "plan" as const,
                category: "floor_count",
                statement: `The project must contain exactly ${requestedStoreys} floor${requestedStoreys === 1 ? "" : "s"}.`,
                measurable: true,
                metric: "floors",
                target_value: requestedStoreys,
                unit: "floors",
                comparison: "exactly" as const,
                evidence_hint: "canonical_plan.levels.length",
              }]
            : [],
        } satisfies ArchitectureRequirementContract,
        usage: null,
      }
    : await extractArchitectureRequirementContract({
        plan: args.plan,
        project: args.project,
        site: args.site,
        planning: args.planning,
        spaceProgram: args.spaceProgram,
      });
  const requirementContract = requirementResult.contract;

  const hardPlanRequirements = requirementContract.requirements.filter(
    (requirement) => requirement.priority === "hard" && requirement.validation_scope === "plan",
  );

  const baseSystem = [
    "You are Heyy Studio's senior conceptual architect preparing one internally coordinated, non-construction concept plan set.",
    "Create exactly one Canonical Plan Specification. Every plan view must derive from this same site, footprint, room coordinates, circulation and entry.",
    "The supplied Requirement Contract is the source of truth for user intent. This system must work for any project type or custom requirement; do not rely on a narrow set of hard-coded examples.",
    "Satisfy every HARD requirement with validation_scope=plan. Preferred requirements should be satisfied when they do not conflict with hard requirements, site constraints or each other. Assumptions may be changed when needed and must never override explicit user requirements.",
    "For every measurable hard plan requirement, make the evidence machine-checkable. Use canonical room names plus capacity_type/capacity_count or explicit fixtures/counts so the requested quantity can be audited later.",
    "For requirements about presence, absence, separation, adjacency, access, preservation or prohibition, represent the evidence explicitly in rooms, circulation, openings, site elements, level assignments or planning assumptions.",
    "Never silently omit an explicit requirement because the template Space Program is incomplete. The Requirement Contract overrides generic defaults.",
    requestedStoreys
      ? `HARD FLOOR COUNT: canonical_plan.levels must contain exactly ${requestedStoreys} distinct levels. Do not reduce, merge or omit floors.`
      : "No exact floor count was supplied. Choose a credible number of levels from the complete requirement contract, programme, capacity, site, target area and operational needs. Do not automatically default large or complex projects to two floors.",
    capacityConstraint
      ? `A legacy deterministic capacity parser also recognized at least ${capacityConstraint.requestedCount} ${capacityConstraint.metric.replace(/_/g, " ")}. Treat this as supporting evidence, not as the only type of requirement the system understands.`
      : "Do not assume the absence of a recognized legacy capacity metric means there is no capacity requirement; use the universal Requirement Contract.",
    "For every canonical room, set capacity_type and capacity_count. Use capacity_count=0 and capacity_type='' when the room carries no measurable programme quantity. For capacity-bearing rooms, use the same normalized metric language as the Requirement Contract wherever practical.",
    "Coordinates use a 0 to 100 site grid. All rooms, pool, driveway, entry and footprint must fit within that grid.",
    "SITE ELEMENT RULE: pool, garden, yard, driveway and landscape zones are not interior rooms. Never put a room named Pool inside canonical_plan.levels[].rooms. The pool exists only in canonical_plan.pool. Terraces/balconies may appear in a level only when they are actual building-attached floor areas and must remain outside enclosed room geometry.",
    "Use the full coordinate canvas: distribute each level between approximately 8 and 92 rather than clustering rooms in one small corner.",
    "Rooms on the same level must not overlap. Align shared walls, keep circulation legible and give every room a practical minimum width and height.",
    "Create a mostly contiguous architectural footprint. Avoid isolated floating room boxes; gaps are allowed only for real courtyards, patios, light wells or separated service buildings when the brief requires them.",
    "Use project-type-appropriate adjacencies and operational logic. Never apply residential adjacency rules to non-residential projects unless the brief explicitly asks for residential functions.",
    "For every level, define a real opening schedule. Include the main entry door, internal doors for every enclosed room, exterior windows for occupied rooms where relevant, and explicit exterior/service access where required.",
    "Every room must be reachable through the circulation graph and opening schedule. Respect any requirement for separated public/private/staff/service/secure circulation rather than collapsing all movement into one route.",
    "Define stairs/vertical circulation whenever the project has more than one level. Vertical circulation must align between connected levels and open into usable halls or landings.",
    "Define representative fixtures/equipment appropriate to the actual project and to measurable requirements, so the detailed plan can visually demonstrate that the brief was satisfied.",
    "Define at least two perpendicular architectural section cuts in canonical_plan.section_cuts. Label them A—A and B—B, specify the cut axis and viewing direction, and list the rooms crossed by each cut.",
    "At least one section cut must pass through the principal vertical circulation so the section can show floor-to-floor relationships.",
    args.planFoundationMode
      ? "DIRECTION-LED PLAN FOUNDATION MODE IS ACTIVE. The user has already selected an Architecture Direction. Translate that approved Direction together with the brief, site, planning information, Space Program and Requirement Contract into one Canonical Plan. The selected Direction governs massing intent, storey logic, entry/site response, roof/facade intent and spatial priorities; the Canonical Plan you create now becomes the exact geometry authority for all later Concept Visuals and the Design Pack."
      : "All levels must align vertically and describe one single building represented by the selected Architecture Direction and Architecture DNA.",
    args.planFoundationMode && args.directionGeometryContract
      ? [
          "A DIRECTION GEOMETRY CONTRACT was created at the same time as the selected Direction, before its image was rendered. It is the shared spatial parent of the Direction render and this Canonical Plan.",
          "A LOCKED PLAN FOUNDATION STRUCTURE is also supplied in the payload. Copy its exact storey count, level_index order, level ids, labels, outlines and shared vertical core. You design the rooms inside that structure; you do not redesign or omit the structure itself.",
          "Treat its front/street edge, storey count, ground/upper massing outlines, entry, garage/driveway, pool/outdoor-living relationship and primary vertical-core zone as non-negotiable spatial anchors.",
          "Do NOT reverse-engineer room geometry from the Direction image. Fit the user Space Program into the contract skeleton while preserving these anchors.",
          directionGeometryContractPrompt(args.directionGeometryContract),
        ].join(" ")
      : "",
    args.planFoundationMode
      ? "Create one explicit canonical building_outline polygon by translating the SELECTED DIRECTION's massing/form strategy into the site envelope, programme, access, outdoor requirements and room relationships. Do not invent a second architectural identity that conflicts with the selected Direction."
      : "Translate architecture_dna.massing, roof_form, entry_expression and visual_prompt_anchor into one explicit canonical building_outline polygon. The master outline is the geometry lock for the building massing; do not let each floor invent its own unrelated perimeter.",
    args.planFoundationMode
      ? "Every level must return level.outline. Ground defines the primary footprint. Upper floors must stack logically over the lower floor, stay within the master outline unless a legitimate cantilever is explicitly required, and keep stairs/cores aligned exactly."
      : "Every level must return level.outline. The ground-floor outline should normally match the master building_outline. Upper floors may step back or omit wings only when that is consistent with the selected Direction massing; they must remain inside the master outline.",
    "Create canonical_plan.vertical_cores as master coordinates for stairs, lifts and shafts. These are NOT level-specific suggestions. Every served floor must use the exact same x, y, width and height for the same core.",
    "The legacy level.stairs entries must mirror the corresponding master stair core coordinates exactly so old renderers and section logic remain compatible.",
    "Create canonical_plan.circulation_routes as real geometric route spines with points on the same 0-100 grid. Routes that serve several floors preserve the same geometric spine on those floors unless the programme explicitly requires a transfer.",
    "Model corridors, halls and landings as real spatial geometry, not only abstract relationships. Every occupied room must connect to a corridor, hall, landing or valid adjacent room through a physical opening.",
    "For every INTERNAL door, opening.connects_to MUST be the exact id of the adjacent target room/corridor/hall on the same level. The two rooms must physically share the wall named by opening.wall. Never place a door on a wall that does not touch its destination.",
    "Every level.circulation relationship between two rooms must be backed by at least one explicit door/sliding-door opening between those same room ids unless the connection is an open-plan boundary. Do not create floating doors or symbolic doors disconnected from walls.",
    "Align wet/service cores, primary structural zones and major facade openings between levels. Higher floors must respond to lower-floor geometry rather than becoming unrelated layouts.",
    "Every enclosed room must have at least one explicit door in level.openings and a clear circulation connection. A circulation relationship by itself is not a substitute for a physical door.",
    "Do not create unreachable rooms, disconnected departments, stairs that move between floors, or corridors that stop before the rooms they are meant to serve.",
    "For healthcare/hospital projects, use explicit public, clinical/staff, service and emergency circulation logic where applicable. Keep public and service routes separate through critical clinical areas whenever practical. Model inpatient bedrooms as actual 1-, 2- or 3-bed rooms when the user requests that room mix, and give each inpatient bedroom direct access to its own ensuite bathroom. Do not interpret this as every hospital department needing a private bathroom.",
    "Use realistic room proportions and circulation widths. Avoid extremely long, narrow or oversized spaces unless the brief explicitly requires them.",
    "Do not create alternative floor plans. Do not allow each diagram to invent a different property.",
    "The plan_images array in the schema is only a compact legacy presentation list. Heyy Studio automatically creates one visible plan card for every canonical level after generation.",
    "Include functional_zoning, ground_floor, upper_floor when two or more storeys exist, site_plan and circulation in the compact plan_images array.",
    ...(isAdjustment
      ? [
          "This request is a controlled adjustment to an existing coordinated plan set, not a new design.",
          "Use existing_plan as the source of truth and preserve every unaffected room, coordinate, opening, stair, fixture, section cut, footprint, site element, area and relationship.",
          "Apply only adjustment_request.instruction at the requested scope. Make the smallest coordinated change that satisfies it.",
          "The Requirement Contract still applies after the adjustment; do not fix the requested local change by breaking another hard requirement.",
          "Return the complete updated plan set in the normal schema, including all unchanged data as well as the adjusted data.",
        ]
      : []),
    safetyInstruction,
  ].filter(Boolean).join(" ");

  const payload: Record<string, unknown> = {
    project: args.project,
    workflow_authority: args.planFoundationMode
      ? "SELECTED DIRECTION → PLAN FOUNDATION: the approved Direction defines design intent; this Canonical Plan locks exact geometry for all later visuals."
      : "SELECTED DIRECTION: geometry must remain coordinated with the approved direction.",
    selected_direction: args.direction,
    architecture_dna: args.architectureDna,
    selected_direction_geometry_contract: args.directionGeometryContract || null,
    locked_plan_foundation_structure: args.planFoundationMode
      ? lockedPlanFoundationStructure(args.directionGeometryContract, requestedStoreys)
      : null,
    concept: args.planFoundationMode ? null : args.concept,
    site: args.site,
    planning_assumptions: args.planning,
    selected_materials: args.selectedMaterials,
    saved_space_program: architectureRequirementSource({
      project: args.project,
      site: args.site,
      planning: args.planning,
      spaceProgram: args.spaceProgram,
    }).saved_space_program,
    requirement_contract: requirementContract,
    hard_plan_requirements: hardPlanRequirements,
    legacy_supporting_checks: {
      parsed_capacity: capacityConstraint,
      requested_storeys: requestedStoreys,
    },
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
      requirement_evidence: "Every hard plan requirement must have explicit evidence in the canonical model. Quantities use capacity_type/capacity_count or countable rooms/fixtures; relationships use circulation/openings/level placement/site elements.",
      same_property_rule: args.planFoundationMode
        ? "Every level and diagram is the same property and uses one locked master building outline, one site arrangement and one common coordinate system. The selected Direction informs the plan; this Plan Foundation controls all later Concept Visuals."
        : "Every level and diagram is the same property and uses one locked master building outline, one site arrangement and one coordinated massing logic derived from the selected Direction.",
      building_outline_rules: args.planFoundationMode
        ? "building_outline is the master geometry authority created from the selected Direction plus brief/site/programme. Ground normally matches it; upper levels must coordinate vertically and preserve exact shared cores. Later visuals are not allowed to replace it."
        : "building_outline is the master massing footprint polygon. Every level.outline is coordinated to it; ground normally matches it and upper levels may only step back within it when consistent with the selected Architecture DNA.",
      opening_rules: "Every enclosed room has an explicit door in level.openings and a valid circulation/access path; occupied rooms have appropriate exterior openings where relevant; required access/separation is explicit.",
      direction_geometry_contract: args.directionGeometryContract
        ? "The selected Direction Geometry Contract is the non-negotiable parent of both the Direction render and this Plan Foundation. Preserve its front edge, storey count, entry, garage/driveway, pool/outdoor relationship, massing outlines and shared vertical-core zone while fitting the saved Space Program inside. Hidden room planning comes from the brief/programme; do not infer it from pixels."
        : "Use the selected Direction text and Architecture DNA as the design-intent source.",
      vertical_rules: "vertical_cores are master coordinates. The same stair/lift/shaft has identical x, y, width and height on every served level; level.stairs mirrors master stair cores exactly.",
      circulation_geometry: "circulation_routes contain geometric route spines on the same 0-100 grid so circulation is coordinated across floors instead of being redrawn independently.",
      healthcare_coordination: "Hospital plans explicitly model public/service/clinical circulation logic and inpatient bedroom-to-ensuite access. User-requested 1/2/3-bed room mixes are represented as real patient bedrooms, not aggregate empty ward rectangles.",
      section_rules: "Provide perpendicular A—A and B—B section cuts. At least one passes through vertical circulation; both are marked on floor plans and produce true vertical sections with level and height information.",
      fixture_rules: "Include representative project-specific fixtures/equipment so usability and measurable requirements can be audited and visibly represented.",
      diagram_renderer: "Deterministic Heyy Studio technical renderer. Floor-plan geometry, labels, dimensions and alignment are rendered directly from the canonical model; GPT Image must not redraw canonical floor plans.",
    },
  };

  const first = await structuredCompletion<LivePlanSet>({
    plan: args.plan,
    schema: planSchema,
    system: baseSystem,
    payload,
  });

  let value = prepareCanonicalPlanCandidate(first.value, args.directionGeometryContract, args.planFoundationMode ? requestedStoreys : null);
  let correctionUsage: unknown = null;
  let correctionAuditUsage: unknown = null;

  // Direction-led Plan Foundation: generate → deterministic validation → model correction.
  // Never repair a bad architectural layout by repacking rooms into generic rows.
  // If the model cannot satisfy the shared Direction Geometry Contract after two
  // correction attempts, fail the paid generation so the credit lifecycle can refund it.
  if (args.planFoundationMode) {
    const buildFromScratch = String(args.project.workflow_mode || "") === "build_from_scratch";
    if (buildFromScratch && !args.directionGeometryContract) {
      throw new Error("The selected Design Direction is missing its Geometry Contract. Regenerate the selected Direction and its visual before preparing the Plan Foundation.");
    }

    const foundationIssues = (candidate: LivePlanSet) => [
      ...planValidationIssues({ planSet: candidate, project: args.project, site: args.site }),
      ...geometryCoordinationIssues({ planSet: candidate, project: args.project }),
      ...(args.directionGeometryContract
        ? validateCanonicalPlanAgainstDirectionContract(candidate.canonical_plan, args.directionGeometryContract)
        : []),
    ];

    let deterministicIssues = [...new Set(foundationIssues(value))];
    const correctionUsages: unknown[] = [];

    // Repair Canonical Plan geometry only. The earlier implementation asked
    // the model to regenerate the entire plan set for every correction, which
    // frequently introduced a new floor, rewrote room assignments, or created
    // fresh overlaps while fixing another one. Returning only canonical_plan
    // keeps the problem small and preserves the already-generated narrative.
    for (let correctionAttempt = 1; correctionAttempt <= 2 && deterministicIssues.length; correctionAttempt += 1) {
      const corrected = await structuredCompletion<{ canonical_plan: CanonicalPlanSpec }>({
        plan: args.plan,
        schema: canonicalPlanRepairSchema,
        system: [
          "You are Heyy Studio's architectural geometry correction engine. Repair only the supplied Canonical Plan; return canonical_plan only.",
          `This is correction pass ${correctionAttempt} of 2. The current geometry failed deterministic validation.`,
          "Do not explain the failures. Do not create a new design direction. Do not mirror or rotate the property.",
          "The LOCKED PLAN FOUNDATION STRUCTURE in the payload is authoritative. Return every locked level in the same order and design actual rooms on every required storey. Never delete a required floor, add another floor, rename a locked level, change an outline, or change the shared stair/core relationship.",
          requestedStoreys
            ? `HARD FLOOR COUNT: return exactly ${requestedStoreys} level${requestedStoreys === 1 ? "" : "s"}. Never create an extra level.`
            : "Preserve the intended floor count from the selected Direction Contract.",
          "Preserve every required Space Program item and its intended level. You may reposition/rescale room rectangles intelligently to make the plan physically valid, but do not delete required indoor spaces.",
          "ROOM GEOMETRY: enclosed indoor rooms on the same level may share boundaries but may never overlap. Keep every enclosed room within that level outline. Use varied, architecturally plausible proportions; do not pack rooms into equal strips or generic rows.",
          "OUTDOOR GEOMETRY: pool, driveway, garden and yard are site elements, not indoor rooms. Attached terraces/balconies/outdoor-dining zones may sit outside the enclosed level outline and must not be used as filler rooms.",
          "ACCESS: every enclosed room needs a real door to a physically adjacent room/hall or appropriate exterior edge. Door wall labels must match the actual shared wall. Use circulation relationships that match those physical adjacencies.",
          "VERTICAL COORDINATION: use the locked shared vertical core in exactly the same x/y/width/height on every served floor. Upper-floor rooms must fit the locked upper outline/setback.",
          "ENTRY/GARAGE/SITE: the Direction Contract locks the facade side and approximate zone. The main entry/pool/driveway anchors are immutable. The actual garage room rectangle may resize or shift modestly within the locked garage side/zone to avoid overlaps while remaining connected to the driveway; do not treat the contract garage rectangle as an exact room box.",
          args.directionGeometryContract ? directionGeometryContractPrompt(args.directionGeometryContract) : "",
          "The deterministic failures below are the exact defects to repair:",
          ...deterministicIssues.map((issue, index) => `${index + 1}. ${issue}`),
          "Return a complete canonical_plan object in the required schema and nothing else.",
        ].join(" "),
        payload: {
          selected_direction_geometry_contract: args.directionGeometryContract || null,
          locked_plan_foundation_structure: lockedPlanFoundationStructure(args.directionGeometryContract, requestedStoreys),
          requested_storeys: requestedStoreys,
          project_type: args.project.project_type || null,
          saved_space_program: args.spaceProgram,
          canonical_plan_to_repair: value.canonical_plan,
          validation_failures_to_correct: deterministicIssues,
          correction_attempt: correctionAttempt,
        },
      });

      value = prepareCanonicalPlanCandidate(
        { ...value, canonical_plan: corrected.value.canonical_plan },
        args.directionGeometryContract,
        requestedStoreys,
      );
      correctionUsages.push(corrected.usage);
      deterministicIssues = [...new Set(foundationIssues(value))];
    }

    if (deterministicIssues.length) {
      throw new Error(
        `Architecture Plan validation failed before the Plan Foundation was shown: ${deterministicIssues.join(" ")}`,
      );
    }

    return {
      planSet: {
        ...value,
        planning_assumptions: [
          ...value.planning_assumptions,
          "Plan Foundation validated against the selected Direction Geometry Contract and canonical geometry checks. Professional architectural development is still required for measured or construction documentation.",
        ],
        plan_images: expandedPlanViews(value, args.architectureDna),
      },
      usage: {
        requirement_extraction: null,
        plan_generation: first.usage,
        requirement_audit: null,
        correction: correctionUsages,
        correction_audit: null,
        plan_foundation_contract_validation: Boolean(args.directionGeometryContract),
        coordination_warnings: [],
      },
    };
  }

  let deterministicIssues = [
    ...planValidationIssues({ planSet: value, project: args.project, site: args.site }),
    ...geometryCoordinationIssues({ planSet: value, project: args.project }),
    ...deterministicRequirementIssues(value, requirementContract),
  ];
  let auditResult = await auditArchitecturePlanRequirements({
    plan: args.plan,
    contract: requirementContract,
    planSet: value,
  });
  let auditFailures = hardPlanAuditFailures(requirementContract, auditResult.value);

  const correctionUsages: unknown[] = [];
  const correctionAuditUsages: unknown[] = [];
  for (let correctionAttempt = 1; correctionAttempt <= 2 && (deterministicIssues.length || auditFailures.length); correctionAttempt += 1) {
    const allFailures = [...new Set([...deterministicIssues, ...auditFailures])];
    const corrected = await structuredCompletion<LivePlanSet>({
      plan: args.plan,
      schema: planSchema,
      system: [
        baseSystem,
        `INDEPENDENT REQUIREMENT VALIDATION FAILED (correction pass ${correctionAttempt} of 2). Correct the complete Canonical Plan rather than explaining the failure.`,
        "The previous plan failed these checks:",
        ...allFailures.map((issue, index) => `${index + 1}. ${issue}`),
        "For quantitative failures, write explicit machine-checkable evidence into capacity_type/capacity_count, fixtures, level count and/or area_schedule as appropriate. Do not merely mention the target in prose.",
        "For geometry failures, repair the canonical geometry itself: building_outline, level.outline, master vertical_cores, mirrored level.stairs, circulation_routes, room coordinates and explicit openings. Do not explain that they should align; make the coordinates align.",
        "If a room is inaccessible, add or correct a real opening and circulation connection. If a stair/core moves between levels, move the level stair back onto the exact master-core coordinates.",
        "If a capacity target is distributed across several spaces or floors, make the explicit capacity_count values sum to the required target without double counting the same physical capacity.",
        args.planFoundationMode
          ? "Return a complete corrected plan that satisfies every HARD plan requirement while preserving already-satisfied requirements, the selected Architecture Direction and the locked plan-foundation geometry relationships."
          : "Return a complete corrected plan that satisfies every HARD plan requirement while preserving already-satisfied requirements and the selected Architecture DNA.",
      ].join(" "),
      payload: {
        ...payload,
        previous_plan_to_correct: value,
        validation_failures_to_correct: allFailures,
        previous_requirement_audit: auditResult.value,
        correction_attempt: correctionAttempt,
      },
    });
    value = repairCanonicalPlanAccess(corrected.value);
    correctionUsages.push(corrected.usage);

    deterministicIssues = [
      ...planValidationIssues({ planSet: value, project: args.project, site: args.site }),
      ...geometryCoordinationIssues({ planSet: value, project: args.project }),
      ...deterministicRequirementIssues(value, requirementContract),
    ];
    auditResult = await auditArchitecturePlanRequirements({
      plan: args.plan,
      contract: requirementContract,
      planSet: value,
    });
    correctionAuditUsages.push(auditResult.usage);
    auditFailures = hardPlanAuditFailures(requirementContract, auditResult.value);
  }
  correctionUsage = correctionUsages;
  correctionAuditUsage = correctionAuditUsages;


  const unresolved = [...new Set([...deterministicIssues, ...auditFailures])];
  if (unresolved.length) {
    throw new Error(
      `Architecture Plan validation failed before images were generated: ${unresolved.join(" ")}`,
    );
  }

  return {
    planSet: {
      ...value,
      planning_assumptions: [
        ...value.planning_assumptions,
        `Requirement Contract validated: ${hardPlanRequirements.length} hard plan requirement${hardPlanRequirements.length === 1 ? "" : "s"} checked before plan images were unlocked.`,
      ],
      plan_images: expandedPlanViews(value, args.architectureDna),
    },
    usage: {
      requirement_extraction: requirementResult.usage,
      plan_generation: first.usage,
      requirement_audit: auditResult.usage,
      correction: correctionUsage,
      correction_audit: correctionAuditUsage,
      validated_hard_plan_requirements: hardPlanRequirements.map((requirement) => ({
        id: requirement.id,
        statement: requirement.statement,
      })),
    },
  };
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
    : ["Exterior Concept Board", "Living & Landscape Concept Board"];
  const existingDesignSource = String(args.project.workflow_mode || "") === "plan_to_render";

  return structuredCompletion<{ visuals: LiveVisualPrompt[] }>({
    plan: args.plan,
    schema: visualPromptsSchema,
    system: [
      "You are Heyy Studio's architecture visual director.",
      "Prepare a small, focused set of architecture CONCEPT BOARD prompts. These must feel different from the single Design Direction hero render: each output is a composed presentation board with several coordinated visual studies rather than one standalone building image. Do not present them as measured elevations or exact coordinated render views.",
      `This is a ${projectType} project. Include the appropriate interior experiences and operational spaces rather than using a residential-only gallery.`,
      `The gallery must reflect these priorities: ${template.directionFocus.join(", ")}.`,
      existingDesignSource
        ? "This is an Existing Design / Plan-to-Visual workflow. The uploaded drawings will be supplied directly to the image editor as authoritative geometry. Do not describe or invent a specific footprint, room layout, stair position, opening pattern, roof geometry or massing that is not explicitly stated by the user."
        : "This is a DIRECTION-FIRST new-design workflow. The selected Direction established the approved architectural identity first; the subsequently approved Canonical Plan Foundation translated that direction into exact geometry. For all Concept Visuals, the Canonical Plan is the geometry source of truth and the selected Direction is the architectural/style source of truth. Neither may replace the other.",
      existingDesignSource
        ? "Prompts should describe only the requested camera/view, material character, atmosphere, lighting, landscape treatment and functional experience. Always say to reconstruct the exact uploaded design."
        : "Every prompt must explicitly preserve the approved plan footprint, floor stacking, stair/core positions, entry, pool/site relationship and circulation while applying the selected Direction's architectural language.",
      existingDesignSource
        ? "Do not rely on a generated canonical plan, concept render or direction render to define geometry."
        : "All views, especially aerial and site-related views, must be derived from the approved plan geometry. Do not invent a U-shape, courtyard, wing, pool location, entry or massing relationship that conflicts with the approved plans.",
      "For new designs, preserve the major project anchors visible in the approved Plan Foundation: storey count, main entry zone, garage side, pool/outdoor relationship and overall massing family. Minor architectural differences may occur and the imagery remains conceptual.",
      "Each concept board should combine one main atmospheric render with 3–5 supporting studies such as material close-ups, façade/details, quick sketch or diagram fragments, landscape/lighting studies and spatial moments. Keep the board premium and graphic, with minimal or no generated text inside the image.",
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
          concept: null,
          geometry_authority: "Approved floor plans and canonical plan. Selected Direction controls architectural expression only.",
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
      : value.visuals.slice(0, 2).map((visual, index) => ({
          ...visual,
          visual_type: index === 0 ? "exterior_concept_board" : "living_landscape_concept_board",
          title: index === 0 ? "Exterior Concept Board" : "Living & Landscape Concept Board",
          prompt: [
            index === 0
              ? "Create a premium architectural EXTERIOR CONCEPT BOARD, not another single hero render. Use one main exterior perspective plus smaller supporting studies: façade/material details, a loose sketch or massing diagram, entry/landscape moments and material swatches derived from the selected project palette."
              : "Create a premium LIVING & LANDSCAPE CONCEPT BOARD, not another standalone exterior render. Use one main indoor-outdoor or terrace/pool scene plus supporting studies: landscape/material close-ups, lighting mood, threshold/detail sketches and smaller spatial vignettes.",
            visual.prompt,
            "Compose the studies into one clean presentation board with a consistent architectural language. Avoid long AI-generated text; visual labels, if any, should be minimal. Keep the number of levels and major entry, garage, pool and outdoor-living relationships recognisable from the approved Plan Foundation. This is concept imagery, not exact documentation.",
          ].join(" "),
        })),
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
      ? "GEOMETRY-LOCKED MODE. THE SOURCE GEOMETRY IMAGES ARE THE ABSOLUTE BUILDING GEOMETRY SOURCE OF TRUTH."
      : "VISUAL CONTINUITY IS THE HIGHEST PRIORITY.",
    sourceList,
    referenceList,
    sourceLocked
      ? "The SOURCE GEOMETRY references come first and override every later style, direction, concept or previous-render reference if there is any conflict. They may be uploaded source drawings or approved Heyy Studio floor plans. Preserve the visible footprint, storey count, floor relationships, stairs/cores, external walls, entry, pool/site relationship, setbacks and spatial arrangement. Do not copy replacement geometry from STYLE / CONTINUITY references."
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
      ? "Translate the locked geometry into the requested architectural visual. If information is not resolved by the geometry references, use the selected Direction only to develop facade, roof, materials, openings, landscape character and atmosphere without changing the plan-established building."
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
  if (!base64) throw new Error("Architecture generation returned no image data.");
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
  const requestedIndex = floorIndexFromVisualType(visualType);
  if (requestedIndex !== null) {
    return levels[requestedIndex] || levels[0];
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
  const floorRender = rendererPlanForFloor(args.plan, args.visualType);
  return renderArchitecturalDrawingSvg({
    ...args,
    plan: floorRender.plan,
    visualType: floorRender.rendererVisualType,
  });
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
  const isFloorPlan = isFloorPlanVisualType(visualType);
  const isSitePlan = visualType === "site_plan";
  const isZoning = visualType === "functional_zoning" || visualType === "circulation";
  const isElevation = /_elevation$/.test(visualType);
  const isSection = /^section_/.test(visualType);
  const level = levelForType(args.canonicalPlan, visualType);
  const roomProgram = (level?.rooms || []).map((room) => ({
    name: room.name,
    zone: room.zone,
    capacity_type: room.capacity_type || "",
    capacity_count: Number(room.capacity_count || 0),
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
      : "CANONICAL GEOMETRY LOCK: Reference 1 is the supplied canonical drawing and is the geometry source of truth, not a loose spatial guide. Preserve every wall endpoint, outline, stair/core position, opening, corridor relationship, room position, site element and level relationship exactly. Later references can influence only drawing quality, materials/style cues and presentation. Improve graphic presentation; never redesign the plan.",
    "When a final floor-plan style reference image is supplied, use only its drawing quality, line hierarchy, symbols, fixtures and level of detail. Ignore its project title, exact layout, room count, dimensions and geometry.",
    args.sourceGeometryLocked
      ? "Preserve the uploaded design exactly; use the saved project information only to clarify labels or presentation where it does not conflict with the source."
      : "Preserve the canonical geometry exactly: same master building outline, same level outline, same wall locations, same entry side, same pool and driveway, identical vertical-core coordinates on every served floor, same openings and same circulation relationships.",
    "Use crisp black-and-white architectural linework on a clean white drawing sheet, with subtle grey poche/hatching only where professionally appropriate.",
    "No coloured zoning blocks, no floating room boxes, no perspective distortion, no photorealistic render, no decorative poster layout and no invented unrelated building.",
    "All text must be readable English. Do not add logos, watermarks, long paragraphs or fake consultant stamps.",
    "This remains a detailed AI concept drawing, not permit or construction documentation.",
  ];

  if (isFloorPlan) {
    return [
      "Create a highly detailed, presentation-quality architectural floor plan in true top-down orthographic view.",
      "REFERENCE PRIORITY: for a new design, the FIRST supplied image is the canonical geometry drawing. Treat its walls, room extents, stair/core position, openings, entry and outline as fixed geometry. Later images are style/continuity references only.",
      "Do not copy the canonical guide's simplified graphic appearance. Upgrade it into a polished architect-quality plan while preserving its geometry. Doors must sit in wall openings and swing from real wall jambs; never draw a floating door symbol.",
      `Required room programme for this level: ${JSON.stringify(roomProgram)}.`,
      "Show a clear main entrance and foyer/entry sequence connected to internal circulation. Every enclosed room must have a logical door and must be reachable without passing through unrelated private rooms.",
      "Show realistic external windows embedded in exterior walls, sized and positioned for daylight and ventilation. Show glazed doors or hinged doors providing real access to terraces, balconies, gardens, patios, pool decks and other outdoor spaces where relevant.",
      "Draw exterior walls heavier than interior partitions. Draw door openings with swing arcs, sliding doors where appropriate, window frames, stairs with direction arrow, landings, wardrobes, storage and built-in cabinetry.",
      "Add professional architectural symbols and project-type-appropriate fixtures. Residential plans need normal residential furniture; healthcare plans need patient beds, clinical equipment, nurse/support spaces; hospitality plans need guest-room beds and operational furniture; education plans need classroom/study furniture; commercial plans need workplace/retail furniture.",
      "For any room with capacity_count greater than zero, visibly represent that capacity in a believable architectural way. In bed-based healthcare wards, subdivide large ward zones into patient rooms/bays as needed and show the correct number of beds distributed across them instead of drawing one empty rectangle.",
      "Label each room clearly and add plausible room dimensions in metres beneath the room name. Add selected overall dimensions, hall widths, north arrow and a simple 0–5 m scale bar.",
      "Keep wet/service areas coordinated, circulation practical, furniture clear of door swings, and operational relationships obvious.",
      "The result should visually match the standard of a polished professional architect's concept floor plan appropriate to this building type, not a residential template.",
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


export async function generateAndStorePlanFoundationSheetImage(args: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  filenamePrefix?: string;
  projectName: string;
  canonicalPlan: CanonicalPlanSpec;
  architectureDna?: ArchitectureDna | null;
  plan: AiPlanConfig;
}) {
  const levels = Array.isArray(args.canonicalPlan.levels) ? args.canonicalPlan.levels : [];
  if (!levels.length) throw new Error("The Plan Foundation has no coordinated floors to render.");

  // The Plan Foundation sheet is a technical geometry artifact, not an AI image.
  // Rendering every level from the same canonical coordinate system guarantees that
  // identical stairs/cores/walls remain the same size and position floor-to-floor.
  const svg = renderPlanFoundationSheetSvg({
    plan: args.canonicalPlan,
    projectName: args.projectName,
    architectureDna: args.architectureDna || null,
  });
  const png = await sharp(Buffer.from(svg, "utf8"), { density: 180 })
    .flatten({ background: "#FFFFFF" })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const stored = await storeArchitectureImageVariants({
    supabase: args.supabase,
    userId: args.userId,
    projectId: args.projectId,
    folder: "plans",
    filenamePrefix: args.filenamePrefix || "plan-foundation-sheet",
    sourceBytes: png,
    tier: "preview",
  });

  return {
    ...stored,
    provider: "heyy-renderer" as const,
    model: "canonical-plan-sheet-renderer-v2",
    generationMethod: "deterministic-canonical-plan-sheet",
    quality: "deterministic",
    tier: "preview" as const,
    referenceCount: 0,
    usage: null,
  };
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

  // Canonical floor plans are technical truth in Plan Foundation mode. Never send them
  // through an image model for a cosmetic redraw because that can move walls, stairs,
  // pools, doors or level relationships. The deterministic renderer is the final plan.
  if (!args.preserveSourceGeometry && isFloorPlanVisualType(args.visualType)) {
    const deterministic = await generateAndStoreCanonicalPlanImage({
      supabase: args.supabase,
      userId: args.userId,
      projectId: args.projectId,
      filenamePrefix: args.filenamePrefix,
      visualType: args.visualType,
      title: args.title,
      projectName: args.projectName,
      canonicalPlan: args.canonicalPlan,
      architectureDna: args.architectureDna,
    });
    return {
      ...deterministic,
      tier: "preview" as const,
      quality: "deterministic",
      provider: "heyy-renderer" as const,
      model: "canonical-plan-renderer-v1",
      referenceCount: 0,
      usage: null,
      generationMethod: "deterministic-canonical-plan-render",
    };
  }

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

  // The deterministic renderer remains an internal geometry source, not the customer-facing final plan.
  // Detailed plans are professionally redrawn from that locked guide with the guide supplied as Reference 1.

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
  const styleReference = isFloorPlanVisualType(args.visualType)
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
          guideAsset,
          ...referenceAssets,
          ...(styleReference ? [styleReference] : []),
        ]
  ).slice(0, 6);
  const openai = getOpenAI();
  const referenceFiles = await Promise.all(
    allAssets.map((asset) => toFile(asset.bytes, asset.filename, { type: asset.mimeType })),
  );
  const quality = imageQualityForTier(args.plan, tier);
  const imageSize = isFloorPlanVisualType(args.visualType) || args.visualType === "site_plan"
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
  if (!base64) throw new Error("Architecture document generation returned no image data.");
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
    throw new Error(`Architecture image generation failed (${response.status}).`);
  }
  const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts || []) || [];
  const image = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  const base64 = image?.inlineData?.data || image?.inline_data?.data;
  if (!base64) throw new Error("Architecture image generation returned no image data.");
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
    if (!base64) throw new Error("Rendered plan generation returned no image data.");
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

