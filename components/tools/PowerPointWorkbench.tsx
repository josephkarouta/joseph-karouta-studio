"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Download, FileText, Image as ImageIcon, Loader2, Paperclip, Presentation, Sparkles, WandSparkles, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button, CreditPill, Eyebrow, GlassCard } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";
import { getPowerPointCreditCost, POWERPOINT_INCLUDED_SLIDES } from "@/lib/credits/config";
import { generationFetch } from "@/lib/client/generation-request";

type Slide = {
  kicker?: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  items?: Array<{ label?: string; title?: string; body?: string; value?: string }>;
  speakerNotes?: string;
  highlight?: string;
  layout?: string;
  visualType?: "none" | "generated" | "attachment";
  visualAssetName?: string;
  visualPosition?: "none" | "background" | "left" | "right";
  sourceUrls?: string[];
};

type Result = {
  fileUrl: string;
  asset?: { id: string };
  slides: Slide[];
  creditsUsed: number;
  theme?: string;
  deckSubtitle?: string;
  visualCount?: number;
  previewVisuals?: Record<string, string>;
  previewLogo?: string;
  attachmentNames?: string[];
  logoIncluded?: boolean;
};

type VisualStyle = "auto" | "editorial" | "corporate" | "bold" | "minimal" | "luxury";

const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_TOTAL_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "jfif", "webp", "svg"]);
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 225;


