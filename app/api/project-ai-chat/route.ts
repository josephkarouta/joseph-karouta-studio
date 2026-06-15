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
    const body = await req.json();
    const { action, project_id, user_id, message } = body;

    if (!project_id || !user_id) {
      return NextResponse.json(
        { success: false, error: "Missing project_id or user_id" },
        { status: 400 }
      );
    }

    const { data: project, error: projectError } = await supabase
      .from("user_projects")
      .select("*")
      .eq("id", project_id)
      .eq("user_id", user_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    if (action === "load") {
      const { data: messages, error: messagesError } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      return NextResponse.json({
        success: true,
        project,
        messages: messages || [],
      });
    }

    if (action !== "send") {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    if (!message?.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing message" },
        { status: 400 }
      );
    }

    const { data: existingMessages, error: existingMessagesError } = await supabase
      .from("project_messages")
      .select("role,message,created_at")
      .eq("project_id", project_id)
      .order("created_at", { ascending: true })
      .limit(20);

    if (existingMessagesError) throw existingMessagesError;

    const { error: userMessageError } = await supabase
      .from("project_messages")
      .insert({
        project_id,
        role: "user",
        message: message.trim(),
      });

    if (userMessageError) throw userMessageError;

    const systemPrompt = `
You are Heyy Studio AI Studio.

You help users continue developing a saved creative, branding, website, architecture, interior or event project.

Use the saved project brief as your source of truth.
Give practical, creative and structured answers.
Keep answers useful, clear and not too long.
When helpful, give options, directions, checklists or next steps.
Do not say you cannot see the brief. The brief is provided below.

Saved Project Brief:
${project.project_brief || "No brief provided."}
`;

const { data: subscription } = await supabase
  .from("user_subscriptions")
  .select("plan")
  .eq("user_id", user_id)
  .single();

const model =
  subscription?.plan === "pro"
    ? "gpt-4.1"
    : "gpt-4.1-nano";

    const completion = await openai.chat.completions.create({
      model,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...(existingMessages || []).map((item: any) => ({
  role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
  content: item.message,
})),
        {
          role: "user",
          content: message.trim(),
        },
      ],
    });

    const aiMessage =
      completion.choices[0]?.message?.content ||
      "I could not generate a response. Please try again.";

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from("project_messages")
      .insert({
        project_id,
        role: "assistant",
        message: aiMessage,
      })
      .select()
      .single();

    if (assistantMessageError) throw assistantMessageError;

    return NextResponse.json({
      success: true,
      message: assistantMessage,
    });
  } catch (error) {
    console.error("Project AI chat error:", error);

    return NextResponse.json(
      { success: false, error: "Could not process AI message" },
      { status: 500 }
    );
  }
}
