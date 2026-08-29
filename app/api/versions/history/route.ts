import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { loadVersionHistory } from "@/lib/versions/history";
import { getWorkspaceStorageEntitlement } from "@/lib/workspace-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const entitlement = await getWorkspaceStorageEntitlement(admin, user.id);
    if (!entitlement.canBrowse) {
      return NextResponse.json({ success: true, families: [], totalVersions: 0, storage: entitlement });
    }
    const history = await loadVersionHistory(admin, user.id);
    return NextResponse.json({ success: true, ...history, storage: entitlement });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("Version history load error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Could not load version history." }, { status: 500 });
  }
}
