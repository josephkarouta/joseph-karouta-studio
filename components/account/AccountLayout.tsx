"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CircleDollarSign, CreditCard, Settings } from "lucide-react";
import AuthRequired from "@/components/auth-required";
import SiteHeader from "@/components/site-header";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { PageContainer, cx } from "@/components/ui/heyy";

const nav = [
  ["Account", "/account", Settings],
  ["Billing & plan", "/billing", CreditCard],
  ["Credit history", "/credits", CircleDollarSign],
  ["Notifications", "/notifications", Bell],
] as const;

export default function AccountLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <AuthRequired>
      <SiteHeader />
      <WorkspaceShell>
        <PageContainer className="py-10 sm:py-14">
          <div className="grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="h-fit rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--glass)] p-3 shadow-[var(--shadow-card)] backdrop-blur-2xl">
              <p className="px-3 pb-3 pt-2 text-[0.64rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Your account</p>
              <nav className="grid gap-1">
                {nav.map(([label, href, Icon]) => {
                  const active = pathname === href;
                  return <Link key={href} href={href} className={cx("flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-extrabold transition", active ? "bg-[var(--accent)] text-white shadow-[var(--shadow-button)]" : "text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]")}><Icon size={17}/>{label}</Link>;
                })}
              </nav>
            </aside>
            <section className="min-w-0">{children}</section>
          </div>
        </PageContainer>
      </WorkspaceShell>
    </AuthRequired>
  );
}
