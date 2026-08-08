"use client";

import Link from "next/link";
import HeyyLogo from "@/components/brand/HeyyLogo";

const columns = [
  {
    title: "Platform",
    links: [
      ["Studios", "/#studios"],
      ["AI tools", "/#tools"],
      ["Workspace", "/#workspace"],
      ["Pricing", "/pricing"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Careers", "/careers"],
      ["Contact", "/contact"],
      ["Help center", "/help"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Terms & Conditions", "/terms"],
      ["Privacy Policy", "/privacy"],
      ["Refund Policy", "/refunds"],
    ],
  },
  {
    title: "Trust",
    links: [
      ["Responsible AI", "/responsible-ai"],
      ["Security", "/security"],
      ["Content Policy", "/content-policy"],
    ],
  },
] as const;

export default function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[#15091f] px-5 py-14 text-white sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/4 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />

      <div className="relative mx-auto max-w-[1450px]">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_repeat(4,1fr)]">
          <div>
            <HeyyLogo variant="full-colour-light" height={36} />
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/58">
              Create with AI. Build with Experts. Keep projects, decisions,
              production and final files inside one connected creative workspace.
            </p>
            <a
              href="mailto:hello@heyystudio.com"
              className="mt-5 inline-block text-sm font-black text-violet-300 transition hover:text-white"
            >
              hello@heyystudio.com
            </a>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-[0.66rem] font-black uppercase tracking-[0.24em] text-white/35">
                {column.title}
              </p>
              <div className="mt-5 grid gap-3">
                {column.links.map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className="text-sm font-semibold text-white/58 transition hover:translate-x-0.5 hover:text-violet-300"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-7 text-xs text-white/38 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Heyy Studio. All rights reserved.</p>
          <p>US English · USD · Built for creative teams worldwide</p>
        </div>
      </div>
    </footer>
  );
}
