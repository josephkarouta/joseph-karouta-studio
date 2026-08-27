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
      ["AI tools", "/#tools"],
    ],
  },
  {
    title: "Heyy Studio",
    links: [
      ["How it works", "/#how-it-works"],
      ["Pricing", "/#pricing"],
      ["Credit guide", "/credit-guide"],
      ["About", "/about"],
      ["Careers", "/careers"],
      ["Contact", "/contact"],
    ],
  },
  {
    title: "Help",
    links: [
      ["Help center", "/help"],
      ["Contact", "/contact"],
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

export default function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[#15091f] px-5 py-14 text-white sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/4 h-72 w-72 rounded-full bg-fuchsia-500/12 blur-3xl" />

      <div className="relative mx-auto max-w-[1450px]">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_repeat(4,1fr)]">
          <div>
            <HeyyLogo variant="full-colour-light" height={36} />
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/58">
              Create with AI. Build with Experts. Start with an idea, explore it your way, and get professional help when you need it.
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
              <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-white/35">
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
          <p>US English · USD · Built for creators worldwide</p>
        </div>
      </div>
    </footer>
  );
}
