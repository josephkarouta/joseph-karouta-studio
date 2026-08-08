import type { ReactNode } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />

      <WorkspaceShell>
        {children}
        <SiteFooter />
      </WorkspaceShell>
    </>
  );
}
