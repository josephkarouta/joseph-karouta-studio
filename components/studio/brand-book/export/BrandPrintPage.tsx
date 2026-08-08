"use client";

export default function BrandPrintPage({
  page,
  title,
  eyebrow,
  children,
}: {
  page: number;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="brand-print-page rounded-[28px] border border-white/10 bg-[#0d0d0d] p-10 text-white">
      <header className="flex items-end justify-between border-b border-white/10 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-purple-300">
            {eyebrow}
          </p>

          <h2 className="mt-4 text-5xl font-black tracking-[-0.06em]">
            {title}
          </h2>
        </div>

        <p className="text-7xl font-black text-white/10">
          {String(page).padStart(2, "0")}
        </p>
      </header>

      <div className="mt-10">{children}</div>

      <footer className="mt-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs uppercase tracking-[0.25em] text-white/30">
        <span>Heyy Studio Brand Book</span>
        <span>{String(page).padStart(2, "0")}</span>
      </footer>
    </section>
  );
}
