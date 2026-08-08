import "server-only";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { storeGeneratedAsset } from "@/lib/assets-server";
import { CreditError, withCreditReservation } from "@/lib/credits/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = await request.json();
    const projectId = Number(body.project_id);
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!Number.isFinite(projectId) || !prompt) {
      return NextResponse.json({ success: false, error: "A project and prompt are required." }, { status: 400 });
    }

    const { data: project, error: projectError } = await admin
      .from("user_projects")
      .select("id,project_name")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();
    if (projectError || !project) {
      return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
    }

    const { result, reservation } = await withCreditReservation({
      admin,
      userId: user.id,
      action: "textToImagePreview",
      metadata: { source: "legacy_project_ai", project_id: String(projectId) },
      work: async () => {
        const image = await openai.images.generate({
          model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
          prompt,
          size: "1536x1024",
          quality: "medium",
          n: 1,
        });
        const imageBase64 = image.data?.[0]?.b64_json;
        if (!imageBase64) throw new Error("The image provider returned no image data.");

        const buffer = Buffer.from(imageBase64, "base64");
        const asset = await storeGeneratedAsset({
          admin,
          userId: user.id,
          projectId: String(projectId),
          studio: "project-ai",
          assetType: "image",
          title: `${project.project_name || "Project"} visual`,
          buffer,
          extension: "png",
          contentType: "image/png",
          payload: { prompt },
          metadata: { provider: "openai", model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2" },
        });

        const imageUrl = asset.file_url as string;
        await Promise.all([
          admin.from("ai_images").insert({ user_id: user.id, project_id: projectId, prompt, image_url: imageUrl }),
          admin.from("project_messages").insert({ project_id: projectId, role: "assistant", message: `[IMAGE]${imageUrl}` }),
        ]);
        return { imageUrl, asset };
      },
    });

    return NextResponse.json({
      success: true,
      image_url: result.imageUrl,
      asset: result.asset,
      credits_used: reservation.amount,
    });
  } catch (error) {
    if (error instanceof ApiAuthError || error instanceof CreditError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Generate image error:", error);
    return NextResponse.json({ success: false, error: "Could not generate image." }, { status: 500 });
  }
}
