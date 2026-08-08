import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

type CanonicalRoom = {
  id?: string;
  name?: string;
  zone?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

type CanonicalLevel = {
  id?: string;
  label?: string;
  rooms?: CanonicalRoom[];
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "room";
}

function roomPriority(name: string) {
  const value = name.toLowerCase();
  if (/entry|foyer|lobby|arrival/.test(value)) return 0;
  if (/living|lounge|family/.test(value)) return 1;
  if (/kitchen|dining/.test(value)) return 2;
  if (/master|primary.*bed|bedroom/.test(value)) return 3;
  if (/terrace|patio|outdoor|garden|pool/.test(value)) return 4;
  if (/office|study|library/.test(value)) return 5;
  return 20;
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = await request.json();
    const projectId = String(body.projectId || "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, error: "Project ID is required." }, { status: 400 });
    }

    const [{ data: project, error: projectError }, { data: planSet, error: planError }] = await Promise.all([
      admin
        .from("architecture_projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single(),
      admin
        .from("architecture_plan_sets")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (projectError || !project) {
      throw new Error(projectError?.message || "Architecture project was not found.");
    }
    if (!project.selected_direction_id) {
      return NextResponse.json(
        { success: false, error: "Select an Architecture Direction before preparing the tour." },
        { status: 400 },
      );
    }
    if (planError || !planSet) {
      return NextResponse.json(
        { success: false, error: "Prepare the connected floor plans before preparing the tour." },
        { status: 400 },
      );
    }

    const generationJson = recordValue(planSet.generation_json);
    const canonicalPlan = recordValue(generationJson.canonical_plan);
    const levels = Array.isArray(canonicalPlan.levels)
      ? canonicalPlan.levels as CanonicalLevel[]
      : [];

    const roomEntries = levels.flatMap((level, levelIndex) =>
      (Array.isArray(level.rooms) ? level.rooms : []).map((room, roomIndex) => ({
        room,
        levelId: String(level.id || `level-${levelIndex + 1}`),
        levelLabel: String(level.label || `Level ${levelIndex + 1}`),
        originalIndex: roomIndex,
      })),
    );

    const selectedRooms = roomEntries
      .filter((entry) => String(entry.room.name || "").trim())
      .sort((one, two) => {
        const priority = roomPriority(String(one.room.name)) - roomPriority(String(two.room.name));
        return priority || one.levelLabel.localeCompare(two.levelLabel) || one.originalIndex - two.originalIndex;
      })
      .filter((entry, index, all) =>
        all.findIndex((candidate) => String(candidate.room.name).toLowerCase() === String(entry.room.name).toLowerCase()) === index,
      )
      .slice(0, 6);

    if (!selectedRooms.length) {
      return NextResponse.json(
        { success: false, error: "No rooms are available in the connected plan model." },
        { status: 400 },
      );
    }

    const { data: existingRows } = await admin
      .from("architecture_visuals")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("direction_id", project.selected_direction_id);

    const existingByType = new Map(
      ((existingRows || []) as Array<Record<string, any>>).map((row) => [String(row.visual_type), row]),
    );

    const rows = selectedRooms.map((entry, index) => {
      const roomName = String(entry.room.name || `Room ${index + 1}`);
      const visualType = `tour_${slug(entry.levelLabel)}_${slug(roomName)}`;
      const next = selectedRooms[(index + 1) % selectedRooms.length];
      const previous = selectedRooms[(index - 1 + selectedRooms.length) % selectedRooms.length];
      const existing = existingByType.get(visualType);
      const existingMetadata = recordValue(existing?.metadata);
      return {
        project_id: projectId,
        user_id: user.id,
        direction_id: project.selected_direction_id,
        visual_type: visualType,
        title: `${roomName} · Immersive Tour`,
        prompt: [
          `Create an immersive room-to-room 360-degree panorama for the ${roomName} on ${entry.levelLabel} of the exact approved project.`,
          "Use the approved floor plans as fixed geometry. Preserve the room proportions, door and window positions, circulation, ceiling height, materials and architecture identity.",
          "Camera position: approximately 1.6 metres above finished floor, near the practical centre of the room, with a wide panoramic field of view and a level horizon.",
          "Compose the left and right edges so they can be panned as a continuous immersive scene. Avoid a standard cropped perspective, extreme fisheye distortion, duplicated furniture or impossible openings.",
          `Show a clear navigable doorway or opening toward ${String(next.room.name || "the next room")} and maintain a believable connection back toward ${String(previous.room.name || "the previous room")}.`,
          "No people, labels, floor-plan graphics, text, watermarks or split-screen layout.",
        ].join("\n\n"),
        metadata: {
          ...existingMetadata,
          group: "tour",
          tour_order: index,
          tour_room_id: String(entry.room.id || visualType),
          tour_room_name: roomName,
          tour_level_id: entry.levelId,
          tour_level_label: entry.levelLabel,
          tour_panorama: true,
          tour_next_visual_type: `tour_${slug(next.levelLabel)}_${slug(String(next.room.name || "room"))}`,
          tour_previous_visual_type: `tour_${slug(previous.levelLabel)}_${slug(String(previous.room.name || "room"))}`,
          room_geometry: entry.room,
          canonical_plan: canonicalPlan,
          prepared_at: new Date().toISOString(),
        },
      };
    });

    const nextTypes = rows.map((row) => row.visual_type);
    const obsolete = ((existingRows || []) as Array<Record<string, any>>).filter((row) => {
      const metadata = recordValue(row.metadata);
      return metadata.group === "tour" && !nextTypes.includes(String(row.visual_type));
    });
    if (obsolete.length) {
      const obsoletePaths = obsolete
        .map((row) => row.storage_path)
        .filter((value): value is string => typeof value === "string" && Boolean(value));
      const { error: deleteError } = await admin
        .from("architecture_visuals")
        .delete()
        .in("id", obsolete.map((row) => row.id));
      if (deleteError) throw new Error(deleteError.message);
      if (obsoletePaths.length) {
        await admin.storage.from("architecture-files").remove(obsoletePaths);
      }
    }

    const { error: upsertError } = await admin
      .from("architecture_visuals")
      .upsert(rows, { onConflict: "direction_id,visual_type" });
    if (upsertError) throw new Error(upsertError.message);

    const { data: visuals, error: visualsError } = await admin
      .from("architecture_visuals")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (visualsError) throw new Error(visualsError.message);

    return NextResponse.json({ success: true, visuals: visuals || [] });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Architecture tour preparation error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "The tour could not be prepared." },
      { status: 500 },
    );
  }
}
