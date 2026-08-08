import "server-only";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function checkUsageLimit(admin: SupabaseClient, userId: string, plan: string) {
  if (plan === "pro") return { allowed: true, limit: null, used: 0 };

  const monthlyLimit = plan === "starter" ? 100 : 0;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error } = await admin
    .from("ai_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("usage_type", "project_chat")
    .gte("used_at", startOfMonth.toISOString());

  if (error) {
    console.error("Project AI usage check failed:", error);
    return { allowed: true, limit: monthlyLimit, used: 0 };
  }

  return {
    allowed: (count || 0) < monthlyLimit,
    limit: monthlyLimit,
    used: count || 0,
  };
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = await request.json();
    const action = typeof body.action === "string" ? body.action : "";
    const projectId = Number(body.project_id);
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!Number.isFinite(projectId)) {
      return NextResponse.json({ success: false, error: "A valid project ID is required." }, { status: 400 });
    }

    const { data: project, error: projectError } = await admin
      .from("user_projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
    }

    if (action === "load") {
      const [{ data: messages, error: messagesError }, { data: images, error: imagesError }] = await Promise.all([
        admin.from("project_messages").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
        admin.from("ai_images").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
      ]);

      if (messagesError) throw messagesError;
      if (imagesError) throw imagesError;

      return NextResponse.json({ success: true, project, messages: messages || [], images: images || [] });
    }

    if (action !== "send") {
      return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ success: false, error: "A message is required." }, { status: 400 });
    }

    const { data: subscription } = await admin
      .from("user_subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();
    const plan = subscription?.plan || "free";

    if (plan === "free") {
      return NextResponse.json({ success: false, error: "Upgrade required" }, { status: 403 });
    }

    const usage = await checkUsageLimit(admin, user.id, plan);
    if (!usage.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `You've reached your monthly AI chat limit of ${usage.limit} messages. Upgrade your plan to continue.`,
        },
        { status: 403 },
      );
    }

    const { data: existingMessages, error: existingMessagesError } = await admin
      .from("project_messages")
      .select("role,message,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(20);
    if (existingMessagesError) throw existingMessagesError;

    const { error: userMessageError } = await admin.from("project_messages").insert({
      project_id: projectId,
      role: "user",
      message,
    });
    if (userMessageError) throw userMessageError;

    const systemPrompt = `
You are Heyy Studio AI Studio. Stay focused on the saved creative project and Heyy Studio services.
Help with branding, graphic design, websites, architecture, interior design, marketing, creative strategy and expert-ready next steps.
Use the saved project brief as the source of truth. Give practical, structured and concise answers.
When the request falls outside the project, politely redirect the user to a relevant Heyy Studio workflow.

Saved Project Brief:
${project.project_brief || "No brief provided."}
`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
      max_completion_tokens: 700,
      messages: [
        { role: "system", content: systemPrompt },
        ...(existingMessages || [])
          .filter((item: { message?: string }) => !item.message?.startsWith("[IMAGE]"))
          .slice(-10)
          .map((item: { role?: string; message?: string }) => ({
            role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: item.message || "",
          })),
        { role: "user", content: message },
      ],
    });

    const aiMessage = completion.choices[0]?.message?.content || "I could not generate a response. Please try again.";
    const { data: assistantMessage, error: assistantMessageError } = await admin
      .from("project_messages")
      .insert({ project_id: projectId, role: "assistant", message: aiMessage })
      .select()
      .single();
    if (assistantMessageError) throw assistantMessageError;

    const { error: usageInsertError } = await admin.from("ai_usage").insert({
      user_id: user.id,
      plan,
      usage_type: "project_chat",
    });
    if (usageInsertError) console.error("Project AI usage insert failed:", usageInsertError);

    return NextResponse.json({ success: true, message: assistantMessage });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Project AI chat error:", error);
    return NextResponse.json({ success: false, error: "Could not process AI message." }, { status: 500 });
  }
}
