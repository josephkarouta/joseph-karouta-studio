"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Grid2X2, Home, Images, Sparkles, UserRound, Wrench } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { openHeyyAuthModal } from "@/lib/auth-modal";
import { cx } from "@/components/ui/heyy";

const hiddenPrefixes = ["/admin", "/login", "/signup", "/expert"];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) return null;

  const leftItem = user
    ? { label: "Projects", href: "/dashboard/projects", icon: FolderKanban, active: pathname.startsWith("/dashboard/project") || pathname === "/dashboard/projects", auth: true }
    : { label: "Studios", href: "/#create", icon: Grid2X2, active: false, auth: false };
  const rightItem = user
    ? { label: "Assets", href: "/dashboard/assets", icon: Images, active: pathname === "/dashboard/assets", auth: true }
    : { label: "Tools", href: "/#tools", icon: Wrench, active: pathname.startsWith("/tools"), auth: false };
  const accountItem = { label: user ? "Account" : "Sign in", href: "/account", icon: UserRound, active: pathname.startsWith("/account") || pathname.startsWith("/billing") || pathname.startsWith("/credits"), auth: true };

  function protectedAction(href: string) {
    if (loading) return;
    if (user) {
      window.location.href = href;
      return;
    }
    openHeyyAuthModal("signin", href);
  }

  return (
    <>
      <div className="h-[calc(76px+env(safe-area-inset-bottom))] md:hidden" aria-hidden="true" />
      <nav
        data-heyy-mobile-bottom-nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#100918]/94 px-2 pt-2 text-white shadow-[0_-12px_36px_rgba(18,8,25,.20)] backdrop-blur-2xl md:hidden"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end gap-1">
          <MobileNavLink label="Home" href="/" icon={Home} active={pathname === "/"} />
          {leftItem.auth ? (
            <MobileNavButton item={leftItem} onClick={() => protectedAction(leftItem.href)} disabled={loading} />
          ) : (
            <MobileNavLink {...leftItem} />
          )}

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("heyy-assistant-open"))}
            className="mx-auto -mt-5 grid h-14 w-14 cursor-pointer place-items-center rounded-[1.15rem] border border-white/20 bg-[#8b5cf6] text-white shadow-[0_16px_34px_rgba(139,92,246,.38)] transition active:scale-[.96]"
            aria-label="Ask Heyy"
          >
            <Sparkles size={22} strokeWidth={2.2} />
          </button>

          {rightItem.auth ? (
            <MobileNavButton item={rightItem} onClick={() => protectedAction(rightItem.href)} disabled={loading} />
          ) : (
            <MobileNavLink {...rightItem} />
          )}
          <MobileNavButton item={accountItem} onClick={() => protectedAction(accountItem.href)} disabled={loading} />
        </div>
        <div className="pointer-events-none mx-auto -mt-1 grid max-w-lg grid-cols-5 gap-1 text-center">
          <span />
          <span />
          <span className="text-[.58rem] font-black text-[#bda7ff]">Ask Heyy</span>
          <span />
          <span />
        </div>
      </nav>
    </>
  );
}

function MobileNavLink({ label, href, icon: Icon, active }: { label: string; href: string; icon: typeof Home; active: boolean }) {
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[.58rem] font-bold transition",
        active ? "text-[#bda7ff]" : "text-white/58",
      )}
    >
      <Icon size={19} strokeWidth={active ? 2.4 : 2} />
      <span>{label}</span>
    </Link>
  );
}

function MobileNavButton({ item, onClick, disabled }: { item: { label: string; icon: typeof Home; active: boolean }; onClick: () => void; disabled?: boolean }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex min-h-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-1 text-[.58rem] font-bold transition disabled:cursor-wait disabled:opacity-50",
        item.active ? "text-[#bda7ff]" : "text-white/58",
      )}
    >
      <Icon size={19} strokeWidth={item.active ? 2.4 : 2} />
      <span>{item.label}</span>
    </button>
  );
}
