"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, ArrowRightLeft, Download, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, Eyebrow, GlassCard } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";
import UtilityUsageCard from "@/components/tools/UtilityUsageCard";
import { createBrowserZip } from "@/lib/client/zip";
import { useUtilityUsage } from "@/hooks/use-utility-usage";
import {
  CONVERTER_TARGETS,
  convertFile,
  fileSizeLabel,
  formatFromFile,
  type ConverterFormat,
  type OutputFile,
} from "@/lib/tools/browser-document-utils";

type PreparedOutput = OutputFile & { url: string };

const FORMATS: Array<{ value: ConverterFormat; label: string }> = [
  { value: "pdf", label: "PDF" },
  { value: "jpg", label: "JPG" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "svg", label: "SVG" },
  { value: "heic", label: "HEIC" },
  { value: "heif", label: "HEIF" },
  { value: "bmp", label: "BMP" },
  { value: "avif", label: "AVIF" },
];

function formatLabel(value: ConverterFormat) {
  return FORMATS.find((item) => item.value === value)?.label || value.toUpperCase();
}

export default function FileConverterWorkbench() {
  const { plan } = useAuth();
  const { usage, loadingUsage, usageError, authorize, complete, fail } = useUtilityUsage("file_converter");
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [from, setFrom] = useState<ConverterFormat>("pdf");
  const [to, setTo] = useState<ConverterFormat>("jpg");
  const [outputs, setOutputs] = useState<PreparedOutput[]>([]);
  const [processing, setProcessing] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const subscribed = String(plan || "free").toLowerCase() !== "free";
  const maxFileBytes = (subscribed ? 100 : 25) * 1024 * 1024;
  const targetOptions = CONVERTER_TARGETS[from].map((value) => ({ value, label: formatLabel(value) }));

  useEffect(() => () => outputs.forEach((output) => URL.revokeObjectURL(output.url)), [outputs]);

  function resetOutputs() {
    outputs.forEach((output) => URL.revokeObjectURL(output.url));
    setOutputs([]);
    setSuccess("");
  }

  function setFromFormat(value: ConverterFormat) {
    setFrom(value);
    const nextTargets = CONVERTER_TARGETS[value];
    if (!nextTargets.includes(to)) setTo(nextTargets[0]);
    setFile(null);
    setError("");
    resetOutputs();
    if (inputRef.current) inputRef.current.value = "";
  }

  function setToFormat(value: ConverterFormat) {
    setTo(value);
    setError("");
    resetOutputs();
  }

  function chooseFile(selected?: File) {
    if (!selected) return;
    if (selected.size > maxFileBytes) {
      setError(`Files must be ${subscribed ? "100 MB" : "25 MB"} or smaller${subscribed ? "." : " on the Free plan."}`);
      return;
    }
    const detected = formatFromFile(selected);
    if (!detected) {
      setError("This file type is not supported yet. Use PDF, JPG, JPEG, PNG, WebP, SVG, HEIC, HEIF, BMP or AVIF.");
      return;
    }
    setFrom(detected);
    const nextTargets = CONVERTER_TARGETS[detected];
    if (!nextTargets.includes(to)) setTo(nextTargets[0]);
    setFile(selected);
    setError("");
    resetOutputs();
  }

  async function downloadAll() {
    if (outputs.length < 2 || !file) return;
    setDownloadingAll(true);
    setError("");
    try {
      const zip = createBrowserZip(await Promise.all(outputs.map(async (output) => ({
        name: output.name,
        data: await output.blob.arrayBuffer(),
      }))));
      triggerDownload(zip, `${safeBaseName(file.name)}-${formatLabel(to).toLowerCase()}-pages.zip`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "The ZIP could not be created.");
    } finally {
      setDownloadingAll(false);
    }
  }

  async function runConversion() {
    if (!file) {
      setError("Attach a file first.");
      return;
    }

    setProcessing(true);
    setError("");
    resetOutputs();
    let authorization: Awaited<ReturnType<typeof authorize>> | null = null;

    try {
      authorization = await authorize("convert");
      const result = await convertFile(file, from, to, subscribed ? 150 : 50);
      await complete(authorization.operationId, {
        operation: "convert",
        from,
        to,
        input_bytes: file.size,
        output_files: result.length,
      });
      setOutputs(result.map((output) => ({ ...output, url: URL.createObjectURL(output.blob) })));
      setSuccess(
        authorization.chargeType === "subscriber"
          ? "Done — included with your plan."
          : authorization.chargeType === "free"
            ? "Done — this used one of today’s free conversions."
            : "Done — 1 credit used.",
      );
    } catch (conversionError) {
      const message = conversionError instanceof Error ? conversionError.message : "The file could not be converted.";
      if (authorization?.operationId) await fail(authorization.operationId, message);
      setError(message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
      <div className="space-y-5">
        <UtilityUsageCard
          unlimited={usage.unlimited}
          freeRemaining={usage.freeRemaining}
          dailyLimit={usage.dailyLimit}
          creditCost={usage.creditCostAfterFree}
          loading={loadingUsage}
          error={usageError}
        />

        <GlassCard className="p-5 sm:p-6">
          <Eyebrow>Supported conversions</Eyebrow>
          <div className="mt-4 space-y-3 text-xs font-semibold leading-6 text-[var(--text-secondary)]">
            <FormatLine from="PDF" to="JPG · JPEG · PNG · WebP" />
            <FormatLine from="JPG / JPEG" to="JPG/JPEG · PNG · WebP · PDF" />
            <FormatLine from="PNG" to="JPG · JPEG · WebP · PDF" />
            <FormatLine from="WebP" to="JPG · JPEG · PNG · PDF" />
            <FormatLine from="SVG" to="JPG · JPEG · PNG · WebP · PDF" />
            <FormatLine from="HEIC / HEIF" to="JPG · JPEG · PNG · WebP · PDF" />
            <FormatLine from="BMP / AVIF" to="JPG · JPEG · PNG · WebP · PDF" />
          </div>
          <p className="mt-4 text-[.68rem] font-semibold leading-5 text-[var(--text-muted)]">PDF-to-image creates one downloadable image for each PDF page. HEIC/HEIF conversion happens in your browser and does not preserve camera metadata. Nothing is saved to your Heyy Studio Assets Library.</p>
        </GlassCard>
      </div>

      <GlassCard className="p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><Eyebrow>Convert file</Eyebrow><h2 className="mt-2 text-3xl font-black tracking-[-.05em]">Choose a format and attach your file.</h2></div>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[.64rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">No storage</span>
        </div>

        <div className="mt-7 grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <label><span className="text-xs font-black">From</span><div className="mt-2"><HeyySelect value={from} onChange={(value) => setFromFormat(value as ConverterFormat)} options={FORMATS} /></div></label>
          <span className="mb-2 hidden h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--accent-strong)] sm:grid"><ArrowRightLeft size={16}/></span>
          <label><span className="text-xs font-black">To</span><div className="mt-2"><HeyySelect value={to} onChange={(value) => setToFormat(value as ConverterFormat)} options={targetOptions} /></div></label>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.svg,.heic,.heif,.bmp,.avif,application/pdf,image/jpeg,image/png,image/webp,image/svg+xml,image/heic,image/heif,image/bmp,image/avif"
          className="hidden"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragActive(true); }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              chooseFile(event.dataTransfer.files?.[0]);
            }}
            className={`mt-6 flex min-h-48 w-full flex-col items-center justify-center rounded-[1.7rem] border border-dashed px-6 text-center transition ${dragActive ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_0_3px_var(--accent-soft)]" : "border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"}`}
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Paperclip size={19}/></span>
            <span className="mt-4 text-base font-black">{dragActive ? "Drop your file here" : `Attach or drag & drop a ${formatLabel(from)} file`}</span>
            <span className="mt-1 text-xs font-semibold text-[var(--text-muted)]">Maximum {subscribed ? "100 MB" : "25 MB"}{from === "pdf" ? ` · up to ${subscribed ? "150" : "50"} pages` : ""}</span>
          </button>
        ) : (
          <div className="mt-6 flex items-center gap-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><FileText size={18}/></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{file.name}</p><p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">{formatLabel(from)} · {fileSizeLabel(file.size)}</p></div>
            <button type="button" onClick={() => { setFile(null); resetOutputs(); if (inputRef.current) inputRef.current.value = ""; }} className="grid h-9 w-9 place-items-center rounded-xl text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500" aria-label={`Remove ${file.name}`}><Trash2 size={15}/></button>
          </div>
        )}

        {error && <p className="mt-4 rounded-2xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-700 dark:text-red-200">{error}</p>}
        {success && <p className="mt-4 rounded-2xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-200">{success}</p>}

        <Button type="button" onClick={runConversion} disabled={processing || !file || outputs.length > 0} className="mt-5 w-full">
          {processing
            ? <><Loader2 size={15} className="animate-spin"/> Converting…</>
            : outputs.length > 0
              ? <>Converted — attach another file to convert again</>
              : <>Convert {formatLabel(from)} to {formatLabel(to)}</>}
        </Button>

        {outputs.length > 0 && (
          <div className="mt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><Eyebrow>Ready</Eyebrow><p className="mt-1 text-sm font-black">{outputs.length === 1 ? "Your converted file" : `${outputs.length} converted files`}</p></div>
              {outputs.length > 1 && (
                <button
                  type="button"
                  onClick={downloadAll}
                  disabled={downloadingAll}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 py-2.5 text-xs font-black text-[var(--background)] transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {downloadingAll ? <Loader2 size={14} className="animate-spin"/> : <Archive size={14}/>}
                  {downloadingAll ? "Creating ZIP…" : "Download all (.zip)"}
                </button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {outputs.map((output) => (
                <div key={output.url} className="flex items-center gap-3 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-xs font-black text-[var(--accent-strong)]">{output.name}</span>
                  <a href={output.url} download={output.name} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 py-2 text-xs font-black text-[var(--background)] transition hover:opacity-85">
                    <Download size={14}/> Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function safeBaseName(value: string) {
  return String(value || "converted-file")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "converted-file";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function FormatLine({ from, to }: { from: string; to: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"><span className="font-black text-[var(--text-primary)]">{from}</span><span className="text-right">{to}</span></div>;
}
