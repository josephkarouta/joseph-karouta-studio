import { createHmac, timingSafeEqual } from "node:crypto";
import { processStudioImageJob } from "../../lib/studio/studio-image-async-job";

export default async function handler(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    const supplied = request.headers.get("x-heyy-job-signature") || "";
    if (!jobId || !valid(jobId, supplied)) { console.error("Rejected unauthorized Studio image background invocation."); return; }
    await processStudioImageJob(jobId);
  } catch (error) {
    console.error("Studio image background invocation error:", error instanceof Error ? error.message : error);
  }
}
export const config = { background: true };
function valid(jobId: string, supplied: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supplied) return false;
  const expected = createHmac("sha256", secret).update(`studio-image:${jobId}`).digest("hex");
  const a = Buffer.from(expected, "utf8"); const b = Buffer.from(supplied, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
