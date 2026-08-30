import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminRole, hasAdminCapability, type AdminCapability, type AdminRole } from "@/lib/auth/admin-role";
import type { User } from "@supabase/supabase-js";

async function currentUser(): Promise<User | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const store = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(items) {
        try { items.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {}
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

export async function requireAdminPageAccess(): Promise<{ user: User; role: Exclude<AdminRole, null> }> {
  const user = await currentUser();
  const role = adminRole(user);
  if (!user || !role) redirect("/login?next=/admin");
  return { user, role };
}

export async function requireAdminPageCapability(capability: AdminCapability) {
  const result = await requireAdminPageAccess();
  if (!hasAdminCapability(result.user, capability)) redirect("/admin");
  return result;
}
