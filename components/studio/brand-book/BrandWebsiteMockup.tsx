"use client";

export default function BrandWebsiteMockup({
  project,
  brand,
}: {
  project: any;
  brand: any;
}) {
  const colours = brand?.colourPalette || brand?.colorPalette || [];
  const primary =
    colours[0]?.hex ||
    colours[0]?.value ||
    colours[0] ||
    "#7C3AED";

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-purple-300">
            Website Preview
          </p>

          <h2 className="mt-1 text-2xl font-black tracking-[-0.05em]">
            Homepage Direction
          </h2>
        </div>

        <div
          className="rounded-full px-4 py-2 text-xs font-black text-white"
          style={{ backgroundColor: primary }}
        >
          Primary CTA
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black">
        {/* Browser */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-[#181818] px-4 py-3">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />

          <div className="ml-5 flex-1 rounded-full bg-white/5 px-4 py-1 text-[11px] text-white/35">
            {project?.project_name || "Website"}
          </div>
        </div>

        {/* Website */}
        <div className="bg-white p-6 text-black">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] opacity-40">
                {project?.project_name}
              </p>

              <h3 className="mt-3 text-4xl font-black leading-none tracking-[-0.06em]">
                Design with confidence.
              </h3>

              <p className="mt-4 max-w-md text-sm leading-6 text-black/60">
                A premium homepage direction generated from your selected brand
                identity.
              </p>

              <button
                className="mt-6 rounded-full px-5 py-3 text-sm font-black text-white"
                style={{
                  backgroundColor: primary,
                }}
              >
                Get Started
              </button>
            </div>

            {/* Right */}
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-black/10 p-3"
                >
                  <div
                    className="h-20 rounded-lg"
                    style={{
                      backgroundColor: primary,
                      opacity: 0.15,
                    }}
                  />

                  <div className="mt-3 h-2 rounded bg-black/10" />

                  <div className="mt-2 h-2 w-2/3 rounded bg-black/10" />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Sections */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl bg-neutral-100 p-4"
              >
                <div
                  className="h-10 w-10 rounded-lg"
                  style={{
                    backgroundColor: primary,
                    opacity: 0.2,
                  }}
                />

                <div className="mt-3 h-2 rounded bg-black/10" />

                <div className="mt-2 h-2 w-3/4 rounded bg-black/10" />

                <div className="mt-2 h-2 w-1/2 rounded bg-black/10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}