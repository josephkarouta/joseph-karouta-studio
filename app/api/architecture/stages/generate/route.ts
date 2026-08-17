import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAiMode, resolveAiPlan } from "@/lib/ai/config";
import { assertRateLimit } from "@/lib/ai/rate-limit";
import { CreditError, reserveCredits, refundCredits } from "@/lib/credits/server";
import {
  processArchitectureStageJob,
  type ArchitectureStage,
} from "@/lib/architecture/architecture-stage-job";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_STAGES: ArchitectureStage[] = ["concept", "plans", "visuals", "design-pack", "all"];

type StageRequest = {
  projectId?: string;
  stage?: ArchitectureStage;
};

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

export async function POST(request: Request) {
  let reservationId: string | null = null;
  let jobId: string | null = null;
  let accepted = false;
  let creditAdmin: SupabaseClient | null = null;

  try {
    const body = (await request.json()) as StageRequest;
    const projectId = body.projectId?.trim();
    const stage = body.stage || "all";

    if (!projectId) {
      return NextResponse.json({ success: false, error: "projectId is required." }, { status: 400 });
    }
    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json({ success: false, error: "Invalid Architecture generation stage." }, { status: 400 });
    }
    if (getAiMode() !== "live") {
      return NextResponse.json(
        { success: false, error: "Live Architecture generation is disabled. Set AI_MODE=live or use the demo route." },
        { status: 409 },
      );
    }

    const supabase = await createAuthenticatedSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    assertRateLimit(`architecture-stages:${user.id}`, 8, 60_000);

    const { data: project, error: projectError } = await supabase
      .from("architecture_projects")
      .select("id,selected_direction_id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: projectError?.message || "Architecture project not found." },
        { status: 404 },
      );
    }
    if (stage !== "plans" && !project.selected_direction_id) {
      return NextResponse.json(
        { success: false, error: "Select an Architecture Direction before continuing." },
        { status: 400 },
      );
    }

    const planName = resolveAiPlan(user);
    creditAdmin = createClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const reservation = await reserveCredits({
      admin: creditAdmin,
      userId: user.id,
      action: "architectureText",
      metadata: {
        project_id: projectId,
        studio: "architecture_studio",
        tool: "stage_generation",
        stage,
      },
    });
    reservationId = reservation.id;

    const { data: job, error: jobError } = await creditAdmin
      .from("generation_jobs")
      .insert({
        user_id: user.id,
        project_id: projectId,
        tool: "architecture_stage",
        provider: "openai",
        provider_job_id: null,
        credit_reservation_id: reservation.id,
        status: "queued",
        input: {
          projectId,
          stage,
          planName,
          credits: reservation.amount,
        },
        output: {},
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(jobError?.message || "Architecture generation job could not be saved.");
    }
    jobId = String(job.id);

    const origin = new URL(request.url).origin;
    const signature = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "")
      .update(`architecture-stage:${jobId}`)
      .digest("hex");

    const backgroundResponse = await fetch(`${origin}/.netlify/functions/architecture-stage-background`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Heyy-Job-Signature": signature,
      },
      body: JSON.stringify({ jobId }),
      cache: "no-store",
    }).catch(() => null);

    if (backgroundResponse?.status === 202 || backgroundResponse?.ok) {
      accepted = true;
    } else if (["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) {
      accepted = true;
      await processArchitectureStageJob(jobId);
    } else {
      throw new Error(`Architecture background generation could not start (${backgroundResponse?.status || "unavailable"}).`);
    }

    return NextResponse.json({
      success: true,
      status: "processing",
      jobId,
      creditsReserved: reservation.amount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Architecture content generation could not start.";

    if (!accepted && creditAdmin && reservationId) {
      await refundCredits(creditAdmin, reservationId, message);
    }
    if (!accepted && creditAdmin && jobId) {
      await creditAdmin
        .from("generation_jobs")
        .update({
          status: "failed",
          error: "Architecture content generation could not start. Your credits were returned.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }

    console.error("Architecture stage start error:", error);
    if (error instanceof CreditError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
