import { createHmac, timingSafeEqual } from "node:crypto";
import { processPowerPointJob } from "../../lib/tools/powerpoint-job";

export default async function handler(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    const signature = request.headers.get("x-heyy-job-signature") || "";

    if (!jobId || !validSignature(jobId, signature)) {
      console.error("Rejected unauthorized PowerPoint background invocation.");
      return;
    }

    await processPowerPointJob(jobId);
  } catch (error) {
    // Do not ask Netlify to retry automatically: the durable job processor is
    // claim-once and owns credit refund/failure handling itself.
    console.error(
      "PowerPoint background invocation error:",
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
    .update(`powerpoint:${jobId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  if (expectedBuffer.length !== suppliedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, suppliedBuffer);
}
