"use client";

type CardProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export default function Card({
  title,
  children,
  className = "",
}: CardProps) {
  return (
    <section
      className={`rounded-[28px] border border-white/10 bg-white/[0.04] p-8 ${className}`}
    >
      {title && (
        <h2 className="text-2xl font-black text-white">
          {title}
        </h2>
      )}

      <div className={title ? "mt-6" : ""}>
        {children}
      </div>
    </section>
  );
}