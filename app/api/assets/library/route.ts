import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { loadAssetLibrary } from "@/lib/assets/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const library = await loadAssetLibrary(admin, user.id);
    return NextResponse.json({ success: true, ...library });
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
