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

export type DirectionSpatialBrief = {
  version: 2;
  source_storage_path: string | null;
  extracted_at: string;
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

  // Machine-checkable visual anchors. These are intentionally simple so
  // downstream plan validation can reject a plan that ignores obvious cues.
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

function cleanList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => cleanString(item, "")).filter(Boolean).slice(0, 16)
    : [];
}

function cleanBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return /^(true|yes|visible|present)$/i.test(value.trim());
  return Boolean(value);
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
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.5;
  return Math.max(0, Math.min(1, number));
}

function normalizeSpatialBrief(
  raw: Record<string, unknown>,
  sourceStoragePath: string | null,
): DirectionSpatialBrief {
  return {
    version: 2,
    source_storage_path: sourceStoragePath,
    extracted_at: new Date().toISOString(),
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
  };
}

function cachedBrief(direction: DirectionRecord) {
  const generationJson = record(direction.generation_json);
  const cached = record(generationJson.direction_spatial_brief);
  const storagePath = typeof direction.image_storage_path === "string"
    ? direction.image_storage_path
    : null;
  if (
    cached.version === 2 &&
    cached.source_storage_path === storagePath &&
    Array.isArray(cached.must_preserve)
  ) {
    return cached as unknown as DirectionSpatialBrief;
  }
  return null;
}

async function directionImageBytes(
  supabase: SupabaseClient,
  direction: DirectionRecord,
) {
  const storagePath = typeof direction.image_storage_path === "string"
    ? direction.image_storage_path
    : null;

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

export async function extractDirectionSpatialBrief(args: {
  supabase: SupabaseClient;
  direction: DirectionRecord;
  project: Record<string, unknown>;
}) {
  const cached = cachedBrief(args.direction);
  if (cached) return cached;

  const image = await directionImageBytes(args.supabase, args.direction);
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for Direction spatial analysis.");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4.1-mini";
  const dataUrl = `data:${image.mimeType};base64,${image.bytes.toString("base64")}`;

  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    max_completion_tokens: 2200,
    messages: [
      {
        role: "system",
        content: [
          "You are Heyy Studio's architectural spatial analyst.",
          "Analyze the SELECTED DIRECTION IMAGE as a spatial reference for the exact same project that will later receive floor plans.",
          "Extract only relationships that are genuinely visible or strongly implied. Never invent hidden room layouts.",
          "The goal is to stop the floor-plan generator from turning the selected direction into a different property.",
          "Return JSON only and include every requested key.",
          "Use concise natural-language descriptions for descriptive keys.",
          "For machine-checkable position keys, use ONLY one of: front_left, front_center, front_right, left_side, right_side, rear_left, rear_center, rear_right, courtyard, unknown.",
          "'Front' means the visible primary facade / foreground side in the direction image, not geographic north.",
          "Set *_visible to true only when the feature is actually visible or unmistakably implied.",
          "Pay particular attention to pool placement relative to the house, main entry, approach steps/terraces, outdoor dining/living, garage, site terracing, footprint/massing family and upper-level setbacks/projections.",
          "For must_preserve, list the visible spatial relationships that a later ground-floor or upper-floor plan must retain.",
          "For unknown_or_hidden, explicitly list information that cannot be inferred from this camera view.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              `Project type: ${cleanString(args.project.project_type, "Architecture project")}.`,
              `Project notes: ${cleanString(args.project.notes, "not supplied")}.`,
              "Return exactly these JSON keys:",
              "site_condition, footprint_family, building_orientation_read, main_entry_position, primary_approach, garage_relationship, pool_relationship, outdoor_living_relationship, landscape_terracing, massing_character, upper_level_relationship, visible_spatial_notes, must_preserve, unknown_or_hidden, confidence, pool_visible, pool_position, entry_visible, entry_position, approach_steps_visible, approach_position, outdoor_living_visible, outdoor_living_position, terracing_visible, garage_visible, garage_position.",
              "confidence is a number from 0 to 1 for the overall spatial read.",
            ].join("\n"),
          },
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
        ] as any,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("Direction spatial analysis returned no result.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("Direction spatial analysis returned invalid JSON.");
  }

  return normalizeSpatialBrief(parsed, image.storagePath);
}
