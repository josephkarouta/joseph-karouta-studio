"use client";

function getColours(brand: any) {
  return brand?.colourPalette || brand?.colorPalette || brand?.colors || [];
}

function colourValue(colour: any, fallback: string) {
  if (!colour) return fallback;
  if (typeof colour === "string") return colour;
  return colour?.hex || colour?.value || fallback;
}

function slug(value: string) {
  return String(value || "brand")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export default function BrandBusinessCardShowcase({
  project,
  brand,
  logo,
}: {
  project: any;
  brand: any;
  logo?: any;
}) {
  const colours = getColours(brand);

  const primary = colourValue(colours[0], "#7C3AED");
  const dark = colourValue(colours[1], "#111111");

  const name = project?.project_name || "Brand";
  const domain = slug(name);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-purple-300">
            Business Cards
          </p>

          <h2 className="mt-1 text-2xl font-black tracking-[-0.05em]">
            Card System
          </h2>
        </div>

        <div
          className="rounded-full px-4 py-2 text-xs font-black text-white"
          style={{
            backgroundColor: primary,
          }}
        >
          Print Ready
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Front">
          <div className="flex aspect-[1.7] flex-col justify-between rounded-2xl bg-white p-5 text-black">
            <div className="flex justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-black/40">
                Creative Studio
              </p>

              {logo?.imageUrl ? (
                <img
                  src={logo.imageUrl}
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <div
                  className="h-10 w-10 rounded-full"
                  style={{
                    backgroundColor: primary,
                  }}
                />
              )}
            </div>

            <div>
              <h3 className="text-2xl font-black">
                {name}
              </h3>

              <p className="mt-1 text-sm text-black/45">
                hello@{domain}.com
              </p>
            </div>
          </div>
        </Card>

        <Card title="Back">
          <div
            className="flex aspect-[1.7] flex-col justify-between rounded-2xl p-5 text-white"
            style={{
              backgroundColor: dark,
            }}
          >
            <div
              className="h-1.5 w-16 rounded-full"
              style={{
                backgroundColor: primary,
              }}
            />

            <h3 className="text-3xl font-black">
              {name}
            </h3>

            <p className="text-sm text-white/45">
              www.{domain}.com
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      {children}

      <p className="mt-3 text-sm font-black text-white/70">
        {title}
      </p>
    </div>
  );
}