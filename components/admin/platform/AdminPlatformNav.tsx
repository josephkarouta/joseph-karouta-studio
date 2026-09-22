"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  FileText,
  Gauge,
  Inbox,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
  UserRoundCheck,
  Users,
  WandSparkles,
  ClipboardList,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react";

type AdminRole = "admin" | "business_admin";
type NavItem = readonly [label: string, href: string, icon: LucideIcon];
type NavCounts = { experts: number | null; roles: number | null; applications: number | null; pendingApplications: number };

const sharedNav: readonly NavItem[] = [
  ["Overview", "/admin/platform", Gauge],
  ["Clients", "/admin/platform/clients", UserRoundSearch],
  ["Payments", "/admin/platform/payments", CircleDollarSign],
  ["Communications", "/admin/platform/communications", Mail],
  ["Templates", "/admin/platform/templates", ClipboardList],
  ["Experts", "/admin/platform/experts", UserRoundCheck],
  ["Expert roles", "/admin/platform/careers", BriefcaseBusiness],
  ["Expert applications", "/admin/platform/applications", FileText],
  ["Public pages", "/admin/platform/pages", BookOpen],
  ["Help center", "/admin/platform/help", Sparkles],
  ["Contact", "/admin/platform/contact", Inbox],
];

const superAdminNav: readonly NavItem[] = [
  ["Audit log", "/admin/platform/audit", ShieldCheck],
  ["Users", "/admin/platform/users", Users],
  ["Generations", "/admin/platform/generations", WandSparkles],
];

export default function AdminPlatformNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const items = role === "admin" ? [...sharedNav, ...superAdminNav] : sharedNav;
  const [counts, setCounts] = useState<NavCounts>({ experts: null, roles: null, applications: null, pendingApplications: 0 });

  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      try {
        const [expertsResponse, rolesResponse, applicationsResponse] = await Promise.all([
          fetch("/api/admin/experts?page=1&pageSize=5", { cache: "no-store" }),
          fetch("/api/admin/platform/careers", { cache: "no-store" }),
          fetch("/api/admin/platform/applications", { cache: "no-store" }),
        ]);

        const [expertsResult, rolesResult, applicationsResult] = await Promise.all([
          expertsResponse.ok ? expertsResponse.json() : Promise.resolve({}),
          rolesResponse.ok ? rolesResponse.json() : Promise.resolve({}),
          applicationsResponse.ok ? applicationsResponse.json() : Promise.resolve({}),
        ]);

        const expertApplications = Array.isArray(applicationsResult.items)
          ? applicationsResult.items.filter((item: Record<string, unknown>) => String(item.application_kind || "") === "expert_network")
          : [];
        const pendingApplications = expertApplications.filter((item: Record<string, unknown>) =>
          ["new", "reviewing", "shortlisted"].includes(String(item.status || "new").toLowerCase()),
        ).length;

        if (cancelled) return;
        setCounts({
          experts: typeof expertsResult.total === "number" ? expertsResult.total : null,
          roles: Array.isArray(rolesResult.items) ? rolesResult.items.length : null,
          applications: expertApplications.length,
          pendingApplications,
        });
      } catch {
        // Navigation still works if a count endpoint is temporarily unavailable.
      }
    }

    void loadCounts();
    return () => { cancelled = true; };
  }, [pathname]);

  function badgeFor(label: string) {
    if (label === "Experts") return counts.experts;
    if (label === "Expert roles") return counts.roles;
    if (label === "Expert applications") return counts.applications;
    return null;
  }

  return (
    <nav className="grid gap-1">
      {items.map(([label, href, Icon]) => {
        const active = href === "/admin/platform"
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        const badge = badgeFor(label);
        const pendingApplications = label === "Expert applications" && counts.pendingApplications > 0;

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-extrabold transition ${
              active
                ? "bg-[#8B5CF6] text-white shadow-sm"
                : "text-slate-600 hover:bg-violet-50 hover:text-[#7447E8]"
            }`}
          >
            <Icon size={16} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {badge !== null && (
              <span
                className={`inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-2 py-1 text-[10px] font-black leading-none ${
                  pendingApplications
                    ? active
                      ? "bg-white text-[#8B5CF6]"
                      : "bg-[#8B5CF6] text-white"
                    : active
                      ? "bg-white/20 text-white"
                      : "bg-violet-100 text-[#7447E8]"
                }`}
                title={pendingApplications ? `${counts.pendingApplications} Expert application${counts.pendingApplications === 1 ? "" : "s"} awaiting review` : undefined}
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
