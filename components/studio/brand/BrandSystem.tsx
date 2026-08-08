import StudioCard from "@/components/studio/common/StudioCard";
import StudioSection from "@/components/studio/common/StudioSection";

export default function BrandSystem({ brand }: { brand: any }) {
  return (
    <div className="grid gap-6">
      <StudioSection
        eyebrow="Brand Strategy"
        title={brand?.brandStrategy?.positioning}
      >
        <p className="leading-8 text-white/60">
          {brand?.brandStrategy?.description}
        </p>
      </StudioSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <StudioSection eyebrow="Brand Voice" title={brand?.brandVoice?.headline}>
          <p className="leading-8 text-white/60">
            {brand?.brandVoice?.description}
          </p>
        </StudioSection>

        <StudioSection
          eyebrow="Personality"
          title={brand?.personality?.headline}
        >
          <div className="flex flex-wrap gap-2">
            {brand?.personality?.traits?.map((trait: string) => (
              <span
                key={trait}
                className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-sm text-white/60"
              >
                {trait}
              </span>
            ))}
          </div>
        </StudioSection>
      </div>

      <StudioSection eyebrow="Taglines">
        <div className="grid gap-3 md:grid-cols-2">
          {brand?.taglines?.map((tagline: string) => (
            <StudioCard key={tagline} className="p-4">
              <p className="text-white/65">{tagline}</p>
            </StudioCard>
          ))}
        </div>
      </StudioSection>

      <StudioSection eyebrow="Colour Palette">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {brand?.colourPalette?.map((colour: any, index: number) => (
            <StudioCard key={`${colour.name}-${index}`}>
              <div
                className="h-20 rounded-xl border border-white/10"
                style={{ backgroundColor: colour.HEX || colour.hex || "#ffffff" }}
              />

              <h3 className="mt-4 font-black">{colour.name}</h3>

              <p className="mt-2 text-sm text-white/45">
                {colour.HEX || colour.hex}
              </p>

              <p className="mt-1 text-xs text-white/35">{colour.RGB}</p>
              <p className="mt-1 text-xs text-white/35">{colour.CMYK}</p>
            </StudioCard>
          ))}
        </div>
      </StudioSection>

      <StudioSection eyebrow="Typography">
        <div className="grid gap-4 md:grid-cols-2">
          {brand?.typography?.map((type: any, index: number) => (
            <StudioCard key={`${type.role}-${index}`}>
              <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                {type.role}
              </p>

              <h3 className="mt-3 text-2xl font-black">{type.font}</h3>

              <p className="mt-3 text-sm leading-6 text-white/55">
                {type.reason}
              </p>

              {type.sourceUrl && (
                <a
                  href={type.sourceUrl}
                  target="_blank"
                  className="mt-4 inline-flex text-sm font-bold text-purple-300 hover:text-white"
                >
                  View font →
                </a>
              )}
            </StudioCard>
          ))}
        </div>
      </StudioSection>
    </div>
  );
}