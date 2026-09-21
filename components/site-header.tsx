"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Armchair,
  BadgeHelp,
  BadgePercent,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CircleDollarSign,
  Clapperboard,
  CreditCard,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Maximize2,
  Megaphone,
  Menu,
  Palette,
  Presentation,
  Repeat2,
  Settings,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import ThemeToggle from "@/components/theme-toggle";
import NotificationBell from "@/components/notifications/NotificationBell";
import HeyyLogo from "@/components/brand/HeyyLogo";
import AuthModal from "@/app/AuthModal";
import { Button } from "@/components/ui/heyy";
import { PLATFORM_TOOLS, VISIBLE_STUDIOS } from "@/lib/platform/platform-registry";

const navItems = [
  ["Studios", "/#create"],
  ["Tools", "/#tools"],
  ["How it works", "/#how-it-works"],
  ["Pricing", "/#pricing"],
] as const;

const studioMenuIcons = {
  brand_studio: Palette,
  marketing_studio: Megaphone,
  architecture_studio: Building2,
  interior_studio: Armchair,
} as const;

const toolMenuIcons = {
  text_to_image: ImageIcon,
  image_to_video: Clapperboard,
  digital_adaptations: LayoutGrid,
  ai_upscaler: Maximize2,
  powerpoint_generator: Presentation,
  pdf_tools: FileText,
  file_converter: Repeat2,
} as const;

