import type { User } from "@supabase/supabase-js";

type AdminUser = Pick<User, "app_metadata"> | null | undefined;

/**
 * Admin access is read only from Supabase app_metadata.
 * Users can edit user_metadata, so it must never be trusted for authorization.
 */
export function hasAdminRole(user: AdminUser): boolean {
  const metadata = user?.app_metadata || {};
  const primaryRole = String(metadata.role || "").trim().toLowerCase();
  const roles = Array.isArray(metadata.roles)
    ? metadata.roles.map((role) => String(role).trim().toLowerCase())
    : [];

  return primaryRole === "admin" || roles.includes("admin") || metadata.is_admin === true;
}
