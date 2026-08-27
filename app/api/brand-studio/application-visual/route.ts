import "server-only";

import { NextResponse } from "next/server";
import { CreditError } from "@/lib/credits/server";
import { startBrandImageJob } from "@/lib/brand/brand-image-job-start";
import { getBrandApplicationCreditCost } from "@/lib/brand/application-visual-pricing";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function applicationProvider(): "openai" | "gemini" {
  return process.env.BRAND_APPLICATION_IMAGE_PROVIDER?.toLowerCase() === "gemini"
    ? "gemini"
    : "openai";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body?.project || {};
    const application = body?.application || {};
    const applicationId = safeText(application?.id);
    const logoReferenceUrl = safeText(body?.logoReferenceUrl);

    if (!project?.id || !applicationId) {
      return NextResponse.json(
        { error: "A Brand project and application are required." },
        { status: 400 },
      );
    }
    if (!logoReferenceUrl) {
      return NextResponse.json(
        { error: "Select or upload the project logo before generating this application." },
        { status: 400 },
      );
    }

    const provider = applicationProvider();
    const creditCost = getBrandApplicationCreditCost(applicationId, body?.brief || {});
    const result = await startBrandImageJob({
      request,
      projectId: String(project.id),
      tool: "brand_application_visual",
      action: "brandApplicationVisual",
      provider,
      input: body,
      amountOverride: creditCost,
      metadata: {
        application_id: applicationId,
        image_provider: provider,
        credit_cost: creditCost,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Brand application visual start error:", error);
    if (error instanceof CreditError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start the application visual." },
      { status: 500 },
    );
  }
}
