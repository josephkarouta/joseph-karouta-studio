"use client";

import BrandBookPage from "@/components/studio/brand-book/BrandBookPage";

export default function BrandConcept({ concept }: { concept?: any }) {
  if (!concept) {
    return (
      <BrandBookPage page={6} eyebrow="Creative Concept" title="No Concept Selected">
        <p className="max-w-2xl leading-8 text-white/55">
          Select a creative concept first. It will appear here as part of the
          living Brand Book.
        </p>
      </BrandBookPage>
    );
  }

  const palette = concept.palette || [];
  const keywords = concept.keywords || [];
  const applications = concept.applications || [];

  return (
    <BrandBookPage
      page={6}
      eyebrow="Creative Concept"
      title={concept.conceptName || concept.title || "Selected Concept"}
    >
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="leading-8 text-white/60">
            {concept.story || concept.visualDirection}
          </p>

          {keywords.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {keywords.map((keyword: string) => (
                <span
                  key={keyword}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-sm text-white/65"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-5">
          {palette.length > 0 && (
            <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/25">
              <div className="grid h-44 grid-cols-3">
                {palette.map((colour: string, index: number) => (
                  <div
                    key={`${colour}-${index}`}
                    style={{ backgroundColor: colour }}
                    className="flex items-end p-4"
                  >
                    <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                      {colour}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Info title="Typography Pairing" body={concept.typography || "Typography pairing"} />

          <Info
            title="Logo Philosophy"
            body={
              concept.logoPhilosophy ||
              "Logo philosophy will appear once a concept is selected."
            }
          />

          {applications.length > 0 && (
            <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-6">
              <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                Best Applications
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {applications.map((item: string) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-white/60"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </BrandBookPage>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-white/35">
        {title}
      </p>

      <p className="mt-3 leading-7 text-white/55">{body}</p>
    </div>
  );
}
