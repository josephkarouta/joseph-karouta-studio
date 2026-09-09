import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { productionServiceMatches, resolveProductionService } from "@/lib/production/service-registry";

type RevisionFileMeta = {
  revisionId: string;
  status: string;
  revisionNumber: number | null;
};

async function getRevisionFileMeta(admin: SupabaseClient, jobId: string) {
  const { data: links, error: linksError } = await admin
    .from("workspace_revision_files")
    .select("deliverable_id,revision_id")
    .eq("production_job_id", jobId);

  if (linksError) throw linksError;

  const revisionIds = Array.from(
    new Set((links || []).map((item: any) => item.revision_id).filter(Boolean)),
  );

  const revisionMap = new Map<string, any>();

  if (revisionIds.length > 0) {
    const { data: revisions, error: revisionsError } = await admin
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
  return (
    !meta ||
    meta.status === "Approved" ||
    meta.status === "Waiting Approval"
  );
}

export async function GET(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const serviceId = request.nextUrl.searchParams.get("serviceId");
    const service = request.nextUrl.searchParams.get("service");

    if (!projectId || (!serviceId && !service)) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 },
      );
    }

    const expectedService = resolveProductionService({ serviceId, service });
    const { data: projectJobs, error: jobError } = await admin
      .from("production_jobs")
      .select("id,status,created_at,service_id,service,studio,metadata")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (jobError) throw jobError;

    const job = (projectJobs || []).find((item: any) =>
      productionServiceMatches(item, expectedService),
    );

    if (!job) {
      return NextResponse.json({
        success: true,
        deliverables: [],
        groups: [],
        status: null,
      });
    }

    const [deliverablesResult, revisionMeta] = await Promise.all([
      admin
        .from("production_deliverables")
        .select("*")
        .eq("production_job_id", job.id),
      getRevisionFileMeta(admin, job.id),
    ]);

    if (deliverablesResult.error) throw deliverablesResult.error;

    const publishedDeliverables = (deliverablesResult.data || [])
      // Keep every version that was ever delivered to the client. Some older
      // rows may no longer carry client_visible=true after later package
      // curation, but published_at proves the client received that version.
      .filter((file: any) => Boolean(file.client_visible || file.published_at))
      .map((file: any) => {
        const meta = revisionMeta.get(file.id);

        return {
          ...file,
          source: meta
            ? meta.status === "Waiting Approval"
              ? "revision_review"
              : meta.status === "Approved"
                ? "approved_revision"
                : "revision_history"
            : "production",
          revision_id: meta?.revisionId || null,
          revision_number: meta?.revisionNumber || null,
          revision_status: meta?.status || null,
          eligible_for_final_handoff: canAppearInFinalHandoff(meta),
        };
      })
      .sort((a: any, b: any) => {
        const aDate = new Date(a.published_at || a.uploaded_at || 0).getTime();
        const bDate = new Date(b.published_at || b.uploaded_at || 0).getTime();

        return aDate - bDate;
      });

    if (publishedDeliverables.length === 0) {
      return NextResponse.json({
        success: true,
        deliverables: [],
        groups: [],
        status: job.status,
      });
    }

    const byOriginalFilename = new Map<string, any[]>();
    for (const file of publishedDeliverables) {
      const key = String(file.original_filename || file.filename || file.id || "deliverable");
      const current = byOriginalFilename.get(key) || [];
      current.push(file);
      byOriginalFilename.set(key, current);
    }

    const groups = Array.from(byOriginalFilename.entries())
      .map(([name, versions]) => {
        const sortedVersions = [...versions].sort((a: any, b: any) => {
          const aDate = new Date(a.published_at || a.uploaded_at || 0).getTime();
          const bDate = new Date(b.published_at || b.uploaded_at || 0).getTime();
          return aDate - bDate;
        });
        const eligibleVersions = sortedVersions.filter((file: any) => file.client_visible && file.eligible_for_final_handoff !== false);
        const reviewCandidate = [...eligibleVersions]
          .reverse()
          .find((file: any) => file.source === "revision_review");
        const finalFile =
          reviewCandidate ||
          [...eligibleVersions].reverse().find((file: any) => file.is_final) ||
          eligibleVersions[eligibleVersions.length - 1] ||
          sortedVersions[sortedVersions.length - 1];

        return {
          name,
          finalFile,
          versions: sortedVersions,
          revisionNumber: finalFile?.revision_number ?? null,
          source: finalFile?.source || "production",
        };
      })
      .sort((a: any, b: any) => {
        const aDate = new Date(a.finalFile?.published_at || a.finalFile?.uploaded_at || 0).getTime();
        const bDate = new Date(b.finalFile?.published_at || b.finalFile?.uploaded_at || 0).getTime();
        return bDate - aDate;
      });

    return NextResponse.json({
      success: true,
      deliverables: publishedDeliverables,
      groups,
      status: job.status,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    console.error("Load client deliverables error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load client deliverables",
      },
      { status: 500 },
    );
  }
}