export default function SiteHeader({ prelaunch = false, heroOverlay = false }: { prelaunch?: boolean; heroOverlay?: boolean }) {
  const pathname = usePathname();
  const { user, loading, plan, credits, signOut } = useAuth();
  const { resolvedTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Account";
  const avatarUrl = String(
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "",
  ).trim();
  const expertRoles = Array.isArray(user?.app_metadata?.roles)
    ? user.app_metadata.roles.map((role: unknown) => String(role).toLowerCase())
    : [];
  const isExpert = Boolean(user?.app_metadata?.expert_profile_id) || expertRoles.includes("expert");
  const showDesktopExpertCta = !prelaunch;

  useEffect(() => {
    setMenuOpen(false);
    setNotificationsOpen(false);
    setMobileOpen(false);
    setAuthMode(null);
  }, [pathname]);

  useEffect(() => {
    if (prelaunch) setMobileOpen(false);
  }, [prelaunch]);

  useEffect(() => {
    if (!mobileOpen) return;

    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function handleLogoClick(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (pathname !== "/") return;
    event.preventDefault();
    setMenuOpen(false);
    setNotificationsOpen(false);
    setMobileOpen(false);
    window.history.replaceState(null, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSignOut() {
    await signOut();
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300 ${
        mobileOpen
          ? "border-[var(--border)] bg-white backdrop-blur-none dark:bg-[#120c1f]"
          : heroOverlay
            ? "border-transparent bg-transparent backdrop-blur-none"
            : "border-[var(--border)] bg-[color:var(--glass)] backdrop-blur-2xl"
      }`}
    >
      <div className="relative mx-auto flex h-[var(--header-height)] max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" onClick={handleLogoClick} className="shrink-0" aria-label="Heyy Studio home">
          <HeyyLogo
            variant={(!mobileOpen && heroOverlay) || resolvedTheme === "dark" ? "full-colour-light" : "full-colour-dark"}
            showStudio={false}
            height={40}
          />
        </Link>

        <nav className={`absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 text-sm font-bold lg:flex ${heroOverlay ? "text-white/80" : "text-[var(--text-secondary)]"}`}>
          {navItems.map(([label, href]) => (
            <Link
              key={label}
              href={prelaunch ? "#" : href}
              aria-disabled={prelaunch || undefined}
              tabIndex={prelaunch ? -1 : undefined}
              className={`rounded-full px-4 py-2.5 transition ${prelaunch ? "pointer-events-none cursor-default opacity-40" : heroOverlay ? "hover:bg-white/10 hover:text-white" : "hover:bg-[var(--surface-strong)] hover:text-[var(--text-primary)]"}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex self-stretch items-center gap-2">
          {showDesktopExpertCta && (
            <Link
              href="/contact?topic=expert"
              aria-label="Contact an Expert"
              title="Contact an Expert"
              className={`hidden h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-[background-color,border-color,color,box-shadow] lg:flex ${
                heroOverlay
                  ? "border-white/25 bg-black/15 text-white shadow-[0_8px_24px_rgba(0,0,0,.18)] hover:border-white/40 hover:bg-white/10"
                  : "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--accent-strong)] shadow-sm hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]"
              }`}
            >
              <BriefcaseBusiness size={17} strokeWidth={2.1} aria-hidden="true" />
            </Link>
          )}

          <ThemeToggle compact overlay={heroOverlay && !mobileOpen} />

          {!prelaunch && !loading && !user ? (
            <button
              type="button"
              onClick={() => setAuthMode("signup")}
              className="min-h-9 cursor-pointer rounded-full bg-[#8b5cf6] px-3.5 text-xs font-black text-white shadow-[0_7px_18px_rgba(139,92,246,.24)] transition-[background-color,box-shadow] hover:bg-[#7447e8] hover:shadow-[0_10px_24px_rgba(116,71,232,.32)] active:bg-[#6840cf] sm:hidden"
            >
              Sign up
            </button>
          ) : null}

          {!prelaunch && !loading && user && (
            <NotificationBell
              open={notificationsOpen}
              onOpenChange={(nextOpen) => {
                setNotificationsOpen(nextOpen);
                if (nextOpen) setMenuOpen(false);
              }}
            />
          )}

          {prelaunch ? (
            <div className="hidden items-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] p-1 shadow-sm sm:flex">
              <span aria-disabled="true" className="min-h-8 cursor-default rounded-full px-3.5 py-2 text-xs font-black text-[var(--text-muted)] opacity-45">
                Sign in
              </span>
              <span aria-disabled="true" className="min-h-8 cursor-default rounded-full bg-[var(--surface-hover)] px-4 py-2 text-xs font-black text-[var(--text-muted)] opacity-55">
                Sign up
              </span>
            </div>
          ) : loading ? (
            <div className="flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] pl-2 pr-3 shadow-sm" aria-label="Loading account">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--surface-hover)] text-[0.68rem] font-black text-[var(--text-muted)]">•</span>
              <span className="hidden w-24 sm:block">
                <span className="block h-2.5 w-20 animate-pulse rounded-full bg-[var(--surface-hover)]" />
                <span className="mt-1.5 block h-2 w-14 animate-pulse rounded-full bg-[var(--surface-hover)]" />
              </span>
              <ChevronDown size={14} className="text-[var(--text-muted)]" />
            </div>
          ) : user ? (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen(false);
                  setMenuOpen((value) => !value);
                }}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] pl-2 pr-3 text-left shadow-sm transition hover:border-[var(--accent-border)]"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-[0.68rem] font-black text-white">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block max-w-28 truncate text-xs font-black text-[var(--text-primary)]">
                    {displayName}
                  </span>
                  <span className="block text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                    {plan} · {credits.available} credits
                  </span>
                </span>
                <ChevronDown size={14} className="text-[var(--text-muted)]" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-3 w-[304px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] p-2 shadow-[var(--shadow-card-hover)] backdrop-blur-2xl"
                >
                  <div className="rounded-2xl border border-white/15 bg-[linear-gradient(135deg,#8b5cf6_0%,#8b5cf6_52%,#e235c7_100%)] p-4 text-white shadow-[0_16px_38px_rgba(139,92,246,0.24)]">
                    <p className="truncate text-sm font-black text-white">{displayName}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-white/72">{user.email}</p>
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-white/15 bg-white/12 px-3 py-2 backdrop-blur-sm">
                      <span className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/90">{plan} plan</span>
                      <span className="text-xs font-black text-white">{credits.available} credits left</span>
                    </div>
                  </div>

                  <div className="mt-2 grid gap-1">
                    <MenuLink href="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" />
                    {isExpert && <MenuLink href="/expert" icon={<BriefcaseBusiness size={16} />} label="Expert Portal" />}
                    <MenuLink href="/account" icon={<Settings size={16} />} label="Account" />
                    <MenuLink href="/billing" icon={<CreditCard size={16} />} label="Billing & plan" />
                    <MenuLink href="/credits" icon={<CircleDollarSign size={16} />} label="Credits" />
                    <MenuLink href="/help" icon={<BadgeHelp size={16} />} label="Help center" />
                  </div>

                  <div className="my-2 border-t border-[var(--border)]" />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--text-secondary)] transition hover:bg-red-500/10 hover:text-red-500"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] p-1 shadow-sm sm:flex">
              <button
                type="button"
                onClick={() => setAuthMode("signin")}
                className="min-h-8 cursor-pointer rounded-full px-3.5 text-xs font-black text-[var(--text-secondary)] transition-[background-color,color] hover:bg-[#eee9ff] hover:text-[#6f46df]"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className="min-h-8 cursor-pointer rounded-full bg-[#8b5cf6] px-4 text-xs font-black text-white shadow-[0_6px_16px_rgba(139,92,246,.24)] transition-[background-color,box-shadow] hover:bg-[#7447e8] hover:shadow-[0_8px_22px_rgba(116,71,232,.38)] active:bg-[#6840cf]"
              >
                Sign up
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (!prelaunch) setMobileOpen((value) => !value);
            }}
            disabled={prelaunch}
            aria-disabled={prelaunch || undefined}
            className={`grid h-10 w-10 place-items-center rounded-full border shadow-sm backdrop-blur-2xl transition lg:hidden ${
              !mobileOpen && heroOverlay
                ? "border-white/25 bg-black/20 text-white hover:border-white/40 hover:bg-white/10"
                : "border-[var(--border)] bg-white/45 text-[var(--text-primary)] hover:border-[var(--accent-border)] hover:bg-white/65 dark:bg-white/10"
            } ${prelaunch ? "cursor-default opacity-35" : "cursor-pointer"}`}
            aria-label={prelaunch ? "Navigation unavailable during pre-launch" : "Toggle navigation"}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {!prelaunch && mobileOpen && (
        <div
          className="absolute inset-x-0 top-full h-[calc(100dvh-var(--header-height))] overflow-y-auto overscroll-contain border-t border-[var(--border)] bg-white shadow-[0_28px_70px_rgba(20,12,34,.18)] dark:bg-[#120c1f] lg:hidden"
        >
          <div className="px-4 py-5">
            <section>
              <div className="mb-2 flex items-center px-1">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Studios</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {VISIBLE_STUDIOS.map((studio) => {
                  const Icon = studioMenuIcons[studio.id as keyof typeof studioMenuIcons] || Sparkles;
                  return (
                    <Link
                      key={studio.id}
                      href={prelaunch ? "#" : studio.href || "/dashboard"}
                      onClick={() => setMobileOpen(false)}
                      aria-disabled={prelaunch || undefined}
                      tabIndex={prelaunch ? -1 : undefined}
                      className={`flex min-h-12 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-sm font-extrabold text-[var(--text-primary)] shadow-[0_8px_22px_rgba(30,18,55,.04)] transition ${prelaunch ? "pointer-events-none cursor-default opacity-40 saturate-50" : "hover:-translate-y-px hover:shadow-[0_12px_26px_rgba(30,18,55,.10)]"}`}
                      style={{
                        background: resolvedTheme === "dark"
                          ? `linear-gradient(135deg,${studio.accent}28,rgba(255,255,255,.035))`
                          : `linear-gradient(135deg,${studio.accent}26,${studio.accent}0f)`,
                        borderColor: `${studio.accent}42`,
                      }}
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border"
                        style={{ background: `${studio.accent}18`, borderColor: `${studio.accent}2e`, color: studio.accent }}
                        aria-hidden="true"
                      >
                        <Icon size={16} strokeWidth={2.1} />
                      </span>
                      <span className="min-w-0 truncate">{studio.shortLabel || studio.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="mt-5">
              <div className="mb-2 flex items-center px-1">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Tools</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORM_TOOLS.map((tool) => {
                  const Icon = toolMenuIcons[tool.id as keyof typeof toolMenuIcons] || Sparkles;
                  return (
                    <Link
                      key={tool.id}
                      href={prelaunch ? "#" : tool.href}
                      onClick={() => setMobileOpen(false)}
                      aria-disabled={prelaunch || undefined}
                      tabIndex={prelaunch ? -1 : undefined}
                      className={`flex min-h-11 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-[0.76rem] font-extrabold leading-4 text-[var(--text-primary)] shadow-[0_8px_22px_rgba(30,18,55,.04)] transition ${prelaunch ? "pointer-events-none cursor-default opacity-40 saturate-50" : "hover:-translate-y-px hover:shadow-[0_12px_26px_rgba(30,18,55,.10)]"}`}
                      style={{
                        background: resolvedTheme === "dark"
                          ? `linear-gradient(135deg,${tool.accent}28,rgba(255,255,255,.035))`
                          : `linear-gradient(135deg,${tool.accent}24,${tool.accent}0d)`,
                        borderColor: `${tool.accent}40`,
                      }}
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border"
                        style={{ background: `${tool.accent}18`, borderColor: `${tool.accent}2e`, color: tool.accent }}
                        aria-hidden="true"
                      >
                        <Icon size={15} strokeWidth={2.1} />
                      </span>
                      <span>{tool.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>

            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 pt-1">
              <nav className="grid gap-2">
                <Link
                  href={prelaunch ? "#" : "/#how-it-works"}
                  onClick={() => setMobileOpen(false)}
                  aria-disabled={prelaunch || undefined}
                  tabIndex={prelaunch ? -1 : undefined}
                  className={`flex min-h-12 items-center gap-2.5 rounded-xl border border-[var(--accent-border)] bg-[color-mix(in_srgb,var(--accent-soft)_72%,transparent)] px-3 py-2.5 text-sm font-extrabold text-[var(--text-primary)] transition ${prelaunch ? "pointer-events-none cursor-default opacity-40 saturate-50" : "hover:bg-[var(--accent-soft)]"}`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]" aria-hidden="true">
                    <Workflow size={16} strokeWidth={2.1} />
                  </span>
                  <span>How it works</span>
                </Link>
                <Link
                  href={prelaunch ? "#" : "/#pricing"}
                  onClick={() => setMobileOpen(false)}
                  aria-disabled={prelaunch || undefined}
                  tabIndex={prelaunch ? -1 : undefined}
                  className={`flex min-h-12 items-center gap-2.5 rounded-xl border border-[var(--accent-border)] bg-[color-mix(in_srgb,var(--accent-soft)_72%,transparent)] px-3 py-2.5 text-sm font-extrabold text-[var(--text-primary)] transition ${prelaunch ? "pointer-events-none cursor-default opacity-40 saturate-50" : "hover:bg-[var(--accent-soft)]"}`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]" aria-hidden="true">
                    <BadgePercent size={16} strokeWidth={2.1} />
                  </span>
                  <span>Pricing</span>
                </Link>
              </nav>

              <Link
                href={prelaunch ? "#" : "/contact?topic=expert"}
                onClick={() => setMobileOpen(false)}
                aria-label="Contact an Expert"
                aria-disabled={prelaunch || undefined}
                tabIndex={prelaunch ? -1 : undefined}
                className={`flex min-h-12 items-center gap-2.5 rounded-xl border border-[var(--accent-border)] bg-[color-mix(in_srgb,var(--accent-soft)_82%,transparent)] px-3 py-2.5 text-sm font-extrabold text-[var(--text-primary)] transition ${prelaunch ? "pointer-events-none cursor-default opacity-35 grayscale" : "hover:border-[#8b5cf6] hover:bg-[var(--accent-soft)]"}`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#8b5cf6] text-white" aria-hidden="true">
                  <BriefcaseBusiness size={16} strokeWidth={2.1} />
                </span>
                <span>Contact an Expert</span>
              </Link>
            </div>

            {prelaunch ? (
              <div className="mt-4 grid grid-cols-2 gap-2 pt-0">
                <span aria-disabled="true" className="flex min-h-11 cursor-default items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-black text-[var(--text-muted)] opacity-45">
                  Sign in
                </span>
                <span aria-disabled="true" className="flex min-h-11 cursor-default items-center justify-center rounded-full bg-[var(--surface-hover)] px-4 text-sm font-black text-[var(--text-muted)] opacity-55">
                  Sign up
                </span>
              </div>
            ) : user ? (
              <div className="mt-4 grid gap-1 pt-0">
                <div className="mb-2 rounded-2xl border border-[var(--accent-border)] bg-[linear-gradient(135deg,var(--accent-soft),var(--surface-strong))] p-4">
                  <p className="truncate text-sm font-black text-[var(--text-primary)]">{displayName}</p>
                  <p className="mt-1 text-xs font-bold text-[var(--accent-strong)]">{plan} plan · {credits.available} credits left</p>
                </div>
                <MenuLink href="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" />
                {isExpert && <MenuLink href="/expert" icon={<BriefcaseBusiness size={16} />} label="Expert Portal" />}
                <MenuLink href="/account" icon={<Settings size={16} />} label="Account" />
                <MenuLink href="/billing" icon={<CreditCard size={16} />} label="Billing & plan" />
                <MenuLink href="/credits" icon={<CircleDollarSign size={16} />} label="Credits" />
                <MenuLink href="/help" icon={<BadgeHelp size={16} />} label="Help center" />
                <button type="button" onClick={handleSignOut} className="mt-1 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-500/10">
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2 pt-0">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => { setMobileOpen(false); setAuthMode("signin"); }}
                >
                  Sign in
                </Button>
                <Button
                  type="button"
                  className="w-full !bg-[#8b5cf6] !text-white hover:!bg-[#7447e8] active:!bg-[#6840cf]"
                  onClick={() => { setMobileOpen(false); setAuthMode("signup"); }}
                >
                  Sign up
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {!prelaunch && !user && authMode && (
        <AuthModal
          initialMode={authMode}
          nextPath={pathname || "/"}
          onClose={() => setAuthMode(null)}
        />
      )}
    </header>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      role="menuitem"
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--text-secondary)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
    >
      {icon}
      {label}
    </Link>
  );
}
