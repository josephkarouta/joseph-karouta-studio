"use client";

function getColours(brand: any) {
  return brand?.colourPalette || brand?.colorPalette || brand?.colors || [];
}

function colourValue(colour: any, fallback: string) {
  if (!colour) return fallback;
  if (typeof colour === "string") return colour;
  return colour?.hex || colour?.value || fallback;
}

export default function BrandPresentationMockup({
  project,
  brand,
}: {
  project: any;
  brand: any;
}) {
  const colours = getColours(brand);

  const primary = colourValue(colours[0], "#7C3AED");
  const dark = colourValue(colours[1], "#101010");
  const soft = colourValue(colours[2], "#F5F5F5");

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-purple-300">
            Presentation System
          </p>

          <h2 className="mt-1 text-2xl font-black tracking-[-0.05em]">
            Slide Direction
          </h2>
        </div>

        <div
          className="rounded-full px-4 py-2 text-xs font-black text-white"
          style={{ backgroundColor: primary }}
        >
          Brand Deck
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Slide title="Cover" bg={dark} text="white">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">
            Brand Presentation
          </p>

          <h3 className="mt-4 text-3xl font-black leading-none tracking-[-0.05em]">
            {project?.project_name || "Brand"}
          </h3>

          <div
            className="mt-5 h-1.5 w-20 rounded-full"
            style={{ backgroundColor: primary }}
          />
        </Slide>

        <Slide title="Section" bg={soft} text="black">
          <p className="text-[10px] uppercase tracking-[0.22em] text-black/40">
            01 Strategy
          </p>

          <h3 className="mt-4 text-3xl font-black leading-none tracking-[-0.05em]">
            Brand Foundation
          </h3>
        </Slide>

        <Slide title="Content" bg="#ffffff" text="black">
          <div className="grid h-full grid-cols-[0.9fr_1.1fr] gap-4">
            <div
              className="rounded-xl"
              style={{
                backgroundColor: primary,
                opacity: .15,
              }}
            />

            <div>
              <h3 className="text-xl font-black">
                Clear Message
              </h3>

              <div className="mt-4 space-y-2">
                <div className="h-2 rounded bg-black/10" />
                <div className="h-2 w-5/6 rounded bg-black/10" />
                <div className="h-2 w-2/3 rounded bg-black/10" />
              </div>
            </div>
          </div>
        </Slide>

        <Slide title="Statistics" bg="#ffffff" text="black">
          <div className="grid h-full grid-cols-3 gap-3">
            {["01", "02", "03"].map((n) => (
              <div
                key={n}
                className="rounded-xl border border-black/10 p-3"
              >
                <p
                  className="text-2xl font-black"
                  style={{ color: primary }}
                >
                  {n}
                </p>

                <div className="mt-4 h-2 rounded bg-black/10" />
                <div className="mt-2 h-2 w-2/3 rounded bg-black/10" />
              </div>
            ))}
          </div>
        </Slide>
      </div>
    </section>
  );
}

function Slide({
  title,
  bg,
  text,
  children,
}: {
  title: string;
  bg: string;
  text: "white" | "black";
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <div
        className={`aspect-video p-5 ${
          text === "white"
            ? "text-white"
            : "text-black"
        }`}
        style={{
          backgroundColor: bg,
        }}
      >
        {children}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <p className="text-sm font-black">
          {title}
        </p>
      </div>
    </div>
  );
}