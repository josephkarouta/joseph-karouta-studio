import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SpatialPosition =
  | "front_left"
  | "front_center"
  | "front_right"
  | "left_side"
  | "right_side"
  | "rear_left"
  | "rear_center"
  | "rear_right"
  | "courtyard"
  | "unknown";

export type DirectionSkeletonPoint = { x: number; y: number };

export type DirectionSkeletonRect = {
  present: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

export type DirectionPlanSkeleton = {
  coordinate_system: string;
  ground_outline: DirectionSkeletonPoint[];
  upper_outline: DirectionSkeletonPoint[];
  entry: {
    present: boolean;
    x: number;
    y: number;
    confidence: number;
  };
  pool: DirectionSkeletonRect;
  outdoor_living: DirectionSkeletonRect;
  garage: DirectionSkeletonRect;
  approach: {
    present: boolean;
    type: "direct" | "steps" | "terraced_steps" | "drive_court" | "unknown";
    points: DirectionSkeletonPoint[];
    confidence: number;
  };
  terraces: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    confidence: number;
  }>;
  protected_open_space: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
  }>;
  reasoning_summary: string;
};

export type DirectionSpatialBrief = {
  version: 3;
  source_storage_path: string | null;
  extracted_at: string;
  analysis_model: string;
  site_condition: string;
  footprint_family: string;
  building_orientation_read: string;
  main_entry_position: string;
  primary_approach: string;
  garage_relationship: string;
  pool_relationship: string;
  outdoor_living_relationship: string;
  landscape_terracing: string;
  massing_character: string;
  upper_level_relationship: string;
  visible_spatial_notes: string[];
  must_preserve: string[];
  unknown_or_hidden: string[];
  confidence: number;
  pool_visible: boolean;
  pool_position: SpatialPosition;
  entry_visible: boolean;
  entry_position: SpatialPosition;
  approach_steps_visible: boolean;
  approach_position: SpatialPosition;
  outdoor_living_visible: boolean;
  outdoor_living_position: SpatialPosition;
  terracing_visible: boolean;
  garage_visible: boolean;
  garage_position: SpatialPosition;
  plan_skeleton: DirectionPlanSkeleton;
};

type DirectionRecord = Record<string, unknown>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanString(value: unknown, fallback = "unknown") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanList(value: unknown, max = 20) {
  return Array.isArray(value)
    ? value.map((item) => cleanString(item, "")).filter(Boolean).slice(0, max)
    : [];
}

function cleanBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return /^(true|yes|visible|present)$/i.test(value.trim());
  return Boolean(value);
}

function clamp(value: unknown, minimum = 0, maximum = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.max(minimum, Math.min(maximum, number));
}

const positions = new Set<SpatialPosition>([
  "front_left", "front_center", "front_right",
  "left_side", "right_side",
  "rear_left", "rear_center", "rear_right",
  "courtyard", "unknown",
]);

function cleanPosition(value: unknown): SpatialPosition {
  const raw = cleanString(value).toLowerCase().replace(/[\s-]+/g, "_") as SpatialPosition;
  return positions.has(raw) ? raw : "unknown";
}

function clampConfidence(value: unknown) {
  return clamp(value, 0, 1);
}

function cleanPoint(value: unknown): DirectionSkeletonPoint {
  const row = record(value);
  return { x: clamp(row.x), y: clamp(row.y) };
}

function cleanPoints(value: unknown, max = 16) {
  return Array.isArray(value)
    ? value.slice(0, max).map(cleanPoint)
    : [];
}

function cleanRect(value: unknown): DirectionSkeletonRect {
  const row = record(value);
  const present = cleanBoolean(row.present);
  return {
    present,
    x: clamp(row.x),
    y: clamp(row.y),
    width: present ? Math.max(1, clamp(row.width)) : 0,
    height: present ? Math.max(1, clamp(row.height)) : 0,
    confidence: clampConfidence(row.confidence),
  };
}

