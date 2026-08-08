"use client";

import type {
  PresentationCard,
  PresentationDocument,
  PresentationImage,
  PresentationSlide,
  PresentationTone,
} from "@/lib/presentation/types";
import { HEYY_LOGO_EXPORT_ASSETS } from "@/lib/brand/heyy-logo-assets";

const toneColours: Record<PresentationTone, { soft: string; strong: string; ink: string }> = {
  purple: { soft: "#F2E9FF", strong: "#6C00FF", ink: "#3E007F" },
  blue: { soft: "#EAF4FF", strong: "#1769D2", ink: "#0E447F" },
  green: { soft: "#E8F8EF", strong: "#0B8F4D", ink: "#075E34" },
  amber: { soft: "#FFF4D8", strong: "#B46A00", ink: "#744300" },
  neutral: { soft: "#EFF2F6", strong: "#334155", ink: "#172033" },
};

function textDensityClass(value: string, compact = false) {
  const length = value.trim().length;
  if (length > (compact ? 520 : 760)) return "long";
  if (length > (compact ? 320 : 480)) return "medium";
  return "";
}

function typographyFontFamily(name: string) {
  const safeName = name.replace(/["']/g, "").trim();
  const serif = /(serif|display|merriweather|playfair|garamond|baskerville|georgia|times|bodoni|didot)/i.test(safeName);
  return `"${safeName}", ${serif ? "Georgia, 'Times New Roman', serif" : "Inter, Arial, Helvetica, sans-serif"}`;
}

function typographyWeight(role?: string) {
  return /(heading|headline|title|display)/i.test(role || "") ? 700 : 400;
}

function imageStyle(image?: PresentationImage | null) {
  const contain = image?.fit === "contain";

  return {
    objectFit: contain ? ("contain" as const) : ("cover" as const),
    objectPosition: "center",
    display: "block",
    width: contain ? "auto" : "100%",
    height: contain ? "auto" : "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    margin: contain ? "auto" : undefined,
  };
}

function ExportHeyyLogo({
  light = false,
  height = 30,
  className,
}: {
  light?: boolean;
  height?: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      aria-label="Heyy Studio"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.max(5, Math.round(height * 0.18)),
        lineHeight: 1,
      }}
    >
      <img
        src={light ? HEYY_LOGO_EXPORT_ASSETS.light : HEYY_LOGO_EXPORT_ASSETS.dark}
        alt=""
        aria-hidden="true"
        crossOrigin="anonymous"
        loading="eager"
        style={{
          display: "block",
          width: "auto",
          height,
          objectFit: "contain",
          flex: "0 0 auto",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          color: light ? "#A78BFA" : "#7C3AED",
          fontFamily: "Inter, Arial, Helvetica, sans-serif",
          fontSize: Math.max(7, Math.round(height * 0.29)),
          fontWeight: 900,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          transform: "translateY(1px)",
        }}
      >
        Studio
      </span>
    </span>
  );
}

function ExportImage({
  image,
  className,
}: {
  image?: PresentationImage | null;
  className?: string;
}) {
  if (!image?.url) {
    return (
      <div className={`heyy-presentation-placeholder ${className || ""}`}>
        <ExportHeyyLogo height={24} />
        <strong>{image?.label || "Visual pending"}</strong>
      </div>
    );
  }

  return (
    <img
      src={image.url}
      alt={image.label || ""}
      crossOrigin="anonymous"
      loading="eager"
      className={className}
      data-image-fit={image.fit || "cover"}
      style={imageStyle(image)}
    />
  );
}

function Header({
  slide,
}: {
  slide: Exclude<PresentationSlide, { kind: "cover" }>;
}) {
  return (
    <header className="heyy-presentation-header">
      <div className="heyy-presentation-heading">
        {slide.number && <span className="heyy-presentation-number">{slide.number}</span>}
        <div>
          <p>{slide.eyebrow}</p>
          <h2>{slide.title}</h2>
        </div>
      </div>
      <ExportHeyyLogo
        height={28}
        className="heyy-presentation-brand-logo"
      />
    </header>
  );
}

