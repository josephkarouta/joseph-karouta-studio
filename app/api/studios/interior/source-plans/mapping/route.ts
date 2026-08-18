import "server-only";

import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

type RoomMapping = { id: string; name: string; notes?: string };

const SOURCE_PLAN_TYPES = new Set(["interior_source_plan_preview", "interior_source_document"]);

function cleanRoomMappings(value: unknown): RoomMapping[] {
  if (!Array.isArray(value)) return [];

  const rooms: RoomMapping[] = [];

  value.slice(0, 80).forEach((item, index) => {
    if (!item || typeof item !== "object") return;

    const record = item as Record<string, unknown>;
    const name = String(record.name || "").trim().slice(0, 160);
    if (!name) return;

    const id =
      String(record.id || `room-${index + 1}`).trim().slice(0, 180) ||
      `room-${index + 1}`;
    const notes = String(record.notes || "").trim().slice(0, 500);

    rooms.push(notes ? { id, name, notes } : { id, name });
  });

  return rooms;
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const body = await request.json();
    const projectId = String(body?.projectId || "").trim();
    const assetId = String(body?.assetId || "").trim();
    const floorLabel = String(body?.floorLabel || "").trim().slice(0, 160);
    const rooms = cleanRoomMappings(body?.rooms);

    if (!projectId || !assetId) {
      return NextResponse.json({ success: false, error: "Project and uploaded plan are required." }, { status: 400 });
    }
    if (!floorLabel) {
      return NextResponse.json({ success: false, error: "Add a floor or plan name before saving the room mapping." }, { status: 400 });
    }

    const { data: project, error: projectError } = await auth.admin
      .from("studio_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", "interior_studio")
      .maybeSingle();
    if (projectError || !project) {
      return NextResponse.json({ success: false, error: projectError?.message || "Interior project not found." }, { status: 404 });
    }

    const { data: asset, error: assetError } = await auth.admin
      .from("project_assets")
      .select("id,asset_type,metadata")
      .eq("id", assetId)
      .eq("project_id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", "interior_studio")
      .maybeSingle();
    if (assetError || !asset || !SOURCE_PLAN_TYPES.has(String(asset.asset_type || ""))) {
      return NextResponse.json({ success: false, error: assetError?.message || "Uploaded source plan not found." }, { status: 404 });
    }

    const metadata = asset.metadata && typeof asset.metadata === "object"
      ? asset.metadata as Record<string, unknown>
      : {};

    const nextMetadata = {
      ...metadata,
      floor_label: floorLabel,
      room_mappings: rooms,
      room_mapping_updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await auth.admin
      .from("project_assets")
      .update({ metadata: nextMetadata })
      .eq("id", assetId)
      .eq("project_id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", "interior_studio");
    if (updateError) throw new Error(updateError.message || "Room mapping could not be saved.");

    return NextResponse.json({ success: true, floorLabel, rooms });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Room mapping could not be saved.";
    console.error("Interior source-plan room mapping error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
