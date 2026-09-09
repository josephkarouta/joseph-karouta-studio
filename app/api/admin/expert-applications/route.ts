import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { recordAdminAudit } from "@/lib/admin/audit";

const APPLICATION_STATUSES = ["new", "reviewing", "shortlisted", "rejected"] as const;
const OPEN_STATUSES = ["new", "reviewing", "shortlisted"] as const;
const AVAILABILITY = ["available", "limited", "unavailable"] as const;

type Row = Record<string, any>;

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
    const status = clean(params.get("status") || "open").toLowerCase();
    const studio = clean(params.get("studio") || "all");
    const availability = clean(params.get("availability") || "all").toLowerCase();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const admin = adminClient();
    const { data: positions, error: positionsError } = await admin
      .from("career_positions")
      .select("id,title,department,location")
      .order("title", { ascending: true });
    if (positionsError) throw positionsError;

    const positionRows = (positions || []) as Row[];
    const studioOptions = Array.from(new Set(positionRows.map((item) => clean(item.department)).filter(Boolean))).sort();
    const studioPositionIds = studio === "all"
      ? []
      : positionRows.filter((item) => clean(item.department) === studio).map((item) => clean(item.id)).filter(Boolean);

    if (studio !== "all" && studioPositionIds.length === 0) {
      return NextResponse.json({
        items: [], page, pageSize, total: 0, totalPages: 1,
        filters: { studios: studioOptions, statuses: APPLICATION_STATUSES, availability: AVAILABILITY },
      });
    }

    let query = admin
      .from("career_applications")
      .select("*", { count: "exact" })
      .eq("application_kind", "expert_network")
      .neq("status", "approved")
      .neq("status", "hired")
      .order("created_at", { ascending: false });

    if (status === "open") {
      query = query.in("status", [...OPEN_STATUSES]);
    } else if (status !== "all" && APPLICATION_STATUSES.includes(status as (typeof APPLICATION_STATUSES)[number])) {
      query = query.eq("status", status);
    }
    if (availability !== "all" && AVAILABILITY.includes(availability as (typeof AVAILABILITY)[number])) {
      query = query.eq("availability", availability);
    }
    if (studioPositionIds.length) query = query.in("position_id", studioPositionIds);
    if (q) {
      const pattern = `%${q}%`;
      query = query.or(`name.ilike.${pattern},email.ilike.${pattern},location.ilike.${pattern},message.ilike.${pattern}`);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const positionMap = new Map(positionRows.map((item) => [clean(item.id), item]));
    const items = ((data || []) as Row[]).map((row) => {
      const position = positionMap.get(clean(row.position_id));
      return {
        ...row,
        position_title: clean(position?.title) || "Role unavailable",
        position_department: clean(position?.department),
        position_location: clean(position?.location),
      };
    });

    const total = Number(count || 0);
    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      filters: { studios: studioOptions, statuses: APPLICATION_STATUSES, availability: AVAILABILITY },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Expert applications could not be loaded." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireAdminApiCapability("careers");
    if (access.response) return access.response;

    const body = (await request.json()) as Record<string, unknown>;
    const id = clean(body.id);
    const status = clean(body.status).toLowerCase();
    if (!id) return NextResponse.json({ error: "Application is required." }, { status: 400 });
    if (!APPLICATION_STATUSES.includes(status as (typeof APPLICATION_STATUSES)[number])) {
      return NextResponse.json({ error: "Choose a valid application status." }, { status: 400 });
    }

    const { data, error } = await adminClient()
      .from("career_applications")
      .update({ status })
      .eq("id", id)
      .eq("application_kind", "expert_network")
      .select("*")
      .single();
    if (error) throw error;

    await recordAdminAudit({
      actorUserId: access.user?.id || null,
      action: "expert.application.status_updated",
      entityType: "career_application",
      entityId: id,
      summary: `Updated Expert application status to ${status}`,
      metadata: { status },
    });

    return NextResponse.json({ success: true, application: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Expert application could not be updated." },
      { status: 500 },
    );
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
    if (!id) return NextResponse.json({ error: "Application is required." }, { status: 400 });

    const admin = adminClient();
    const { data: application, error: loadError } = await admin
      .from("career_applications")
      .select("id,name,email,resume_url,application_kind")
      .eq("id", id)
      .eq("application_kind", "expert_network")
      .maybeSingle();
    if (loadError) throw loadError;
    if (!application) return NextResponse.json({ error: "Expert application not found." }, { status: 404 });

    const { count: linkedProfiles, error: linkedError } = await admin
      .from("expert_profiles")
      .select("id", { count: "exact", head: true })
      .eq("application_id", id);
    if (linkedError) throw linkedError;
    if (linkedProfiles) {
      return NextResponse.json(
        { error: "This application already belongs to an Expert profile. Delete the Expert from the Experts page instead." },
        { status: 409 },
      );
    }

    const resumePath = clean(application.resume_url);
    if (resumePath) {
      const { error: storageError } = await admin.storage
        .from("career-application-files")
        .remove([resumePath]);
      if (storageError) console.warn("Expert application CV cleanup failed:", storageError);
    }

    const { error: deleteError } = await admin
      .from("career_applications")
      .delete()
      .eq("id", id)
      .eq("application_kind", "expert_network");
    if (deleteError) throw deleteError;

    await recordAdminAudit({
      actorUserId: access.user?.id || null,
      action: "expert.application.deleted",
      entityType: "career_application",
      entityId: id,
      summary: `Deleted Expert Network application for ${String(application.name || application.email || id)}`,
      metadata: { email: application.email || null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Expert application could not be deleted." },
      { status: 500 },
    );
  }
}
