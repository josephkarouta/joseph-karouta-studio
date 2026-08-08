import { NextRequest, NextResponse } from "next/server";

import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import {
  cleanMessage,
  createProductionMessage,
  extractMessageFiles,
  loadProductionMessages,
  ProductionMessageInputError,
} from "@/lib/production/messages";
import { Notifications } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const jobId = request.nextUrl.searchParams.get("jobId")?.trim() || "";

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Missing production job." },
        { status: 400 },
      );
    }

    const { data: job, error: jobError } = await admin
      .from("production_jobs")
      .select("id,user_id,project_id,project_name,studio,service")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Production conversation not found." },
        { status: 404 },
      );
    }

    const { count: unreadCount, error: unreadError } = await admin
      .from("production_messages")
      .select("id", { count: "exact", head: true })
      .eq("production_job_id", job.id)
      .in("sender_type", ["studio", "system"])
      .is("read_by_client_at", null);

    if (unreadError) throw unreadError;

    const now = new Date().toISOString();
    const { error: readError } = await admin
      .from("production_messages")
      .update({ read_by_client_at: now })
      .eq("production_job_id", job.id)
      .in("sender_type", ["studio", "system"])
      .is("read_by_client_at", null);

    if (readError) throw readError;

    const messages = await loadProductionMessages(admin, job.id);

    return NextResponse.json({
      success: true,
      messages,
      unreadCount: unreadCount || 0,
    });
  } catch (error) {
    console.error("Load client production messages error:", error);

    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { success: false, error: "Could not load the production conversation." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const formData = await request.formData();
    const jobId = cleanMessage(formData.get("jobId"));
    const message = cleanMessage(formData.get("message"));
    const files = extractMessageFiles(formData);

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Missing production job." },
        { status: 400 },
      );
    }

    const { data: job, error: jobError } = await admin
      .from("production_jobs")
      .select("id,user_id,project_id,project_name,studio,service,status")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this conversation." },
        { status: 403 },
      );
    }

    if (String(job.status || "").toLowerCase() === "completed") {
      return NextResponse.json(
        {
          success: false,
          error: "This production job is complete. Start a new request for additional work.",
        },
        { status: 400 },
      );
    }

    const senderName =
      cleanMessage(user.user_metadata?.full_name) ||
      cleanMessage(user.user_metadata?.name) ||
      cleanMessage(user.email) ||
      "Client";

    const created = await createProductionMessage({
      admin,
      jobId: job.id,
      senderType: "client",
      senderName,
      senderUserId: user.id,
      message,
      files,
    });

    await Notifications.emit({
      event: "production.message.client",
      projectId: job.project_id || undefined,
      projectName: job.project_name || undefined,
      service: job.service || undefined,
      studio: job.studio || undefined,
      userId: user.id,
      clientName: senderName,
      clientEmail: user.email || null,
      metadata: {
        productionJobId: job.id,
        messageId: created.id,
        message: message || `${files.length} attachment${files.length === 1 ? "" : "s"}`,
        attachmentCount: files.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: created,
    });
  } catch (error) {
    console.error("Send client production message error:", error);

    if (error instanceof ApiAuthError || error instanceof ProductionMessageInputError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { success: false, error: "Could not send the message." },
      { status: 500 },
    );
  }
}
