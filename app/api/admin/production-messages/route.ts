import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdminApiAccess } from "@/lib/server/admin-api";
import {
  cleanMessage,
  createProductionMessage,
  extractMessageFiles,
  loadProductionMessages,
  ProductionMessageInputError,
} from "@/lib/production/messages";
import { Notifications } from "@/lib/notifications";
import { getStudioLabel } from "@/lib/studio/studio-identity";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  try {
    const jobId = request.nextUrl.searchParams.get("jobId")?.trim() || "";

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Missing production job." },
        { status: 400 },
      );
    }

    const { data: job, error: jobError } = await supabase
      .from("production_jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Production job not found." },
        { status: 404 },
      );
    }

    const { count: unreadClientCount, error: unreadError } = await supabase
      .from("production_messages")
      .select("id", { count: "exact", head: true })
      .eq("production_job_id", job.id)
      .eq("sender_type", "client")
      .is("read_by_admin_at", null);

    if (unreadError) throw unreadError;

    const { error: readError } = await supabase
      .from("production_messages")
      .update({ read_by_admin_at: new Date().toISOString() })
      .eq("production_job_id", job.id)
      .eq("sender_type", "client")
      .is("read_by_admin_at", null);

    if (readError) throw readError;

    const messages = await loadProductionMessages(supabase, job.id);

    return NextResponse.json({
      success: true,
      messages,
      unreadClientCount: unreadClientCount || 0,
    });
  } catch (error) {
    console.error("Load admin production messages error:", error);
    return NextResponse.json(
      { success: false, error: "Could not load the production conversation." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  try {
    const contentType = request.headers.get("content-type") || "";
    let jobId = "";
    let message = "";
    let files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      jobId = cleanMessage(formData.get("jobId") || formData.get("production_job_id"));
      message = cleanMessage(formData.get("message"));
      files = extractMessageFiles(formData);
    } else {
      const body = await request.json();
      jobId = cleanMessage(body?.jobId || body?.production_job_id);
      message = cleanMessage(body?.message);
    }

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Missing production job." },
        { status: 400 },
      );
    }

    const { data: job, error: jobError } = await supabase
      .from("production_jobs")
      .select(
        "id,user_id,project_id,project_name,studio,assigned_studio,service,status",
      )
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Production job not found." },
        { status: 404 },
      );
    }

    const senderName = getStudioLabel(job.assigned_studio || job.studio);
    const created = await createProductionMessage({
      admin: supabase,
      jobId: job.id,
      senderType: "studio",
      senderName,
      message,
      files,
    });

    if (job.user_id) {
      await Notifications.emit({
        event: "production.message.studio",
        projectId: job.project_id || undefined,
        projectName: job.project_name || undefined,
        service: job.service || undefined,
        studio: job.studio || job.assigned_studio || undefined,
        userId: job.user_id,
        metadata: {
          productionJobId: job.id,
          messageId: created.id,
          message: message || `${files.length} attachment${files.length === 1 ? "" : "s"}`,
          attachmentCount: files.length,
          senderName,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: created,
    });
  } catch (error) {
    console.error("Send admin production message error:", error);

    if (error instanceof ProductionMessageInputError) {
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
