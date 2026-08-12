import "server-only";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAiMode, resolveAiPlan, type ImageGenerationTier } from "@/lib/ai/config";
import { assertRateLimit } from "@/lib/ai/rate-limit";
import { CreditError, reserveCredits, refundCredits } from "@/lib/credits/server";
import type { CreditAction } from "@/lib/credits/config";

export const runtime = "nodejs";
export const maxDuration = 60;

type ImageTarget = "direction" | "concept" | "visual";

type RegenerateRequest = {
  projectId?: string;
  targetType?: ImageTarget;
  targetId?: string;
  quality?: ImageGenerationTier;
  planMode?: "technical" | "rendered";
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

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function validateTargetAndResolveAction(args: {
  supabase: Awaited<ReturnType<typeof createAuthenticatedSupabaseClient>>;
  userId: string;
  projectId: string;
  targetType: ImageTarget;
  targetId: string;
  quality: ImageGenerationTier;
  planMode: "technical" | "rendered";
}): Promise<CreditAction> {
  if (args.quality === "final") return "architectureProfessionalFinal";

  if (args.targetType === "direction") {
    const { data, error } = await args.supabase
      .from("architecture_directions")
      .select("id")
      .eq("id", args.targetId)
      .eq("project_id", args.projectId)
      .eq("user_id", args.userId)
      .maybeSingle();
    if (error || !data) throw new Error(error?.message || "Architecture Direction not found.");
    return "architectureDirection";
  }

  if (args.targetType === "concept") {
    const { data, error } = await args.supabase
      .from("architecture_concepts")
      .select("id")
      .eq("id", args.targetId)
      .eq("project_id", args.projectId)
      .eq("user_id", args.userId)
      .maybeSingle();
    if (error || !data) throw new Error(error?.message || "Architecture Concept not found.");
    return "architectureDirection";
  }

  const { data: visual, error } = await args.supabase
    .from("architecture_visuals")
    .select("id,metadata")
    .eq("id", args.targetId)
    .eq("project_id", args.projectId)
    .eq("user_id", args.userId)
    .maybeSingle();
  if (error || !visual) throw new Error(error?.message || "Architecture visual not found.");

  const group = metadataRecord(visual.metadata).group;
  if (group === "plans" && args.planMode === "technical") {
    return "architectureTechnicalPlan";
  }
  return "architectureVisual";
}

export async function POST(request: Request) {
  let reservationId: string | null = null;
  let jobId: string | null = null;
  let accepted = false;
  let admin: SupabaseClient | null = null;

  try {
    const body = (await request.json()) as RegenerateRequest;
    const projectId = body.projectId?.trim();
    const targetId = body.targetId?.trim();
    const targetType = body.targetType;
    const quality: ImageGenerationTier = body.quality === "final" ? "final" : "preview";
    const planMode = body.planMode === "rendered" ? "rendered" : "technical";

    if (!projectId || !targetId || !targetType) {
      return NextResponse.json(
        { success: false, error: "projectId, targetType and targetId are required." },
        { status: 400 },
      );
    }
    if (!["direction", "concept", "visual"].includes(targetType)) {
      return NextResponse.json({ success: false, error: "Invalid image target." }, { status: 400 });
    }

    const supabase = await createAuthenticatedSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from("architecture_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: projectError?.message || "Architecture project not found." },
        { status: 404 },
      );
    }

    assertRateLimit(`architecture-image:${user.id}`, 8, 60_000);

    const action = await validateTargetAndResolveAction({
      supabase,
      userId: user.id,
      projectId,
      targetType,
      targetId,
      quality,
      planMode,
    });

    admin = createClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const mode = process.env.NEXT_PUBLIC_MOCK_IMAGES === "true" ? "demo" : getAiMode();
    let credits = 0;
    if (mode !== "demo") {
      const reservation = await reserveCredits({
        admin,
        userId: user.id,
        action,
        metadata: {
          project_id: projectId,
          studio: "architecture_studio",
          target: targetType,
          target_id: targetId,
          quality,
          plan_mode: planMode,
        },
      });
      reservationId = reservation.id;
      credits = reservation.amount;
    }

    const { data: job, error: jobError } = await admin
      .from("generation_jobs")
      .insert({
        user_id: user.id,
        project_id: projectId,
        tool: "architecture_image",
        provider: mode === "demo" ? "demo" : "openai",
        provider_job_id: null,
        credit_reservation_id: reservationId,
        status: "queued",
        input: {
          projectId,
          targetType,
          targetId,
          quality,
          planMode,
          planName: resolveAiPlan(user),
          credits,
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
    const signature = createHmac("sha256", requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"))
      .update(`architecture-image:${jobId}`)
      .digest("hex");

    const backgroundResponse = await fetch(
      `${origin}/.netlify/functions/architecture-image-background`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Heyy-Job-Signature": signature,
        },
        body: JSON.stringify({ jobId }),
        cache: "no-store",
      },
    ).catch(() => null);

    if (backgroundResponse?.status === 202 || backgroundResponse?.ok) {
      accepted = true;
    } else if (["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) {
      accepted = true;
      const { processArchitectureImageJob } = await import("@/lib/architecture/architecture-image-job");
      await processArchitectureImageJob(jobId);
    } else {
      throw new Error(
        `Architecture background generation could not start (${backgroundResponse?.status || "unavailable"}).`,
      );
    }

    return NextResponse.json({
      success: true,
      jobId,
      status: "processing",
      creditsReserved: credits,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Architecture image generation could not start.";

    if (!accepted && admin && jobId) {
      const { data: failedQueuedJob, error: failError } = await admin
        .from("generation_jobs")
        .update({
          status: "failed",
          error: "Architecture image generation could not start. Your credits were returned.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("status", "queued")
        .select("id")
        .maybeSingle();

      if (failError) {
        console.error("Architecture generation start cleanup failed:", failError.message);
      } else if (failedQueuedJob && reservationId) {
        await refundCredits(admin, reservationId, message);
      }
    } else if (!accepted && admin && reservationId) {
      await refundCredits(admin, reservationId, message);
    }

    console.error("Architecture image start error:", error);
    if (error instanceof CreditError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
