import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  BriefcaseBusiness,
  FileText,
  Gauge,
  Inbox,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
  Users,
  WandSparkles,
  ClipboardList,
} from "lucide-react";
import { PageContainer } from "@/components/ui/heyy";
import { requireAdminPageAccess } from "@/lib/server/admin-page";

const sharedNav = [
  ["Overview", "/admin/platform", Gauge],
  ["Clients", "/admin/platform/clients", UserRoundSearch],
  ["Communications", "/admin/platform/communications", Mail],
  ["Templates", "/admin/platform/templates", ClipboardList],
  ["Careers", "/admin/platform/careers", BriefcaseBusiness],
  ["Applications", "/admin/platform/applications", FileText],
  ["Public pages", "/admin/platform/pages", BookOpen],
  ["Help center", "/admin/platform/help", Sparkles],
  ["Contact", "/admin/platform/contact", Inbox],
] as const;

const superAdminNav = [
  ["Audit log", "/admin/platform/audit", ShieldCheck],
  ["Users", "/admin/platform/users", Users],
  ["Generations", "/admin/platform/generations", WandSparkles],
] as const;

export default async function AdminPlatformShell({ children }: { children: ReactNode }) {
  const { role } = await requireAdminPageAccess();
  const nav = role === "admin" ? [...sharedNav, ...superAdminNav] : sharedNav;

  return (
    <main className="min-h-screen bg-[#f7f6fb] text-slate-950">
      <header className="border-b border-violet-100 bg-white/90 backdrop-blur-xl">
        <PageContainer className="flex min-h-20 flex-wrap items-center justify-between gap-4 py-3">
          <div>
            <p className="text-[.62rem] font-black uppercase tracking-[.2em] text-violet-600">Heyy Studio Admin</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-.04em]">Platform management</h1>
            {role === "business_admin" && <p className="mt-1 text-[.68rem] font-bold text-slate-400">Business operations access</p>}
          </div>
          <div className="flex gap-2">
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black shadow-sm hover:border-violet-300 hover:text-violet-700"><ArrowLeft size={14}/>Command center</Link>
            <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-violet-700">View website →</Link>
          </div>
        </PageContainer>
      </header>
      <PageContainer className="grid gap-6 py-7 xl:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-violet-100 bg-white p-3 shadow-sm">
          <nav className="grid gap-1">
            {nav.map(([label, href, Icon]) => (
              <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-extrabold text-slate-600 transition hover:bg-violet-50 hover:text-violet-700"><Icon size={16}/>{label}</Link>
            ))}
          </nav>
        </aside>
        <section className="min-w-0">{children}</section>
      </PageContainer>
    </main>
  );
}
