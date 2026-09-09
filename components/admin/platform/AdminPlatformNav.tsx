"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <nav className="grid gap-1">
      {items.map(([label, href, Icon]) => {
        const active = href === "/admin/platform"
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-extrabold transition ${
              active
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-violet-50 hover:text-violet-700"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
