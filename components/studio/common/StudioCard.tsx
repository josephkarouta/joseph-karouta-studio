import type { ReactNode } from "react";

type StudioCardProps = {
  children: ReactNode;
  className?: string;
};

export default function StudioCard({
  children,
  className = "",
}: StudioCardProps) {
  return (
    <div
      className={`rounded-[19px] border border-slate-200 bg-white p-5 text-slate-950 shadow-[0_8px_22px_rgba(35,24,51,.045)] transition duration-200 hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-[0_14px_30px_rgba(108,0,255,.10)] ${className}`}
    >
      {children}
    </div>
  );
}
