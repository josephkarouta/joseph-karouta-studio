"use client";

import BrandBookPage from "@/components/studio/brand-book/BrandBookPage";

function safeSlug(value: string) {
  return String(value || "brand")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

function getColours(brand: any) {
  return brand?.colourPalette || brand?.colorPalette || brand?.colors || [];
}

function colourValue(colour: any, fallback: string) {
  if (!colour) return fallback;
  if (typeof colour === "string") return colour;
  return colour?.hex || colour?.value || fallback;
}

export default function BrandStationery({
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
  const secondary = colourValue(colours[1], "#111111");
  const slug = safeSlug(project?.project_name);

  return (
    <BrandBookPage page={15} eyebrow="Stationery System" title="Business Touchpoints">
      <p className="max-w-2xl leading-7 text-white/50">
        Core stationery examples for proposals, client communication and
        professional brand presence.
      </p>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-white/10 bg-white p-8 text-black">
          <div className="flex min-h-[320px] flex-col justify-between rounded-2xl border border-black/10 p-8">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-black/35">
                  Business Card
                </p>

                <h3 className="mt-8 text-4xl font-black tracking-[-0.06em]">
                  {project?.project_name || "Brand"}
                </h3>
              </div>

              {logo?.imageUrl ? (
                <img
                  src={logo.imageUrl}
                  alt="Logo"
                  className="h-16 w-16 object-contain"
                />
              ) : (
                <div
                  className="h-16 w-16 rounded-full"
                  style={{ backgroundColor: primary }}
                />
              )}
            </div>

            <div>
              <div
                className="mb-6 h-2 w-24 rounded-full"
                style={{ backgroundColor: primary }}
              />

              <p className="text-sm text-black/55">hello@{slug}.com</p>
              <p className="mt-1 text-sm text-black/55">www.{slug}.com</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-[1.75rem] border border-white/10 bg-white p-6 text-black">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-black/35">
              Letterhead
            </p>

            <div className="mt-10 space-y-3">
              <div className="h-3 w-2/3 rounded-full bg-black/15" />
              <div className="h-3 w-full rounded-full bg-black/10" />
              <div className="h-3 w-5/6 rounded-full bg-black/10" />
            </div>

            <div
              className="mt-14 h-2 w-32 rounded-full"
              style={{ backgroundColor: primary }}
            />
          </div>

          <div
            className="rounded-[1.75rem] border border-white/10 p-6 text-white"
            style={{ backgroundColor: secondary }}
          >
            <p className="text-xs font-black uppercase tracking-[0.25em] text-white/40">
              Email Signature
            </p>

            <h3 className="mt-6 text-2xl font-black">
              {project?.project_name || "Brand"}
            </h3>

            <p className="mt-2 text-sm text-white/50">Creative Team</p>

            <div
              className="mt-6 h-1.5 w-20 rounded-full"
              style={{ backgroundColor: primary }}
            />
          </div>
        </div>
      </div>
    </BrandBookPage>
  );
}
