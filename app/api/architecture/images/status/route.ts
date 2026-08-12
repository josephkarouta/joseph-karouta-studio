import "server-only";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from the server environment.`);
  return value;
}

async function createAuthenticatedSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Parameters<typeof cookieStore.set>[2];
          }>,
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Cookie writes are optional after the response is committed.
          }
        },
      },
    },
  );
}

export async function GET(request: Request) {
  try {
    const supabase = await createAuthenticatedSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
    }

    const admin = createClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: job, error } = await admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .eq("tool", "architecture_image")
      .maybeSingle();

    if (error) throw new Error(error.message || "Architecture generation status could not be loaded.");
    if (!job) {
      return NextResponse.json({ error: "Architecture generation job not found." }, { status: 404 });
    }

    if (job.status === "succeeded") {
      return NextResponse.json({
        success: true,
        status: "succeeded",
        ...(job.output?.result || {}),
        creditsUsed: Number(job.output?.credits_used || job.input?.credits || 0),
      });
    }

    if (job.status === "failed" || job.status === "cancelled") {
      return NextResponse.json({
        success: true,
        status: "failed",
        error: job.error || "Architecture image generation failed. Your credits were returned.",
      });
    }

    return NextResponse.json({ success: true, status: "processing" });
  } catch (error) {
    console.error("Architecture image status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Architecture generation status could not be loaded." },
      { status: 500 },
    );
  }
}
