import { createHmac, timingSafeEqual } from "node:crypto";
import { processBrandImageJob } from "../../lib/brand/brand-image-job";

export default async function handler(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    const signature = request.headers.get("x-heyy-job-signature") || "";

    if (!jobId || !validSignature(jobId, signature)) {
      console.error("Rejected unauthorized Brand image background invocation.");
      return;
    }

    await processBrandImageJob(jobId);
  } catch (error) {
    // Keep the invocation successful so Netlify does not retry a paid provider
    // generation automatically. The durable job owns failure/refund handling.
    console.error(
      "Brand image background invocation error:",
      error instanceof Error ? error.message : error,
    );
  }
}

export const config = {
  background: true,
};

function validSignature(jobId: string, supplied: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supplied) return false;

  const expected = createHmac("sha256", secret)
    .update(`brand-image:${jobId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  if (expectedBuffer.length !== suppliedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, suppliedBuffer);
}
