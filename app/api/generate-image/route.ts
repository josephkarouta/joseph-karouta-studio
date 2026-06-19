import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { user_id, project_id, prompt } = await req.json();

    if (!user_id || !project_id || !prompt) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("plan")
      .eq("user_id", user_id)
      .eq("status", "active")
      .single();

    if (subscription?.plan !== "pro") {
      return NextResponse.json(
        { success: false, error: "Image generation is available on Pro only." },
        { status: 403 }
      );
    }

    const image = await openai.images.generate({
      model: "gpt-image-2",
      prompt,
      size: "1536x1024",
      quality: "medium",
      n: 1,
    });

    const imageBase64 = image.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error("No image returned");
    }

    const imageUrl = `data:image/png;base64,${imageBase64}`;

    await supabase.from("ai_images").insert({
      user_id,
      project_id,
      prompt,
      image_url: imageUrl,
    });

    await supabase.from("project_messages").insert({
  project_id,
  role: "assistant",
  message: `[IMAGE]${imageUrl}`,
});

    return NextResponse.json({
      success: true,
      image_url: imageUrl,
    });
  } catch (error) {
    console.error("Generate image error:", error);

    return NextResponse.json(
      { success: false, error: "Could not generate image" },
      { status: 500 }
    );
  }
}