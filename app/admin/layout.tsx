import type { ReactNode } from "react";
import { requireAdminPageAccess } from "@/lib/server/admin-page";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPageAccess();
  return children;
}
