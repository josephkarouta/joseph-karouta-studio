"use client";

export default function BrandPackagingMockup({
  project,
  brand,
}: {
  project: any;
  brand: any;
}) {
  const colours = brand?.colourPalette || [];
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
            Packaging
          </p>

          <h2 className="mt-1 text-2xl font-black tracking-[-0.05em]">
            Packaging Direction
          </h2>
        </div>

        <div
          className="rounded-full px-4 py-2 text-xs font-black text-white"
          style={{
            backgroundColor: primary,
          }}
        >
          Premium Packaging
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 bg-white p-4 text-black"
          >
            <div
              className="mx-auto flex h-40 w-28 items-center justify-center rounded-lg border border-black/10"
              style={{
                background: `linear-gradient(180deg,#ffffff,${primary}22)`,
              }}
            >
              <div className="text-center">
                <div className="text-lg font-black">
                  {project?.project_name}
                </div>

                <div
                  className="mx-auto mt-3 h-1.5 w-12 rounded-full"
                  style={{
                    backgroundColor: primary,
                  }}
                />
              </div>
            </div>

            <div className="mt-4">
              <div className="h-2 rounded bg-black/10" />
              <div className="mt-2 h-2 w-2/3 rounded bg-black/10" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}