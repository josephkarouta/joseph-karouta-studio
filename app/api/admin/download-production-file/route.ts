import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdminApiCapability } from "@/lib/server/admin-api";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  try {
    const body = await request.json();
    const { path } = body;

    if (!path) {
      return NextResponse.json(
        { success: false, error: "Missing path" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.storage
      .from("production-files")
      .createSignedUrl(path, 60 * 5);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      url: data.signedUrl,
    });
  } catch (error) {
    console.error("Download production file error:", error);

    return NextResponse.json(
      { success: false, error: "Could not create download link" },
      { status: 500 }
    );
  }
}