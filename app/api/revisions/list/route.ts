import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { loadProductionMessages } from "@/lib/production/messages";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  try {
    const productionJobId =
      request.nextUrl.searchParams.get("production_job_id")?.trim() || "";

    if (!productionJobId) {
      return NextResponse.json(
        { success: false, error: "Missing production_job_id" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("workspace_revisions")
      .select(`
        *,
        workspace_revision_files (
          id,
          revision_id,
          deliverable_id,
          version,
          production_deliverables (
            id,
            filename,
            original_filename,
            version,
            storage_path,
            file_size,
            mime_type
          )
        )
      `)
      .eq("production_job_id", productionJobId)
      .order("revision_number", { ascending: true });

    if (error) throw error;

    const messages = await loadProductionMessages(supabase, productionJobId);
    const messagesById = new Map(messages.map((message) => [message.id, message]));

    const revisions = (data || []).map((revision: any) => ({
      ...revision,
      client_message: revision.client_message_id
        ? messagesById.get(revision.client_message_id) || null
        : null,
    }));

    return NextResponse.json({
      success: true,
      revisions,
    });
  } catch (error) {
    console.error("List revisions error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Could not load revisions",
      },
      { status: 500 },
    );
  }
}
