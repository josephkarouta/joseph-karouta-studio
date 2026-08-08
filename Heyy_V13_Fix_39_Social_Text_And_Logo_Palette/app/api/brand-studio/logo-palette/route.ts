import "server-only";

import { NextResponse } from "next/server";
import { requireBrandImageProject } from "@/lib/brand/generated-image-storage";
import { extractLogoPaletteFromUrl } from "@/lib/brand/logo-palette";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const projectId = typeof body?.projectId === "string" ? body.projectId : "";
    const logoUrl = typeof body?.logoUrl === "string" ? body.logoUrl.trim() : "";

    if (!projectId || !logoUrl) {
      return NextResponse.json(
        { error: "A Brand project and selected logo are required." },
        { status: 400 },
      );
    }

    await requireBrandImageProject(projectId);
    const palette = await extractLogoPaletteFromUrl(logoUrl);
    return NextResponse.json({ success: true, palette });
  } catch (error) {
    console.error("Logo palette extraction error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to extract colours from the selected logo.",
      },
      { status: 500 },
    );
  }
}
