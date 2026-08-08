import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      user_id,
      name,
      email,
      phone,
      company,
      notes,
      project_brief,
      attachments,
      metadata,
    } = body;

    let finalName = name || "Logged-in user";
    let finalEmail = email || "";
    let finalPhone = phone || "Not provided";

    if (user_id && !finalEmail) {
      const { data: userData } = await supabase.auth.admin.getUserById(user_id);

      finalEmail = userData?.user?.email || "";
      finalName =
        userData?.user?.user_metadata?.full_name ||
        userData?.user?.user_metadata?.name ||
        finalName;
    }

    if (!finalEmail) {
      return NextResponse.json(
        { success: false, error: "Missing user email" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(finalEmail)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("expert_requests")
      .insert({
        user_id: user_id || null,
        name: finalName,
        email: finalEmail,
        phone: finalPhone,
        company: company || metadata?.project_name || null,
        notes,
        project_brief,
        attachments: attachments || [],
        status: "New",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

let productionJob = null;

const { data: existingJob, error: existingJobError } = await supabase
  .from("production_jobs")
  .select("*")
  .eq("project_id", metadata?.project_id || "")
  .eq(
    "service",
    metadata?.service || metadata?.production_type || "Brand Production"
  )
  .not("status", "in", '("Delivered","Cancelled")')
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (existingJobError) {
  console.error("Production existing job check error:", existingJobError);
}

if (existingJob) {
  productionJob = existingJob;
} else {
  const { data: newProductionJob, error: productionJobError } = await supabase
    .from("production_jobs")
    .insert({
      project_id: metadata?.project_id || null,
      project_name: metadata?.project_name || null,
      user_id: user_id || null,
      studio: metadata?.studio || "brand_studio",
      service:
        metadata?.service ||
        metadata?.production_type ||
        "Brand Production",
      notes: notes || "",
      status: "Waiting Assignment",
      priority: "Normal",
      delivery_status: "Pending",
      preview_image: metadata?.preview_image || null,
      client_name: finalName || null,
      client_email: finalEmail || null,
      client_phone: finalPhone || null,
      metadata: {
        ...(metadata || {}),
        client_name: finalName || null,
        client_email: finalEmail || null,
        client_phone: finalPhone || null,
      },
    })
    .select()
    .single();

  if (productionJobError) {
    console.error("❌ Production Job Error:", productionJobError);
  } else {
    productionJob = newProductionJob;
  }
}

    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    console.error("Expert request error:", error);

    return NextResponse.json(
      { success: false, error: "Could not submit production request" },
      { status: 500 }
    );
  }
}