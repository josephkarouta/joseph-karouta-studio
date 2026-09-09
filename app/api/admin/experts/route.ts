import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { recordAdminAudit } from "@/lib/admin/audit";

const STATUSES = ["invited", "active", "paused", "inactive"] as const;
const AVAILABILITY = ["available", "limited", "unavailable"] as const;
const STUDIOS = ["brand_studio", "marketing_studio", "architecture_studio", "interior_studio"] as const;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function safeSearch(value: string) {
  return value.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export async function GET(request: Request) {
  try {
    const access = await requireAdminApiCapability("careers");
    if (access.response) return access.response;

    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(5, Number.parseInt(params.get("pageSize") || "10", 10) || 10));
    const q = safeSearch(params.get("q") || "");
    const status = clean(params.get("status") || "all").toLowerCase();
    const availability = clean(params.get("availability") || "all").toLowerCase();
    const studio = clean(params.get("studio") || "all");
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = adminClient()
      .from("expert_profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status !== "all" && STATUSES.includes(status as (typeof STATUSES)[number])) query = query.eq("status", status);
    if (availability !== "all" && AVAILABILITY.includes(availability as (typeof AVAILABILITY)[number])) query = query.eq("availability", availability);
    if (studio !== "all" && STUDIOS.includes(studio as (typeof STUDIOS)[number])) query = query.eq("studio", studio);
    if (q) {
      const pattern = `%${q}%`;
      query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern},role_title.ilike.${pattern},location.ilike.${pattern}`);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    const total = Number(count || 0);
    return NextResponse.json({
      experts: data || [],
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      filters: { statuses: STATUSES, availability: AVAILABILITY, studios: STUDIOS },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Experts could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireAdminApiCapability("careers");
    if (access.response) return access.response;
    const body = (await request.json()) as Record<string, unknown>;
    const id = clean(body.id);
    if (!id) return NextResponse.json({ error: "Expert profile is required." }, { status: 400 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) {
      const status = clean(body.status).toLowerCase();
      if (!STATUSES.includes(status as (typeof STATUSES)[number])) return NextResponse.json({ error: "Invalid Expert status." }, { status: 400 });
      update.status = status;
    }
    if (body.availability !== undefined) {
      const availability = clean(body.availability).toLowerCase();
      if (!AVAILABILITY.includes(availability as (typeof AVAILABILITY)[number])) return NextResponse.json({ error: "Invalid Expert availability." }, { status: 400 });
      update.availability = availability;
    }
    if (body.internalNotes !== undefined) update.internal_notes = clean(body.internalNotes).slice(0, 5000) || null;

    const { data, error } = await adminClient().from("expert_profiles").update(update).eq("id", id).select("*").single();
    if (error) throw error;

    await recordAdminAudit({
      actorUserId: access.user?.id || null,
      action: "expert.profile.updated",
      entityType: "expert_profile",
      entityId: id,
      summary: `Updated Expert profile for ${String(data.full_name || data.email || id)}`,
      metadata: { status: data.status, availability: data.availability },
    });

    return NextResponse.json({ success: true, expert: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Expert profile could not be updated." }, { status: 500 });
  }
}


export async function DELETE(request: Request) {
  try {
    const access = await requireAdminApiCapability("careers");
    if (access.response) return access.response;

    const params = new URL(request.url).searchParams;
    const body = request.headers.get("content-type")?.includes("application/json")
      ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
      : {};
    const id = clean(body.id || params.get("id"));
    if (!id) return NextResponse.json({ error: "Expert profile is required." }, { status: 400 });

    const admin = adminClient();
    const { data: expert, error: loadError } = await admin
      .from("expert_profiles")
      .select("id,application_id,full_name,email,status")
      .eq("id", id)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!expert) return NextResponse.json({ error: "Expert profile not found." }, { status: 404 });

    const { count: assignmentCount, error: assignmentError } = await admin
      .from("expert_assignments")
      .select("id", { count: "exact", head: true })
      .eq("expert_profile_id", id);
    if (assignmentError) throw assignmentError;

    if (assignmentCount) {
      return NextResponse.json(
        {
          error: "This Expert has project history and cannot be permanently deleted. Set the Expert status to Inactive instead so production records remain intact.",
          code: "expert_has_project_history",
        },
        { status: 409 },
      );
    }

    const applicationId = clean(expert.application_id);
    if (applicationId) {
      const { data: application } = await admin
        .from("career_applications")
        .select("resume_url")
        .eq("id", applicationId)
        .maybeSingle();
      const resumePath = clean(application?.resume_url);
      if (resumePath) {
        const { error: storageError } = await admin.storage
          .from("career-application-files")
          .remove([resumePath]);
        if (storageError) console.warn("Expert CV cleanup failed:", storageError);
      }
    }

    const { error: deleteError } = await admin.from("expert_profiles").delete().eq("id", id);
    if (deleteError) throw deleteError;

    if (applicationId) {
      const { error: applicationDeleteError } = await admin
        .from("career_applications")
        .delete()
        .eq("id", applicationId)
        .eq("application_kind", "expert_network");
      if (applicationDeleteError) console.warn("Linked Expert application cleanup failed:", applicationDeleteError);
    }

    await recordAdminAudit({
      actorUserId: access.user?.id || null,
      action: "expert.profile.deleted",
      entityType: "expert_profile",
      entityId: id,
      summary: `Deleted Expert profile for ${String(expert.full_name || expert.email || id)}`,
      metadata: { email: expert.email || null, previous_status: expert.status || null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Expert profile could not be deleted." }, { status: 500 });
  }
}
