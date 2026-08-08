import { NextRequest, NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

const REVIEWABLE_REVISION_STATUSES = [
  "Waiting Approval",
  "Changes Requested",
  "Approved",
];

export async function POST(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = await request.json();
    const path = typeof body?.path === "string" ? body.path.trim() : "";

    if (!path || path.length > 1_000 || path.includes("..")) {
      return NextResponse.json(
        { success: false, error: "Invalid production file." },
        { status: 400 },
      );
    }

    const { data: deliverable, error: deliverableError } = await admin
      .from("production_deliverables")
      .select("id,production_job_id,storage_path,filename,original_filename,client_visible")
      .eq("storage_path", path)
      .maybeSingle();

    if (deliverableError) throw deliverableError;

    if (!deliverable) {
      return NextResponse.json(
        { success: false, error: "Production file not found." },
        { status: 404 },
      );
    }

    const { data: job, error: jobError } = await admin
      .from("production_jobs")
      .select("id,user_id")
      .eq("id", deliverable.production_job_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobError) throw jobError;

    if (!job) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this file." },
        { status: 403 },
      );
    }

    let canDownload = Boolean(deliverable.client_visible);

    if (!canDownload) {
      const { data: revisionFile, error: revisionFileError } = await admin
        .from("workspace_revision_files")
        .select("revision_id")
        .eq("deliverable_id", deliverable.id)
        .eq("production_job_id", job.id)
        .maybeSingle();

      if (revisionFileError) throw revisionFileError;

      if (revisionFile?.revision_id) {
        const { data: revision, error: revisionError } = await admin
          .from("workspace_revisions")
          .select("status,client_visible")
          .eq("id", revisionFile.revision_id)
          .eq("production_job_id", job.id)
          .maybeSingle();

        if (revisionError) throw revisionError;

        canDownload = Boolean(
          revision?.client_visible &&
            REVIEWABLE_REVISION_STATUSES.includes(revision.status),
        );
      }
    }

    if (!canDownload) {
      return NextResponse.json(
        {
          success: false,
          error: "This file has not been released to the client yet.",
        },
        { status: 403 },
      );
    }

    const fallbackFilename =
      deliverable.storage_path.split("/").pop() || "production-file";
    const downloadFilename = String(
      deliverable.original_filename || deliverable.filename || fallbackFilename,
    )
      .replace(/[\r\n]/g, "")
      .replace(/[\\/]/g, "-")
      .trim() || "production-file";

    const { data, error: signedUrlError } = await admin.storage
      .from("production-files")
      .createSignedUrl(deliverable.storage_path, 60 * 5, {
        download: downloadFilename,
      });

    if (signedUrlError || !data?.signedUrl) {
      throw signedUrlError || new Error("Could not create download link.");
    }

    return NextResponse.json({
      success: true,
      url: data.signedUrl,
      filename: downloadFilename,
      expiresIn: 300,
    });
  } catch (error) {
    console.error("Client production file download error:", error);

    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { success: false, error: "Could not create download link." },
      { status: 500 },
    );
  }
}
