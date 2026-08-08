"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Download, ImageIcon, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button, CreditPill, Eyebrow, GlassCard, cx } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";
import { CREDIT_COSTS } from "@/lib/credits/config";

type Result = { imageUrl: string; asset?: { id: string; file_url?: string }; creditsUsed: number; revisedPrompt?: string };

export default function TextToImageWorkbench() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { refreshAccount } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState<"preview" | "high">("preview");
  const [styleNotes, setStyleNotes] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cost = quality === "high" ? CREDIT_COSTS.textToImageHigh : CREDIT_COSTS.textToImagePreview;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("prompt")) setPrompt(params.get("prompt") || "");
  }, []);

  async function generate() {
    if (prompt.trim().length < 8) { setError("Describe the image in a little more detail."); return; }
    setLoading(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/tools/text-to-image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, styleNotes, size, quality, projectId: new URLSearchParams(window.location.search).get("project") }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Image generation failed.");
      setResult(payload);
      await refreshAccount();
    } catch (generationError) { setError(generationError instanceof Error ? generationError.message : "Image generation failed."); }
    finally { setLoading(false); }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[.82fr_1.18fr]">
      <GlassCard className="p-5 sm:p-6">
        <Eyebrow>Prompt & settings</Eyebrow>
        <h2 className="mt-3 text-2xl font-black tracking-[-.045em]">Describe the image</h2>
        <label className="mt-6 block text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Prompt</label>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} className="heyy-form-field mt-2 resize-y" placeholder="A premium editorial photograph of..." />
        <label className="mt-5 block text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Style and restrictions</label>
        <textarea value={styleNotes} onChange={(event) => setStyleNotes(event.target.value)} rows={3} className="heyy-form-field mt-2 resize-y" placeholder="Lighting, lens, materials, colors, composition, and anything to avoid." />

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><label className="text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Aspect ratio</label><div className="mt-2"><HeyySelect value={size} ariaLabel="Aspect ratio" options={[{value:"1024x1024",label:"Square · 1:1"},{value:"1536x1024",label:"Landscape · 3:2"},{value:"1024x1536",label:"Portrait · 2:3"}]} onChange={setSize}/></div></div>
          <div><label className="text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Quality</label><div className="mt-2 grid grid-cols-2 gap-2">{(["preview","high"] as const).map((item) => <button key={item} onClick={() => setQuality(item)} className={cx("min-h-12 rounded-2xl border text-xs font-black capitalize transition", quality === item ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--accent)]")}>{item}<span className="ml-1 opacity-70">· {item === "high" ? CREDIT_COSTS.textToImageHigh : CREDIT_COSTS.textToImagePreview}</span></button>)}</div></div>
        </div>
        {error && <div className="mt-5 flex gap-3 rounded-2xl border border-red-300/60 bg-red-500/10 p-4 text-sm font-bold text-red-700 dark:text-red-200"><AlertCircle size={18} className="shrink-0"/>{error}</div>}
        <Button className="mt-6 w-full" size="lg" onClick={() => void generate()} disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} {loading ? "Generating image…" : `Generate · ${cost} credits`}</Button>
        <p className="mt-3 text-center text-[.65rem] font-semibold text-[var(--text-muted)]">Credits are reserved before generation and automatically returned if the provider fails.</p>
      </GlassCard>

      <GlassCard className="flex min-h-[620px] flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4 px-1 pb-4"><div><Eyebrow>Generated asset</Eyebrow><p className="mt-1 text-sm font-bold text-[var(--text-secondary)]">Your latest result appears here.</p></div>{result && <CreditPill credits={result.creditsUsed}/>}</div>
        <div className="grid flex-1 place-items-center overflow-hidden rounded-[1.4rem] border border-dashed border-[var(--border-strong)] bg-[linear-gradient(135deg,var(--surface-hover),rgba(46,124,246,.08))]">
          {loading ? <div className="text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--surface-strong)] shadow-lg"><Loader2 size={25} className="animate-spin text-[var(--accent-strong)]"/></span><p className="mt-4 text-sm font-black">Building your image</p><p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">Composition, lighting and detail are being resolved.</p></div> : result ? <img src={result.imageUrl} alt="Generated result" className="h-full max-h-[720px] w-full object-contain"/> : <div className="max-w-sm p-8 text-center"><ImageIcon size={34} className="mx-auto text-[var(--accent-strong)]"/><h3 className="mt-4 text-xl font-black">Ready for a prompt</h3><p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">Be specific about subject, environment, lighting, materials, camera and composition.</p></div>}
        </div>
        {result && <div className="mt-4 flex flex-wrap gap-3"><a href={result.asset?.file_url || result.imageUrl} download="heyy-studio-image.png" target="_blank" rel="noreferrer" className="heyy-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-strong)] px-5 text-sm font-extrabold transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"><Download size={15}/> Download</a><Button variant="ghost" onClick={() => void generate()} disabled={loading}><RotateCcw size={15}/> Regenerate · {cost} credits</Button></div>}
      </GlassCard>
    </div>
  );
}
