"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface BrandBookPageProps {
  eyebrow?: string;
  title: string;
  page?: number;
  tone?: "violet" | "blue" | "amber" | "rose" | "emerald";
  icon?: LucideIcon;
  children: ReactNode;
}

export default function BrandBookPage({
  eyebrow,
  title,
  page,
  children,
}: BrandBookPageProps) {
  return (
    <section className="heyy-brand-book-page overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(48,31,68,.06)]">
      <header className="flex items-center justify-between gap-5 border-b border-slate-200 px-5 py-6 md:px-7">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-600">
              {eyebrow}
            </p>
          )}
          <h2 className="mt-1 max-w-3xl text-2xl font-black tracking-[-0.045em] text-slate-950 md:text-[30px] md:leading-[1.08]">
            {title}
          </h2>
        </div>

        {typeof page === "number" && (
          <span className="hidden min-h-9 shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-4 text-[8px] font-black uppercase tracking-[0.18em] text-slate-500 sm:inline-flex">
            Section {String(page).padStart(2, "0")}
          </span>
        )}
      </header>

      <div className="p-5 md:p-7">{children}</div>
    </section>
  );
}
