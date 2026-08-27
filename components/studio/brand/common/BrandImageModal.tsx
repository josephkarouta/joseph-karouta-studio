"use client";

import { useEffect } from "react";

export default function BrandImageModal({
  imageUrl,
  title,
  onClose,
  contain = false,
}: {
  imageUrl: string | null;
  title: string;
  onClose: () => void;
  contain?: boolean;
}) {
  useEffect(() => {
    if (!imageUrl) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-white/15 bg-slate-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 text-white">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-300">Large visual</p>
            <h3 className="mt-1 text-base font-black">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xl text-white transition hover:bg-violet-600">×</button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-[#121018] p-3 sm:p-5">
          <img src={imageUrl} alt={title} className={`mx-auto max-h-[78vh] w-full ${contain ? "object-contain" : "object-contain"}`} />
        </div>
      </div>
    </div>
  );
}
