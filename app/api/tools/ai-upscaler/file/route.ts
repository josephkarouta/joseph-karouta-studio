import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request);
    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) return NextResponse.json({ error: "Job ID required." }, { status: 400 });

    const { data: job } = await auth.admin
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .eq("status", "succeeded")
      .single();
    if (!job) return NextResponse.json({ error: "Enhanced image not found." }, { status: 404 });

    const assetUrl = String(job.output?.asset_url || "");
    if (assetUrl) {
      const response = await fetch(assetUrl, { redirect: "follow" });
      if (!response.ok || !response.body) {
        return NextResponse.json({ error: "Enhanced image could not be downloaded." }, { status: 502 });
      }
      return streamImage(response);
    }

    if (!process.env.TOPAZ_API_KEY || !job.provider_job_id) {
      return NextResponse.json({ error: "Enhanced image not found." }, { status: 404 });
    }
    const template =
      process.env.TOPAZ_DOWNLOAD_ENDPOINT_TEMPLATE || "https://api.topazlabs.com/image/v1/download/{id}";
    const endpoint = template.replace("{id}", encodeURIComponent(job.provider_job_id));
    const response = await fetch(endpoint, {
      headers: { "X-API-Key": process.env.TOPAZ_API_KEY },
      redirect: "follow",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Enhanced image could not be downloaded." }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await readJson(response);
      const signedUrl = findOutputUrl(payload);
      if (!signedUrl) {
        return NextResponse.json({ error: "Enhanced image could not be downloaded." }, { status: 502 });
      }
      const fileResponse = await fetch(signedUrl, { redirect: "follow" });
      if (!fileResponse.ok || !fileResponse.body) {
        return NextResponse.json({ error: "Enhanced image could not be downloaded." }, { status: 502 });
      }
      return streamImage(fileResponse);
    }

    if (!response.body) {
      return NextResponse.json({ error: "Enhanced image could not be downloaded." }, { status: 502 });
    }
    return streamImage(response);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image download failed." },
      { status: 500 },
    );
  }
}

function streamImage(response: Response) {
  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("content-type") || "image/png",
      "Content-Disposition": "inline; filename=heyy-studio-upscaled.png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}


async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function findOutputUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findOutputUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const item of Object.values(record)) {
      const found = findOutputUrl(item);
      if (found) return found;
    }
  }
  return null;
}
