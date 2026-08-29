import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { getWorkspaceStorageEntitlement, storageAccessError } from "@/lib/workspace-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VersionRow = {
  id: string;
  user_id: string;
  family_key: string;
  source_kind: string;
  source_id: string;
  version_number: number;
  status: string;
  snapshot: Record<string, any>;
};

function asObject(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

async function getVersion(admin: any, userId: string, id: string): Promise<VersionRow | null> {
  const { data, error } = await admin.from("project_version_history").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as VersionRow | null;
}

function clonePayload(sourceKind: string, snapshot: Record<string, any>, versionId: string) {
  const clone = { ...snapshot };
  delete clone.id;
  delete clone.created_at;
  delete clone.updated_at;
  delete clone.uploaded_at;
  delete clone.published_at;
  if (sourceKind === "project_asset") {
    clone.version = Number(snapshot.version || 0) + 1;
    clone.metadata = { ...asObject(snapshot.metadata), restored_from_version_id: versionId, change_summary: "Restored from an earlier version" };
  }
  if (sourceKind.startsWith("architecture_")) {
    clone.metadata = { ...asObject(snapshot.metadata), restored_from_version_id: versionId, change_summary: "Restored from an earlier version" };
    if (sourceKind === "architecture_visual") clone.is_approved = true;
    if (sourceKind === "architecture_direction") clone.is_selected = true;
  }
  return clone;
}

function tableFor(sourceKind: string) {
  return sourceKind === "project_asset" ? "project_assets"
    : sourceKind === "architecture_visual" ? "architecture_visuals"
      : sourceKind === "architecture_direction" ? "architecture_directions"
        : sourceKind === "architecture_concept" ? "architecture_concepts"
          : null;
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const entitlement = await getWorkspaceStorageEntitlement(admin, user.id);
    if (!entitlement.canManage) {
      return NextResponse.json({ success: false, error: storageAccessError(entitlement) }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    const versionId = String(body.versionId || "");
    if (!versionId) return NextResponse.json({ success: false, error: "Version is required." }, { status: 400 });
    const version = await getVersion(admin, user.id, versionId);
    if (!version) return NextResponse.json({ success: false, error: "Version not found." }, { status: 404 });

    if (action === "note") {
      const userNote = String(body.note || "").trim().slice(0, 1000) || null;
      const { error } = await admin.from("project_version_history").update({ user_note: userNote, updated_at: new Date().toISOString() }).eq("id", version.id).eq("user_id", user.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "status") {
      const status = String(body.status || "").toLowerCase();
      if (!(["draft", "approved", "rejected", "final", "source"] as string[]).includes(status)) {
        return NextResponse.json({ success: false, error: "Invalid version status." }, { status: 400 });
      }
      const { error } = await admin.from("project_version_history").update({ status, updated_at: new Date().toISOString() }).eq("id", version.id).eq("user_id", user.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "restore") {
      if (version.source_kind === "production_deliverable" || version.status === "source") {
        return NextResponse.json({ success: false, error: "Source drawings and delivered production files are immutable and cannot be restored over." }, { status: 409 });
      }

      const table = tableFor(version.source_kind);
      let newSourceId: string | null = null;
      let cloned = false;
      if (table) {
        const payload = clonePayload(version.source_kind, asObject(version.snapshot), version.id);
        const { data: inserted, error: insertError } = await admin.from(table).insert(payload).select("id").single();
        if (!insertError && inserted?.id) {
          cloned = true;
          newSourceId = String(inserted.id);
          await admin.from("project_version_history").update({
            restored_from_version_id: version.id,
            change_summary: `Restored from version ${version.version_number}`,
            updated_at: new Date().toISOString(),
          }).eq("source_kind", version.source_kind).eq("source_id", newSourceId).eq("user_id", user.id);
        }
      }

      if (!cloned) {
        // Safe fallback for source schemas with one-row-per-project constraints: move the history pointer only.
        await admin.from("project_version_history").update({ is_current: false, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("family_key", version.family_key);
        const { error } = await admin.from("project_version_history").update({ is_current: true, updated_at: new Date().toISOString() }).eq("id", version.id).eq("user_id", user.id);
        if (error) throw error;
      }

      return NextResponse.json({ success: true, mode: cloned ? "restored-copy" : "history-selection", newSourceId });
    }

    return NextResponse.json({ success: false, error: "Unsupported version action." }, { status: 400 });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("Version action error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not update version history." }, { status: 500 });
  }
}
