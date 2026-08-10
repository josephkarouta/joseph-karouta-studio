"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, Download, Images, Loader2, Sparkles, Upload } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button, CreditPill, Eyebrow, GlassCard, cx } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";
import { CREDIT_COSTS } from "@/lib/credits/config";

const APPROACHES = [
  "Standard",
  "High fidelity",
  "Low resolution",
  "Art & illustration",
  "Text & shapes",
  "Strong recovery",
];

export default function UpscalerWorkbench() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { refreshAccount } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [scale, setScale] = useState<2 | 4>(2);
  const [model, setModel] = useState("Standard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cost = scale === 4 ? CREDIT_COSTS.aiUpscale4x : CREDIT_COSTS.aiUpscale2x;

  function chooseFile(selected?: File) {
    if (!selected) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(selected.type)) {
      setError("Upload a PNG, JPEG or WebP image.");
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      setError("The image must be 20 MB or smaller.");
      return;
    }
    setFile(selected);
    setSourceUrl(URL.createObjectURL(selected));
    setResultUrl("");
    setError("");
  }

  async function upscale() {
    if (!file) {
      setError("Upload the image you want to enhance.");
      return;
    }
    setLoading(true);
    setError("");
    setResultUrl("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const imageBase64 = await fileToBase64(file);
      const response = await fetch("/api/tools/ai-upscaler/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64, mimeType: file.type, filename: file.name, scale, model }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Upscale could not start.");

      if (payload.status === "succeeded") await loadFile(payload.jobId, token);
      else await poll(payload.jobId, token);
      await refreshAccount();
    } catch (upscaleError) {
      setError(upscaleError instanceof Error ? upscaleError.message : "Upscale failed.");
    } finally {
      setLoading(false);
    }
  }

  async function poll(jobId: string, token: string) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      await delay(attempt === 0 ? 1000 : 3500);
      const response = await fetch(`/api/tools/ai-upscaler/status?job=${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not check enhancement status.");
      if (payload.status === "failed") {
        throw new Error(payload.error || "The enhancement service could not complete this image.");
      }
      if (payload.status === "succeeded") {
        await loadFile(jobId, token);
        return;
      }
    }
    throw new Error("The enhancement is still processing. Check generation history later.");
  }

  async function loadFile(jobId: string, token: string) {
    const response = await fetch(`/api/tools/ai-upscaler/file?job=${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("The enhanced image could not be downloaded.");
    setResultUrl(URL.createObjectURL(await response.blob()));
  }

  const generative = model === "Strong recovery";

  return (
    <div className="grid gap-5 xl:grid-cols-[.76fr_1.24fr]">
      <GlassCard className="p-5 sm:p-6">
        <Eyebrow>Source & enhancement</Eyebrow>
        <h2 className="mt-3 text-2xl font-black tracking-[-.045em]">Increase resolution</h2>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={(event) => {
            event.preventDefault();
            chooseFile(event.dataTransfer.files?.[0]);
          }}
          onDragOver={(event) => event.preventDefault()}
          className="mt-6 grid min-h-60 w-full place-items-center overflow-hidden rounded-[1.4rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
        >
          {sourceUrl ? (
            <img src={sourceUrl} alt="Source" className="h-full max-h-80 w-full object-contain" />
          ) : (
            <div className="p-8 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <Upload size={22} />
              </span>
              <p className="mt-4 text-sm font-black">Upload the original image</p>
              <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">PNG, JPEG or WebP · maximum 20 MB</p>
            </div>
          )}
        </button>

        <div className="mt-5">
          <label className="text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">
            Enhancement approach
          </label>
          <div className="mt-2">
            <HeyySelect
              value={model}
              tone="architecture"
              ariaLabel="Enhancement approach"
              options={APPROACHES}
              onChange={setModel}
            />
          </div>
          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3 text-[.68rem] font-semibold leading-5 text-[var(--text-secondary)]">
            <span className="font-black text-[var(--text-primary)]">Topaz Labs · {model}.</span>{" "}
            {generative
              ? "Strong recovery uses Topaz Recover 3. It can reconstruct missing detail, so use it for weak or very low-resolution sources rather than approved artwork that must remain pixel-faithful."
              : "This is a fidelity-preserving Topaz enhancement mode designed to enlarge the image while keeping the source identity and structure stable."}
          </div>
        </div>

        <div className="mt-5">
          <label className="text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Output scale</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([2, 4] as const).map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setScale(item)}
                className={cx(
                  "min-h-12 rounded-2xl border text-xs font-black transition",
                  scale === item
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--accent)]",
                )}
              >
                {item}× upscale{" "}
                <span className="opacity-70">· {item === 4 ? CREDIT_COSTS.aiUpscale4x : CREDIT_COSTS.aiUpscale2x}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-5 flex gap-3 rounded-2xl border border-red-300/60 bg-red-500/10 p-4 text-sm font-bold text-red-700 dark:text-red-200">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        <Button className="mt-6 w-full" size="lg" onClick={() => void upscale()} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? "Enhancing image…" : `Upscale ${scale}× · ${cost} credits`}
        </Button>
      </GlassCard>

      <GlassCard className="flex min-h-[640px] flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4 px-1 pb-4">
          <div>
            <Eyebrow>Enhanced result</Eyebrow>
            <p className="mt-1 text-sm font-bold text-[var(--text-secondary)]">Topaz-enhanced output saved to your Assets Library.</p>
          </div>
          <CreditPill credits={cost} />
        </div>
        <div className="grid flex-1 place-items-center overflow-hidden rounded-[1.4rem] border border-dashed border-[var(--border-strong)] bg-[linear-gradient(135deg,var(--surface-hover),rgba(2,132,199,.08))]">
          {loading ? (
            <div className="text-center">
              <Loader2 size={32} className="mx-auto animate-spin text-[var(--accent-strong)]" />
              <h3 className="mt-4 text-xl font-black">Recovering detail</h3>
              <p className="mt-2 text-sm font-semibold text-[var(--text-muted)]">Resolution, texture and edges are being enhanced.</p>
            </div>
          ) : resultUrl ? (
            <img src={resultUrl} alt="Enhanced result" className="h-full max-h-[720px] w-full object-contain" />
          ) : (
            <div className="max-w-sm p-8 text-center">
              <Images size={36} className="mx-auto text-[var(--accent-strong)]" />
              <h3 className="mt-4 text-xl font-black">Your enhanced image will appear here</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                Standard, high-fidelity, low-resolution, CGI and text modes preserve the source more closely. Strong recovery is for reconstruction.
              </p>
            </div>
          )}
        </div>
        {resultUrl && (
          <div className="mt-4">
            <a
              href={resultUrl}
              download="heyy-studio-upscaled.png"
              className="heyy-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--button-primary)] px-5 text-sm font-extrabold text-[var(--button-primary-text)]"
            >
              <Download size={15} /> Download enhanced image
            </a>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
