"use client";

function asText(value: any) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value?.description === "string") return value.description.trim();
  if (typeof value?.positioning === "string") return value.positioning.trim();
  if (typeof value?.headline === "string") return value.headline.trim();
  return "";
}

function asArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function first(...values: any[]) {
  return values.find((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return Boolean(value);
  });
}

export default function BrandOverview({ brand }: { project?: any; brand: any }) {
  const foundation = brand?.foundation || {};
  const guidelines = brand?.generatedGuidelines || {};

  const direction =
    asText(first(
      foundation?.positioning,
      brand?.brandStrategy?.positioning,
      guidelines?.positioning,
      brand?.positioning,
    )) || "Brand direction will appear here.";

  const strategy =
    asText(first(
      foundation?.strategy,
      brand?.brandStrategy?.description,
      guidelines?.brandOverview,
      foundation?.summary,
      brand?.summary,
    )) || direction;

  const mission =
    asText(first(foundation?.mission, brand?.mission, guidelines?.mission, brand?.brandStrategy?.mission)) ||
    "Mission will appear after the Brand Studio foundation is generated.";

  const vision =
    asText(first(foundation?.vision, brand?.vision, guidelines?.vision, brand?.brandStrategy?.vision)) ||
    "Vision will appear after the Brand Studio foundation is generated.";

  const promise =
    asText(first(foundation?.brandPromise, brand?.brandPromise, brand?.brandStrategy?.brandPromise, guidelines?.brandPromise)) ||
    "Brand promise will appear after the Brand Studio foundation is generated.";

  const voice =
    asText(first(
      foundation?.brandVoice?.description,
      brand?.brandVoice?.description,
      guidelines?.toneOfVoice?.description,
      foundation?.brandVoice,
      brand?.brandVoice,
    )) || "Brand voice will appear here.";

  const audience =
    asText(first(foundation?.targetAudience, brand?.targetAudience, guidelines?.targetAudience, brand?.audience)) ||
    "Target audience details will appear here.";

  const traits = asArray(first(
    foundation?.personality?.traits,
    brand?.personality?.traits,
    guidelines?.personality,
    brand?.personality,
  ));

  const tone = asArray(first(
    foundation?.toneOfVoice,
    foundation?.brandVoice?.toneWords,
    brand?.toneOfVoice,
    brand?.brandVoice?.toneWords,
    guidelines?.toneOfVoice?.principles,
    guidelines?.toneOfVoice?.traits,
  ));

  const keywords = asArray(first(
    foundation?.keywords,
    brand?.keywords,
    guidelines?.keywords,
    guidelines?.brandKeywords,
  ));

  const values = asArray(first(foundation?.coreValues, brand?.coreValues, guidelines?.coreValues));
  const recommendations = asArray(first(
    foundation?.recommendations,
    guidelines?.recommendations,
    brand?.recommendations,
    brand?.aiRecommendations,
  ));

  return (
    <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(48,31,68,.06)]">
      <header className="border-b border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">Brand foundation</p>
        <h2 className="mt-1 text-3xl font-black tracking-[-0.045em] text-slate-950">Brand Strategy</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          The core strategic system behind the identity, applications and future production work.
        </p>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <Summary label="Direction" value={direction} />
          <Summary label="Voice" value={tone.slice(0, 4).join(", ") || voice} />
          <Summary label="Audience" value={audience} />
        </div>
      </header>

      <div className="grid gap-4 p-5 sm:p-6">
        <Section label="Strategy" title={direction} body={strategy} />

        <div className="grid gap-4 md:grid-cols-2">
          <Section label="Purpose" title="Mission" body={mission} />
          <Section label="Future" title="Vision" body={vision} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Section label="Commitment" title="Brand Promise" body={promise} />
          <Section label="Communication" title="Tone of Voice" body={voice} chips={tone} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Section label="Audience" title="Target Audience" body={audience} />
          <Section label="Personality" title="Brand Traits" chips={traits} />
        </div>

        {(values.length > 0 || keywords.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {values.length > 0 && <Section label="Values" title="Core Values" chips={values} />}
            {keywords.length > 0 && <Section label="Language" title="Brand Keywords" chips={keywords} />}
          </div>
        )}

        {recommendations.length > 0 && (
          <section className="rounded-[18px] border border-violet-200 bg-violet-50/50 p-5">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-600">Next steps</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">AI Recommendations</h3>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
              {recommendations.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-[8px] font-black uppercase tracking-[0.15em] text-violet-600">{label}</p>
      <p className="mt-2 line-clamp-3 text-xs font-bold leading-5 text-slate-700">{value}</p>
    </div>
  );
}

function Section({
  label,
  title,
  body,
  chips = [],
}: {
  label: string;
  title: string;
  body?: string;
  chips?: string[];
}) {
  const unique = Array.from(new Set(chips.map((item) => item.trim()).filter(Boolean)));
  return (
    <section className="rounded-[18px] border border-slate-200 bg-white p-5">
      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-600">{label}</p>
      <h3 className="mt-1 text-lg font-black tracking-[-0.02em] text-slate-950">{title}</h3>
      {body ? <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p> : null}
      {unique.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {unique.map((item) => (
            <span key={item.toLowerCase()} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] font-black text-slate-700">
              {item}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
