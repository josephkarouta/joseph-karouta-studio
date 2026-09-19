"use client";

import Link from "next/link";
import HeyyLogo from "@/components/brand/HeyyLogo";


function LinkedInIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  );
}

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const columns = [
  {
    title: "Create",
    links: [
      ["Brand", "/#create"],
      ["Architecture", "/#create"],
      ["Interior", "/#create"],
      ["Marketing", "/#create"],
      ["Tools", "/#tools"],
    ],
  },
  {
    title: "Heyy Studio",
    links: [
      ["How it works", "/#how-it-works"],
      ["Pricing", "/#pricing"],
      ["Credit guide", "/credit-guide"],
      ["About", "/about"],
      ["Expert Network", "/expertsnetwork"],
    ],
  },
  {
    title: "Help",
    links: [
      ["Help center", "/help"],
      ["Contact & support", "/contact"],
      ["Responsible AI", "/responsible-ai"],
      ["Security", "/security"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy Policy", "/privacy"],
      ["Terms & Conditions", "/terms"],
      ["Refund Policy", "/refunds"],
      ["Content Policy", "/content-policy"],
    ],
  },
] as const;

const prelaunchPublicLinks = new Set([
  "/expertsnetwork",
  "/privacy",
  "/terms",
  "/refunds",
  "/content-policy",
  "/responsible-ai",
  "/security",
]);

function isFooterLinkActive(href: string, prelaunch: boolean) {
  return !prelaunch || prelaunchPublicLinks.has(href);
}

export default function SiteFooter({ prelaunch = false }: { prelaunch?: boolean }) {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[#120819] px-5 py-9 text-white sm:px-8 sm:py-11 lg:px-12 lg:py-12">
      <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/4 h-72 w-72 rounded-full bg-fuchsia-500/12 blur-3xl" />

      <div className="relative mx-auto max-w-[1500px]">
        <div className="grid gap-8 lg:grid-cols-[1.35fr_repeat(4,1fr)] lg:gap-10">
          <div>
            <HeyyLogo variant="full-colour-light" height={38} />
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/58">
              Create with AI. Build with Experts. From first idea to finished work.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-white/65">
              <span aria-hidden="true" className="text-sm">🇦🇺</span>
              <span>Melbourne, Australia</span>
            </div>
            <a
              href="mailto:hello@heyystudio.com"
              className="mt-4 block w-fit text-sm font-black text-[#a78bfa] transition-colors hover:text-white"
            >
              hello@heyystudio.com
            </a>
            <div className="mt-4 flex items-center gap-2" aria-label="Heyy Studio social media">
              <a
                href="https://www.linkedin.com/company/heyy-studio-ai/"
                target="_blank"
                rel="noreferrer"
                aria-label="Heyy Studio on LinkedIn"
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-white/12 bg-white/[.04] text-white/70 transition-colors hover:border-[#8b5cf6]/65 hover:bg-[#8b5cf6] hover:text-white"
              >
                <LinkedInIcon size={16} />
              </a>
              <a
                href="https://www.instagram.com/heyy_studio_/"
                target="_blank"
                rel="noreferrer"
                aria-label="Heyy Studio on Instagram"
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-white/12 bg-white/[.04] text-white/70 transition-colors hover:border-[#8b5cf6]/65 hover:bg-[#8b5cf6] hover:text-white"
              >
                <InstagramIcon size={16} />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-8 lg:contents">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/35 sm:text-[0.66rem] sm:tracking-[0.22em]">
                  {column.title}
                </p>
                <div className="mt-3.5 grid gap-2.5 sm:mt-4 sm:gap-2.5">
                  {column.links.map(([label, href]) => {
                    const active = isFooterLinkActive(href, prelaunch);
                    return (
                      <Link
                        key={label}
                        href={active ? href : "#"}
                        aria-disabled={!active || undefined}
                        tabIndex={active ? undefined : -1}
                        className={`text-[0.82rem] font-semibold sm:text-sm ${active ? "text-white/58 transition-colors hover:text-violet-300" : "pointer-events-none cursor-default text-white/25"}`}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-5 text-[0.7rem] text-white/38 sm:mt-10 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-6 sm:text-xs">
          <p>© 2026 Heyy Studio. All rights reserved.</p>
          <p>US English · USD · Built for creators worldwide</p>
        </div>
      </div>
    </footer>
  );
}
