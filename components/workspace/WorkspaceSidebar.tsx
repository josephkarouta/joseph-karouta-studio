"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  BadgeHelp,
  Blocks,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FolderKanban,
  FolderOpen,
  FileClock,
  Gauge,
  ImageIcon,
  Images,
  Megaphone,
  PanelLeftClose,
  PanelsTopLeft,
  Presentation,
  Settings,
  Sofa,
  Sparkles,
  Video,
  WandSparkles,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PLATFORM_TOOLS, VISIBLE_STUDIOS } from "@/lib/platform/platform-registry";
import { cx } from "@/components/ui/heyy";

const SIDEBAR_SCROLL_KEY = "heyy:workspace-sidebar-scroll";

type Props = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  activePrefixes?: string[];
  accent?: string;
  badge?: string;
};

const studioIcons: Record<string, LucideIcon> = {
  brand_studio: WandSparkles,
  architecture_studio: Building2,
  interior_studio: Sofa,
  marketing_studio: Megaphone,
};

const toolIcons: Record<string, LucideIcon> = {
  digital_adaptations: PanelsTopLeft,
  text_to_image: ImageIcon,
  image_to_video: Video,
  ai_upscaler: Images,
  powerpoint_generator: Presentation,
};

export default function WorkspaceSidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: Props) {
  const pathname = usePathname();
  const navigationScrollRef = useRef<HTMLDivElement>(null);
  const workspaceItems: NavigationItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: Gauge, activePrefixes: ["/dashboard"] },
    { label: "Projects", href: "/dashboard/projects", icon: FolderKanban, activePrefixes: ["/dashboard/projects"] },
    { label: "Assets", href: "/dashboard/assets", icon: FolderOpen, activePrefixes: ["/dashboard/assets"] },
    { label: "Versions", href: "/dashboard/versions", icon: FileClock, activePrefixes: ["/dashboard/versions"] },
    { label: "Production", href: "/dashboard#production", icon: Blocks },
  ];

  const studioItems: NavigationItem[] = VISIBLE_STUDIOS.map((studio) => ({
    label: studio.shortLabel,
    href: studio.href || "/dashboard",
    icon: studioIcons[studio.id] || Sparkles,
    activePrefixes: studio.activePrefixes,
    accent: studio.accent,
  }));

  const toolItems: NavigationItem[] = PLATFORM_TOOLS.map((tool) => ({
    label: tool.label,
    href: tool.href,
    icon: toolIcons[tool.id] || Sparkles,
    activePrefixes: [tool.href],
    accent: tool.accent,
  }));

  function itemIsActive(item: NavigationItem) {
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return Boolean(item.activePrefixes?.some((prefix) => pathname.startsWith(prefix)));
  }

  useLayoutEffect(() => {
    const savedPosition = Number(window.sessionStorage.getItem(SIDEBAR_SCROLL_KEY) || 0);
    if (navigationScrollRef.current && Number.isFinite(savedPosition)) {
      navigationScrollRef.current.scrollTop = savedPosition;
    }
  }, []);

  return (
    <aside
      className={cx(
        "fixed bottom-0 top-[var(--header-height)] z-50 flex w-[270px] flex-col border-r border-[var(--border)] bg-[color:var(--glass)] shadow-[14px_0_42px_rgba(32,21,48,.08)] backdrop-blur-3xl transition-[width,transform] duration-300",
        collapsed && "lg:w-[86px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
      aria-label="Workspace navigation"
    >
      <div className="flex h-[70px] items-center justify-between gap-3 border-b border-[var(--border)] px-4">
        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className="flex min-w-0 items-center gap-3 overflow-hidden"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#6f2dff,#d83cb8)] text-white shadow-lg">
            <Sparkles size={18} />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block text-[0.61rem] font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                Heyy Studio
              </span>
              <span className="block truncate text-sm font-black">Workspace</span>
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={onCloseMobile}
          className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] lg:hidden"
          aria-label="Close navigation"
        >
          <X size={17} />
        </button>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hidden h-9 w-9 place-items-center rounded-xl border border-[var(--border)] text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] lg:grid"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      <div
        ref={navigationScrollRef}
        onScroll={(event) => window.sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(event.currentTarget.scrollTop))}
        className="heyy-scrollbar flex-1 overflow-y-auto px-3 py-4"
      >
        <NavigationGroup
          label="Workspace"
          items={workspaceItems}
          collapsed={collapsed}
          onNavigate={onCloseMobile}
          isActive={itemIsActive}
        />
        <NavigationGroup
          label="Studios"
          items={studioItems}
          collapsed={collapsed}
          onNavigate={onCloseMobile}
          isActive={itemIsActive}
        />
        <NavigationGroup
          label="AI Tools"
          items={toolItems}
          collapsed={collapsed}
          onNavigate={onCloseMobile}
          isActive={itemIsActive}
        />
      </div>

      <div className="space-y-2 border-t border-[var(--border)] p-3">
        <SidebarLink collapsed={collapsed} href="/account" icon={Settings} label="Account" active={pathname.startsWith("/account")} />
        <SidebarLink collapsed={collapsed} href="/billing" icon={CreditCard} label="Plan & billing" active={pathname.startsWith("/billing")} />
        <SidebarLink collapsed={collapsed} href="/help" icon={BadgeHelp} label="Help & support" active={pathname.startsWith("/help")} />
      </div>
    </aside>
  );
}

function NavigationGroup({
  label,
  items,
  collapsed,
  onNavigate,
  isActive,
}: {
  label: string;
  items: NavigationItem[];
  collapsed: boolean;
  onNavigate: () => void;
  isActive: (item: NavigationItem) => boolean;
}) {
  return (
    <div className="mb-6">
      {!collapsed && (
        <p className="mb-2 px-3 text-[0.58rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={`${label}-${item.label}`}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cx(
                "group relative flex min-h-11 items-center gap-3 rounded-2xl border px-3 text-sm font-extrabold transition",
                collapsed && "justify-center px-0",
                active
                  ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-sm"
                  : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
              )}
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--surface)] transition group-hover:bg-[var(--surface-strong)]"
                style={item.accent ? { color: item.accent } : undefined}
              >
                <Icon size={16} />
              </span>
              {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="rounded-full bg-[var(--surface-strong)] px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SidebarLink({
  collapsed,
  href,
  icon: Icon,
  label,
  active,
}: {
  collapsed: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cx(
        "flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-extrabold transition",
        collapsed && "justify-center px-0",
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
      )}
    >
      <Icon size={16} />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
