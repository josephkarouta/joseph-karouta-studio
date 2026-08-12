import { createSupabaseBrowserClient } from "@/lib/supabase";

type BrandImageStatus = {
  success?: boolean;
  status?: "processing" | "succeeded" | "failed";
  jobId?: string;
  error?: string;
  [key: string]: any;
};

async function readJson(response: Response, fallback: string): Promise<BrandImageStatus> {
  const text = await response.text();
  if (!text) {
    if (!response.ok) throw new Error(fallback);
    return {};
  }

  try {
    return JSON.parse(text) as BrandImageStatus;
  } catch {
    if (response.status === 504 || /inactivity timeout|<html|<!doctype/i.test(text)) {
      throw new Error("Heyy Studio could not start this image request. Please try again.");
    }
    throw new Error(fallback);
  }
}

export async function runBrandImageJob(
  endpoint: string,
  payload: Record<string, unknown>,
  fallback: string,
) {
  const supabase = createSupabaseBrowserClient();
  const { data, error: sessionError } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (sessionError || !token) throw new Error("Your session expired. Sign in again.");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const started = await readJson(response, fallback);

  if (!response.ok || !started.success || !started.jobId) {
    throw new Error(started.error || fallback);
  }

  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (attempt > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 2500));
    }

    const statusResponse = await fetch(
      `/api/brand-studio/image-status?job=${encodeURIComponent(started.jobId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    const status = await readJson(statusResponse, "Unable to check Brand image generation.");

    if (!statusResponse.ok || status.success === false) {
      throw new Error(status.error || "Unable to check Brand image generation.");
    }
    if (status.status === "succeeded") return status;
    if (status.status === "failed") {
      throw new Error(status.error || "Brand image generation failed. Your credits were returned.");
    }
  }

  throw new Error(
    "Your Brand image is still being prepared safely in the background. Reopen the project shortly to see the saved result.",
  );
}
