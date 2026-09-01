"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Download,
  ImageIcon,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  Video,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button, CreditPill, Eyebrow, GlassCard, cx } from "@/components/ui/heyy";
import { CREDIT_COSTS } from "@/lib/credits/config";

type VideoMode = "fast" | "quality";
type VideoResolution = "720p" | "1080p";
type AspectRatio = "16:9" | "9:16";

type StatusPayload = {
  success?: boolean;
  status?: string;
  error?: string;
  fileUrl?: string | null;
  videoUrl?: string | null;
  url?: string | null;
};

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 225;

export default function ImageToVideoWorkbench() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { refreshAccount } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [mode, setMode] = useState<VideoMode>("fast");
  const [resolution, setResolution] = useState<VideoResolution>("1080p");
  const [resultUrl, setResultUrl] = useState("");
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");

  const cost = getVideoCost(mode, resolution);

  useEffect(() => {
    return () => {
      if (sourceUrl.startsWith("blob:")) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(() => {
    return () => {
      if (resultUrl.startsWith("blob:")) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  function selectImage(file?: File) {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Upload a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("The source image must be 4 MB or smaller.");
      return;
    }

    if (sourceUrl.startsWith("blob:")) URL.revokeObjectURL(sourceUrl);
    setSourceImage(file);
    setSourceUrl(URL.createObjectURL(file));
    setError("");
  }

  function removeImage() {
    if (sourceUrl.startsWith("blob:")) URL.revokeObjectURL(sourceUrl);
    setSourceImage(null);
    setSourceUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function generate() {
    if (!sourceImage) {
      setError("Upload a source image first.");
      return;
    }
    if (prompt.trim().length < 8) {
      setError("Describe the motion, camera and timing in more detail.");
      return;
    }

    setLoading(true);
    setError("");
    setStatusText("Preparing your video…");
    setJobId("");
    if (resultUrl.startsWith("blob:")) URL.revokeObjectURL(resultUrl);
    setResultUrl("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const imageBase64 = await fileToBase64(sourceImage);
      const projectId = new URLSearchParams(window.location.search).get("project") || "";

      const response = await fetch("/api/tools/image-to-video/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageBase64,
          mimeType: sourceImage.type,
          filename: sourceImage.name,
          prompt: prompt.trim(),
          aspect,
          mode,
          resolution,
          projectId,
        }),
      });

      const payload = await readJsonResponse(response);
      if (!response.ok || !payload?.success || !payload?.jobId) {
        throw new Error(payload?.error || "Video generation could not start.");
      }

      const currentJobId = String(payload.jobId);
      setJobId(currentJobId);
      setStatusText(mode === "quality" ? "Rendering quality video…" : "Rendering video…");

      if (payload.status === "succeeded") {
        await loadCompletedVideo(currentJobId, token, payload);
      } else {
        await pollUntilComplete(currentJobId, token);
      }

      await refreshAccount();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Video generation failed.");
    } finally {
      setLoading(false);
      setStatusText("");
    }
  }

  async function pollUntilComplete(currentJobId: string, token: string) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await delay(POLL_INTERVAL_MS);

      const response = await fetch(
        `/api/tools/image-to-video/status?job=${encodeURIComponent(currentJobId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      const payload = (await readJsonResponse(response)) as StatusPayload;

      if (!response.ok) {
        throw new Error(payload.error || "Video status could not be checked.");
      }
      if (payload.status === "failed" || payload.status === "cancelled") {
        throw new Error(payload.error || "Video generation failed. Your credits were returned.");
      }
      if (payload.status === "succeeded") {
        await loadCompletedVideo(currentJobId, token, payload);
        return;
      }

      if (attempt > 6) {
        setStatusText(
          mode === "quality"
            ? "Quality rendering can take several minutes. Keep this page open while Heyy Studio finishes your video…"
            : "Your video is still rendering. Keep this page open while Heyy Studio finishes it…",
        );
      }
    }

    throw new Error("Your video is still processing. Keep this page open and try again shortly.");
  }

  async function loadCompletedVideo(currentJobId: string, token: string, statusPayload?: StatusPayload) {
    const statusUrl = statusPayload?.fileUrl || statusPayload?.videoUrl || statusPayload?.url || "";
    if (statusUrl) {
      setResultUrl(statusUrl);
      return;
    }

    const response = await fetch(
      `/api/tools/image-to-video/file?job=${encodeURIComponent(currentJobId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const payload = await readJsonResponse(response);
      throw new Error(payload?.error || "The generated video could not be loaded.");
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as StatusPayload;
      const remoteUrl = payload.fileUrl || payload.videoUrl || payload.url || "";
      if (!remoteUrl) throw new Error(payload.error || "The generated video is not available yet.");
      setResultUrl(remoteUrl);
      return;
    }

    const videoBlob = await response.blob();
    if (!videoBlob.size) throw new Error("The generated video is empty.");
    if (resultUrl.startsWith("blob:")) URL.revokeObjectURL(resultUrl);
    setResultUrl(URL.createObjectURL(videoBlob));
  }

  async function downloadResult() {
    if (!resultUrl) return;
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(resultUrl);
      if (!response.ok) throw new Error("The video could not be downloaded.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `heyy-video-${mode}-${resolution}.mp4`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "The video could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,.82fr)]">
      <GlassCard className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Source & motion</Eyebrow>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">Animate your image</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">
              Upload one still image, describe the movement you want, then choose the rendering mode and resolution.
            </p>
          </div>
          <CreditPill credits={cost} />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => selectImage(event.target.files?.[0])}
        />

        <div className="mt-6">
          {sourceUrl ? (
            <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-hover)]">
              <img src={sourceUrl} alt="Source image" className="max-h-[420px] w-full object-contain" />
              <button
                type="button"
                aria-label="Remove source image"
                onClick={removeImage}
                disabled={loading}
                className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80 disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="grid min-h-64 w-full place-items-center rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-hover)] px-6 text-center transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
            >
              <span>
                <ImageIcon size={34} className="mx-auto text-[var(--accent-strong)]" />
                <strong className="mt-4 block text-sm font-black text-[var(--text-primary)]">Upload source image</strong>
                <span className="mt-2 block text-xs font-semibold text-[var(--text-muted)]">PNG, JPEG or WebP · maximum 4 MB</span>
                <span className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[var(--accent-strong)]">
                  <Upload size={14} /> Choose image
                </span>
              </span>
            </button>
          )}
        </div>

        <label className="mt-6 block">
          <span className="text-[.65rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">Motion direction</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            disabled={loading}
            className="heyy-input mt-2 min-h-32 w-full resize-y"
            placeholder="Example: Slow camera push-in, subtle movement in the subject and environment, natural lighting changes, premium cinematic pacing."
          />
        </label>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <ChoiceGroup
            label="Mode"
            value={mode}
            disabled={loading}
            options={[
              { value: "fast", title: "Fast", description: "High-quality video optimized for faster rendering." },
              { value: "quality", title: "Quality", description: "Best visual quality and consistency. Rendering can take longer." },
            ]}
            onChange={(value) => setMode(value as VideoMode)}
          />

          <ChoiceGroup
            label="Resolution"
            value={resolution}
            disabled={loading}
            options={[
              { value: "720p", title: "720p", description: "Lower cost, faster processing." },
              { value: "1080p", title: "1080p", description: "Higher resolution output." },
            ]}
            onChange={(value) => setResolution(value as VideoResolution)}
          />
        </div>

        <div className="mt-5">
          <ChoiceGroup
            label="Aspect ratio"
            value={aspect}
            compact
            disabled={loading}
            options={[
              { value: "16:9", title: "16:9", description: "Landscape" },
              { value: "9:16", title: "9:16", description: "Vertical" },
            ]}
            onChange={(value) => setAspect(value as AspectRatio)}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3">
          <p className="text-xs font-bold text-[var(--text-secondary)]">8-second video · native audio included</p>
          <CreditPill credits={cost} />
        </div>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-300/60 bg-rose-500/10 p-4 text-sm font-bold text-rose-600">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button className="mt-6 w-full justify-center" onClick={() => void generate()} disabled={loading || !sourceImage}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? "Generating video…" : `Generate video · ${cost} credits`}
        </Button>

        {resultUrl && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => void generate()} disabled={loading}>
              <RotateCcw size={15} /> Regenerate · {cost} credits
            </Button>
          </div>
        )}
      </GlassCard>

      <GlassCard className="overflow-hidden p-0">
        <div className="border-b border-[var(--border)] p-6">
          <Eyebrow>Video result</Eyebrow>
          <h2 className="mt-2 text-xl font-black tracking-[-0.03em]">
            {resultUrl ? `${mode === "quality" ? "Quality" : "Fast"} · ${resolution}` : "Your generated video"}
          </h2>
        </div>

        <div className={cx("relative grid min-h-[430px] place-items-center bg-black/10", aspect === "9:16" && "min-h-[560px]")}> 
          {resultUrl ? (
            <video
              src={resultUrl}
              controls
              playsInline
              className={cx("max-h-[70vh] w-full bg-black object-contain", aspect === "9:16" ? "aspect-[9/16]" : "aspect-video")}
            />
          ) : loading ? (
            <div className="px-8 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <Loader2 size={28} className="animate-spin" />
              </div>
              <p className="mt-5 text-sm font-black text-[var(--text-primary)]">{statusText || "Generating your video…"}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-muted)]">
                Keep this page open while the render completes.
              </p>
              {jobId && <p className="mt-3 text-[.62rem] font-bold text-[var(--text-muted)]">Generation in progress</p>}
            </div>
          ) : (
            <div className="px-8 text-center">
              <Video size={38} className="mx-auto text-[var(--accent-strong)]" />
              <p className="mt-5 text-sm font-black text-[var(--text-primary)]">No video generated yet</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-muted)]">
                Your 8-second result will appear here with audio when generation is complete.
              </p>
            </div>
          )}
        </div>

        {resultUrl && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] p-5">
            <p className="text-xs font-bold text-[var(--text-muted)]">8 seconds · {resolution} · audio included</p>
            <Button variant="secondary" onClick={() => void downloadResult()} disabled={downloading}>
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {downloading ? "Downloading…" : "Download video"}
            </Button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
  disabled,
  compact = false,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; title: string; description: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div>
      <p className="text-[.65rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">{label}</p>
      <div className={cx("mt-2 grid gap-2", options.length === 2 && "grid-cols-2")}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cx(
                "rounded-2xl border p-4 text-left transition disabled:opacity-60",
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_0_1px_var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
                compact && "p-3",
              )}
            >
              <strong className="block text-sm font-black text-[var(--text-primary)]">{option.title}</strong>
              <span className="mt-1 block text-[.68rem] font-semibold leading-4 text-[var(--text-muted)]">{option.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getVideoCost(mode: VideoMode, resolution: VideoResolution) {
  if (mode === "quality") {
    return resolution === "720p" ? CREDIT_COSTS.imageToVideoQuality720 : CREDIT_COSTS.imageToVideoQuality1080;
  }
  return resolution === "720p" ? CREDIT_COSTS.imageToVideoFast720 : CREDIT_COSTS.imageToVideoFast1080;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",")[1] || "" : value);
    };
    reader.onerror = () => reject(new Error("The source image could not be read."));
    reader.readAsDataURL(file);
  });
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {} as any;
  try {
    return JSON.parse(text);
  } catch {
    if (/inactivity timeout/i.test(text)) {
      return { error: "Video generation timed out before the job could start. Please try again." } as any;
    }
    return {
      error: response.ok
        ? "The server returned an invalid response."
        : `Video generation request failed (${response.status}).`,
    } as any;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
