import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { loadAssetLibrary } from "@/lib/assets/library";
import { getWorkspaceStorageEntitlement } from "@/lib/workspace-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const entitlement = await getWorkspaceStorageEntitlement(admin, user.id);
    if (!entitlement.canBrowse) {
      return NextResponse.json({
        success: true,
        items: [],
        projects: [],
        setupRequired: false,
        versionHistoryReady: true,
        storage: entitlement,
      });
    }
    const library = await loadAssetLibrary(admin, user.id);
    return NextResponse.json({ success: true, ...library, storage: entitlement });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Assets library load error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Could not load the Assets Library." },
      { status: 500 },
    );
  }
}
