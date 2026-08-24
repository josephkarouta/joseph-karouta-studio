import { randomUUID } from "node:crypto";
import { generationReconciliationSignature } from "../../lib/generation-jobs/reconciliation-signature";

export default async function handler() {
  const site = siteUrl();
  const runId = randomUUID();
  const signature = generationReconciliationSignature(`dispatch:${runId}`);

  const response = await fetch(
    `${site}/.netlify/functions/provider-generation-reconciler-background`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Heyy-Reconciliation-Signature": signature,
      },
      body: JSON.stringify({ runId }),
      cache: "no-store",
    },
  );

  if (response.status !== 202 && !response.ok) {
    throw new Error(`Provider generation reconciler could not be dispatched (${response.status}).`);
  }

  return new Response(null, { status: 204 });
}

export const config = {
  schedule: "*/2 * * * *",
};

function siteUrl() {
  const raw = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) throw new Error("The deployed site URL is missing.");
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:") throw new Error("The deployed site URL must use HTTPS.");
  return parsed.origin;
}
