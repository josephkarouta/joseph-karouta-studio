import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }>) {
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
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) return NextResponse.json({ error: "Job ID is required." }, { status: 400 });

    const { data: job, error } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .eq("tool", "architecture_direction")
      .maybeSingle();

    if (error) throw new Error(error.message || "Architecture direction status could not be loaded.");
    if (!job) return NextResponse.json({ error: "Architecture direction job not found." }, { status: 404 });

    if (job.status === "failed" || job.status === "cancelled") {
      return NextResponse.json({
        success: true,
        status: "failed",
        error: job.error || "Architecture Direction generation failed. Your credits were returned.",
      });
    }

    if (job.status !== "succeeded") {
      return NextResponse.json({ success: true, status: "processing" });
    }

    const projectId = String(job.project_id || job.input?.projectId || "").trim();
    if (!projectId) throw new Error("Architecture direction job has no project ID.");

    const [projectResult, directionsResult] = await Promise.all([
      supabase.from("architecture_projects").select("*").eq("id", projectId).eq("user_id", user.id).single(),
      supabase.from("architecture_directions").select("*").eq("project_id", projectId).eq("user_id", user.id).order("direction_number", { ascending: true }),
    ]);

    if (projectResult.error) throw new Error(projectResult.error.message);
    if (directionsResult.error) throw new Error(directionsResult.error.message);

    return NextResponse.json({
      success: true,
      status: "succeeded",
      mode: job.output?.mode || job.input?.mode || "live",
      project: projectResult.data || null,
      directions: directionsResult.data || [],
      creditsUsed: Number(job.output?.credits_used || job.input?.credits || 0),
    });
  } catch (error) {
    console.error("Architecture direction status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Architecture direction status could not be loaded." },
      { status: 500 },
    );
  }
}