function Footer({ text, page }: { text?: string; page: number }) {
  return (
    <footer className="heyy-presentation-footer">
      <span>{text || "Heyy Studio Presentation"}</span>
      <span>{String(page).padStart(2, "0")}</span>
    </footer>
  );
}

function Card({ card }: { card: PresentationCard }) {
  const tone = toneColours[card.tone || "neutral"];

  return (
    <article
      className="heyy-presentation-card"
      style={{
        borderColor: tone.strong,
        background: tone.soft,
      }}
    >
      <span style={{ color: tone.strong }}>{card.title}</span>
      <p className={textDensityClass(card.body, true)} style={{ color: tone.ink }}>{card.body}</p>
    </article>
  );
}

function CoverSlide({
  slide,
  page,
}: {
  slide: Extract<PresentationSlide, { kind: "cover" }>;
  page: number;
}) {
  return (
    <section className="heyy-presentation-slide heyy-presentation-cover" data-presentation-slide="true">
      <div className="heyy-cover-image">
        <ExportImage image={slide.image} />
      </div>
      <div className="heyy-cover-overlay" />
      <div className="heyy-cover-top">
        <ExportHeyyLogo
          light
          height={31}
          className="heyy-presentation-brand-logo light"
        />
        <span>{String(page).padStart(2, "0")}</span>
      </div>
      <div className="heyy-cover-content">
        <p>{slide.eyebrow}</p>
        <h1>{slide.title}</h1>
        {slide.subtitle && <h2>{slide.subtitle}</h2>}
        {slide.meta && <span>{slide.meta}</span>}
      </div>
      <div className="heyy-cover-logo">
        {slide.logo?.url ? <ExportImage image={slide.logo} /> : <span>CREATE WITH AI.<br />BUILD WITH EXPERTS.</span>}
      </div>
    </section>
  );
}

