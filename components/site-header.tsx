"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  BadgeHelp,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import ThemeToggle from "@/components/theme-toggle";
import NotificationBell from "@/components/notifications/NotificationBell";
import HeyyLogo from "@/components/brand/HeyyLogo";
import { ButtonLink } from "@/components/ui/heyy";

const navItems = [
  ["Studios", "/#create"],
  ["Tools", "/#tools"],
  ["How it works", "/#how-it-works"],
  ["Pricing", "/#pricing"],
] as const;

export default function SiteHeader() {
  const pathname = usePathname();
  const { user, loading, plan, credits, signOut } = useAuth();
  const { resolvedTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Account";
  const avatarUrl = String(
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "",
  ).trim();

  useEffect(() => {
    setMenuOpen(false);
    setNotificationsOpen(false);
    setMobileOpen(false);
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
    window.location.href = "/";
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--border)] bg-[color:var(--glass)] backdrop-blur-2xl">
      <div className="mx-auto flex h-[var(--header-height)] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" onClick={handleLogoClick} className="shrink-0" aria-label="Heyy Studio home">
          <HeyyLogo
            variant={resolvedTheme === "dark" ? "full-colour-light" : "full-colour-dark"}
            height={31}
          />
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-bold text-[var(--text-secondary)] lg:flex">
          {navItems.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="rounded-full px-4 py-2.5 transition hover:bg-[var(--surface-strong)] hover:text-[var(--text-primary)]"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/contact?topic=expert"
            className="hidden min-h-10 items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 px-4 text-xs font-black text-white shadow-[0_10px_24px_rgba(109,40,217,.24)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(109,40,217,.32)] lg:inline-flex"
          >
            <UserRound size={15} /> Contact an Expert
          </Link>

          <ThemeToggle compact />

          {!loading && user && (
            <NotificationBell
              open={notificationsOpen}
              onOpenChange={(nextOpen) => {
                setNotificationsOpen(nextOpen);
                if (nextOpen) setMenuOpen(false);
              }}
            />
          )}

          {loading ? (
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
                className="flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] pl-2 pr-3 text-left shadow-sm transition hover:border-[var(--accent-border)]"
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
                  className="absolute right-0 mt-3 w-[290px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] p-2 shadow-[var(--shadow-card-hover)] backdrop-blur-2xl"
                >
                  <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-500 p-4 text-white">
                    <p className="truncate text-sm font-black">{displayName}</p>
                    <p className="mt-1 truncate text-xs text-white/70">{user.email}</p>
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-white/12 px-3 py-2">
                      <span className="text-[0.65rem] font-black uppercase tracking-[0.14em]">{plan} plan</span>
                      <span className="text-xs font-black">{credits.available} credits left</span>
                    </div>
                  </div>

                  <div className="mt-2 grid gap-1">
                    <MenuLink href="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" />
                    <MenuLink href="/account" icon={<Settings size={16} />} label="Account" />
                    <MenuLink href="/billing" icon={<CreditCard size={16} />} label="Billing & plan" />
                    <MenuLink href="/credits" icon={<CircleDollarSign size={16} />} label="Credits" />
                    <MenuLink href="/help" icon={<BadgeHelp size={16} />} label="Help center" />
                  </div>

                  <div className="my-2 border-t border-[var(--border)]" />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--text-secondary)] transition hover:bg-red-500/10 hover:text-red-500"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <ButtonLink href="/login" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" size="sm">
                <Sparkles size={14} /> Start creating
              </ButtonLink>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-primary)] lg:hidden"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--surface-strong)] px-4 py-4 shadow-xl lg:hidden">
          <nav className="grid gap-1">
            {navItems.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="rounded-xl px-4 py-3 text-sm font-extrabold text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
              >
                {label}
              </Link>
            ))}
          </nav>

          <Link
            href="/contact?topic=expert"
            onClick={() => setMobileOpen(false)}
            className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 px-4 text-sm font-black text-white shadow-lg"
          >
            <UserRound size={16} /> Contact an Expert
          </Link>

          {user ? (
            <div className="mt-3 grid gap-1 border-t border-[var(--border)] pt-3">
              <div className="mb-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 p-4 text-white">
                <p className="truncate text-sm font-black">{displayName}</p>
                <p className="mt-1 text-xs font-bold text-white/75">{plan} plan · {credits.available} credits left</p>
              </div>
              <MenuLink href="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" />
              <MenuLink href="/account" icon={<Settings size={16} />} label="Account" />
              <MenuLink href="/billing" icon={<CreditCard size={16} />} label="Billing & plan" />
              <MenuLink href="/credits" icon={<CircleDollarSign size={16} />} label="Credits" />
              <MenuLink href="/help" icon={<BadgeHelp size={16} />} label="Help center" />
              <button type="button" onClick={handleSignOut} className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-500/10">
                <LogOut size={16} /> Sign out
              </button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-3">
              <ButtonLink href="/login" variant="secondary" className="w-full">
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" className="w-full">
                Start creating
              </ButtonLink>
            </div>
          )}
        </div>
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
