import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["queued", "processing", "finalizing"];

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const columns = "id,project_id,tool,status,error,credit_reservation_id,created_at,updated_at,completed_at";
    const [activeResult, recentResult] = await Promise.all([
      admin
        .from("generation_jobs")
        .select(columns)
        .eq("user_id", user.id)
        .in("status", ACTIVE_STATUSES)
        .order("updated_at", { ascending: false })
        .limit(12),
      admin
        .from("generation_jobs")
        .select(columns)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
    if (activeResult.error) throw activeResult.error;
    if (recentResult.error) throw recentResult.error;

    const byId = new Map<string, any>();
    for (const row of [...(activeResult.data || []), ...(recentResult.data || [])]) {
      byId.set(String(row.id), row);
    }
    const rows = [...byId.values()]
      .sort((a, b) => {
        const activeDifference = Number(ACTIVE_STATUSES.includes(String(b.status)))
          - Number(ACTIVE_STATUSES.includes(String(a.status)));
        return activeDifference || timestamp(b.created_at) - timestamp(a.created_at);
      })
      .slice(0, 18);

    const reservationIds = rows
      .map((row) => row.credit_reservation_id ? String(row.credit_reservation_id) : "")
      .filter(Boolean);
    const reservationMap = new Map<string, { amount: number; status: string }>();
    if (reservationIds.length) {
      const { data, error } = await admin
        .from("credit_reservations")
        .select("id,amount,status")
        .eq("user_id", user.id)
        .in("id", reservationIds);
      if (error) throw error;
      for (const row of data || []) {
        reservationMap.set(String(row.id), {
          amount: Math.max(0, Number(row.amount || 0)),
          status: String(row.status || ""),
        });
      }
    }

    return NextResponse.json({
      success: true,
      jobs: rows.map((row) => {
        const reservation = row.credit_reservation_id
          ? reservationMap.get(String(row.credit_reservation_id))
          : undefined;
        return {
          id: String(row.id),
          projectId: row.project_id ? String(row.project_id) : null,
          tool: String(row.tool || "generation"),
          label: jobLabel(row.tool),
          href: jobHref(row.tool, row.project_id),
          status: String(row.status || "queued"),
          error: row.error ? String(row.error) : null,
          credits: reservation?.amount || 0,
          creditStatus: reservation?.status || null,
          createdAt: row.created_at ? String(row.created_at) : null,
          updatedAt: row.updated_at ? String(row.updated_at) : null,
          completedAt: row.completed_at ? String(row.completed_at) : null,
        };
      }),
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Generation activity load error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Generation activity could not be loaded." },
      { status: 500 },
    );
  }
}

function jobLabel(tool: unknown) {
  const value = String(tool || "");
  const labels: Record<string, string> = {
    digital_adaptations: "Digital Adaptations",
    text_to_image: "Text to Image",
    image_to_video: "Image to Video",
    ai_upscaler: "AI Upscaler",
    powerpoint_generator: "PowerPoint Generator",
    brand_system: "Brand Studio",
    brand_logo: "Brand logo",
    brand_logo_variation: "Brand logo variation",
    brand_moodboard: "Brand moodboard",
    brand_moodboard_variation: "Brand moodboard variation",
    brand_application_visual: "Brand application visual",
    brand_creative_directions: "Brand creative directions",
    brand_guidelines: "Brand guidelines",
    architecture_direction: "Architecture directions",
    directions: "Architecture directions",
    architecture_stage: "Architecture stage",
    stage_generation: "Architecture stage",
    architecture_image: "Architecture image",
    architecture_plan_tweak: "Architecture plan tweak",
    guided_studio: "Studio generation",
    studio_image: "Studio image",
  };
  return labels[value] || humanize(value || "generation");
}

function jobHref(tool: unknown, projectId: unknown) {
  const value = String(tool || "");
  const id = projectId ? String(projectId) : "";
  if (value === "digital_adaptations") return "/tools/digital-adaptations";
  if (value === "text_to_image") return "/tools/text-to-image";
  if (value === "image_to_video") return "/tools/image-to-video";
  if (value === "ai_upscaler") return "/tools/ai-upscaler";
  if (value === "powerpoint_generator") return "/tools/powerpoint-generator";
  if (value.startsWith("brand_") || value === "brand_system") {
    return id ? `/dashboard/brand/${encodeURIComponent(id)}` : "/brand-studio";
  }
  if (value.startsWith("architecture_") || value === "directions" || value === "stage_generation") {
    return id ? `/dashboard/architecture/${encodeURIComponent(id)}` : "/architecture-studio";
  }
  return "/dashboard";
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timestamp(value: unknown) {
  const time = value ? new Date(String(value)).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}
