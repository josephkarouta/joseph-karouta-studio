"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Download,
  Expand,
  ImageIcon,
  Loader2,
  Paperclip,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button, CreditPill, Eyebrow, GlassCard, cx } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";
import { CREDIT_COSTS } from "@/lib/credits/config";

type Result = { imageUrl: string; asset?: { id: string; file_url?: string }; creditsUsed: number; revisedPrompt?: string };

const REFERENCE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;

export default function TextToImageWorkbench() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { refreshAccount } = useAuth();
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState<"preview" | "high">("preview");
  const [styleNotes, setStyleNotes] = useState("");
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState("");
  const cost = quality === "high" ? CREDIT_COSTS.textToImageHigh : CREDIT_COSTS.textToImagePreview;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("prompt")) setPrompt(params.get("prompt") || "");
  }, []);

  useEffect(() => {
    return () => {
      if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    };
  }, [referenceUrl]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewOpen(false);
    }
    if (previewOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewOpen]);

  function chooseReference(selected?: File) {
    if (!selected) return;
    if (!REFERENCE_TYPES.includes(selected.type)) {
      setError("Attach a PNG, JPEG or WebP reference image.");
      return;
    }
    if (selected.size > MAX_REFERENCE_BYTES) {
      setError("The reference image must be 10 MB or smaller.");
      return;
    }
    setReferenceImage(selected);
    setReferenceUrl(URL.createObjectURL(selected));
    setError("");
  }

  function removeReference() {
    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    setReferenceImage(null);
    setReferenceUrl("");
    if (referenceInputRef.current) referenceInputRef.current.value = "";
  }

  async function generate() {
    if (prompt.trim().length < 8) {
      setError("Describe the image in a little more detail.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("styleNotes", styleNotes);
      formData.append("size", size);
      formData.append("quality", quality);
      formData.append("projectId", new URLSearchParams(window.location.search).get("project") || "");
      if (referenceImage) formData.append("referenceImage", referenceImage, referenceImage.name);

      const response = await fetch("/api/tools/text-to-image/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Image generation failed.");
      setResult(payload);
      await refreshAccount();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Image generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadResult() {
    if (!result) return;
    const source = result.asset?.file_url || result.imageUrl;
    if (!source) {
      setError("The generated image could not be downloaded.");
      return;
    }

    try {
      setDownloading(true);
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) throw new Error("The generated image could not be downloaded.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "heyy-studio-image.png";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "The generated image could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[.82fr_1.18fr]">
        <GlassCard className="p-5 sm:p-6">
          <Eyebrow>Prompt & settings</Eyebrow>
          <h2 className="mt-3 text-2xl font-black tracking-[-.045em]">Describe the image</h2>
          <label className="mt-6 block text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Prompt</label>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} className="heyy-form-field mt-2 resize-y" placeholder="A premium editorial photograph of..." />

          <div className="mt-3">
            <input
              ref={referenceInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => chooseReference(event.target.files?.[0])}
            />
            {referenceImage ? (
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-hover)] p-3">
                <img src={referenceUrl} alt="Reference" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black">{referenceImage.name}</p>
                  <p className="mt-1 text-[.65rem] font-semibold text-[var(--text-muted)]">Reference image attached</p>
                </div>
                <button
                  type="button"
                  onClick={removeReference}
                  aria-label="Remove reference image"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => referenceInputRef.current?.click()}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-xs font-black transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                <Paperclip size={14} /> Attach reference image
              </button>
            )}
          </div>

          <label className="mt-5 block text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Style and restrictions</label>
          <textarea value={styleNotes} onChange={(event) => setStyleNotes(event.target.value)} rows={3} className="heyy-form-field mt-2 resize-y" placeholder="Lighting, lens, materials, colors, composition, and anything to avoid." />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Aspect ratio</label>
              <div className="mt-2">
                <HeyySelect
                  value={size}
                  ariaLabel="Aspect ratio"
                  options={[
                    { value: "1024x1024", label: "Square · 1:1" },
                    { value: "1536x1024", label: "Landscape · 3:2" },
                    { value: "1024x1536", label: "Portrait · 2:3" },
                    { value: "1792x1024", label: "Cinematic · 16:9" },
                    { value: "1024x1792", label: "Vertical · 9:16" },
                  ]}
                  onChange={setSize}
                />
              </div>
            </div>
            <div>
              <label className="text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Quality</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["preview", "high"] as const).map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setQuality(item)}
                    className={cx(
                      "min-h-12 rounded-2xl border text-xs font-black capitalize transition",
                      quality === item
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--accent)]",
                    )}
                  >
                    {item}
                    <span className="ml-1 opacity-70">· {item === "high" ? CREDIT_COSTS.textToImageHigh : CREDIT_COSTS.textToImagePreview}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {error && <div className="mt-5 flex gap-3 rounded-2xl border border-red-300/60 bg-red-500/10 p-4 text-sm font-bold text-red-700 dark:text-red-200"><AlertCircle size={18} className="shrink-0"/>{error}</div>}
          <Button className="mt-6 w-full" size="lg" onClick={() => void generate()} disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} {loading ? "Generating image…" : `Generate · ${cost} credits`}</Button>
          <p className="mt-3 text-center text-[.65rem] font-semibold text-[var(--text-muted)]">Credits are reserved before generation and automatically returned if the provider fails.</p>
        </GlassCard>

        <GlassCard className="flex min-h-[620px] flex-col p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4 px-1 pb-4"><div><Eyebrow>Generated asset</Eyebrow><p className="mt-1 text-sm font-bold text-[var(--text-secondary)]">Your latest result appears here.</p></div>{result && <CreditPill credits={result.creditsUsed}/>}</div>
          <div className="grid flex-1 place-items-center overflow-hidden rounded-[1.4rem] border border-dashed border-[var(--border-strong)] bg-[linear-gradient(135deg,var(--surface-hover),rgba(46,124,246,.08))]">
            {loading ? <div className="text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--surface-strong)] shadow-lg"><Loader2 size={25} className="animate-spin text-[var(--accent-strong)]"/></span><p className="mt-4 text-sm font-black">Building your image</p><p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">Composition, lighting and detail are being resolved.</p></div> : result ? (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="group relative h-full max-h-[720px] w-full"
                aria-label="Preview generated image"
              >
                <img src={result.imageUrl} alt="Generated result" className="h-full max-h-[720px] w-full object-contain"/>
                <span className="pointer-events-none absolute right-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-black text-white opacity-0 transition group-hover:opacity-100">
                  <Expand size={14} /> Preview
                </span>
              </button>
            ) : <div className="max-w-sm p-8 text-center"><ImageIcon size={34} className="mx-auto text-[var(--accent-strong)]"/><h3 className="mt-4 text-xl font-black">Ready for a prompt</h3><p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">Be specific about subject, environment, lighting, materials, camera and composition.</p></div>}
          </div>
          {result && <div className="mt-4 flex flex-wrap gap-3"><Button variant="ghost" onClick={() => setPreviewOpen(true)} disabled={loading}><Expand size={15}/> Preview</Button><Button variant="ghost" onClick={() => void downloadResult()} disabled={loading || downloading}>{downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15}/>} {downloading ? "Downloading…" : "Download"}</Button><Button variant="ghost" onClick={() => void generate()} disabled={loading}><RotateCcw size={15}/> Regenerate · {cost} credits</Button></div>}
        </GlassCard>
      </div>

      {previewOpen && result && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewOpen(false)}>
          <div className="relative max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[1.6rem] border border-white/10 bg-[var(--surface-strong)] p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <Eyebrow>Image preview</Eyebrow>
                <p className="mt-1 text-sm font-bold text-[var(--text-secondary)]">Review the generated result at a larger size.</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                aria-label="Close preview"
                className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] transition hover:border-[var(--accent)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid max-h-[78vh] place-items-center overflow-auto rounded-[1.2rem] bg-black/20 p-3">
              <img src={result.imageUrl} alt="Generated preview" className="h-auto max-h-[74vh] w-auto max-w-full object-contain" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
