import type { ReactNode } from "react";

type StudioSectionProps = {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  className?: string;
};

export default function StudioSection({
  eyebrow,
  title,
  children,
  className = "",
}: StudioSectionProps) {
  return (
    <section
      className={`overflow-hidden rounded-[25px] border border-violet-200 bg-white shadow-[0_14px_34px_rgba(55,30,83,.065)] ${className}`}
    >
      {(eyebrow || title) && (
        <header className="border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-white px-5 py-5 sm:px-6">
          {eyebrow && (
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-600">
              {eyebrow}
            </p>
          )}

          {title && (
            <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-slate-950 sm:text-3xl">
              {title}
            </h2>
          )}
        </header>
      )}

      <div className={(eyebrow || title) ? "p-5 sm:p-6" : "p-5 sm:p-6"}>
        {children}
      </div>
    </section>
  );
}
