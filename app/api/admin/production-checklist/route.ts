import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { recordAdminAudit } from "@/lib/admin/audit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type ChecklistTemplateContent = {
  items?: unknown[];
};

type ChecklistTemplateRow = {
  id: string;
  studio: string | null;
  service_id: string | null;
  content: ChecklistTemplateContent | null;
  updated_at: string | null;
};

const CHECKLIST_TEMPLATES: Record<string, string[]> = {
  brand_studio: [
    "Brief Reviewed",
    "Brand Strategy Reviewed",
    "Production Started",
    "Files Created",
    "Quality Assurance",
    "Package Uploaded",
    "Ready For Delivery",
  ],
  marketing_studio: [
    "Brief Reviewed",
    "Campaign Requirements Reviewed",
    "Production Started",
    "Assets Created",
    "Quality Assurance",
    "Package Uploaded",
    "Ready For Delivery",
  ],
  architecture_studio: [
    "Brief Reviewed",
    "Site Requirements Reviewed",
    "Floor Plan Prepared",
    "Render Prepared",
    "Materials Checked",
    "Package Uploaded",
    "Ready For Delivery",
  ],
  interior_studio: [
    "Brief Reviewed",
    "Moodboard Reviewed",
    "Layout Prepared",
    "Render Prepared",
    "Furniture / Materials Checked",
    "Package Uploaded",
    "Ready For Delivery",
  ],
};

export async function GET(request: NextRequest) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ success: false, error: "Missing jobId" }, { status: 400 });

  let { data, error } = await supabase
    .from("production_checklist")
    .select("*")
    .eq("production_job_id", jobId)
    .order("position");

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  if (!data || data.length === 0) {
    const { data: job, error: jobError } = await supabase
      .from("production_jobs")
      .select("studio,service,service_id")
      .eq("id", jobId)
      .single();
    if (jobError || !job) return NextResponse.json({ success: false, error: jobError?.message || "Production job not found." }, { status: 404 });

    const template = await resolveChecklistTemplate(job.studio, job.service_id);
    const autoCompletedOnCreate = new Set(["Brief Reviewed", "Brand Strategy Reviewed"]);
    const rows = template.map((title, index) => ({
      production_job_id: jobId,
      title,
      position: index,
      completed: autoCompletedOnCreate.has(title),
    }));

    const created = await supabase
      .from("production_checklist")
      .upsert(rows, { onConflict: "production_job_id,title" })
      .select();
    if (created.error) return NextResponse.json({ success: false, error: created.error.message }, { status: 500 });
    data = created.data || [];
  }

  return NextResponse.json({ success: true, items: data });
}

export async function POST(request: NextRequest) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;
  const body = await request.json();
  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ success: false, error: "Checklist item ID is required." }, { status: 400 });

  const current = await supabase
    .from("production_checklist")
    .select("id,production_job_id,title,completed")
    .eq("id", id)
    .single();
  if (current.error || !current.data) return NextResponse.json({ success: false, error: current.error?.message || "Checklist item not found." }, { status: 404 });

  const completed = !current.data.completed;
  const updated = await supabase.from("production_checklist").update({ completed }).eq("id", id);
  if (updated.error) return NextResponse.json({ success: false, error: updated.error.message }, { status: 500 });

  await recordAdminAudit({
    actorUserId: access.user!.id,
    action: completed ? "production_checklist.completed" : "production_checklist.reopened",
    entityType: "production_job",
    entityId: current.data.production_job_id,
    summary: `${completed ? "Completed" : "Reopened"} checklist item: ${current.data.title}`,
    metadata: { checklist_item_id: id },
  });

  return NextResponse.json({ success: true, completed });
}

async function resolveChecklistTemplate(studio: unknown, serviceId: unknown): Promise<string[]> {
  const normalizedStudio = String(studio || "brand_studio").trim();
  const normalizedService = String(serviceId || "").trim();
  try {
    let query = supabase
      .from("admin_saved_templates")
      .select("id,studio,service_id,content,updated_at")
      .eq("kind", "checklist")
      .eq("enabled", true)
      .or(`studio.is.null,studio.eq.${normalizedStudio}`)
      .order("updated_at", { ascending: false });
    const { data } = await query.limit(50);
    const rows = (data || []) as ChecklistTemplateRow[];
    const best = rows.find((row) => row.service_id && normalizedService && row.service_id === normalizedService)
      || rows.find((row) => !row.service_id && row.studio === normalizedStudio)
      || rows.find((row) => !row.service_id && !row.studio);
    const rawItems = Array.isArray(best?.content?.items) ? best.content.items : [];
    const items = rawItems
      .map((item: unknown) => String(item).trim())
      .filter((item: string) => Boolean(item));
    if (items.length) return items;
  } catch {
    // Keep existing production workflow available before/without custom templates.
  }
  return CHECKLIST_TEMPLATES[normalizedStudio] || CHECKLIST_TEMPLATES.brand_studio;
}
