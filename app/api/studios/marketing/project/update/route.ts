import "server-only";

import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";

export const runtime = "nodejs";

type MarketingPatch = {
  selectedCampaignAngle?: number;
  calendar?: Array<Record<string, unknown>>;
};

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const body = await request.json();
    const projectId = String(body?.projectId || "").trim();
    const patch = body?.patch && typeof body.patch === "object"
      ? body.patch as MarketingPatch
      : {};

    if (!projectId) {
      return NextResponse.json({ error: "Project is required." }, { status: 400 });
    }

    const { data: project, error: projectError } = await auth.admin
      .from("studio_projects")
      .select("id,output")
      .eq("id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", "marketing_studio")
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: projectError?.message || "Marketing project not found." },
        { status: 404 },
      );
    }

    const output = project.output && typeof project.output === "object" && !Array.isArray(project.output)
      ? project.output as Record<string, unknown>
      : {};
    const nextOutput: Record<string, unknown> = { ...output };

    if (patch.selectedCampaignAngle !== undefined) {
      const angleIndex = Number(patch.selectedCampaignAngle);
      if (!Number.isInteger(angleIndex) || angleIndex < 0 || angleIndex > 20) {
        return NextResponse.json({ error: "Choose a valid campaign angle." }, { status: 400 });
      }
      nextOutput.selectedCampaignAngle = angleIndex;
    }

    if (patch.calendar !== undefined) {
      if (!Array.isArray(patch.calendar) || patch.calendar.length > 120) {
        return NextResponse.json({ error: "The campaign calendar is not valid." }, { status: 400 });
      }
      nextOutput.calendar = patch.calendar.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? item
          : {},
      );
    }

    const { data: updated, error: updateError } = await auth.admin
      .from("studio_projects")
      .update({
        output: nextOutput,
        current_step: patch.calendar ? "campaign_calendar_updated" : "campaign_strategy_updated",
      })
      .eq("id", projectId)
      .eq("user_id", auth.user.id)
      .eq("studio", "marketing_studio")
      .select("id,output")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message || "Marketing project changes could not be saved." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, output: updated.output });
  } catch (error) {
    console.error("Marketing project update error:", error);
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Marketing project update failed." },
      { status: 500 },
    );
  }
}
