import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ArchitectureFloorGenerationRole =
  | "ground_floor_from_direction"
  | "upper_floor_from_approved_floor"
  | "level_from_approved_floors"
  | "normal";

export type ArchitectureReferenceDescriptor = {
  id: string;
  visualType: string;
  title: string;
  storagePath: string | null;
  url: string | null;
  metadata: Record<string, unknown>;
};

export type ArchitectureReferenceBundle = {
  generationRole: ArchitectureFloorGenerationRole;
  targetFloorIndex: number | null;
  direction: {
    id: string;
    storagePath: string;
    url: string | null;
    generationJson: Record<string, unknown>;
  };
  approvedFloors: ArchitectureReferenceDescriptor[];
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function preferredDirectionPath(direction: Record<string, unknown>) {
  const metadata = recordValue(direction.generation_json);
  const finalAssets = recordValue(metadata.final_assets);
  const previewAssets = recordValue(metadata.preview_assets);
  const candidates = [
    finalAssets.master_storage_path,
    previewAssets.master_storage_path,
    direction.image_storage_path,
  ];
  return candidates.find((value): value is string => typeof value === "string" && Boolean(value)) || null;
}

function floorReferencePath(visual: Record<string, unknown>) {
  const metadata = recordValue(visual.metadata);
  const technical = recordValue(metadata.technical_assets);
  const candidates = [
    technical.master_storage_path,
    technical.preview_storage_path,
    visual.storage_path,
  ];
  return candidates.find((value): value is string => typeof value === "string" && Boolean(value)) || null;
}

function floorReferenceUrl(visual: Record<string, unknown>) {
  const metadata = recordValue(visual.metadata);
  const technical = recordValue(metadata.technical_assets);
  const candidates = [technical.master_url, technical.preview_url, visual.image_url];
  return candidates.find((value): value is string => typeof value === "string" && Boolean(value)) || null;
}

export function floorIndexFromArchitectureVisualType(visualType: string) {
  if (visualType === "ground_floor") return 0;
  if (visualType === "upper_floor") return 1;
  const match = visualType.match(/^level_(\d+)_floor$/);
  return match ? Number(match[1]) : null;
}

export function architectureFloorVisualType(index: number) {
  if (index <= 0) return "ground_floor";
  if (index === 1) return "upper_floor";
  return `level_${index}_floor`;
}

export function architectureFloorGenerationRole(visualType: string): ArchitectureFloorGenerationRole {
  const index = floorIndexFromArchitectureVisualType(visualType);
  if (index === 0) return "ground_floor_from_direction";
  if (index === 1) return "upper_floor_from_approved_floor";
  if (index !== null && index > 1) return "level_from_approved_floors";
  return "normal";
}

export async function buildArchitectureReferenceBundle(args: {
  admin: SupabaseClient;
  userId: string;
  projectId: string;
  targetVisualType: string;
}): Promise<ArchitectureReferenceBundle> {
  const [{ data: project, error: projectError }, { data: visuals, error: visualsError }] = await Promise.all([
    args.admin
      .from("architecture_projects")
      .select("id,selected_direction_id")
      .eq("id", args.projectId)
      .eq("user_id", args.userId)
      .maybeSingle(),
    args.admin
      .from("architecture_visuals")
      .select("id,visual_type,title,image_url,storage_path,is_approved,metadata")
      .eq("project_id", args.projectId)
      .eq("user_id", args.userId),
  ]);

  if (projectError || !project) {
    throw new Error(projectError?.message || "Architecture project not found while preparing connected references.");
  }
  if (visualsError) throw new Error(visualsError.message || "Architecture plan references could not be loaded.");

  const selectedDirectionId = typeof project.selected_direction_id === "string"
    ? project.selected_direction_id
    : "";
  if (!selectedDirectionId) {
    throw new Error("Select an Architecture Direction before generating connected plans.");
  }

  const { data: direction, error: directionError } = await args.admin
    .from("architecture_directions")
    .select("id,image_url,image_storage_path,generation_json")
    .eq("id", selectedDirectionId)
    .eq("project_id", args.projectId)
    .eq("user_id", args.userId)
    .maybeSingle();
  if (directionError || !direction) {
    throw new Error(directionError?.message || "The selected Architecture Direction could not be loaded.");
  }

  const directionPath = preferredDirectionPath(direction as Record<string, unknown>);
  if (!directionPath) {
    throw new Error("Generate the selected Architecture Direction visual before generating connected floor plans.");
  }

  const targetFloorIndex = floorIndexFromArchitectureVisualType(args.targetVisualType);
  const generationRole = architectureFloorGenerationRole(args.targetVisualType);
  const planRows = ((visuals || []) as Array<Record<string, unknown>>)
    .filter((visual) => floorIndexFromArchitectureVisualType(String(visual.visual_type || "")) !== null);

  const approvedFloors: ArchitectureReferenceDescriptor[] = [];
  if (targetFloorIndex !== null && targetFloorIndex > 0) {
    for (let index = 0; index < targetFloorIndex; index += 1) {
      const visualType = architectureFloorVisualType(index);
      const floor = planRows.find((row) => String(row.visual_type || "") === visualType);
      const metadata = recordValue(floor?.metadata);
      const storagePath = floor ? floorReferencePath(floor) : null;
      const url = floor ? floorReferenceUrl(floor) : null;
      const stale = metadata.stale === true;

      if (!floor || floor.is_approved !== true || stale || (!storagePath && !url)) {
        const label = index === 0 ? "Ground Floor" : index === 1 ? "Upper Floor" : `Level ${index}`;
        throw new Error(`Approve the ${label} detailed plan before generating the next floor.`);
      }

      approvedFloors.push({
        id: String(floor.id),
        visualType,
        title: String(floor.title || labelForFloor(index)),
        storagePath,
        url,
        metadata,
      });
    }
  }

  return {
    generationRole,
    targetFloorIndex,
    direction: {
      id: String(direction.id),
      storagePath: directionPath,
      url: typeof direction.image_url === "string" ? direction.image_url : null,
      generationJson: recordValue(direction.generation_json),
    },
    approvedFloors,
  };
}

function labelForFloor(index: number) {
  return index === 0 ? "Ground Floor Plan" : index === 1 ? "Upper Floor Plan" : `Level ${index} Plan`;
}
