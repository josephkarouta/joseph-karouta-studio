import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const leadId = formData.get("leadId") as string;

  if (!file || !leadId) {
    return NextResponse.json({ success: false, error: "Missing file or leadId" });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

  const { error: uploadError } = await supabase.storage
    .from("project-files")
    .upload(fileName, buffer, { contentType: file.type });

  if (uploadError) {
    console.error("Supabase upload error:", uploadError);
    return NextResponse.json({ success: false, error: uploadError.message });
  }

  const { data: urlData } = supabase.storage
    .from("project-files")
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  const { data: lead } = await supabase
    .from("leads")
    .select("attachments")
    .eq("id", leadId)
    .single();

  const existing = lead?.attachments || [];

  await supabase
    .from("leads")
    .update({ attachments: [...existing, publicUrl] })
    .eq("id", leadId);

  return NextResponse.json({ success: true, url: publicUrl });
}
