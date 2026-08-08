"use client";

import BrandPrintStyles from "@/components/studio/brand-book/export/BrandPrintStyles";
import BrandPrintPage from "@/components/studio/brand-book/export/BrandPrintPage";

export default function BrandPrintRoot({
  project,
  brand,
}: {
  project: any;
  brand: any;
}) {
  const colours =
    brand?.colourPalette ||
    brand?.colorPalette ||
    brand?.colors ||
    [];

  const typography =
    brand?.typography ||
    brand?.typographySystem ||
    brand?.fonts ||
    [];

  return (
    <>
      <BrandPrintStyles />

      <div id="brand-book-print-root">
        <BrandPrintPage page={1} eyebrow="Brand Book" title={project?.project_name || "Brand Project"}>
          <p className="max-w-xl text-lg leading-8 text-white/60">
            Professional brand guidelines generated with Heyy Studio.
          </p>
        </BrandPrintPage>

        <BrandPrintPage page={2} eyebrow="Brand Foundation" title="Overview">
          <div className="grid gap-5 md:grid-cols-2">
            <Card title="Strategy">
              {brand?.brandStrategy?.description || brand?.summary || "Brand strategy will appear here."}
            </Card>

            <Card title="Voice">
              {brand?.brandVoice?.description || "Brand voice will appear here."}
            </Card>
          </div>
        </BrandPrintPage>

        <BrandPrintPage page={3} eyebrow="Colour System" title="Palette">
          <div className="grid gap-4 md:grid-cols-3">
            {colours.map((colour: any, index: number) => {
              const value =
                typeof colour === "string"
                  ? colour
                  : colour?.hex || colour?.value || "#111111";

              return (
                <div
                  key={`${value}-${index}`}
                  className="brand-print-avoid-break overflow-hidden rounded-3xl bg-white text-black"
                >
                  <div className="h-40" style={{ backgroundColor: value }} />
                  <div className="p-5">
                    <p className="font-black">
                      {typeof colour === "string"
                        ? `Colour ${index + 1}`
                        : colour?.name || colour?.role || `Colour ${index + 1}`}
                    </p>
                    <p className="mt-2 text-sm text-black/55">HEX {value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </BrandPrintPage>

        <BrandPrintPage page={4} eyebrow="Typography" title="Type System">
          <div className="grid gap-5 md:grid-cols-2">
            {typography.map((font: any, index: number) => (
              <div
                key={index}
                className="brand-print-avoid-break rounded-3xl bg-white p-8 text-black"
              >
                <p className="text-7xl font-black tracking-[-0.08em]">Aa</p>
                <h3 className="mt-6 text-3xl font-black">
                  {typeof font === "string" ? font : font?.font || font?.name || "Typography"}
                </h3>
              </div>
            ))}
          </div>
        </BrandPrintPage>
      </div>
    </>
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
    <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-4 leading-8 text-white/55">{children}</p>
    </div>
  );
}
