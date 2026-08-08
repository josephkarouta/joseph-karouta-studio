import "server-only";

import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const body = await request.json();
    const projectId = String(body?.projectId || "").trim();
    const assetId = String(body?.assetId || "").trim();

    if (!projectId || !assetId) {
      return NextResponse.json({ error: "Project and asset are required." }, { status: 400 });
    }

    const { data: asset, error: assetError } = await auth.admin
      .from("project_assets")
      .select("id,user_id,project_id,studio,asset_type,metadata")
      .eq("id", assetId)
      .eq("project_id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", "marketing_studio")
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: assetError?.message || "Marketing asset not found." }, { status: 404 });
    }

    const metadata = asset.metadata && typeof asset.metadata === "object"
      ? asset.metadata as Record<string, unknown>
      : {};
    const viewType = String(metadata.view_type || "");
    const stage = String(metadata.stage || "");
    if (!viewType || stage !== "final") {
      return NextResponse.json(
        { error: "Create the Professional Final before approving this campaign visual." },
        { status: 409 },
      );
    }

    const { data: related } = await auth.admin
      .from("project_assets")
      .select("id,metadata")
      .eq("project_id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", "marketing_studio")
      .order("created_at", { ascending: false });

    for (const item of related || []) {
      if (item.id === assetId) continue;
      const itemMetadata = item.metadata && typeof item.metadata === "object"
        ? item.metadata as Record<string, unknown>
        : {};
      if (
        String(itemMetadata.view_type || "") === viewType
        && (itemMetadata.approved === true || itemMetadata.approved === "true")
      ) {
        await auth.admin
          .from("project_assets")
          .update({ metadata: { ...itemMetadata, approved: false, superseded_at: new Date().toISOString() } })
          .eq("id", item.id)
          .eq("user_id", auth.user.id);
      }
    }

    const approvedAt = new Date().toISOString();
    const { data: approvedAsset, error: updateError } = await auth.admin
      .from("project_assets")
      .update({
        metadata: {
          ...metadata,
          approved: true,
          approved_at: approvedAt,
          approved_by: auth.user.id,
        },
      })
      .eq("id", assetId)
      .eq("user_id", auth.user.id)
      .select("id,metadata")
      .single();

    if (updateError || !approvedAsset) {
      return NextResponse.json({ error: updateError?.message || "Approval could not be saved." }, { status: 500 });
    }

    await auth.admin
      .from("studio_projects")
      .update({ progress: 96, current_step: `visual_${viewType}_approved` })
      .eq("id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", "marketing_studio");

    return NextResponse.json({ success: true, asset: approvedAsset });
  } catch (error) {
    console.error("Marketing asset approval error:", error);
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Approval failed." }, { status: 500 });
  }
}
