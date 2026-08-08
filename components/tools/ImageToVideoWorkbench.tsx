"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, Download, Loader2, Play, Sparkles, Upload, Video } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button, CreditPill, Eyebrow, GlassCard, cx } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";
import { CREDIT_COSTS } from "@/lib/credits/config";

export default function ImageToVideoWorkbench() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { refreshAccount } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"preview" | "high">("preview");
  const [aspect, setAspect] = useState("16:9");
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "ready">("idle");
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");
  const cost = mode === "high" ? CREDIT_COSTS.imageToVideoHigh : CREDIT_COSTS.imageToVideoPreview;

  function chooseFile(selected?: File) {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) { setError("Upload a PNG, JPEG or WebP image."); return; }
    if (selected.size > 15 * 1024 * 1024) { setError("The image must be 15 MB or smaller."); return; }
    setFile(selected); setPreview(URL.createObjectURL(selected)); setVideoUrl(""); setError(""); setStatus("idle");
  }

  async function generate() {
    if (!file) { setError("Upload the still image you want to animate."); return; }
    if (prompt.trim().length < 8) { setError("Describe the movement, camera and timing in more detail."); return; }
    setStatus("uploading"); setError(""); setVideoUrl("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const imageBase64 = await fileToBase64(file);
      const response = await fetch("/api/tools/image-to-video/generate", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64, mimeType: file.type, prompt, mode, aspect }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Video generation could not start.");
      setStatus("processing");
      await pollJob(payload.jobId, token);
      await refreshAccount();
    } catch (generationError) { setStatus("idle"); setError(generationError instanceof Error ? generationError.message : "Video generation failed."); }
  }

  async function pollJob(jobId: string, token: string) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await delay(attempt === 0 ? 1500 : 5000);
      const response = await fetch(`/api/tools/image-to-video/status?job=${encodeURIComponent(jobId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not check video status.");
      if (payload.status === "failed") throw new Error(payload.error || "The video provider could not complete this clip.");
      if (payload.status === "succeeded") {
        const fileResponse = await fetch(`/api/tools/image-to-video/file?job=${encodeURIComponent(jobId)}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!fileResponse.ok) throw new Error("The finished video could not be downloaded.");
        const blob = await fileResponse.blob();
        setVideoUrl(URL.createObjectURL(blob));
        setStatus("ready");
        return;
      }
    }
    throw new Error("The video is still processing. Open the tool again later to check its generation history.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[.82fr_1.18fr]">
      <GlassCard className="p-5 sm:p-6">
        <Eyebrow>Source & motion</Eyebrow><h2 className="mt-3 text-2xl font-black tracking-[-.045em]">Animate a still image</h2>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])}/>
        <button type="button" onClick={() => inputRef.current?.click()} onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files?.[0]); }} onDragOver={(event) => event.preventDefault()} className="mt-6 grid min-h-64 w-full place-items-center overflow-hidden rounded-[1.4rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
          {preview ? <img src={preview} alt="Source image" className="h-full max-h-80 w-full object-contain"/> : <div className="p-8 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Upload size={22}/></span><p className="mt-4 text-sm font-black">Upload your source image</p><p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">PNG, JPEG or WebP · maximum 15 MB</p></div>}
        </button>
        <label className="mt-5 block text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Motion direction</label>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} className="heyy-form-field mt-2 resize-y" placeholder="Slow camera push-in. The curtains move gently, light shifts across the room, objects remain consistent..."/>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><label className="text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Aspect ratio</label><div className="mt-2"><HeyySelect value={aspect} tone="marketing" ariaLabel="Video aspect ratio" options={["16:9","9:16"]} onChange={setAspect}/></div></div><div><label className="text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Mode</label><div className="mt-2 grid grid-cols-2 gap-2">{(["preview","high"] as const).map((item)=><button key={item} onClick={()=>setMode(item)} className={cx("min-h-12 rounded-2xl border text-xs font-black capitalize transition",mode===item?"border-[var(--accent)] bg-[var(--accent)] text-white":"border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--accent)]")}>{item}<span className="ml-1 opacity-70">· {item === "high" ? CREDIT_COSTS.imageToVideoHigh : CREDIT_COSTS.imageToVideoPreview}</span></button>)}</div></div></div>
        {error && <div className="mt-5 flex gap-3 rounded-2xl border border-red-300/60 bg-red-500/10 p-4 text-sm font-bold text-red-700 dark:text-red-200"><AlertCircle size={18} className="shrink-0"/>{error}</div>}
        <Button className="mt-6 w-full" size="lg" onClick={() => void generate()} disabled={status === "uploading" || status === "processing"}>{status === "uploading" || status === "processing" ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} {status === "uploading" ? "Starting generation…" : status === "processing" ? "Video is processing…" : `Generate video · ${cost} credits`}</Button>
        <p className="mt-3 text-center text-[.65rem] font-semibold text-[var(--text-muted)]">Video generation is asynchronous. Credits are refunded automatically if the provider reports failure.</p>
      </GlassCard>

      <GlassCard className="flex min-h-[640px] flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4 px-1 pb-4"><div><Eyebrow>Generated clip</Eyebrow><p className="mt-1 text-sm font-bold text-[var(--text-secondary)]">Motion preview and downloadable MP4.</p></div><CreditPill credits={cost}/></div>
        <div className="grid flex-1 place-items-center overflow-hidden rounded-[1.4rem] border border-dashed border-[var(--border-strong)] bg-black/90">
          {status === "processing" || status === "uploading" ? <div className="p-8 text-center text-white"><Loader2 size={32} className="mx-auto animate-spin text-fuchsia-300"/><h3 className="mt-4 text-xl font-black">Creating motion</h3><p className="mt-2 text-sm font-semibold text-white/60">Keep this page open while the clip is rendered.</p></div> : videoUrl ? <video src={videoUrl} controls autoPlay loop className="h-full max-h-[720px] w-full object-contain"/> : <div className="max-w-sm p-8 text-center text-white"><Video size={36} className="mx-auto text-fuchsia-300"/><h3 className="mt-4 text-xl font-black">Your clip will appear here</h3><p className="mt-2 text-sm font-semibold leading-6 text-white/55">Use motion language: camera, subject movement, environmental movement and what must remain fixed.</p></div>}
        </div>
        {videoUrl && <div className="mt-4"><a href={videoUrl} download="heyy-studio-video.mp4" className="heyy-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--button-primary)] px-5 text-sm font-extrabold text-[var(--button-primary-text)]"><Download size={15}/> Download MP4</a></div>}
      </GlassCard>
    </div>
  );
}

function fileToBase64(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("The image could not be read.")); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.readAsDataURL(file); }); }
function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
