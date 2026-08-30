import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdminApiCapability } from "@/lib/server/admin-api";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RevisionFileMeta = {
  revisionId: string;
  status: string;
  revisionNumber: number | null;
};

async function getRevisionFileMeta(jobId: string) {
  const { data: links, error: linksError } = await supabase
    .from("workspace_revision_files")
    .select("deliverable_id,revision_id")
    .eq("production_job_id", jobId);

  if (linksError) throw linksError;

  const revisionIds = Array.from(
    new Set((links || []).map((item: any) => item.revision_id).filter(Boolean))
  );

  const revisionMap = new Map<string, any>();

  if (revisionIds.length > 0) {
    const { data: revisions, error: revisionsError } = await supabase
      .from("workspace_revisions")
      .select("id,status,revision_number")
      .in("id", revisionIds);

    if (revisionsError) throw revisionsError;

    for (const revision of revisions || []) {
      revisionMap.set(revision.id, revision);
    }
  }

  const metaByDeliverableId = new Map<string, RevisionFileMeta>();

  for (const link of links || []) {
    if (!link.deliverable_id) continue;

    const revision = revisionMap.get(link.revision_id);

    metaByDeliverableId.set(link.deliverable_id, {
      revisionId: link.revision_id,
      status: revision?.status || "Unknown",
      revisionNumber: revision?.revision_number ?? null,
    });
  }

  return metaByDeliverableId;
}

function canAppearInFinalHandoff(meta?: RevisionFileMeta) {
  return !meta || meta.status === "Approved";
}


export async function GET(request: NextRequest) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  try {
    const jobId = request.nextUrl.searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Missing jobId" },
        { status: 400 }
      );
    }

    const [revisionMeta, deliverablesResult] = await Promise.all([
      getRevisionFileMeta(jobId),
      supabase
        .from("production_deliverables")
        .select("*")
        .eq("production_job_id", jobId)
        .order("uploaded_at", { ascending: false }),
    ]);

    if (deliverablesResult.error) throw deliverablesResult.error;

    const deliverables = (deliverablesResult.data || [])
      .filter((file: any) => canAppearInFinalHandoff(revisionMeta.get(file.id)))
      .map((file: any) => {
        const meta = revisionMeta.get(file.id);

        return {
          ...file,
          source: meta ? "approved_revision" : "production",
          revision_id: meta?.revisionId || null,
          revision_status: meta?.status || null,
          revision_number: meta?.revisionNumber || null,
        };
      });

    return NextResponse.json({
      success: true,
      deliverables,
    });
  } catch (error: any) {
    console.error("Load production deliverables error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Could not load deliverables",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  try {
    const body = await request.json();

    const deliverableId = body.deliverableId as string | undefined;
    const jobId = body.jobId as string | undefined;

    if (!deliverableId || !jobId) {
      return NextResponse.json(
        { success: false, error: "Missing deliverableId or jobId" },
        { status: 400 }
      );
    }

    const { data: target, error: targetError } = await supabase
      .from("production_deliverables")
      .select("*")
      .eq("id", deliverableId)
      .eq("production_job_id", jobId)
      .single();

    if (targetError || !target) {
      throw targetError || new Error("Deliverable not found");
    }

    const revisionMeta = await getRevisionFileMeta(jobId);
    const targetRevision = revisionMeta.get(deliverableId);

    if (targetRevision && targetRevision.status !== "Approved") {
      return NextResponse.json(
        {
          success: false,
          error: "The client must approve this revision before it can become the final deliverable.",
        },
        { status: 400 }
      );
    }

    /*
     * The current V12 rule is one active Final for the entire production job.
     * Older delivered versions stay client-visible as history.
     */
    const { error: clearError } = await supabase
      .from("production_deliverables")
      .update({ is_final: false })
      .eq("production_job_id", jobId);

    if (clearError) throw clearError;

    const { data: deliverable, error: updateError } = await supabase
      .from("production_deliverables")
      .update({ is_final: true })
      .eq("id", deliverableId)
      .select()
      .single();

    if (updateError || !deliverable) {
      throw updateError || new Error("Could not mark file as final");
    }

    await supabase.from("production_timeline").insert({
      production_job_id: jobId,
      title: `New final selected: ${deliverable.filename}`,
      description: `Version ${deliverable.version || 1} is now the active final. Previously delivered files remain available in client history.`,
      status: "Final File Selected",
      created_by: "Admin",
    });

    return NextResponse.json({
      success: true,
      deliverable,
    });
  } catch (error: any) {
    console.error("Finalize deliverable error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Could not mark file as final",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  try {
    const body = await request.json();

    const deliverableId = body.deliverableId as string | undefined;
    const jobId = body.jobId as string | undefined;

    if (!deliverableId || !jobId) {
      return NextResponse.json(
        { success: false, error: "Missing deliverableId or jobId" },
        { status: 400 }
      );
    }

    const { data: target, error: targetError } = await supabase
      .from("production_deliverables")
      .select("*")
      .eq("id", deliverableId)
      .eq("production_job_id", jobId)
      .single();

    if (targetError || !target) {
      throw targetError || new Error("Deliverable not found");
    }

    if (target.client_visible) {
      return NextResponse.json(
        {
          success: false,
          error: "Delivered files cannot be deleted because they are already available to the client",
        },
        { status: 400 }
      );
    }

    const revisionMeta = await getRevisionFileMeta(jobId);

    if (revisionMeta.has(deliverableId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Revision files must be deleted from the Revision Workspace",
        },
        { status: 400 }
      );
    }

    const originalFilename = target.original_filename || target.filename;

    const { error: deleteError } = await supabase
      .from("production_deliverables")
      .delete()
      .eq("id", deliverableId)
      .eq("production_job_id", jobId);

    if (deleteError) throw deleteError;

    let restoredLatestId: string | null = null;

    if (target.is_latest && originalFilename) {
      const { data: remainingFiles, error: remainingError } = await supabase
        .from("production_deliverables")
        .select("id,version")
        .eq("production_job_id", jobId)
        .eq("original_filename", originalFilename)
        .order("version", { ascending: false });

      if (remainingError) throw remainingError;

      const newestRemaining = (remainingFiles || []).find(
        (file: any) => !revisionMeta.has(file.id)
      );

      if (newestRemaining?.id) {
        const { error: clearLatestError } = await supabase
          .from("production_deliverables")
          .update({ is_latest: false })
          .eq("production_job_id", jobId)
          .eq("original_filename", originalFilename);

        if (clearLatestError) throw clearLatestError;

        const { error: restoreLatestError } = await supabase
          .from("production_deliverables")
          .update({ is_latest: true })
          .eq("id", newestRemaining.id);

        if (restoreLatestError) throw restoreLatestError;

        restoredLatestId = newestRemaining.id;
      }
    }

    if (target.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("production-files")
        .remove([target.storage_path]);

      if (storageError) {
        console.error("Deliverable storage cleanup failed:", storageError);
      }
    }

    return NextResponse.json({
      success: true,
      deletedDeliverableId: deliverableId,
      restoredLatestId,
    });
  } catch (error: any) {
    console.error("Delete production deliverable error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Could not delete deliverable",
      },
      { status: 500 }
    );
  }
}
