"use client";

export default function BrandBookPrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        setTimeout(() => window.print(), 100);
      }}
      className="rounded-full bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-purple-300"
    >
      Print / Save Brand Book PDF
    </button>
  );
}
