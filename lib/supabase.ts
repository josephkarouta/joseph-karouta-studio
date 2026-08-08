import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return browserClient;
}

/**
 * Backwards-compatible alias.
 * Some existing files still import createSupabaseBrowserClient.
 * It returns the same single shared browser client.
 */
export function createSupabaseBrowserClient() {
  return getSupabaseBrowserClient();
}

export const supabase = getSupabaseBrowserClient();
