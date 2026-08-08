import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Notifications } from "@/lib/notifications";
import { requireAdminApiAccess } from "@/lib/server/admin-api";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  try {
    const body = await request.json();
    const requestId = String(body.requestId || "").trim();
    const questionId = String(body.questionId || "").trim();
    const message = String(body.message || "").trim();

    if (!requestId || !questionId || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "Request, question and reply are required.",
        },
        { status: 400 },
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { success: false, error: "Keep the reply under 2,000 characters." },
        { status: 400 },
      );
    }

    const { data: studioRequest, error: requestError } = await supabase
      .from("studio_requests")
      .select("id,project_id,project_name,user_id,studio,service_id,service,metadata")
      .eq("id", requestId)
      .single();

    if (requestError || !studioRequest) {
      return NextResponse.json(
        { success: false, error: "Studio request not found." },
        { status: 404 },
      );
    }

    const metadata =
      studioRequest.metadata && typeof studioRequest.metadata === "object"
        ? studioRequest.metadata
        : {};

    const questions = Array.isArray(metadata.quote_questions)
      ? metadata.quote_questions
      : [];

    const questionIndex = questions.findIndex(
      (question: any) => String(question?.id || "") === questionId,
    );

    if (questionIndex < 0) {
      return NextResponse.json(
        { success: false, error: "Quote question not found." },
        { status: 404 },
      );
    }

    const currentQuestion = questions[questionIndex] || {};
    const previousReplies = Array.isArray(currentQuestion.replies)
      ? currentQuestion.replies
      : [];

    const reply = {
      id: randomUUID(),
      sender_type: "studio",
      sender_name: "Heyy Studio",
      message,
      created_at: new Date().toISOString(),
    };

    const nextQuestions = [...questions];
    nextQuestions[questionIndex] = {
      ...currentQuestion,
      status: "answered",
      answered_at: reply.created_at,
      replies: [...previousReplies, reply],
    };

    const { error: updateError } = await supabase
      .from("studio_requests")
      .update({
        metadata: {
          ...metadata,
          quote_questions: nextQuestions,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) throw updateError;

    await Notifications.emit({
      event: "quote.replied",
      projectId: studioRequest.project_id,
      projectName: studioRequest.project_name,
      service: studioRequest.service,
      studio: studioRequest.studio,
      userId: studioRequest.user_id,
      metadata: {
        serviceId: studioRequest.service_id || studioRequest.metadata?.service_id,
        requestId: studioRequest.id,
        questionId,
        questionMessage: String(currentQuestion.message || "").trim(),
        replyId: reply.id,
        replyMessage: reply.message,
      },
    });

    return NextResponse.json({ success: true, reply });
  } catch (error) {
    console.error("Quote reply error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Reply could not be sent.",
      },
      { status: 500 },
    );
  }
}
