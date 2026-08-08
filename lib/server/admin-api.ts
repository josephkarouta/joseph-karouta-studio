import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasAdminRole } from "@/lib/auth/admin-role";

/**
 * Defence-in-depth protection for /api/admin route handlers.
 *
 * proxy.ts already blocks unauthorised requests before they reach these routes,
 * but every admin endpoint also verifies the Supabase cookie session itself so
 * the service-role client can never be used without an authenticated admin.
 */
export async function requireAdminApiAccess(): Promise<NextResponse | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { success: false, error: "Supabase authentication is not configured." },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The proxy normally refreshes auth cookies first. A read-only cookie
          // context must not weaken the authorisation check below.
        }
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { success: false, error: "Admin sign-in required." },
      { status: 401 },
    );
  }

  if (!hasAdminRole(user)) {
    return NextResponse.json(
      { success: false, error: "Admin access required." },
      { status: 403 },
    );
  }

  return null;
}
