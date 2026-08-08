"use client";

const DEFAULT_STEPS = [
  "Reading project context",
  "Understanding creative direction",
  "Building visual logic",
  "Preparing output",
  "Saving to workspace",
];

export default function AIGenerationLoader({
  title = "Heyy Studio is working",
  steps = DEFAULT_STEPS,
}: {
  title?: string;
  steps?: string[];
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-[2rem] border border-purple-400/20 bg-purple-500/10 p-6">
      <div className="flex items-center gap-4">
        <div className="relative h-11 w-11 shrink-0 rounded-full border border-purple-300/40">
          <div className="absolute inset-1 animate-pulse rounded-full bg-purple-400/20" />
          <div className="absolute inset-3 rounded-full bg-purple-300" />
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-purple-300">
            Generating
          </p>

          <h3 className="mt-1 text-lg font-black text-white">{title}</h3>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {steps.map((step, index) => (
          <div
            key={step}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3"
            style={{
              animation: "fadeSlide 700ms ease both",
              animationDelay: `${index * 120}ms`,
            }}
          >
            <div className="h-2 w-2 rounded-full bg-purple-300" />

            <p className="text-sm text-white/60">{step}</p>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes fadeSlide {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
