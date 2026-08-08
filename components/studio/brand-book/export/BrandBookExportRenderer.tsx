"use client";

import { BrandBookExportCover } from "@/components/studio/brand-book/export/BrandBookExportCover";
import { BrandBookContents } from "@/components/studio/brand-book/export/BrandBookContents";

function readPayload(asset: any) {
  const payload = asset?.output_payload;
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return payload;
}

function latest(assets: any[], types: string[]) {
  return assets.find((asset) => types.includes(asset.asset_type));
}

function selectedConcept(assets: any[]) {
  const asset = latest(assets, ["creative_direction_selected", "moodboard_selected", "moodboard"]);
  const payload = readPayload(asset);
  return payload.selectedConcept || payload.moodboards?.[payload.selectedMoodboard ?? 0] || payload.moodboards?.[0] || null;
}

function selectedMoodboard(assets: any[]) {
  const asset = latest(assets, ["moodboard_selected", "moodboard_variations", "moodboard", "creative_direction_selected"]);
  const payload = readPayload(asset);
  const index = payload.selectedMoodboard ?? 0;
  return payload.moodboards?.[index] || payload.moodboards?.[0] || payload.variations?.[0] || payload.selectedConcept || null;
}

function selectedLogo(assets: any[]) {
  const asset = latest(assets, ["logo_selected", "logo_variation", "logo_concept"]);
  const payload = readPayload(asset);
  const index = payload.selectedLogo ?? 0;
  return payload.logos?.[index] || payload.logos?.[0] || payload.variations?.[0] || (asset?.file_url ? { imageUrl: asset.file_url } : null);
}

function colours(brand: any) {
  return brand?.colourPalette || brand?.colorPalette || brand?.colors || [];
}

function typography(brand: any) {
  return brand?.typography || brand?.typographySystem || brand?.fonts || [];
}

function colourValue(colour: any, fallback: string) {
  if (!colour) return fallback;
  if (typeof colour === "string") return colour;
  return colour?.hex || colour?.value || fallback;
}

function colourName(colour: any, index: number) {
  if (typeof colour === "string") return `Colour ${index + 1}`;
  return colour?.name || colour?.role || `Colour ${index + 1}`;
}

function fontName(font: any) {
  if (typeof font === "string") return font;
  return font?.font || font?.name || "Typography";
}

function rgbFromHex(hex: string) {
  if (!hex || !hex.startsWith("#")) return "";
  const value = hex.replace("#", "");
  if (value.length !== 6) return "";
  const bigint = parseInt(value, 16);
  return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
}

function cmykFromHex(hex: string) {
  if (!hex || !hex.startsWith("#")) return "";
  const value = hex.replace("#", "");
  if (value.length !== 6) return "";
  const r = parseInt(value.substring(0, 2), 16) / 255;
  const g = parseInt(value.substring(2, 4), 16) / 255;
  const b = parseInt(value.substring(4, 6), 16) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return "0, 0, 0, 100";
  const c = Math.round(((1 - r - k) / (1 - k)) * 100);
  const m = Math.round(((1 - g - k) / (1 - k)) * 100);
  const y = Math.round(((1 - b - k) / (1 - k)) * 100);
  return `${c}, ${m}, ${y}, ${Math.round(k * 100)}`;
}

