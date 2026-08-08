"use client";

export default function BrandBookCover({
  project,
  moodboard,
  logo,
}: {
  project: any;
  moodboard?: any;
  logo?: any;
}) {
  return (
    <section className="relative overflow-hidden rounded-[26px] border border-violet-200 bg-white shadow-[0_16px_36px_rgba(55,30,83,.08)]">
      <div className="grid min-h-[430px] lg:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1d1030] via-[#40206b] to-[#7a2cff] p-7 text-white sm:p-9">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/25 blur-3xl" />
          <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-violet-300/20 blur-3xl" />

          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-200">
                Heyy Studio Brand Book
              </p>

              <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[.92] tracking-[-0.065em] sm:text-6xl">
                {project?.project_name || "Brand Project"}
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-white/70">
                A living brand system built from strategy, visual direction,
                logo, colour, typography and generated project assets.
              </p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              <Meta label="Industry" value={project?.industry} />
              <Meta label="Audience" value={project?.audience} />
              <Meta label="Style" value={project?.style} />
              <Meta label="Version" value={`V${project?.version || 1}`} />
            </div>
          </div>
        </div>

        <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden bg-violet-50 p-7">
          {moodboard?.imageUrl && (
            <img
              src={moodboard.imageUrl}
              alt={project?.project_name || "Brand moodboard"}
              className="absolute inset-0 h-full w-full object-cover opacity-25"
            />
          )}

          <div className="relative z-10 rounded-[24px] border border-white bg-white p-6 shadow-2xl shadow-violet-900/15">
            {logo?.imageUrl ? (
              <img
                src={logo.imageUrl}
                alt="Selected logo"
                className="h-36 w-36 object-contain"
              />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded-[18px] bg-violet-100 text-sm font-black text-violet-700">
                Brand Logo
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Meta({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-[15px] border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/45">
        {label}
      </p>
      <p className="mt-2 text-sm font-black text-white">{value || "—"}</p>
    </div>
  );
}