function ContentSlide({
  slide,
  page,
}: {
  slide: Extract<PresentationSlide, { kind: "content" }>;
  page: number;
}) {
  return (
    <section className="heyy-presentation-slide" data-presentation-slide="true">
      <Header slide={slide} />
      <div className="heyy-presentation-body">
        {slide.lead && (
          <p className={`heyy-presentation-lead ${textDensityClass(slide.lead)}`}>
            {slide.lead}
          </p>
        )}

        {slide.metrics && slide.metrics.length > 0 && (
          <div className="heyy-presentation-metrics">
            {slide.metrics.map((metric) => (
              <article key={`${metric.label}-${metric.value}`}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </div>
        )}

        {slide.cards && slide.cards.length > 0 && (
          <div className={`heyy-presentation-cards columns-${Math.min(slide.cards.length, 3)}`}>
            {slide.cards.map((card) => <Card key={`${card.title}-${card.body}`} card={card} />)}
          </div>
        )}
      </div>
      <Footer text={slide.footer} page={page} />
    </section>
  );
}

function PaletteSlide({
  slide,
  page,
}: {
  slide: Extract<PresentationSlide, { kind: "palette" }>;
  page: number;
}) {
  const layout = slide.items.length <= 4 ? "one-row" : "two-rows";

  return (
    <section className="heyy-presentation-slide" data-presentation-slide="true">
      <Header slide={slide} />
      <div className="heyy-presentation-body">
        <div className={`heyy-palette-grid ${layout}`}>
          {slide.items.slice(0, 8).map((item) => (
            <article key={`${item.name}-${item.hex}`} className="heyy-palette-card">
              <div style={{ background: item.hex }} />
              <section>
                <strong>{item.name}</strong>
                <span>HEX {item.hex}</span>
                <span>RGB {item.rgb || "—"}</span>
                <span>CMYK {item.cmyk || "—"}</span>
              </section>
            </article>
          ))}
        </div>
      </div>
      <Footer text={slide.footer} page={page} />
    </section>
  );
}

function TypographySlide({
  slide,
  page,
}: {
  slide: Extract<PresentationSlide, { kind: "typography" }>;
  page: number;
}) {
  return (
    <section className="heyy-presentation-slide" data-presentation-slide="true">
      <Header slide={slide} />
      <div className="heyy-presentation-body">
        <div className="heyy-type-grid">
          {slide.items.slice(0, 4).map((item) => (
            <article key={`${item.name}-${item.role}`}>
              <div
                className="heyy-type-sample"
                style={{
                  fontFamily: typographyFontFamily(item.name),
                  fontWeight: typographyWeight(item.role),
                }}
              >
                {item.sample || "Aa Bb Cc 0123"}
              </div>
              <strong>{item.name}</strong>
              <span>{item.role || "Typography"}</span>
              {item.reason && <p>{item.reason}</p>}
            </article>
          ))}
        </div>
      </div>
      <Footer text={slide.footer} page={page} />
    </section>
  );
}

function ImageTextSlide({
  slide,
  page,
}: {
  slide: Extract<PresentationSlide, { kind: "imageText" }>;
  page: number;
}) {
  return (
    <section className="heyy-presentation-slide" data-presentation-slide="true">
      <Header slide={slide} />
      <div className="heyy-presentation-body heyy-image-text-layout">
        <div className="heyy-image-text-visual">
          <ExportImage image={slide.image} />
        </div>
        <div className="heyy-image-text-copy">
          {slide.lead && (
            <p className={`heyy-presentation-lead compact ${textDensityClass(slide.lead, true)}`}>
              {slide.lead}
            </p>
          )}
          {slide.cards && slide.cards.length > 0 && (
            <div className="heyy-image-text-cards">
              {slide.cards.slice(0, 4).map((card) => (
                <Card key={`${card.title}-${card.body}`} card={card} />
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer text={slide.footer} page={page} />
    </section>
  );
}

function GallerySlide({
  slide,
  page,
}: {
  slide: Extract<PresentationSlide, { kind: "gallery" }>;
  page: number;
}) {
  const count = Math.max(1, slide.images.length);
  const className =
    count === 1
      ? "one"
      : count <= 4
        ? "four"
        : "six";

  return (
    <section className="heyy-presentation-slide" data-presentation-slide="true">
      <Header slide={slide} />
      <div className="heyy-presentation-body">
        {slide.images.length > 0 ? (
          <div className={`heyy-gallery-grid ${className}`}>
            {slide.images.slice(0, 6).map((item, index) => (
              <figure key={`${item.url}-${index}`}>
                <ExportImage image={item} />
                <figcaption>{item.caption || item.label || `Visual ${index + 1}`}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="heyy-gallery-empty">
            <strong>Visual pending</strong>
            <span>The selected image will appear here when it is available.</span>
          </div>
        )}
      </div>
      <Footer text={slide.footer} page={page} />
    </section>
  );
}

function MaterialsSlide({
  slide,
  page,
}: {
  slide: Extract<PresentationSlide, { kind: "materials" }>;
  page: number;
}) {
  return (
    <section className="heyy-presentation-slide" data-presentation-slide="true">
      <Header slide={slide} />
      <div className="heyy-presentation-body">
        {slide.lead && (
            <p className={`heyy-presentation-lead compact ${textDensityClass(slide.lead, true)}`}>
              {slide.lead}
            </p>
          )}
        <div className="heyy-material-grid">
          {slide.items.slice(0, 8).map((item) => (
            <article key={`${item.name}-${item.category}`}>
              <div>
                <ExportImage
                  image={
                    item.imageUrl
                      ? { url: item.imageUrl, label: item.name, fit: "cover" }
                      : null
                  }
                />
              </div>
              <section>
                <strong>{item.name}</strong>
                <span>{item.category || "Material"}</span>
                <p>{item.finish || "Finish to verify"} · {item.application || "Application to define"}</p>
              </section>
            </article>
          ))}
        </div>
      </div>
      <Footer text={slide.footer} page={page} />
    </section>
  );
}

function TableSlide({
  slide,
  page,
}: {
  slide: Extract<PresentationSlide, { kind: "table" }>;
  page: number;
}) {
  return (
    <section className="heyy-presentation-slide" data-presentation-slide="true">
      <Header slide={slide} />
      <div className="heyy-presentation-body">
        {slide.lead && (
            <p className={`heyy-presentation-lead compact ${textDensityClass(slide.lead, true)}`}>
              {slide.lead}
            </p>
          )}
        <div className="heyy-table-wrap">
          <div
            className="heyy-table-row head"
            style={{ gridTemplateColumns: `repeat(${slide.table.columns.length}, minmax(0, 1fr))` }}
          >
            {slide.table.columns.map((column) => <strong key={column}>{column}</strong>)}
          </div>
          {slide.table.rows.map((row, rowIndex) => (
            <div
              key={`${row.join("-")}-${rowIndex}`}
              className="heyy-table-row"
              style={{ gridTemplateColumns: `repeat(${slide.table.columns.length}, minmax(0, 1fr))` }}
            >
              {row.map((cell, index) => <span key={`${cell}-${index}`}>{cell}</span>)}
            </div>
          ))}
        </div>
      </div>
      <Footer text={slide.footer} page={page} />
    </section>
  );
}

function DisclaimerSlide({
  slide,
  page,
}: {
  slide: Extract<PresentationSlide, { kind: "disclaimer" }>;
  page: number;
}) {
  return (
    <section className="heyy-presentation-slide heyy-disclaimer-slide" data-presentation-slide="true">
      <Header slide={slide} />
      <div className="heyy-presentation-body">
        <div className="heyy-disclaimer-mark" aria-hidden="true">
          <svg viewBox="0 0 100 100" role="presentation">
            <rect x="45" y="18" width="10" height="50" rx="5" fill="currentColor" />
            <circle cx="50" cy="81" r="6" fill="currentColor" />
          </svg>
        </div>
        <div className="heyy-disclaimer-copy">
          {slide.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <div className="heyy-disclaimer-signoff">
          <ExportHeyyLogo height={42} />
        </div>
      </div>
      <Footer text={slide.footer} page={page} />
    </section>
  );
}

function Slide({ slide, page }: { slide: PresentationSlide; page: number }) {
  switch (slide.kind) {
    case "cover":
      return <CoverSlide slide={slide} page={page} />;
    case "content":
      return <ContentSlide slide={slide} page={page} />;
    case "palette":
      return <PaletteSlide slide={slide} page={page} />;
    case "typography":
      return <TypographySlide slide={slide} page={page} />;
    case "imageText":
      return <ImageTextSlide slide={slide} page={page} />;
    case "gallery":
      return <GallerySlide slide={slide} page={page} />;
    case "materials":
      return <MaterialsSlide slide={slide} page={page} />;
    case "table":
      return <TableSlide slide={slide} page={page} />;
    case "disclaimer":
      return <DisclaimerSlide slide={slide} page={page} />;
  }
}

export default function PresentationRenderer({
  document,
  rootId,
}: {
  document: PresentationDocument;
  rootId: string;
}) {
  return (
    <>
      <style>{presentationStyles}</style>
      <div
        id={rootId}
        className="heyy-presentation-export-root"
        aria-hidden="true"
        style={{ ["--heyy-accent" as string]: document.accentHex }}
      >
        {document.slides.map((slide, index) => (
          <Slide key={slide.id} slide={slide} page={index + 1} />
        ))}
      </div>
    </>
  );
}

const presentationStyles = `
.heyy-presentation-export-root {
  position: fixed;
  left: -24000px;
  top: 0;
  z-index: -9999;
  display: grid;
  width: 1600px;
  gap: 32px;
  pointer-events: none;
  font-family: Inter, Arial, Helvetica, sans-serif;
  color: #18202b;
}
.heyy-presentation-slide {
  position: relative;
  box-sizing: border-box;
  width: 1600px;
  height: 900px;
  overflow: hidden;
  background:
    radial-gradient(circle at 92% 8%, rgba(108,0,255,.08), transparent 27%),
    #f8fafc;
  padding: 66px 74px 54px;
}
.heyy-presentation-cover {
  background: #11131a;
  color: #fff;
  padding: 0;
}
.heyy-cover-image {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 62%;
  height: 100%;
  overflow: hidden;
}
.heyy-cover-image img,
.heyy-cover-image .heyy-presentation-placeholder {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover !important;
  object-position: center;
}
.heyy-cover-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(13,14,22,1) 0%, rgba(13,14,22,.98) 34%, rgba(13,14,22,.82) 51%, rgba(13,14,22,.18) 100%),
    linear-gradient(0deg, rgba(13,14,22,.72), transparent 58%);
}
.heyy-cover-top {
  position: absolute;
  top: 58px;
  left: 70px;
  right: 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: rgba(255,255,255,.58);
  font-size: 18px;
  font-weight: 800;
}
.heyy-cover-content {
  position: absolute;
  left: 74px;
  right: 680px;
  bottom: 84px;
}
.heyy-cover-content p,
.heyy-presentation-heading p {
  margin: 0;
  color: var(--heyy-accent);
  font-size: 17px;
  font-weight: 900;
  letter-spacing: .18em;
  text-transform: uppercase;
}
.heyy-cover-content h1 {
  max-width: 780px;
  margin: 24px 0 0;
  font-size: 82px;
  font-weight: 950;
  letter-spacing: -.06em;
  line-height: .92;
}
.heyy-cover-content h2 {
  max-width: 720px;
  margin: 25px 0 0;
  color: #d7c8ff;
  font-size: 39px;
  font-weight: 850;
  letter-spacing: -.035em;
  line-height: 1.06;
}
.heyy-cover-content > span {
  display: block;
  margin-top: 22px;
  color: rgba(255,255,255,.66);
  font-size: 20px;
}
.heyy-cover-logo {
  position: absolute;
  right: 76px;
  bottom: 70px;
  display: flex;
  width: 250px;
  height: 145px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.42);
  border-radius: 28px;
  background: rgba(255,255,255,.96);
  padding: 22px;
  color: #17151f;
  text-align: center;
  font-size: 15px;
  font-weight: 900;
  letter-spacing: .12em;
  line-height: 1.6;
}
.heyy-cover-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.heyy-presentation-brand-logo {
  flex: 0 0 auto;
}
.heyy-presentation-brand-logo.light {
  filter: none;
}
.heyy-presentation-header {
  display: flex;
  min-height: 94px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 40px;
  border-bottom: 2px solid #dfe6ee;
  padding-bottom: 24px;
}
.heyy-presentation-heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 22px;
}
.heyy-presentation-heading > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  padding-top: 2px;
}
.heyy-presentation-number {
  color: var(--heyy-accent);
  font-size: 53px;
  font-weight: 950;
  letter-spacing: -.07em;
  line-height: .9;
}
.heyy-presentation-heading p {
  line-height: 1;
}
.heyy-presentation-heading h2 {
  max-width: 1100px;
  margin: 0;
  color: #18202b;
  font-size: 44px;
  font-weight: 950;
  letter-spacing: -.045em;
  line-height: 1.01;
}
.heyy-presentation-body {
  height: 650px;
  box-sizing: border-box;
  padding-top: 30px;
}
.heyy-presentation-footer {
  position: absolute;
  left: 74px;
  right: 74px;
  bottom: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #dfe6ee;
  padding-top: 15px;
  color: #718096;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .04em;
}
.heyy-presentation-lead {
  max-width: 1360px;
  margin: 0;
  color: #4c5b6d;
  font-size: 22px;
  line-height: 1.48;
}
.heyy-presentation-lead.medium { font-size: 20px; line-height: 1.45; }
.heyy-presentation-lead.long { font-size: 17px; line-height: 1.42; }
.heyy-presentation-lead.compact {
  font-size: 18px;
  line-height: 1.44;
}
.heyy-presentation-lead.compact.medium { font-size: 16px; }
.heyy-presentation-lead.compact.long { font-size: 14px; line-height: 1.38; }
.heyy-presentation-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 18px;
  margin-top: 28px;
}
.heyy-presentation-metrics article {
  min-height: 108px;
  box-sizing: border-box;
  border: 1px solid #d8e1eb;
  border-radius: 21px;
  background: #fff;
  padding: 22px;
}
.heyy-presentation-metrics span {
  display: block;
  color: #718096;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.heyy-presentation-metrics strong {
  display: block;
  margin-top: 14px;
  color: #18202b;
  font-size: 24px;
  font-weight: 950;
  line-height: 1.12;
}
.heyy-presentation-cards {
  display: grid;
  gap: 18px;
  margin-top: 26px;
}
.heyy-presentation-cards.columns-1 { grid-template-columns: 1fr; }
.heyy-presentation-cards.columns-2 { grid-template-columns: repeat(2,minmax(0,1fr)); }
.heyy-presentation-cards.columns-3 { grid-template-columns: repeat(3,minmax(0,1fr)); }
.heyy-presentation-card {
  min-height: 168px;
  box-sizing: border-box;
  border: 1px solid;
  border-radius: 22px;
  padding: 22px 24px;
}
.heyy-presentation-card > span {
  display: block;
  font-size: 18px;
  font-weight: 950;
}
.heyy-presentation-card p {
  margin: 12px 0 0;
  font-size: 16px;
  line-height: 1.43;
}
.heyy-presentation-card p.medium { font-size: 14px; line-height: 1.4; }
.heyy-presentation-card p.long { font-size: 12.5px; line-height: 1.35; }
.heyy-palette-grid {
  display: grid;
  height: 612px;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 18px;
}
.heyy-palette-grid.one-row { grid-template-rows: 1fr; }
.heyy-palette-grid.two-rows { grid-template-rows: repeat(2,minmax(0,1fr)); }
.heyy-palette-card {
  display: grid;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #d8e1eb;
  border-radius: 24px;
  background: #fff;
}
.heyy-palette-grid.one-row .heyy-palette-card { grid-template-rows: minmax(0,1fr) auto; }
.heyy-palette-grid.two-rows .heyy-palette-card { grid-template-rows: minmax(0,1fr) auto; }
.heyy-palette-card > div { min-height: 0; }
.heyy-palette-card section { display: grid; gap: 5px; padding: 15px 17px; }
.heyy-palette-card strong { color: #18202b; font-size: 18px; line-height: 1.1; }
.heyy-palette-card span { color: #657487; font-size: 11px; font-weight: 750; line-height: 1.2; }
.heyy-type-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 24px;
}
.heyy-type-grid article {
  min-height: 275px;
  box-sizing: border-box;
  border: 1px solid #d8e1eb;
  border-radius: 24px;
  background: #fff;
  padding: 28px;
}
.heyy-type-sample {
  color: #18202b;
  font-size: 66px;
  letter-spacing: -.035em;
  line-height: 1;
}
.heyy-type-grid strong { display: block; margin-top: 18px; font-size: 28px; }
.heyy-type-grid span { display: block; margin-top: 8px; color: var(--heyy-accent); font-size: 14px; font-weight: 900; text-transform: uppercase; }
.heyy-type-grid p { margin: 16px 0 0; color: #607083; font-size: 15px; line-height: 1.45; }
.heyy-image-text-layout {
  display: grid;
  grid-template-columns: minmax(0,1.18fr) minmax(0,.82fr);
  gap: 28px;
}
.heyy-image-text-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 610px;
  overflow: hidden;
  border: 1px solid #d8e1eb;
  border-radius: 25px;
  background: #eef2f7;
}
.heyy-image-text-visual img,
.heyy-image-text-visual .heyy-presentation-placeholder {
  width: 100%;
  height: 100%;
  object-position: center;
}
.heyy-image-text-copy { min-width: 0; }
.heyy-image-text-cards { display: grid; gap: 13px; margin-top: 18px; }
.heyy-image-text-cards .heyy-presentation-card {
  min-height: 106px;
  padding: 17px 19px;
}
.heyy-image-text-cards .heyy-presentation-card p {
  font-size: 14px;
  line-height: 1.4;
}
.heyy-gallery-grid {
  display: grid;
  height: 612px;
  gap: 17px;
}
.heyy-gallery-grid.one { grid-template-columns: 1fr; }
.heyy-gallery-grid.four { grid-template-columns: repeat(2,minmax(0,1fr)); grid-template-rows: repeat(2,minmax(0,1fr)); }
.heyy-gallery-grid.six { grid-template-columns: repeat(3,minmax(0,1fr)); grid-template-rows: repeat(2,minmax(0,1fr)); }
.heyy-gallery-grid figure {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
  margin: 0;
  border: 1px solid #d8e1eb;
  border-radius: 22px;
  background: #eef2f7;
}
.heyy-gallery-grid.one figure {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px;
  background:
    radial-gradient(circle at 50% 40%, rgba(108,0,255,.08), transparent 48%),
    #f1f5f9;
}
.heyy-gallery-grid img,
.heyy-gallery-grid .heyy-presentation-placeholder {
  width: 100%;
  height: 100%;
  object-position: center;
}
.heyy-presentation-slide img[data-image-fit="contain"] {
  width: auto !important;
  height: auto !important;
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
  object-position: center !important;
  margin: auto !important;
}
.heyy-gallery-grid.one img[data-image-fit="contain"] {
  width: auto !important;
  height: auto !important;
  max-width: 100% !important;
  max-height: 100% !important;
}
.heyy-gallery-grid figcaption {
  position: absolute;
  left: 13px;
  right: 13px;
  bottom: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(17,24,39,.82);
  padding: 9px 14px;
  color: #fff;
  font-size: 13px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.heyy-gallery-empty {
  display: flex;
  height: 610px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border: 2px dashed #cbd5e1;
  border-radius: 24px;
  background: #fff;
  color: #718096;
}
.heyy-gallery-empty strong { color: #334155; font-size: 28px; }
.heyy-gallery-empty span { margin-top: 10px; font-size: 16px; }
.heyy-material-grid {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 18px;
  margin-top: 24px;
}
.heyy-material-grid article {
  overflow: hidden;
  border: 1px solid #d8e1eb;
  border-radius: 22px;
  background: #fff;
}
.heyy-material-grid article > div {
  height: 180px;
  overflow: hidden;
  background: #eef2f7;
}
.heyy-material-grid img,
.heyy-material-grid .heyy-presentation-placeholder {
  width: 100%;
  height: 100%;
}
.heyy-material-grid section { padding: 17px; }
.heyy-material-grid strong { display: block; font-size: 19px; }
.heyy-material-grid span { display: block; margin-top: 7px; color: var(--heyy-accent); font-size: 12px; font-weight: 900; text-transform: uppercase; }
.heyy-material-grid p { margin: 9px 0 0; color: #617084; font-size: 13px; line-height: 1.35; }
.heyy-table-wrap {
  overflow: hidden;
  margin-top: 20px;
  border: 1px solid #d8e1eb;
  border-radius: 22px;
  background: #fff;
}
.heyy-table-row {
  display: grid;
  align-items: center;
  min-height: 51px;
  border-top: 1px solid #e5eaf0;
}
.heyy-table-row:first-child { border-top: 0; }
.heyy-table-row > * {
  min-width: 0;
  padding: 12px 18px;
  overflow: hidden;
  color: #526174;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.heyy-table-row > *:first-child {
  color: #18202b;
  font-weight: 900;
}
.heyy-table-row.head {
  min-height: 53px;
  background: #172033;
}
.heyy-table-row.head strong {
  color: #fff;
  font-size: 12px;
  letter-spacing: .1em;
  text-transform: uppercase;
}
.heyy-disclaimer-slide .heyy-presentation-body {
  display: grid;
  grid-template-columns: 160px minmax(0,1fr);
  align-content: center;
  gap: 42px;
}
.heyy-disclaimer-mark {
  display: flex;
  width: 145px;
  height: 145px;
  align-items: center;
  justify-content: center;
  border-radius: 44px;
  background: var(--heyy-accent);
  color: #fff;
}
.heyy-disclaimer-mark svg {
  display: block;
  width: 76px;
  height: 76px;
}
.heyy-disclaimer-copy p {
  margin: 0 0 21px;
  color: #46566b;
  font-size: 20px;
  line-height: 1.6;
}
.heyy-disclaimer-signoff {
  grid-column: 2;
  margin-top: 22px;
}
.heyy-presentation-placeholder {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background:
    linear-gradient(135deg, #e9eef5, #f8fafc);
  color: #2d3748;
  text-align: center;
}
.heyy-presentation-placeholder span {
  color: var(--heyy-accent);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: .18em;
}
.heyy-presentation-placeholder strong {
  margin-top: 12px;
  font-size: 27px;
}
`;