export default function BrandBookExportRenderer({
  project,
  brand,
  assets,
}: {
  project: any;
  brand: any;
  assets: any[];
}) {
  const moodboard = selectedMoodboard(assets);
  const logo = selectedLogo(assets);
  const concept = selectedConcept(assets);
  const palette = colours(brand);
  const fonts = typography(brand);

  return (
    <div id="brand-book-export-renderer">
      <div className="space-y-8 bg-black p-8 text-white">
        <div className="print-page">
          <BrandBookExportCover project={project} logo={logo} moodboard={moodboard} />
        </div>

        <div className="print-page">
          <BrandBookContents />
        </div>

        <ExportPage number="03" eyebrow="Brand Foundation" title="Overview">
          <div className="grid gap-5 md:grid-cols-2">
            <ExportCard title={brand?.brandStrategy?.positioning || "Brand Strategy"}>
              {brand?.brandStrategy?.description || brand?.summary || "Brand strategy will appear here."}
            </ExportCard>
            <ExportCard title={brand?.brandVoice?.headline || "Brand Voice"}>
              {brand?.brandVoice?.description || "Brand voice will appear here."}
            </ExportCard>
          </div>
        </ExportPage>

        <ExportPage number="04" eyebrow="Colour System" title="Palette">
          <div className="grid gap-4 md:grid-cols-3">
            {palette.map((colour: any, index: number) => {
              const value = colourValue(colour, "#111111");
              return (
                <div key={`${value}-${index}`} className="no-print-break overflow-hidden rounded-3xl bg-white text-black">
                  <div className="h-44" style={{ backgroundColor: value }} />
                  <div className="p-5">
                    <p className="font-black">{colourName(colour, index)}</p>
                    <p className="mt-2 text-sm text-black/55">HEX {value}</p>
                    <p className="text-sm text-black/55">RGB {colour?.rgb || rgbFromHex(value) || "—"}</p>
                    <p className="text-sm text-black/55">CMYK {colour?.cmyk || cmykFromHex(value) || "—"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ExportPage>

        <ExportPage number="05" eyebrow="Typography" title="Type hierarchy">
          <div className="grid gap-5 md:grid-cols-2">
            {fonts.map((font: any, index: number) => (
              <div key={`${fontName(font)}-${index}`} className="no-print-break rounded-3xl bg-white p-8 text-black">
                <p className="text-7xl font-black tracking-[-0.08em]">Aa</p>
                <h3 className="mt-6 text-3xl font-black">{fontName(font)}</h3>
                <p className="mt-2 text-sm text-black/50">{font?.role || (index === 0 ? "Heading" : "Body")}</p>
                {font?.reason && <p className="mt-5 leading-7 text-black/60">{font.reason}</p>}
              </div>
            ))}
          </div>
        </ExportPage>

        <ExportPage number="06" eyebrow="Creative Concept" title={concept?.conceptName || concept?.title || "Selected concept"}>
          <div className="grid gap-5 md:grid-cols-2">
            <ExportCard title="Concept Story">{concept?.story || concept?.visualDirection || "Creative concept will appear here."}</ExportCard>
            <ExportCard title="Logo Philosophy">{concept?.logoPhilosophy || "Logo philosophy will appear here."}</ExportCard>
          </div>
        </ExportPage>

        <ExportPage number="07" eyebrow="Moodboard" title="Visual direction">
          {moodboard?.imageUrl ? (
            <img src={moodboard.imageUrl} className="w-full rounded-3xl border border-white/10 object-cover" />
          ) : (
            <ExportCard title="Moodboard">No selected moodboard yet.</ExportCard>
          )}
        </ExportPage>

        <ExportPage number="08" eyebrow="Logo System" title="Primary logo">
          {logo?.imageUrl ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-3xl bg-white p-16">
              <img src={logo.imageUrl} className="max-h-80 max-w-full object-contain" />
            </div>
          ) : (
            <ExportCard title="Logo">No selected logo yet.</ExportCard>
          )}
        </ExportPage>
      </div>
    </div>
  );
}

function ExportPage({
  number,
  eyebrow,
  title,
  children,
}: {
  number: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="print-page min-h-[760px] rounded-[2rem] border border-white/10 bg-white/[0.04] p-10">
      <div className="mb-10 flex items-end justify-between gap-8">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-purple-300">{eyebrow}</p>
          <h2 className="mt-4 text-5xl font-black tracking-[-0.06em]">{title}</h2>
        </div>
        <p className="text-7xl font-black text-white/10">{number}</p>
      </div>
      {children}
    </section>
  );
}

function ExportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="no-print-break rounded-3xl border border-white/10 bg-black/30 p-6">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-4 leading-8 text-white/55">{children}</p>
    </div>
  );
}
