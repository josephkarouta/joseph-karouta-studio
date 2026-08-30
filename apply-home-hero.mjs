import fs from "node:fs";

const target = "app/page.tsx";

if (!fs.existsSync(target)) {
  throw new Error(`Could not find ${target}. Run this script from the Heyy Studio project root.`);
}

let source = fs.readFileSync(target, "utf8");
let changes = 0;

function replaceOnce(label, before, after) {
  if (!source.includes(before)) {
    throw new Error(`Patch stopped: could not find "${label}" in ${target}. No file was written.`);
  }
  source = source.replace(before, after);
  changes += 1;
}

replaceOnce(
  "homepage hero background insertion",
`        <div data-home-parallax="0.04" className="home-motion-parallax absolute bottom-[-18rem] left-[38%] -z-10 h-[520px] w-[520px] rounded-full bg-violet-500/12 blur-[120px]" />

        <PageContainer className="grid min-h-[690px] items-center gap-14 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:py-24">`,
`        <div data-home-parallax="0.04" className="home-motion-parallax absolute bottom-[-18rem] left-[38%] -z-10 h-[520px] w-[520px] rounded-full bg-violet-500/12 blur-[120px]" />

        <img
          src="/heyy-home-hero.webp"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full object-cover object-center lg:block"
        />
        <div className="hero-image-overlay pointer-events-none absolute inset-0 z-[1] hidden lg:block" />

        <PageContainer className="relative z-10 min-h-[690px] py-16 lg:flex lg:items-center lg:py-24">`
);

replaceOnce(
  "desktop hero copy width",
`          <div data-home-reveal className="relative z-10 max-w-4xl">`,
`          <div data-home-reveal className="relative z-10 max-w-[650px]">`
);

replaceOnce(
  "hero image overlay styles",
`        .hero-static-wrap {
          display: grid;
          place-items: center;
        }`,
`        .hero-image-overlay {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.97) 0%,
            rgba(255, 255, 255, 0.88) 28%,
            rgba(255, 255, 255, 0.48) 45%,
            rgba(255, 255, 255, 0.08) 61%,
            rgba(255, 255, 255, 0) 72%
          );
        }

        [data-theme="dark"] .hero-image-overlay {
          background: linear-gradient(
            90deg,
            rgba(18, 16, 24, 0.96) 0%,
            rgba(18, 16, 24, 0.84) 30%,
            rgba(18, 16, 24, 0.42) 47%,
            rgba(18, 16, 24, 0.05) 64%,
            rgba(18, 16, 24, 0) 76%
          );
        }

        [data-theme="dark"] .home-hero > img {
          filter: brightness(0.72) saturate(0.9);
        }

        .hero-static-wrap {
          display: grid;
          place-items: center;
        }`
);

replaceOnce(
  "HeroPlayground",
`function HeroPlayground() {
  return (
    <div
      data-home-reveal
      className="hero-static-wrap relative mx-auto h-[430px] w-full max-w-[620px] py-5 lg:h-[520px] lg:py-0"
      aria-hidden="true"
    >
      <div className="hero-static-frame">
        <div className="hero-static-grid" />
        <div className="hero-static-plane hero-static-plane-dark">
          <span className="hero-static-line hero-static-line-one" />
          <span className="hero-static-line hero-static-line-two" />
        </div>
        <div className="hero-static-plane hero-static-plane-light">
          <span className="hero-static-block hero-static-block-violet" />
          <span className="hero-static-block hero-static-block-pink" />
          <span className="hero-static-block hero-static-block-blue" />
          <span className="hero-static-block hero-static-block-orange" />
        </div>
        <div className="hero-static-outline" />
        <div className="hero-static-bar">
          <span />
          <span />
          <span />
        </div>
        <div className="hero-static-caption">
          <span>IDEA</span>
          <i />
          <span>DIRECTION</span>
          <i />
          <span>FINISH</span>
        </div>
      </div>
    </div>
  );
}`,
`function HeroPlayground() {
  return (
    <div
      data-home-reveal
      className="relative mt-10 w-full overflow-hidden rounded-[1.8rem] border border-[var(--border)] shadow-[var(--shadow-card)] lg:hidden"
      aria-hidden="true"
    >
      <img
        src="/heyy-home-hero.webp"
        alt=""
        className="aspect-[1.25/1] h-auto w-full object-cover object-[72%_center]"
      />
    </div>
  );
}`
);

fs.writeFileSync(target, source, "utf8");
console.log(`Updated ${target} successfully (${changes} controlled replacements).`);
console.log("Hero asset expected at: public/heyy-home-hero.webp");
