import type { User } from "@supabase/supabase-js";

type AdminUser = Pick<User, "app_metadata"> | null | undefined;

export type AdminRole = "admin" | "business_admin" | null;
export type AdminCapability =
  | "command_center"
  | "clients"
  | "communications"
  | "templates"
  | "operations"
  | "content"
  | "careers"
  | "system";

function metadataRoles(user: AdminUser) {
  const metadata = user?.app_metadata || {};
  const primaryRole = String(metadata.role || "").trim().toLowerCase();
  const roles = Array.isArray(metadata.roles)
    ? metadata.roles.map((role) => String(role).trim().toLowerCase())
    : [];
  return { metadata, primaryRole, roles };
}

export function adminRole(user: AdminUser): AdminRole {
  const { metadata, primaryRole, roles } = metadataRoles(user);
  if (primaryRole === "admin" || roles.includes("admin") || metadata.is_admin === true) {
    return "admin";
  }
  if (primaryRole === "business_admin" || roles.includes("business_admin")) {
    return "business_admin";
  }
  return null;
}

/** Full technical/super-admin only. Existing sensitive routes use this. */
export function hasAdminRole(user: AdminUser): boolean {
  return adminRole(user) === "admin";
}

export function hasBusinessAdminRole(user: AdminUser): boolean {
  return adminRole(user) === "business_admin";
}

export function hasAdminAccess(user: AdminUser): boolean {
  return adminRole(user) !== null;
}

export function hasAdminCapability(user: AdminUser, capability: AdminCapability): boolean {
  const role = adminRole(user);
  if (role === "admin") return true;
  if (role !== "business_admin") return false;

  // Business admins can run the day-to-day business without access to
  // sensitive account/credit/provider/system controls.
  return new Set<AdminCapability>([
    "command_center",
    "clients",
    "communications",
    "templates",
    "operations",
    "content",
    "careers",
  ]).has(capability);
}