function cleanPlanSkeleton(value: unknown): DirectionPlanSkeleton {
  const skeleton = record(value);
  const entry = record(skeleton.entry);
  const approach = record(skeleton.approach);
  return {
    coordinate_system: cleanString(
      skeleton.coordinate_system,
      "Conceptual 0-100 top-down grid: x=0 left, x=100 right, y=0 rear/background, y=100 front/foreground as seen in the selected Direction image.",
    ),
    ground_outline: cleanPoints(skeleton.ground_outline),
    upper_outline: cleanPoints(skeleton.upper_outline),
    entry: {
      present: cleanBoolean(entry.present),
      x: clamp(entry.x),
      y: clamp(entry.y),
      confidence: clampConfidence(entry.confidence),
    },
    pool: cleanRect(skeleton.pool),
    outdoor_living: cleanRect(skeleton.outdoor_living),
    garage: cleanRect(skeleton.garage),
    approach: {
      present: cleanBoolean(approach.present),
      type: ["direct", "steps", "terraced_steps", "drive_court", "unknown"].includes(cleanString(approach.type))
        ? cleanString(approach.type) as DirectionPlanSkeleton["approach"]["type"]
        : "unknown",
      points: cleanPoints(approach.points, 12),
      confidence: clampConfidence(approach.confidence),
    },
    terraces: Array.isArray(skeleton.terraces)
      ? skeleton.terraces.slice(0, 10).map((item) => {
          const row = record(item);
          return {
            x: clamp(row.x),
            y: clamp(row.y),
            width: Math.max(1, clamp(row.width)),
            height: Math.max(1, clamp(row.height)),
            label: cleanString(row.label, "terrace"),
            confidence: clampConfidence(row.confidence),
          };
        })
      : [],
    protected_open_space: Array.isArray(skeleton.protected_open_space)
      ? skeleton.protected_open_space.slice(0, 10).map((item) => {
          const row = record(item);
          return {
            x: clamp(row.x),
            y: clamp(row.y),
            width: Math.max(1, clamp(row.width)),
            height: Math.max(1, clamp(row.height)),
            label: cleanString(row.label, "open space"),
          };
        })
      : [],
    reasoning_summary: cleanString(skeleton.reasoning_summary, "Conceptual plan skeleton inferred from the visible Direction image."),
  };
}

function normalizeSpatialBrief(
  raw: Record<string, unknown>,
  sourceStoragePath: string | null,
  model: string,
): DirectionSpatialBrief {
  return {
    version: 3,
    source_storage_path: sourceStoragePath,
    extracted_at: new Date().toISOString(),
    analysis_model: model,
    site_condition: cleanString(raw.site_condition),
    footprint_family: cleanString(raw.footprint_family),
    building_orientation_read: cleanString(raw.building_orientation_read),
    main_entry_position: cleanString(raw.main_entry_position),
    primary_approach: cleanString(raw.primary_approach),
    garage_relationship: cleanString(raw.garage_relationship),
    pool_relationship: cleanString(raw.pool_relationship),
    outdoor_living_relationship: cleanString(raw.outdoor_living_relationship),
    landscape_terracing: cleanString(raw.landscape_terracing),
    massing_character: cleanString(raw.massing_character),
    upper_level_relationship: cleanString(raw.upper_level_relationship),
    visible_spatial_notes: cleanList(raw.visible_spatial_notes),
    must_preserve: cleanList(raw.must_preserve),
    unknown_or_hidden: cleanList(raw.unknown_or_hidden),
    confidence: clampConfidence(raw.confidence),
    pool_visible: cleanBoolean(raw.pool_visible),
    pool_position: cleanPosition(raw.pool_position),
    entry_visible: cleanBoolean(raw.entry_visible),
    entry_position: cleanPosition(raw.entry_position),
    approach_steps_visible: cleanBoolean(raw.approach_steps_visible),
    approach_position: cleanPosition(raw.approach_position),
    outdoor_living_visible: cleanBoolean(raw.outdoor_living_visible),
    outdoor_living_position: cleanPosition(raw.outdoor_living_position),
    terracing_visible: cleanBoolean(raw.terracing_visible),
    garage_visible: cleanBoolean(raw.garage_visible),
    garage_position: cleanPosition(raw.garage_position),
    plan_skeleton: cleanPlanSkeleton(raw.plan_skeleton),
  };
}

