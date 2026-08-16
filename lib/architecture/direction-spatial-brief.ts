
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DirectionSpatialBrief = {
  version: 1;
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
    ? value.map((item) => cleanString(item, "")).filter(Boolean).slice(0, 12)
    : [];
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
    version: 1,
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
  };
}

function cachedBrief(direction: DirectionRecord) {
  const generationJson = record(direction.generation_json);
  const cached = record(generationJson.direction_spatial_brief);
  const storagePath = typeof direction.image_storage_path === "string"
    ? direction.image_storage_path
    : null;
  if (
    cached.version === 1 &&
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
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for Direction spatial analysis.");
  }

  const model = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4.1-mini";
  const dataUrl = `data:${image.mimeType};base64,${image.bytes.toString("base64")}`;
  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    max_completion_tokens: 1800,
    messages: [
      {
        role: "system",
        content: [
          "You are Heyy Studio's architectural spatial analyst.",
          "Analyze the supplied SELECTED DIRECTION IMAGE as a visual spatial brief for the SAME project that will later receive floor plans.",
          "Extract only relationships that are genuinely visible or strongly implied by the image. Never invent hidden room layouts.",
          "Your job is to stop the plan generator from turning the selected direction into a different property.",
          "Return JSON only.",
          "Use concise natural-language values rather than long prose.",
          "Pay special attention to the visible building footprint/massing family, entry side and approach, exterior steps/terraces, pool location relative to the house, outdoor dining/living location, garage relationship if visible, site slope/terracing, upper-level setbacks/projections and courtyard/wing relationships.",
          "For must_preserve, list only spatial relationships that a later ground-floor/upper-floor plan should visibly respect.",
          "For unknown_or_hidden, explicitly list information that cannot be inferred from this perspective so later planning can solve it from the user's brief rather than hallucinating it.",
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
              "site_condition, footprint_family, building_orientation_read, main_entry_position, primary_approach, garage_relationship, pool_relationship, outdoor_living_relationship, landscape_terracing, massing_character, upper_level_relationship, visible_spatial_notes, must_preserve, unknown_or_hidden, confidence.",
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
