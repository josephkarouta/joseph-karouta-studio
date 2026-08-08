import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdminApiAccess } from "@/lib/server/admin-api";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json(
      { success: false, error: "Missing jobId" },
      { status: 400 }
    );
  }

  let { data, error } = await supabase
    .from("production_checklist")
    .select("*")
    .eq("production_job_id", jobId)
    .order("position");

if (error) {
  console.error("Checklist GET Error:", error);

  return NextResponse.json(
    { success: false, error: error.message },
    { status: 500 }
  );
}

  if (!data || data.length === 0) {
const { data: job } = await supabase
  .from("production_jobs")
  .select("studio")
  .eq("id", jobId)
  .single();

const template =
  CHECKLIST_TEMPLATES[job?.studio || "brand_studio"] ||
  CHECKLIST_TEMPLATES.brand_studio;

const autoCompletedOnCreate = [
  "Brief Reviewed",
  "Brand Strategy Reviewed",
];

const rows = template.map((title, index) => ({
  production_job_id: jobId,
  title,
  position: index,
  completed: autoCompletedOnCreate.includes(title),
}));

const created = await supabase
  .from("production_checklist")
  .upsert(rows, {
    onConflict: "production_job_id,title",
  })
  .select();

    data = created.data || [];
  }

  return NextResponse.json({
    success: true,
    items: data,
  });
}

export async function POST(request: NextRequest) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  const body = await request.json();

  const { id } = body;

  const current = await supabase
    .from("production_checklist")
    .select("completed")
    .eq("id", id)
    .single();

  if (current.error) {
    console.error("Checklist Toggle Error:", current.error);
    return NextResponse.json(
      { success: false, error: current.error.message },
      { status: 500 }
    );
  }

  const updated = await supabase
    .from("production_checklist")
    .update({
      completed: !current.data.completed,
    })
    .eq("id", id);

  if (updated.error) {
    console.error("Checklist Update Error:", updated.error);
    return NextResponse.json(
      { success: false, error: updated.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}