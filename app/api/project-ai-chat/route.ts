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

async function checkUsageLimit(userId: string, plan: string) {
  if (plan === "pro") {
    return { allowed: true };
  }

  const monthlyLimit = plan === "starter" ? 100 : 999999;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("ai_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("usage_type", "project_chat")
    .gte("used_at", startOfMonth.toISOString());

  if (error) {
    console.error("Usage check error:", error);
    return { allowed: true };
  }

  if ((count || 0) >= monthlyLimit) {
    return {
      allowed: false,
      limit: monthlyLimit,
      used: count || 0,
    };
  }

  return { allowed: true, limit: monthlyLimit, used: count || 0 };
}

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

  const { data: images, error: imagesError } = await supabase
    .from("ai_images")
    .select("*")
    .eq("project_id", project_id)
    .order("created_at", { ascending: true });

  if (imagesError) throw imagesError;

  return NextResponse.json({
    success: true,
    project,
    messages: messages || [],
    images: images || [],
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

You must stay focused on the saved project and Heyy Studio services.

Only help with:
- branding
- graphic design
- websites
- events
- architecture
- interior design
- creative strategy
- AI creative workflows

If the user asks about unrelated topics, politely refuse and redirect back to the project.

Use this response:
"I’m here to help develop this creative project. I can help with branding, design directions, moodboards, websites, interiors, architecture, events or expert-ready next steps."

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

  const plan = subscription?.plan || "free";

if (plan === "free") {
  return NextResponse.json(
    {
      success: false,
      error: "Upgrade required",
    },
    { status: 403 }
  );
}

const model =
  plan === "pro"
    ? "gpt-5.5"
    : "gpt-4.1";

    const usage = await checkUsageLimit(user_id, plan);

if (!usage.allowed) {
  return NextResponse.json(
    {
      success: false,
      error: `You've reached your monthly AI chat limit of ${usage.limit} messages. Upgrade your plan to continue.`,
    },
    { status: 403 }
  );
}

    const completion = await openai.chat.completions.create({
      model,
      max_completion_tokens: 700,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...(existingMessages || [])
  .filter((item: any) => !item.message?.startsWith("[IMAGE]"))
  .slice(-10)
  .map((item: any) => ({
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

    const { error: usageInsertError } = await supabase
  .from("ai_usage")
  .insert({
    user_id,
    plan,
    usage_type: "project_chat",
  });

console.log("Project AI usage insert error:", usageInsertError);

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
