"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { AlertCircle, Download, Loader2, Presentation, Sparkles, WandSparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button, CreditPill, Eyebrow, GlassCard, cx } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";
import { CREDIT_COSTS } from "@/lib/credits/config";
import { generationFetch } from "@/lib/client/generation-request";

type Slide = {
  title: string;
  subtitle?: string;
  bullets?: string[];
  speakerNotes?: string;
  highlight?: string;
  layout?: string;
};

type Result = {
  fileUrl: string;
  asset?: { id: string };
  slides: Slide[];
  creditsUsed: number;
  model?: string;
};

type GenerationMode = "draft" | "full";

const MODES: Array<{
  id: GenerationMode;
  title: string;
  model: string;
  detail: string;
  credits: number;
}> = [
  {
    id: "draft",
    title: "Fast draft",
    model: "GPT-5.6 Luna",
    detail: "Quick story structure and a clean editable deck for early review.",
    credits: CREDIT_COSTS.powerpointDraft,
  },
  {
    id: "full",
    title: "Professional",
    model: "GPT-5.6 Terra",
    detail: "Stronger narrative judgment, hierarchy and slide-by-slide information design.",
    credits: CREDIT_COSTS.powerpointFull,
  },
];

export default function PowerPointWorkbench() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { refreshAccount } = useAuth();
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [objective, setObjective] = useState("");
  const [source, setSource] = useState("");
  const [slides, setSlides] = useState(10);
  const [tone, setTone] = useState("Premium and concise");
  const [mode, setMode] = useState<GenerationMode>("full");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedMode = MODES.find((item) => item.id === mode) || MODES[1];
  const cost = selectedMode.credits;

  async function generate() {
    if (!title.trim() || !objective.trim() || source.trim().length < 30) {
      setError("Add a title, objective and enough source content to build the presentation.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const requestPayload = { title, audience, objective, source, slideCount: slides, tone, mode };
      const response = await generationFetch("/api/tools/powerpoint-generator/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestPayload),
      }, {
        scope: "powerpoint-generator",
        payload: requestPayload,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Presentation generation failed.");

      setResult(payload);
      await refreshAccount();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Presentation generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[.78fr_1.22fr]">
      <GlassCard className="p-5 sm:p-6">
        <Eyebrow>Brief & structure</Eyebrow>
        <h2 className="mt-3 text-2xl font-black tracking-[-.045em]">Build an editable deck</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
          Heyy Studio uses OpenAI to shape the story, then builds a native PowerPoint with editable text, shapes and notes.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Presentation title">
            <input
              className="heyy-form-field"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Heyy Studio investor overview"
            />
          </Field>
          <Field label="Audience">
            <input
              className="heyy-form-field"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              placeholder="Clients, investors, internal team..."
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Objective">
            <textarea
              className="heyy-form-field resize-y"
              rows={3}
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              placeholder="What should the audience understand, decide or do?"
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Source content">
            <textarea
              className="heyy-form-field resize-y"
              rows={9}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Paste the brief, proposal, notes, report or source material. Heyy Studio will organize it without inventing unsupported facts."
            />
          </Field>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Number of slides">
            <input
              type="number"
              min={5}
              max={20}
              className="heyy-form-field"
              value={slides}
              onChange={(event) => setSlides(Math.max(5, Math.min(20, Number(event.target.value) || 10)))}
            />
          </Field>
          <Field label="Tone">
            <HeyySelect
              value={tone}
              tone="interior"
              ariaLabel="Presentation tone"
              options={[
                "Premium and concise",
                "Corporate and analytical",
                "Bold and persuasive",
                "Warm and explanatory",
                "Minimal and visual",
              ]}
              onChange={setTone}
            />
          </Field>
        </div>

        <div className="mt-5">
          <label className="text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">
            Generation mode
          </label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {MODES.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setMode(item.id)}
                className={cx(
                  "rounded-2xl border p-4 text-left transition",
                  mode === item.id
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-soft)]"
                    : "border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--accent)]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black">{item.title}</p>
                    <p className="mt-1 text-[.66rem] font-black text-[var(--accent-strong)]">{item.model}</p>
                  </div>
                  <CreditPill credits={item.credits} />
                </div>
                <p className="mt-3 text-[.68rem] font-semibold leading-5 text-[var(--text-secondary)]">{item.detail}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
          <div className="flex items-start gap-3">
            <WandSparkles size={17} className="mt-0.5 shrink-0 text-orange-500" />
            <p className="text-[.7rem] font-semibold leading-5 text-[var(--text-secondary)]">
              <span className="font-black text-[var(--text-primary)]">Native editable .pptx.</span> The deck is generated by Heyy Studio rather than flattened into slide images, so users can keep editing it in PowerPoint.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex gap-3 rounded-2xl border border-red-300/60 bg-red-500/10 p-4 text-sm font-bold text-red-700 dark:text-red-200">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        <Button className="mt-6 w-full" size="lg" onClick={() => void generate()} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? "Writing and designing slides…" : `Generate PowerPoint · ${cost} credits`}
        </Button>
      </GlassCard>

      <GlassCard className="min-h-[680px] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Eyebrow>Presentation preview</Eyebrow>
            <h2 className="mt-2 text-2xl font-black tracking-[-.045em]">Story outline</h2>
            <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">
              {result?.model || selectedMode.model} · editable PowerPoint output
            </p>
          </div>
          <CreditPill credits={result?.creditsUsed || cost} />
        </div>

        {loading ? (
          <div className="grid min-h-[560px] place-items-center">
            <div className="text-center">
              <Loader2 size={34} className="mx-auto animate-spin text-[var(--accent-strong)]" />
              <h3 className="mt-4 text-xl font-black">Structuring the deck</h3>
              <p className="mt-2 text-sm font-semibold text-[var(--text-muted)]">
                Creating narrative flow, slide hierarchy and a native editable layout.
              </p>
            </div>
          </div>
        ) : result ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {result.slides.map((slide, index) => (
                <div
                  key={`${index}-${slide.title}`}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-orange-500/12 text-[.65rem] font-black text-orange-600">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-sm font-black">{slide.title}</p>
                      {slide.subtitle && (
                        <p className="mt-1 text-[.68rem] font-semibold text-[var(--text-muted)]">{slide.subtitle}</p>
                      )}
                    </div>
                  </div>
                  {slide.highlight && (
                    <p className="mt-3 rounded-xl bg-orange-500/8 px-3 py-2 text-[.66rem] font-black text-orange-700 dark:text-orange-300">
                      {slide.highlight}
                    </p>
                  )}
                  {slide.bullets && (
                    <ul className="mt-3 space-y-1.5 pl-11">
                      {slide.bullets.slice(0, 3).map((bullet, itemIndex) => (
                        <li
                          key={itemIndex}
                          className="text-[.68rem] font-semibold leading-5 text-[var(--text-secondary)]"
                        >
                          • {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <a
              href={result.fileUrl}
              download="heyy-studio-presentation.pptx"
              className="heyy-button mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--button-primary)] px-5 text-sm font-extrabold text-[var(--button-primary-text)]"
            >
              <Download size={15} /> Download editable .pptx
            </a>
          </>
        ) : (
          <div className="grid min-h-[560px] place-items-center">
            <div className="max-w-sm text-center">
              <Presentation size={38} className="mx-auto text-orange-500" />
              <h3 className="mt-4 text-xl font-black">Your deck outline will appear here</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                The presentation is built as an editable PowerPoint with real text, shapes, hierarchy and speaker notes rather than a flattened image export.
              </p>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
