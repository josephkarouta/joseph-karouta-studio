import { createHmac, timingSafeEqual } from "node:crypto";
import { processDigitalAdaptationsJob } from "../../lib/tools/digital-adaptations-job";

export default async function handler(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    const supplied = request.headers.get("x-heyy-job-signature") || "";
    if (!jobId || !validSignature(jobId, supplied)) {
      console.error("Rejected unauthorized digital adaptations background invocation.");
      return;
    }
    await processDigitalAdaptationsJob(jobId);
  } catch (error) {
    console.error(
      "Digital adaptations background invocation error:",
      error instanceof Error ? error.message : error,
    );
  }
}

export const config = { background: true };

function validSignature(jobId: string, supplied: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supplied) return false;
  const expected = createHmac("sha256", secret)
    .update(`digital-adaptations:${jobId}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  if (expectedBuffer.length !== suppliedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, suppliedBuffer);
}
