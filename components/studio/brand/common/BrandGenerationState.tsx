"use client";

const DEFAULT_STEPS = [
  "Reading the selected direction",
  "Preparing the visual prompt",
  "Generating the image",
  "Optimising the preview",
  "Saving to the workspace",
];

export default function BrandGenerationState({
  title = "Heyy Studio is generating",
  steps = DEFAULT_STEPS,
  compact = false,
}: {
  title?: string;
  steps?: string[];
  compact?: boolean;
}) {
  return (
    <div className={`overflow-hidden rounded-[18px] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 ${compact ? "p-4" : "p-5"}`}>
      <style>{`
        @keyframes heyyBrandSpin { to { transform: rotate(360deg); } }
        @keyframes heyyBrandMove { from { transform: translateX(-130%); } to { transform: translateX(340%); } }
        @keyframes heyyBrandPulse { 0%,100% { opacity:.55; } 50% { opacity:1; } }
      `}</style>
      <div className="flex items-center gap-3">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-violet-700 text-white shadow-lg shadow-violet-700/20">
          <span className="absolute inset-1 rounded-[10px] border-2 border-white/30 border-t-white" style={{ animation: "heyyBrandSpin .9s linear infinite" }} />
          <span className="text-[10px] font-black">h</span>
        </span>
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-600">Generating</p>
          <p className={`${compact ? "text-sm" : "text-base"} mt-1 font-black text-slate-950`}>{title}</p>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-full bg-violet-100 p-1">
        <div className="h-1.5 w-[34%] rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-500" style={{ animation: "heyyBrandMove 1.15s ease-in-out infinite" }} />
      </div>
      {!compact && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center gap-2 rounded-[12px] border border-violet-100 bg-white px-3 py-2 text-[10px] font-bold text-slate-600" style={{ animation: "heyyBrandPulse 1.5s ease-in-out infinite", animationDelay: `${index * 120}ms` }}>
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              {step}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
