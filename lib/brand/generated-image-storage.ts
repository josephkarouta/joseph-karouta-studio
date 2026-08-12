import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export {
  storeGeneratedBrandImage,
  type BrandImageStorageContext,
} from "@/lib/brand/brand-image-storage";

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing from the server environment.`);
  return value;
}

async function createAuthenticatedSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Parameters<typeof cookieStore.set>[2];
          }>,
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookie writes may be unavailable after a response is committed.
          }
        },
      },
    },
  );
}

export type AuthenticatedBrandImageContext = {
  supabase: Awaited<ReturnType<typeof createAuthenticatedSupabaseClient>>;
  admin: SupabaseClient;
  userId: string;
  projectId: string;
};

export async function requireBrandImageProject(
  projectIdValue: unknown,
): Promise<AuthenticatedBrandImageContext> {
  const projectId = typeof projectIdValue === "string" ? projectIdValue.trim() : "";
  if (!projectId) throw new Error("A valid Brand project ID is required.");

  const supabase = await createAuthenticatedSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;

  if (authError || !user) {
    throw new Error("Authentication is required before generating Brand images.");
  }

  const { data: project, error: projectError } = await supabase
    .from("brand_projects")
    .select("id,user_id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    throw new Error(projectError?.message || "The Brand project could not be found.");
  }

  const serviceKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { supabase, admin, userId: user.id, projectId };
}
