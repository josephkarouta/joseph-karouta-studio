import { createHmac, timingSafeEqual } from "node:crypto";

export function generationReconciliationSignature(target: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");

  return createHmac("sha256", secret)
    .update(`generation-reconciliation:${target}`)
    .digest("hex");
}

export function validGenerationReconciliationSignature(
  target: string,
  supplied: string | null,
) {
  if (!supplied) return false;

  let expected: string;
  try {
    expected = generationReconciliationSignature(target);
  } catch {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}