function preferredDirectionStoragePath(direction: DirectionRecord) {
  const generationJson = record(direction.generation_json);
  const finalAssets = record(generationJson.final_assets);
  const previewAssets = record(generationJson.preview_assets);
  return [
    finalAssets.master_storage_path,
    previewAssets.master_storage_path,
    direction.image_storage_path,
  ].find((value): value is string => typeof value === "string" && Boolean(value)) || null;
}

function cachedBrief(direction: DirectionRecord) {
  const generationJson = record(direction.generation_json);
  const cached = record(generationJson.direction_spatial_brief);
  const storagePath = preferredDirectionStoragePath(direction);
  if (
    cached.version === 3 &&
    cached.source_storage_path === storagePath &&
    Array.isArray(cached.must_preserve) &&
    record(cached.plan_skeleton).coordinate_system
  ) {
    return cached as unknown as DirectionSpatialBrief;
  }
  return null;
}

async function directionImageBytes(
  supabase: SupabaseClient,
  direction: DirectionRecord,
) {
  const storagePath = preferredDirectionStoragePath(direction);

  if (storagePath) {
    const { data, error } = await supabase.storage
      .from("architecture-files")
      .download(storagePath);
    if (!error && data) {
      return {
        bytes: Buffer.from(await data.arrayBuffer()),
        mimeType: data.type || "image/webp",
        storagePath,
      };
    }
  }

  const url = typeof direction.image_url === "string" ? direction.image_url : "";
  if (!url) throw new Error("Generate the selected Direction visual before preparing Plans.");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The selected Direction visual could not be loaded (${response.status}).`);
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("content-type") || "image/webp",
    storagePath,
  };
}

const positionEnum = [
  "front_left", "front_center", "front_right", "left_side", "right_side",
  "rear_left", "rear_center", "rear_right", "courtyard", "unknown",
] as const;

const pointSchema = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y"],
  properties: {
    x: { type: "number", minimum: 0, maximum: 100 },
    y: { type: "number", minimum: 0, maximum: 100 },
  },
} as const;

const rectSchema = {
  type: "object",
  additionalProperties: false,
  required: ["present", "x", "y", "width", "height", "confidence"],
  properties: {
    present: { type: "boolean" },
    x: { type: "number", minimum: 0, maximum: 100 },
    y: { type: "number", minimum: 0, maximum: 100 },
    width: { type: "number", minimum: 0, maximum: 100 },
    height: { type: "number", minimum: 0, maximum: 100 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

const directionPlanSkeletonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "site_condition", "footprint_family", "building_orientation_read", "main_entry_position",
    "primary_approach", "garage_relationship", "pool_relationship", "outdoor_living_relationship",
    "landscape_terracing", "massing_character", "upper_level_relationship", "visible_spatial_notes",
    "must_preserve", "unknown_or_hidden", "confidence", "pool_visible", "pool_position",
    "entry_visible", "entry_position", "approach_steps_visible", "approach_position",
    "outdoor_living_visible", "outdoor_living_position", "terracing_visible", "garage_visible",
    "garage_position", "plan_skeleton",
  ],
  properties: {
    site_condition: { type: "string" },
    footprint_family: { type: "string" },
    building_orientation_read: { type: "string" },
    main_entry_position: { type: "string" },
    primary_approach: { type: "string" },
    garage_relationship: { type: "string" },
    pool_relationship: { type: "string" },
    outdoor_living_relationship: { type: "string" },
    landscape_terracing: { type: "string" },
    massing_character: { type: "string" },
    upper_level_relationship: { type: "string" },
    visible_spatial_notes: { type: "array", maxItems: 20, items: { type: "string" } },
    must_preserve: { type: "array", minItems: 3, maxItems: 20, items: { type: "string" } },
    unknown_or_hidden: { type: "array", maxItems: 20, items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    pool_visible: { type: "boolean" },
    pool_position: { type: "string", enum: positionEnum },
    entry_visible: { type: "boolean" },
    entry_position: { type: "string", enum: positionEnum },
    approach_steps_visible: { type: "boolean" },
    approach_position: { type: "string", enum: positionEnum },
    outdoor_living_visible: { type: "boolean" },
    outdoor_living_position: { type: "string", enum: positionEnum },
    terracing_visible: { type: "boolean" },
    garage_visible: { type: "boolean" },
    garage_position: { type: "string", enum: positionEnum },
    plan_skeleton: {
      type: "object",
      additionalProperties: false,
      required: [
        "coordinate_system", "ground_outline", "upper_outline", "entry", "pool", "outdoor_living",
        "garage", "approach", "terraces", "protected_open_space", "reasoning_summary",
      ],
      properties: {
        coordinate_system: { type: "string" },
        ground_outline: { type: "array", minItems: 4, maxItems: 16, items: pointSchema },
        upper_outline: { type: "array", maxItems: 16, items: pointSchema },
        entry: {
          type: "object",
          additionalProperties: false,
          required: ["present", "x", "y", "confidence"],
          properties: {
            present: { type: "boolean" },
            x: { type: "number", minimum: 0, maximum: 100 },
            y: { type: "number", minimum: 0, maximum: 100 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
        pool: rectSchema,
        outdoor_living: rectSchema,
        garage: rectSchema,
        approach: {
          type: "object",
          additionalProperties: false,
          required: ["present", "type", "points", "confidence"],
          properties: {
            present: { type: "boolean" },
            type: { type: "string", enum: ["direct", "steps", "terraced_steps", "drive_court", "unknown"] },
            points: { type: "array", maxItems: 12, items: pointSchema },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
        terraces: {
          type: "array",
          maxItems: 10,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "width", "height", "label", "confidence"],
            properties: {
              x: { type: "number", minimum: 0, maximum: 100 },
              y: { type: "number", minimum: 0, maximum: 100 },
              width: { type: "number", minimum: 0, maximum: 100 },
              height: { type: "number", minimum: 0, maximum: 100 },
              label: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
          },
        },
        protected_open_space: {
          type: "array",
          maxItems: 10,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "width", "height", "label"],
            properties: {
              x: { type: "number", minimum: 0, maximum: 100 },
              y: { type: "number", minimum: 0, maximum: 100 },
              width: { type: "number", minimum: 0, maximum: 100 },
              height: { type: "number", minimum: 0, maximum: 100 },
              label: { type: "string" },
            },
          },
        },
        reasoning_summary: { type: "string" },
      },
    },
  },
} as const;

function analysisSystemPrompt() {
  return [
    "You are Heyy Studio's senior architectural visual-to-plan analyst.",
    "Study the SELECTED DIRECTION IMAGE as if an architect is about to sketch a conceptual floor plan from that exact reference.",
    "Do not reduce the image to style words. Convert the visible architecture into a conceptual TOP-DOWN PLAN SKELETON on a normalized 0-100 coordinate grid.",
    "Coordinate convention is mandatory: x=0 is image-left, x=100 image-right, y=0 is the rear/background side of the property, y=100 is the visible foreground/front side shown by the camera.",
    "Infer only a reasonable conceptual footprint from visible massing. Hidden rear edges may be conservative and must be low-confidence rather than invented with false certainty.",
    "The skeleton must lock the relationships that a human architect would carry into the plan: overall ground-floor envelope/massing family, visible upper-floor envelope, main entry, pool, garage if visible, outdoor living/dining, terraces, stepped approach and protected open-space relationships.",
    "The plan skeleton is NOT a measured survey and must not invent hidden room locations. The user programme will later be fitted inside this skeleton.",
    "If the selected Direction shows a pool in front-right, the skeleton must put the pool in front-right. If it shows a stepped approach on the left, model that approach path on the left. If the upper massing is narrower or set back, show a smaller upper_outline.",
    "Use rectangles only for site anchors; use polygons for building outlines. Make the geometry spatially coherent and avoid overlapping a pool with the building footprint.",
    "must_preserve must list the visible relationships that later Ground Floor, Upper Floor and exterior views are not allowed to change.",
    "unknown_or_hidden must explicitly list what cannot be reliably inferred from this one camera view.",
    "Return only the structured response required by the schema.",
  ].join(" ");
}

function projectContextText(args: {
  project: Record<string, unknown>;
  site?: Record<string, unknown> | null;
  planning?: Record<string, unknown> | null;
  spaceProgram?: Array<Record<string, unknown>>;
  architectureDna?: Record<string, unknown> | null;
}) {
  return JSON.stringify({
    project_type: args.project.project_type || null,
    project_name: args.project.project_name || null,
    notes: args.project.notes || null,
    source_notes: args.project.source_notes || null,
    professional_brief: args.project.professional_brief || null,
    source_brief: args.project.source_brief || null,
    site: args.site || null,
    planning: args.planning || null,
    space_program: (args.spaceProgram || []).map((row) => ({
      space_name: row.space_name || null,
      zone: row.zone || null,
      level: row.level || null,
      quantity: row.quantity || null,
      total_area_m2: row.total_area_m2 || null,
      priority: row.priority || null,
      is_ai_suggested: row.is_ai_suggested === true,
    })),
    architecture_dna: args.architectureDna || null,
  });
}

async function analyseWithResponsesApi(args: {
  openai: OpenAI;
  model: string;
  dataUrl: string;
  context: string;
}) {
  const response = await args.openai.responses.create({
    model: args.model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: analysisSystemPrompt() }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "PROJECT CONTEXT follows. Use it only to understand programme/site intent; do not let it overwrite visible image geometry.",
              args.context,
              "Now infer the conceptual top-down skeleton of the exact Direction image.",
            ].join("\n\n"),
          },
          {
            type: "input_image",
            image_url: args.dataUrl,
            detail: "high",
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "architecture_direction_plan_skeleton",
        strict: true,
        schema: directionPlanSkeletonSchema,
      },
    },
    max_output_tokens: 5000,
  } as never);
  const content = response.output_text?.trim();
  if (!content) throw new Error("Direction plan-skeleton analysis returned no structured output.");
  return content;
}

async function analyseWithChatFallback(args: {
  openai: OpenAI;
  model: string;
  dataUrl: string;
  context: string;
}) {
  const completion = await args.openai.chat.completions.create({
    model: args.model,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "architecture_direction_plan_skeleton",
        strict: true,
        schema: directionPlanSkeletonSchema,
      },
    },
    max_completion_tokens: 5000,
    messages: [
      { role: "system", content: analysisSystemPrompt() },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "PROJECT CONTEXT follows. Use it only to understand programme/site intent; do not let it overwrite visible image geometry.",
              args.context,
              "Now infer the conceptual top-down skeleton of the exact Direction image.",
            ].join("\n\n"),
          },
          { type: "image_url", image_url: { url: args.dataUrl, detail: "high" } },
        ] as never,
      },
    ],
  } as never);
  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("Direction plan-skeleton fallback returned no structured output.");
  return content;
}

export async function extractDirectionSpatialBrief(args: {
  supabase: SupabaseClient;
  direction: DirectionRecord;
  project: Record<string, unknown>;
  site?: Record<string, unknown> | null;
  planning?: Record<string, unknown> | null;
  spaceProgram?: Array<Record<string, unknown>>;
  architectureDna?: Record<string, unknown> | null;
}) {
  const cached = cachedBrief(args.direction);
  if (cached) return cached;

  const image = await directionImageBytes(args.supabase, args.direction);
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for Direction plan-skeleton analysis.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_ARCHITECTURE_VISION_MODEL?.trim()
    || process.env.OPENAI_TEXT_MODEL?.trim()
    || "gpt-4.1-mini";
  const dataUrl = `data:${image.mimeType};base64,${image.bytes.toString("base64")}`;
  const context = projectContextText(args);

  let content: string;
  try {
    content = await analyseWithResponsesApi({ openai, model, dataUrl, context });
  } catch (responsesError) {
    console.warn("Direction plan-skeleton Responses API analysis failed; using Chat Completions fallback.", responsesError);
    content = await analyseWithChatFallback({ openai, model, dataUrl, context });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("Direction plan-skeleton analysis returned invalid JSON.");
  }

  return normalizeSpatialBrief(parsed, image.storagePath, model);
}
