"use client";

export default function DisclosureChevron({ open }: { open: boolean }) {
  return (
    <span
      className={[
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition-all duration-300 hover:border-purple-300/40 hover:bg-purple-500/10",
        open ? "rotate-180 text-purple-200" : "text-white/45",
      ].join(" ")}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 9L12 15L18 9"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}