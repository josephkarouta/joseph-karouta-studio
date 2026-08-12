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
    const direction = body?.direction || {};
    const tier = body?.tier === "final" ? "final" : "preview";

    if (!project?.id || !project?.project_name || !direction?.title) {
      return NextResponse.json(
        { error: "Project, project ID and creative direction are required." },
        { status: 400 },
      );
    }

    const result = await startBrandImageJob({
      request,
      projectId: String(project.id),
      tool: "brand_moodboard",
      action: tier === "final" ? "brandProfessionalFinal" : "brandMoodboard",
      provider: "openai",
      input: { ...body, tier },
      metadata: { tier, image_provider: "openai" },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Creative-direction image start error:", error);
    if (error instanceof CreditError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start the creative-direction image." },
      { status: 500 },
    );
  }
}
