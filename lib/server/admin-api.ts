import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  hasAdminCapability,
  hasAdminRole,
  type AdminCapability,
} from "@/lib/auth/admin-role";
import type { User } from "@supabase/supabase-js";

async function authenticatedUser(): Promise<{ user: User | null; response: NextResponse | null }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, error: "Authentication is temporarily unavailable." },
        { status: 503 },
      ),
    };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {}
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, response: NextResponse.json({ success: false, error: "Admin sign-in required." }, { status: 401 }) };
  }
  return { user, response: null };
}

/** Full technical/super-admin only. */
export async function requireAdminApiUser(): Promise<{ user: User | null; response: NextResponse | null }> {
  const result = await authenticatedUser();
  if (result.response || !result.user) return result;
  if (!hasAdminRole(result.user)) {
    return { user: null, response: NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 }) };
  }
  return result;
}

export async function requireAdminApiAccess(): Promise<NextResponse | null> {
  const result = await requireAdminApiUser();
  return result.response;
}

/** Capability-aware access for operational/business-admin routes. */
export async function requireAdminApiCapability(
  capability: AdminCapability,
): Promise<{ user: User | null; response: NextResponse | null }> {
  const result = await authenticatedUser();
  if (result.response || !result.user) return result;
  if (!hasAdminCapability(result.user, capability)) {
    return {
      user: null,
      response: NextResponse.json({ success: false, error: "You do not have permission for this Admin action." }, { status: 403 }),
    };
  }
  return result;
}
