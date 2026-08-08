"use client";

import BrandBookPage from "@/components/studio/brand-book/BrandBookPage";

export default function BrandLogoRules({ logo }: { logo?: any }) {
  const rules = [
    {
      type: "do",
      title: "Use clean contrast",
      body: "Place the logo on simple backgrounds with enough contrast.",
    },
    {
      type: "do",
      title: "Respect clear space",
      body: "Leave room around the mark so it feels premium and intentional.",
    },
    {
      type: "do",
      title: "Keep proportions",
      body: "Scale the logo proportionally across all touchpoints.",
    },
    {
      type: "dont",
      title: "Do not stretch",
      body: "Never squash, stretch, rotate or distort the logo.",
    },
    {
      type: "dont",
      title: "Do not add effects",
      body: "Avoid shadows, outlines, gradients or random filters.",
    },
    {
      type: "dont",
      title: "Do not use busy backgrounds",
      body: "Avoid low contrast or visually noisy placements.",
    },
  ];

  return (
    <BrandBookPage page={9} eyebrow="Logo Rules" title="Usage and Clear Space">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-6">
          <h3 className="text-xl font-black">Clear Space</h3>

          <div className="mt-6 flex min-h-80 items-center justify-center rounded-2xl border border-dashed border-purple-400/35 bg-white/[0.03] p-8">
            <div className="rounded-2xl border-2 border-purple-400/70 p-8">
              <div className="rounded-xl border border-white/15 bg-white p-8">
                {logo?.imageUrl ? (
                  <img
                    src={logo.imageUrl}
                    alt="Logo clear space"
                    className="h-24 w-56 object-contain"
                  />
                ) : (
                  <div className="flex h-24 w-56 items-center justify-center text-black">
                    LOGO
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="mt-5 leading-7 text-white/55">
            The purple frame represents minimum clear space. Keep text, imagery
            and layout edges outside this area.
          </p>
        </div>

        <div className="grid gap-3">
          {rules.map((rule) => (
            <div
              key={rule.title}
              className="rounded-2xl border border-white/10 bg-black/25 p-4"
            >
              <div className="flex gap-3">
                <span
                  className={
                    rule.type === "do"
                      ? "font-black text-green-300"
                      : "font-black text-red-300"
                  }
                >
                  {rule.type === "do" ? "✓" : "×"}
                </span>

                <div>
                  <h4 className="font-black">{rule.title}</h4>
                  <p className="mt-1 text-sm leading-6 text-white/50">
                    {rule.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrandBookPage>
  );
}
