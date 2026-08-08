"use client";

import { Layers3, type LucideIcon } from "lucide-react";

interface BrandBookPageProps {
  eyebrow?: string;
  title: string;
  page?: number;
  tone?: "violet" | "blue" | "amber" | "rose" | "emerald";
  icon?: LucideIcon;
  children: React.ReactNode;
}

const palettes = {
  violet: {
    border: "#d8c2fb",
    soft: "#f2e8ff",
    accent: "#6c00ff",
    deep: "#3b007f",
    glow: "rgba(108,0,255,.17)",
  },
  blue: {
    border: "#b8d8ff",
    soft: "#eaf5ff",
    accent: "#1766c2",
    deep: "#103f7d",
    glow: "rgba(23,102,194,.16)",
  },
  amber: {
    border: "#efd28e",
    soft: "#fff4d8",
    accent: "#a45c00",
    deep: "#643700",
    glow: "rgba(164,92,0,.15)",
  },
  rose: {
    border: "#f2bad9",
    soft: "#ffe9f5",
    accent: "#c51f7c",
    deep: "#761149",
    glow: "rgba(197,31,124,.15)",
  },
  emerald: {
    border: "#afe2c7",
    soft: "#e8faef",
    accent: "#0b8f4d",
    deep: "#075c33",
    glow: "rgba(11,143,77,.15)",
  },
};

export default function BrandBookPage({
  eyebrow,
  title,
  page,
  tone = "violet",
  icon: Icon = Layers3,
  children,
}: BrandBookPageProps) {
  const palette = palettes[tone];

  return (
    <section
      className="heyy-brand-book-page overflow-hidden rounded-[28px] bg-white"
      style={{
        border: `1px solid ${palette.border}`,
        boxShadow: `0 22px 55px ${palette.glow}, 0 8px 22px rgba(43,30,58,.05)`,
      }}
    >
      <style>{`
        .heyy-brand-book-page,
        .heyy-brand-book-page * {
          box-sizing: border-box;
        }

        .heyy-brand-book-page-header {
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }

        .heyy-brand-book-page-header::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          background:
            radial-gradient(circle at 78% 12%, ${palette.glow}, transparent 34%),
            linear-gradient(135deg, ${palette.soft} 0%, #ffffff 72%);
        }

        .heyy-brand-book-page-header::after {
          content: "/";
          position: absolute;
          right: 30px;
          top: -58px;
          z-index: -1;
          color: ${palette.accent}0f;
          font-size: 210px;
          font-weight: 950;
          line-height: 1;
          transform: rotate(7deg);
          pointer-events: none;
        }

        .heyy-brand-book-page-kicker {
          color: ${palette.accent};
        }

        .heyy-brand-book-page-icon {
          background: linear-gradient(145deg, ${palette.accent}, ${palette.deep});
          box-shadow: 0 13px 28px ${palette.glow};
        }

        .heyy-brand-book-page-number {
          border: 1px solid ${palette.border};
          background: rgba(255,255,255,.76);
          color: ${palette.accent};
          backdrop-filter: blur(10px);
        }
      `}</style>

      <header
        className="heyy-brand-book-page-header flex items-center justify-between gap-5 border-b px-5 py-6 md:px-7 md:py-7"
        style={{ borderColor: palette.border }}
      >
        <div className="flex min-w-0 items-center gap-4">
          <span className="heyy-brand-book-page-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] text-white">
            <Icon size={21} strokeWidth={2.1} />
          </span>

          <div className="min-w-0">
            {eyebrow && (
              <p className="heyy-brand-book-page-kicker text-[9px] font-black uppercase tracking-[0.24em]">
                {eyebrow}
              </p>
            )}

            <h2 className="mt-1 max-w-3xl text-2xl font-black tracking-[-0.05em] text-slate-950 md:text-[31px] md:leading-[1.08]">
              {title}
            </h2>
          </div>
        </div>

        {typeof page === "number" && (
          <span className="heyy-brand-book-page-number hidden min-h-10 shrink-0 items-center rounded-full px-4 text-[9px] font-black uppercase tracking-[0.2em] sm:inline-flex">
            Section {String(page).padStart(2, "0")}
          </span>
        )}
      </header>

      <div className="p-5 md:p-7">{children}</div>
    </section>
  );
}
