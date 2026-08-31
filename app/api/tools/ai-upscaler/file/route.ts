import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) return NextResponse.json({ error: "Job ID is required." }, { status: 400 });

    const { data: job, error } = await admin
      .from("generation_jobs")
      .select("id,status,output")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .eq("tool", "ai_upscaler")
      .maybeSingle();
    if (error) throw error;
    if (!job) return NextResponse.json({ error: "Enhanced image not found." }, { status: 404 });
    if (job.status !== "succeeded") return NextResponse.json({ error: "Enhanced image is not ready yet." }, { status: 409 });

    const source = String(job.output?.asset_url || "").trim();
    if (!/^https?:\/\//i.test(source)) return NextResponse.json({ error: "Enhanced image is unavailable." }, { status: 404 });

    const response = await fetch(source, { cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Enhanced image could not be downloaded." }, { status: 502 });
    const contentType = response.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) return NextResponse.json({ error: "Enhanced image could not be downloaded." }, { status: 502 });

    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": 'attachment; filename="heyy-studio-upscaled.png"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof ApiAuthError ? error.message : "Enhanced image could not be downloaded." },
      { status: error instanceof ApiAuthError ? error.status : 500 },
    );
  }
}
