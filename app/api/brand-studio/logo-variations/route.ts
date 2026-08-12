import "server-only";

import { NextResponse } from "next/server";
import { CreditError } from "@/lib/credits/server";
import { startBrandImageJob } from "@/lib/brand/brand-image-job-start";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body?.project || {};
    const selectedLogo = body?.selectedLogo || {};

    if (!project?.id) {
      return NextResponse.json({ error: "A Brand project ID is required." }, { status: 400 });
    }
    if (!selectedLogo?.imageUrl) {
      return NextResponse.json({ error: "Select a generated logo before creating a variation." }, { status: 400 });
    }

    const result = await startBrandImageJob({
      request,
      projectId: String(project.id),
      tool: "brand_logo_variation",
      action: "brandVariation",
      provider: "openai",
      input: body,
      metadata: { image_provider: "openai" },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Logo variation start error:", error);
    if (error instanceof CreditError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start the logo variation." },
      { status: 500 },
    );
  }
}
