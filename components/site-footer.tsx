"use client";

import Link from "next/link";
import HeyyLogo from "@/components/brand/HeyyLogo";

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

function resolvedFooterHref(href: string, prelaunch: boolean) {
  if (!prelaunch) return href;
  return prelaunchPublicLinks.has(href) ? href : "/";
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
              className="mt-4 block w-fit text-sm font-black text-violet-300 transition hover:text-white"
            >
              hello@heyystudio.com
            </a>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-8 lg:contents">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/35 sm:text-[0.66rem] sm:tracking-[0.22em]">
                  {column.title}
                </p>
                <div className="mt-3.5 grid gap-2.5 sm:mt-4 sm:gap-2.5">
                  {column.links.map(([label, href]) => (
                    <Link
                      key={label}
                      href={resolvedFooterHref(href, prelaunch)}
                      className="text-[0.82rem] font-semibold text-white/58 transition-colors hover:text-violet-300 sm:text-sm"
                    >
                      {label}
                    </Link>
                  ))}
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
