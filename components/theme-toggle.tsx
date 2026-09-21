"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function ThemeToggle({ compact = false, overlay = false }: { compact?: boolean; overlay?: boolean }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border px-3 text-xs font-extrabold shadow-sm backdrop-blur-2xl transition ${
        overlay
          ? "border-white/25 bg-black/20 text-white hover:border-white/40 hover:bg-white/10"
          : "border-[var(--border)] bg-white/45 text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:bg-white/65 hover:text-[var(--accent-strong)] dark:bg-white/10"
      }`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      {!compact && <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
}
