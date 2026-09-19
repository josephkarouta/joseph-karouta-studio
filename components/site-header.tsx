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

export default function SiteHeader({ prelaunch = false }: { prelaunch?: boolean }) {
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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--border)] bg-[color:var(--glass)] backdrop-blur-2xl">
      <div className="mx-auto flex h-[var(--header-height)] max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" onClick={handleLogoClick} className="shrink-0" aria-label="Heyy Studio home">
          <HeyyLogo
            variant={resolvedTheme === "dark" ? "full-colour-light" : "full-colour-dark"}
            height={40}
          />
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-bold text-[var(--text-secondary)] lg:flex">
          {navItems.map(([label, href]) => (
            <Link
              key={label}
              href={prelaunch ? "#" : href}
              aria-disabled={prelaunch || undefined}
              tabIndex={prelaunch ? -1 : undefined}
              className={`rounded-full px-4 py-2.5 transition ${prelaunch ? "pointer-events-none cursor-default opacity-40" : "hover:bg-[var(--surface-strong)] hover:text-[var(--text-primary)]"}`}
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
              className="group relative hidden h-[60px] w-[132px] shrink-0 cursor-pointer self-end items-end justify-center overflow-visible -mb-px lg:flex"
            >
              <img
                src="/expert-contact-bubble.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[3px] left-1/2 h-[56px] w-auto max-w-[98px] -translate-x-1/2 object-contain opacity-100 transition-opacity duration-200 ease-out group-hover:opacity-0"
              />
              <img
                src="/expert-contact-desktop.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-[3px] h-[60px] w-full object-contain opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100"
              />
            </Link>
          )}

          <ThemeToggle compact />

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
                  <div className="rounded-2xl border border-white/15 bg-[linear-gradient(135deg,#6f2dff_0%,#9b2cff_52%,#e235c7_100%)] p-4 text-white shadow-[0_16px_38px_rgba(111,45,255,0.24)]">
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
                className="min-h-8 cursor-pointer rounded-full px-3.5 text-xs font-black text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className="min-h-8 cursor-pointer rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 px-4 text-xs font-black text-white shadow-[0_6px_16px_rgba(109,40,217,.22)] transition-[filter,box-shadow,transform] hover:-translate-y-px hover:brightness-[1.08] hover:saturate-[1.08] hover:shadow-[0_8px_20px_rgba(109,40,217,.30)]"
              >
                Sign up
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-primary)] lg:hidden"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="max-h-[calc(100dvh-var(--header-height))] overflow-y-auto border-t border-[var(--border)] bg-[var(--surface-strong)] shadow-xl lg:hidden">
          <div className="px-4 py-5">
            <section>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Studios</p>
                <Link
                  href={prelaunch ? "#" : "/#create"}
                  onClick={() => setMobileOpen(false)}
                  aria-disabled={prelaunch || undefined}
                  tabIndex={prelaunch ? -1 : undefined}
                  className={`text-[0.68rem] font-extrabold text-[var(--text-muted)] ${prelaunch ? "pointer-events-none cursor-default opacity-40" : ""}`}
                >
                  Explore all
                </Link>
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
                      className={`flex min-h-12 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-extrabold text-[var(--text-primary)] transition ${prelaunch ? "pointer-events-none cursor-default opacity-40 saturate-50" : "hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]"}`}
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                        style={{ background: studio.soft, color: studio.accent }}
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
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Tools</p>
                <Link
                  href={prelaunch ? "#" : "/#tools"}
                  onClick={() => setMobileOpen(false)}
                  aria-disabled={prelaunch || undefined}
                  tabIndex={prelaunch ? -1 : undefined}
                  className={`text-[0.68rem] font-extrabold text-[var(--text-muted)] ${prelaunch ? "pointer-events-none cursor-default opacity-40" : ""}`}
                >
                  Explore all
                </Link>
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
                      className={`flex min-h-11 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[0.76rem] font-extrabold leading-4 text-[var(--text-primary)] transition ${prelaunch ? "pointer-events-none cursor-default opacity-40 saturate-50" : "hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]"}`}
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                        style={{ background: tool.soft, color: tool.accent }}
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

            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 border-y border-[var(--border)] pt-4">
              <nav className="grid gap-2">
                <Link
                  href={prelaunch ? "#" : "/#how-it-works"}
                  onClick={() => setMobileOpen(false)}
                  aria-disabled={prelaunch || undefined}
                  tabIndex={prelaunch ? -1 : undefined}
                  className={`flex min-h-12 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-extrabold text-[var(--text-primary)] transition ${prelaunch ? "pointer-events-none cursor-default opacity-40 saturate-50" : "hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]"}`}
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
                  className={`flex min-h-12 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-extrabold text-[var(--text-primary)] transition ${prelaunch ? "pointer-events-none cursor-default opacity-40 saturate-50" : "hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]"}`}
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
                className={`group relative flex min-h-[104px] items-end justify-center overflow-visible rounded-xl -mb-px ${prelaunch ? "pointer-events-none cursor-default opacity-35 grayscale" : ""}`}
              >
                <img
                  src="/expert-contact-mobile.png"
                  alt=""
                  aria-hidden="true"
                  className="max-h-[118px] w-full object-contain object-bottom transition-transform duration-300 ease-out group-hover:scale-[1.035]"
                />
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
                  className="w-full"
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