export default function PowerPointWorkbench() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { refreshAccount } = useAuth();
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [objective, setObjective] = useState("");
  const [source, setSource] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [logoAttachmentName, setLogoAttachmentName] = useState("");
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [slides, setSlides] = useState(10);
  const [tone, setTone] = useState("Premium and concise");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("auto");
  const [result, setResult] = useState<Result | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState("");
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");

  const cost = getPowerPointCreditCost(slides);

  function addAttachments(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (!incoming.length) return;

    const merged = [...attachments];
    for (const file of incoming) {
      if (merged.length >= MAX_ATTACHMENTS) break;
      if (!isSupportedAttachment(file)) {
        setError(`${file.name} is not a supported document or image type.`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`${file.name} is larger than 5 MB.`);
        continue;
      }
      const duplicateName = merged.some((candidate) => candidate.name.toLowerCase() === file.name.toLowerCase());
      if (duplicateName) {
        setError(`Only one attachment can use the name ${file.name}. Rename duplicate files before attaching them.`);
        continue;
      }
      merged.push(file);
    }

    const trimmed: File[] = [];
    let total = 0;
    for (const file of merged.slice(0, MAX_ATTACHMENTS)) {
      if (total + file.size > MAX_ATTACHMENT_TOTAL_BYTES) {
        setError("Attachments can be up to 5 MB combined.");
        break;
      }
      trimmed.push(file);
      total += file.size;
    }
    setAttachments(trimmed);

    if (!logoAttachmentName) {
      const detectedLogo = trimmed.find((file) => isImageAttachment(file) && /(^|[\s_.-])logo([\s_.-]|$)/i.test(file.name));
      if (detectedLogo) setLogoAttachmentName(detectedLogo.name);
    }
  }

  function removeAttachment(file: File) {
    setAttachments((current) => current.filter((candidate) => !(candidate.name === file.name && candidate.size === file.size && candidate.lastModified === file.lastModified)));
    if (logoAttachmentName === file.name) setLogoAttachmentName("");
  }

  useEffect(() => {
    if (!jobId || !loading) return;
    let cancelled = false;

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Your session expired. Sign in again.");

        for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && !cancelled; attempt += 1) {
          const response = await fetch(`/api/tools/powerpoint-generator/status?jobId=${encodeURIComponent(jobId)}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          const payload = await readApiPayload(response);

          if (!response.ok) {
            throw new Error(publicApiMessage(payload, "Presentation status could not be loaded."));
          }
          if (payload?.status === "succeeded" && payload?.result) {
            setResult(payload.result as Result);
            setActiveSlide(0);
            setLoading(false);
            setJobId("");
            setStatusText("");
            await refreshAccount();
            return;
          }
          if (payload?.status === "failed" || payload?.status === "cancelled") {
            throw new Error(publicApiMessage(payload, "Presentation generation could not be completed. Your credits were returned."));
          }

          setStatusText(attempt < 3 ? "Starting your presentation…" : "Researching, designing and building your presentation…");
          await sleep(POLL_INTERVAL_MS);
        }

        if (!cancelled) {
          setLoading(false);
          setStatusText("");
          setError("Your presentation is still being prepared in the background. Check Generation Activity shortly for the result.");
        }
      } catch (generationError) {
        if (cancelled) return;
        setLoading(false);
        setJobId("");
        setStatusText("");
        setError(generationError instanceof Error ? generationError.message : "Presentation generation could not be completed.");
        await refreshAccount();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, loading, refreshAccount, supabase]);

  async function generate() {
    if (!title.trim() || !objective.trim() || (source.trim().length < 10 && attachments.length === 0)) {
      setError("Add a title, objective and either source notes or at least one attachment.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setStatusText("Preparing your presentation…");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const requestPayload = {
        title,
        audience,
        objective,
        source,
        slideCount: slides,
        tone,
        visualStyle,
        attachments: attachments.map((file) => ({ name: file.name, size: file.size, modified: file.lastModified })),
        logoAttachmentName,
      };
      const form = new FormData();
      form.set("title", title);
      form.set("audience", audience);
      form.set("objective", objective);
      form.set("source", source);
      form.set("slideCount", String(slides));
      form.set("tone", tone);
      form.set("visualStyle", visualStyle);
      if (logoAttachmentName) form.set("logoAttachmentName", logoAttachmentName);
      attachments.forEach((file) => form.append("attachments", file, file.name));

      const response = await generationFetch("/api/tools/powerpoint-generator/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }, {
        scope: "powerpoint-generator",
        payload: requestPayload,
      });
      const payload = await readApiPayload(response);
      if (!response.ok) {
        throw new Error(publicApiMessage(payload, "Presentation generation could not start. Please try again."));
      }

      const nextJobId = typeof payload?.jobId === "string" ? payload.jobId : "";
      if (!nextJobId) throw new Error("Presentation generation could not start. Please try again.");

      setJobId(nextJobId);
      setStatusText(payload?.existing ? "This presentation is already being prepared…" : "Presentation queued. Building it in the background…");
    } catch (generationError) {
      setLoading(false);
      setJobId("");
      setStatusText("");
      setError(generationError instanceof Error ? generationError.message : "Presentation generation could not start.");
      await refreshAccount();
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[.78fr_1.22fr]">
      <GlassCard className="p-5 sm:p-6">
        <Eyebrow>Brief & structure</Eyebrow>
        <h2 className="mt-3 text-2xl font-black tracking-[-.045em]">Build an editable deck</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
          Heyy Studio shapes a clear narrative, selects the right layout for every idea, then builds a polished native PowerPoint with editable content.
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
          <Field label="Source content & instructions">
            <textarea
              className="heyy-form-field resize-y"
              rows={7}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Paste source material, explain what to use from your attachments, or tell Heyy Studio what to research."
            />
          </Field>
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-hover)] p-4">
          <input
            ref={attachmentInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.rtf,.odt,.ppt,.pptx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.jfif,.webp,.svg,image/jpeg"
            onChange={(event) => {
              if (event.target.files) addAttachments(event.target.files);
              event.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black">Attachments</p>
              <p className="mt-1 max-w-xl text-[.68rem] font-semibold leading-5 text-[var(--text-secondary)]">
                Add a document to turn its content into a deck, or attach a logo and images that should be used in the presentation. Up to 6 files, 5 MB combined.
              </p>
              <p className="mt-1 max-w-xl text-[.62rem] font-semibold leading-5 text-[var(--text-muted)]">
                For documents with important charts or page visuals, PDF works best. Otherwise, attach important logos and images separately so they can be placed directly in the deck.
              </p>
            </div>
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={loading || attachments.length >= MAX_ATTACHMENTS}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-xs font-black transition hover:border-orange-400 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Paperclip size={15} /> Attach files
            </button>
          </div>

          {attachments.length > 0 && (
            <div className="mt-4 grid min-w-0 max-w-full gap-2 overflow-hidden">
              {attachments.map((file) => {
                const image = isImageAttachment(file);
                const isLogo = logoAttachmentName === file.name;
                return (
                  <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-hover)] text-orange-500">
                      {image ? <ImageIcon size={17} /> : <FileText size={17} />}
                    </span>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="block max-w-full truncate text-xs font-black">{file.name}</p>
                      <p className="mt-0.5 text-[.62rem] font-semibold text-[var(--text-muted)]">{formatFileSize(file.size)}</p>
                    </div>
                    {image && (
                      <button
                        type="button"
                        onClick={() => setLogoAttachmentName(isLogo ? "" : file.name)}
                        className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[.62rem] font-black transition ${isLogo ? "bg-orange-500 text-white" : "border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:border-orange-400"}`}
                      >
                        {isLogo && <Check size={12} />} {isLogo ? "Logo" : "Use as logo"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(file)}
                      disabled={loading}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-secondary)] transition hover:border-orange-400 hover:text-[var(--text-primary)] disabled:opacity-40"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-3">
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
          <Field label="Visual style">
            <HeyySelect
              value={visualStyle}
              tone="interior"
              ariaLabel="Presentation visual style"
              options={[
                { value: "auto", label: "Auto — based on topic" },
                { value: "editorial", label: "Editorial" },
                { value: "corporate", label: "Corporate" },
                { value: "bold", label: "Bold" },
                { value: "minimal", label: "Minimal" },
                { value: "luxury", label: "Luxury" },
              ]}
              onChange={(value) => setVisualStyle(value as VisualStyle)}
            />
          </Field>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black">Best quality</p>
              <p className="mt-1 text-[.66rem] font-black text-[var(--accent-strong)]">
                {slides <= POWERPOINT_INCLUDED_SLIDES
                  ? `Up to ${POWERPOINT_INCLUDED_SLIDES} slides included`
                  : `${slides - POWERPOINT_INCLUDED_SLIDES} additional slide${slides - POWERPOINT_INCLUDED_SLIDES === 1 ? "" : "s"}`}
              </p>
            </div>
            <CreditPill credits={cost} />
          </div>
          <p className="mt-3 text-[.68rem] font-semibold leading-5 text-[var(--text-secondary)]">
            One quality-first workflow researches when requested, develops the narrative and creates presentation visuals before building the editable deck.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
          <div className="flex items-start gap-3">
            <WandSparkles size={17} className="mt-0.5 shrink-0 text-orange-500" />
            <p className="text-[.7rem] font-semibold leading-5 text-[var(--text-secondary)]">
              <span className="font-black text-[var(--text-primary)]">Native editable .pptx.</span> Titles, timelines, processes, comparisons, metrics and supporting copy remain editable instead of being flattened into slide images.
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
          {loading ? "Preparing in background…" : `Generate PowerPoint · ${cost} credits`}
        </Button>
      </GlassCard>

      <GlassCard className="min-h-[680px] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Eyebrow>Presentation preview</Eyebrow>
            <h2 className="mt-2 text-2xl font-black tracking-[-.045em]">Designed slide preview</h2>
            <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">
              {result?.theme ? `${capitalize(result.theme)} theme · ` : ""}editable PowerPoint output
            </p>
          </div>
          <CreditPill credits={result?.creditsUsed || cost} />
        </div>

        {loading ? (
          <div className="grid min-h-[560px] place-items-center">
            <div className="text-center">
              <Loader2 size={34} className="mx-auto animate-spin text-[var(--accent-strong)]" />
              <h3 className="mt-4 text-xl font-black">{statusText || "Preparing your presentation"}</h3>
              <p className="mt-2 text-sm font-semibold text-[var(--text-muted)]">
                Your presentation is running in the background. You can leave this page and return later; Generation Activity will keep its status.
              </p>
            </div>
          </div>
        ) : result ? (
          <>
            <DeckPreview
              slides={result.slides}
              theme={result.theme}
              previewVisuals={result.previewVisuals}
              previewLogo={result.previewLogo}
              activeSlide={Math.min(activeSlide, Math.max(0, result.slides.length - 1))}
              onActiveSlideChange={setActiveSlide}
            />
            <p className="mt-3 text-[.66rem] font-semibold leading-5 text-[var(--text-muted)]">
              This in-page preview shows the generated hierarchy, layouts and slide flow. The downloaded PowerPoint contains the editable deck, attached visual assets and finished presentation artwork.
              {result.attachmentNames?.length ? ` ${result.attachmentNames.length} attachment${result.attachmentNames.length === 1 ? "" : "s"} were used as source material${result.logoIncluded ? ", including the selected logo" : ""}.` : ""}
            </p>
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
              <h3 className="mt-4 text-xl font-black">Your presentation preview will appear here</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                The presentation is built with a narrative arc and varied editorial, comparison, timeline, process, metric and statement layouts—not one repeated template.
              </p>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

async function readApiPayload(response: Response): Promise<any> {
  const text = await response.text();
  if (!text.trim()) return {};
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("json")) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function publicApiMessage(payload: any, fallback: string) {
  const message = typeof payload?.error === "string" ? payload.error.trim() : "";
  if (
    message &&
    message.length <= 240 &&
    !/[{}<>`]/.test(message) &&
    !/https?:\/\//i.test(message) &&
    !/unexpected token|json|html|supabase|openai|netlify|credit_operation|stack|schema cache/i.test(message)
  ) {
    return message;
  }
  return fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function attachmentExtension(file: File) {
  return file.name.split(".").pop()?.trim().toLowerCase() || "";
}

function isImageAttachment(file: File) {
  return file.type.startsWith("image/") || IMAGE_EXTENSIONS.has(attachmentExtension(file));
}

function isSupportedAttachment(file: File) {
  const extension = attachmentExtension(file);
  if ([
    "pdf", "doc", "docx", "rtf", "odt", "ppt", "pptx", "txt", "md", "csv", "xls", "xlsx",
    "png", "jpg", "jpeg", "jfif", "webp", "svg",
  ].includes(extension)) return true;

  const mime = String(file.type || "").toLowerCase();
  return mime === "image/jpeg" || mime === "image/pjpeg";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type PreviewPalette = {
  background: string;
  surface: string;
  ink: string;
  muted: string;
  primary: string;
  accent: string;
  soft: string;
  dark: string;
  onDark: string;
};

const PREVIEW_PALETTES: Record<string, PreviewPalette> = {
  editorial: { background: "#f4f1ea", surface: "#fffefb", ink: "#16181c", muted: "#626871", primary: "#183b56", accent: "#d85b47", soft: "#e7ded0", dark: "#101820", onDark: "#f8f4ec" },
  corporate: { background: "#f2f6fa", surface: "#ffffff", ink: "#132033", muted: "#5c697a", primary: "#164e78", accent: "#1a9cb0", soft: "#dceaf2", dark: "#0b2239", onDark: "#f4faff" },
  bold: { background: "#f6f1e8", surface: "#fffdf8", ink: "#15120f", muted: "#655e55", primary: "#15120f", accent: "#f05a28", soft: "#f2d7c8", dark: "#12100e", onDark: "#fff8ed" },
  minimal: { background: "#f7f7f5", surface: "#ffffff", ink: "#171717", muted: "#6b6b68", primary: "#283593", accent: "#5b6cff", soft: "#e3e6f6", dark: "#15171c", onDark: "#fafaf7" },
  luxury: { background: "#f3efe7", surface: "#fffcf6", ink: "#191713", muted: "#6d665c", primary: "#29251f", accent: "#a98345", soft: "#ded1bb", dark: "#11100e", onDark: "#f7f0e4" },
};

function DeckPreview({
  slides,
  theme,
  previewVisuals,
  previewLogo,
  activeSlide,
  onActiveSlideChange,
}: {
  slides: Slide[];
  theme?: string;
  previewVisuals?: Record<string, string>;
  previewLogo?: string;
  activeSlide: number;
  onActiveSlideChange: (index: number) => void;
}) {
  const palette = PREVIEW_PALETTES[theme || ""] || PREVIEW_PALETTES.editorial;
  const active = slides[activeSlide];
  if (!active) return null;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[.62rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">
          Slide {activeSlide + 1} of {slides.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onActiveSlideChange(Math.max(0, activeSlide - 1))}
            disabled={activeSlide === 0}
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] transition hover:border-orange-400 disabled:opacity-35"
            aria-label="Previous slide"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => onActiveSlideChange(Math.min(slides.length - 1, activeSlide + 1))}
            disabled={activeSlide === slides.length - 1}
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] transition hover:border-orange-400 disabled:opacity-35"
            aria-label="Next slide"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.4rem] border border-[var(--border-strong)] bg-[#0e0d12] p-2 shadow-xl sm:p-3">
        <PreviewSlide slide={active} index={activeSlide} total={slides.length} palette={palette} visualUrl={previewVisuals?.[String(activeSlide)]} logoUrl={previewLogo} />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
        {slides.map((slide, index) => {
          const dark = isDarkSlide(slide);
          return (
            <button
              type="button"
              key={`${index}-${slide.title}`}
              onClick={() => onActiveSlideChange(index)}
              className={`w-28 shrink-0 overflow-hidden rounded-xl border-2 text-left transition ${index === activeSlide ? "border-orange-500 shadow-md" : "border-transparent opacity-75 hover:opacity-100"}`}
              aria-label={`Show slide ${index + 1}: ${slide.title}`}
            >
              <span
                className="relative flex aspect-video flex-col justify-between overflow-hidden p-2"
                style={{
                  background: dark ? palette.dark : palette.background,
                  color: previewVisuals?.[String(index)] ? palette.onDark : dark ? palette.onDark : palette.ink,
                  backgroundImage: previewVisuals?.[String(index)] ? `linear-gradient(90deg,rgba(0,0,0,.72),rgba(0,0,0,.08)),url(${previewVisuals[String(index)]})` : undefined,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }}
              >
                <span className="text-[.38rem] font-black uppercase tracking-[.12em]" style={{ color: palette.accent }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong className="line-clamp-2 text-[.48rem] leading-tight">{slide.title}</strong>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PreviewSlide({ slide, index, total, palette, visualUrl, logoUrl }: { slide: Slide; index: number; total: number; palette: PreviewPalette; visualUrl?: string; logoUrl?: string }) {
  const layout = slide.layout || "editorial";
  const dark = isDarkSlide(slide);
  const items = normalizedItems(slide).slice(0, layout === "timeline" || layout === "process" ? 5 : 4);
  const foreground = dark ? palette.onDark : palette.ink;
  const muted = dark ? `${palette.onDark}b8` : palette.muted;
  const background = dark ? palette.dark : palette.background;
  const sideVisual = Boolean(visualUrl && !dark && (slide.visualPosition === "left" || slide.visualPosition === "right"));
  const visualOnLeft = sideVisual && slide.visualPosition === "left";

  return (
    <div className="relative aspect-video w-full overflow-hidden" style={{ background, color: foreground }}>
      {visualUrl && dark ? (
        <div className="absolute inset-0 overflow-hidden">
          <img src={visualUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/48 to-black/12" />
        </div>
      ) : slide.visualType === "generated" && dark ? (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-[8%] -top-[28%] h-[118%] w-[58%] rounded-full opacity-65 blur-3xl" style={{ background: palette.accent }} />
          <div className="absolute -bottom-[42%] right-[18%] h-[92%] w-[50%] rounded-full opacity-50 blur-3xl" style={{ background: palette.primary }} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/15 to-transparent" />
        </div>
      ) : null}

      {sideVisual && (
        <div className={`absolute inset-y-0 w-[44%] overflow-hidden ${visualOnLeft ? "left-0" : "right-0"}`}>
          <img src={visualUrl} alt="" className="h-full w-full object-cover" />
          <div className={`absolute inset-0 ${visualOnLeft ? "bg-gradient-to-l" : "bg-gradient-to-r"} from-transparent via-transparent to-[var(--preview-bg)]`} style={{ "--preview-bg": background } as CSSProperties} />
        </div>
      )}

      {logoUrl && (
        <div className={`absolute z-20 flex items-center justify-center overflow-hidden rounded-md ${dark ? "right-[5%] top-[6%] h-[10%] w-[15%] bg-white/90 px-[1.5%] py-[1%]" : "bottom-[4.5%] right-[9%] h-[6%] w-[10%]"}`}>
          <img src={logoUrl} alt="Attached logo" className="h-full w-full object-contain" />
        </div>
      )}

      {layout === "cover" || layout === "section" || layout === "statement" || layout === "closing" ? (
        <div className="relative z-10 flex h-full max-w-[80%] flex-col justify-center px-[7%] py-[6%]">
          <p className="text-[.46rem] font-black uppercase tracking-[.24em] sm:text-[.58rem]" style={{ color: palette.accent }}>
            {slide.kicker || (layout === "cover" ? "Presentation" : layout.replace("-", " "))}
          </p>
          <h3 className="mt-[3%] text-xl font-black leading-[.96] tracking-[-.055em] sm:text-3xl lg:text-4xl">{slide.title}</h3>
          {slide.subtitle && <p className="mt-[3%] max-w-[82%] text-[.62rem] font-semibold leading-relaxed sm:text-xs" style={{ color: muted }}>{slide.subtitle}</p>}
          {layout === "closing" && items.length > 0 && (
            <div className="mt-[4%] grid max-w-[92%] grid-cols-3 gap-2">
              {items.slice(0, 3).map((item, itemIndex) => (
                <div key={itemIndex} className="border-t pt-2" style={{ borderColor: palette.accent }}>
                  <p className="text-[.48rem] font-black sm:text-[.58rem]">{item.title || item.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className="relative z-10 flex h-full flex-col px-[5.5%] py-[4.5%]"
          style={sideVisual ? { width: "58%", marginLeft: visualOnLeft ? "42%" : 0 } : undefined}
        >
          <p className="text-[.42rem] font-black uppercase tracking-[.2em] sm:text-[.55rem]" style={{ color: palette.accent }}>{slide.kicker || `Chapter ${String(index + 1).padStart(2, "0")}`}</p>
          <h3 className="mt-[1.2%] max-w-[92%] text-sm font-black leading-tight tracking-[-.035em] sm:text-xl lg:text-2xl">{slide.title}</h3>
          {slide.subtitle && <p className="mt-[1%] line-clamp-2 max-w-[88%] text-[.48rem] font-semibold sm:text-[.62rem]" style={{ color: muted }}>{slide.subtitle}</p>}
          <div className="mt-[3.5%] min-h-0 flex-1">
            <SlideBody layout={layout} items={items} palette={palette} foreground={foreground} muted={muted} />
          </div>
        </div>
      )}

      <div className="absolute bottom-[3%] left-[5.5%] right-[5.5%] z-20 flex items-center justify-between text-[.36rem] font-bold uppercase tracking-[.12em] sm:text-[.46rem]" style={{ color: muted }}>
        <span>Heyy Studio presentation</span>
        <span>{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
      </div>
    </div>
  );
}

function SlideBody({ layout, items, palette, foreground, muted }: { layout: string; items: Array<{ label?: string; title?: string; body?: string; value?: string }>; palette: PreviewPalette; foreground: string; muted: string }) {
  if (!items.length) return <div className="h-full w-[72%] border-t-4" style={{ borderColor: palette.accent }} />;

  if (layout === "timeline") {
    return (
      <div className="relative flex h-[72%] items-center gap-2">
        <div className="absolute left-1 right-1 top-[38%] h-px" style={{ background: palette.soft }} />
        {items.map((item, index) => <PreviewItem key={index} item={item} index={index} palette={palette} foreground={foreground} muted={muted} mode="timeline" />)}
      </div>
    );
  }
  if (layout === "process") {
    return <div className="grid h-[76%] items-stretch gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>{items.map((item, index) => <PreviewItem key={index} item={item} index={index} palette={palette} foreground={foreground} muted={muted} mode="process" />)}</div>;
  }
  if (layout === "metrics") {
    return <div className="grid h-[74%] items-center gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>{items.map((item, index) => <PreviewItem key={index} item={item} index={index} palette={palette} foreground={foreground} muted={muted} mode="metric" />)}</div>;
  }
  if (layout === "two-column") {
    return <div className="grid h-[76%] grid-cols-2 gap-[5%]">{items.slice(0, 2).map((item, index) => <PreviewItem key={index} item={item} index={index} palette={palette} foreground={foreground} muted={muted} mode="column" />)}</div>;
  }
  return <div className="grid h-[76%] grid-cols-2 gap-2">{items.map((item, index) => <PreviewItem key={index} item={item} index={index} palette={palette} foreground={foreground} muted={muted} mode="card" />)}</div>;
}

function PreviewItem({ item, index, palette, foreground, muted, mode }: { item: { label?: string; title?: string; body?: string; value?: string }; index: number; palette: PreviewPalette; foreground: string; muted: string; mode: "timeline" | "process" | "metric" | "column" | "card" }) {
  const color = index % 2 ? palette.primary : palette.accent;
  const className = mode === "timeline"
    ? "relative z-10 flex min-w-0 flex-1 flex-col items-center pt-[17%] text-center"
    : mode === "column"
      ? "border-t-4 pt-[7%]"
      : mode === "card"
        ? "rounded-lg border p-[5%]"
        : "border-l-2 pl-[7%] pt-[5%]";
  return (
    <div className={className} style={mode === "card" ? { borderColor: palette.soft, background: palette.surface } : { borderColor: color }}>
      {mode === "timeline" && <span className="absolute top-[30%] h-2 w-2 rounded-full border-2" style={{ background: color, borderColor: palette.background }} />}
      <p className={`font-black uppercase tracking-[.12em] ${mode === "metric" ? "text-sm sm:text-xl" : "text-[.38rem] sm:text-[.48rem]"}`} style={{ color }}>{item.value || item.label || String(index + 1).padStart(2, "0")}</p>
      {item.title && <p className="mt-1 line-clamp-2 text-[.5rem] font-black leading-tight sm:text-[.66rem]" style={{ color: foreground }}>{item.title}</p>}
      {item.body && <p className="mt-1 line-clamp-3 text-[.38rem] font-semibold leading-relaxed sm:text-[.5rem]" style={{ color: muted }}>{item.body}</p>}
    </div>
  );
}

function normalizedItems(slide: Slide) {
  if (slide.items?.length) return slide.items;
  return (slide.bullets || []).map((bullet) => ({ title: bullet, body: "" }));
}

function isDarkSlide(slide: Slide) {
  return ["cover", "section", "statement", "closing"].includes(slide.layout || "");
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
