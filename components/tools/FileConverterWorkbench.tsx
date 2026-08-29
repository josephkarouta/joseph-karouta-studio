"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, ArrowRightLeft, Download, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
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
  const { usage, loadingUsage, usageError, authorize, complete, fail, syncUsage } = useUtilityUsage("file_converter");
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [from, setFrom] = useState<ConverterFormat>("pdf");
  const [to, setTo] = useState<ConverterFormat>("jpg");
  const [outputs, setOutputs] = useState<PreparedOutput[]>([]);
  const [lastBatchName, setLastBatchName] = useState("converted-files");
  const [processing, setProcessing] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const subscribed = usage.unlimited;
  const maxFileBytes = (subscribed ? 100 : 25) * 1024 * 1024;
  const maxBatchFiles = subscribed ? 20 : 5;
  const targetOptions = CONVERTER_TARGETS[from].map((value) => ({ value, label: formatLabel(value) }));

  useEffect(() => () => outputs.forEach((output) => URL.revokeObjectURL(output.url)), [outputs]);

  function resetOutputs() {
    outputs.forEach((output) => URL.revokeObjectURL(output.url));
    setOutputs([]);
    setSuccess("");
  }

  function clearFiles() {
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function setFromFormat(value: ConverterFormat) {
    setFrom(value);
    const nextTargets = CONVERTER_TARGETS[value];
    if (!nextTargets.includes(to)) setTo(nextTargets[0]);
    clearFiles();
    setError("");
    resetOutputs();
  }

  function setToFormat(value: ConverterFormat) {
    setTo(value);
    setError("");
    resetOutputs();
  }

  function chooseFiles(selected: FileList | File[] | null) {
    if (!selected) return;
    const next = Array.from(selected);
    if (!next.length) return;

    if (next.length > maxBatchFiles) {
      setError(`Attach up to ${maxBatchFiles} files at a time${subscribed ? " with your plan." : " on the Free plan."}`);
      return;
    }

    if (next.some((file) => file.size > maxFileBytes)) {
      setError(`Each file must be ${subscribed ? "100 MB" : "25 MB"} or smaller${subscribed ? "." : " on the Free plan."}`);
      return;
    }

    const detected = next.map((file) => formatFromFile(file));
    if (detected.some((value) => !value)) {
      setError("One or more files are not supported. Use PDF, JPG, JPEG, PNG, WebP, SVG, HEIC, HEIF, BMP or AVIF.");
      return;
    }

    const sourceFormat = detected[0] as ConverterFormat;
    if (detected.some((value) => value !== sourceFormat)) {
      setError("Files in one batch must use the same source format. Convert mixed formats in separate batches.");
      return;
    }

    setFrom(sourceFormat);
    const nextTargets = CONVERTER_TARGETS[sourceFormat];
    if (!nextTargets.includes(to)) setTo(nextTargets[0]);
    setFiles(next);
    setError("");
    resetOutputs();
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setError("");
  }

  async function downloadAll() {
    if (outputs.length < 2) return;
    setDownloadingAll(true);
    setError("");
    try {
      const zip = createBrowserZip(await Promise.all(outputs.map(async (output) => ({
        name: output.name,
        data: await output.blob.arrayBuffer(),
      }))));
      triggerDownload(zip, `${lastBatchName}-${formatLabel(to).toLowerCase()}.zip`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "The ZIP could not be created.");
    } finally {
      setDownloadingAll(false);
    }
  }

  async function runConversion() {
    if (!files.length) {
      setError("Attach at least one file first.");
      return;
    }

    const batch = [...files];
    setProcessing(true);
    setError("");
    resetOutputs();

    const prepared: PreparedOutput[] = [];
    const failures: string[] = [];
    let freeUsed = 0;
    let creditsUsed = 0;
    let subscriberUsed = 0;

    try {
      for (const currentFile of batch) {
        let authorization: Awaited<ReturnType<typeof authorize>> | null = null;
        try {
          authorization = await authorize("convert");
          const result = await convertFile(currentFile, from, to, subscribed ? 150 : 50);
          await complete(
            authorization.operationId,
            {
              operation: "convert",
              from,
              to,
              input_name: currentFile.name,
              input_bytes: currentFile.size,
              output_files: result.length,
            },
            { refresh: false },
          );

          prepared.push(...result.map((output) => ({ ...output, url: URL.createObjectURL(output.blob) })));
          if (authorization.chargeType === "subscriber") subscriberUsed += 1;
          else if (authorization.chargeType === "free") freeUsed += 1;
          else creditsUsed += authorization.creditsReserved || 1;
        } catch (conversionError) {
          const message = conversionError instanceof Error ? conversionError.message : "The file could not be converted.";
          if (authorization?.operationId) await fail(authorization.operationId, message, { refresh: false });
          failures.push(`${currentFile.name}: ${message}`);

          if (!authorization) {
            // Authorization failures such as insufficient credits affect the
            // rest of the batch too, so stop rather than repeating the error.
            break;
          }
        }
      }
    } finally {
      await syncUsage();
      setProcessing(false);
    }

    if (prepared.length) {
      setOutputs(prepared);
      setLastBatchName(batch.length === 1 ? safeBaseName(batch[0].name) : `heyy-studio-${batch.length}-file-batch`);
      clearFiles();

      const parts: string[] = [];
      if (subscriberUsed) parts.push(`${subscriberUsed} included with your plan`);
      if (freeUsed) parts.push(`${freeUsed} free use${freeUsed === 1 ? "" : "s"}`);
      if (creditsUsed) parts.push(`${creditsUsed} credit${creditsUsed === 1 ? "" : "s"} used`);
      setSuccess(`Done — ${prepared.length === 1 ? "your file is ready" : `${prepared.length} converted outputs are ready`}${parts.length ? `. ${parts.join(" · ")}.` : "."}`);
    }

    if (failures.length) {
      setError(`${failures.length} file${failures.length === 1 ? "" : "s"} could not be converted. ${failures[0]}`);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
      <div className="space-y-5">
        <UtilityUsageCard
          unlimited={usage.unlimited}
          plan={usage.plan}
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
          <div><Eyebrow>Convert files</Eyebrow><h2 className="mt-2 text-3xl font-black tracking-[-.05em]">Choose a format and attach your files.</h2></div>
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
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.svg,.heic,.heif,.bmp,.avif,application/pdf,image/jpeg,image/png,image/webp,image/svg+xml,image/heic,image/heif,image/bmp,image/avif"
          className="hidden"
          onChange={(event) => chooseFiles(event.target.files)}
        />

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
            chooseFiles(event.dataTransfer.files);
          }}
          className={`mt-6 flex min-h-40 w-full flex-col items-center justify-center rounded-[1.7rem] border border-dashed px-6 text-center transition ${dragActive ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_0_3px_var(--accent-soft)]" : "border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"}`}
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Paperclip size={19}/></span>
          <span className="mt-4 text-base font-black">{dragActive ? "Drop your files here" : `Attach or drag & drop up to ${maxBatchFiles} ${formatLabel(from)} files`}</span>
          <span className="mt-1 text-xs font-semibold text-[var(--text-muted)]">Maximum {subscribed ? "100 MB" : "25 MB"} each{from === "pdf" ? ` · up to ${subscribed ? "150" : "50"} pages per PDF` : ""}</span>
        </button>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs font-bold text-[var(--text-muted)]">
              <span>{files.length} of {maxBatchFiles} files attached</span>
              <button type="button" onClick={clearFiles} className="font-black text-[var(--accent-strong)] hover:underline">Remove all</button>
            </div>
            {files.map((file, index) => (
              <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><FileText size={17}/></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{file.name}</p><p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">{formatLabel(from)} · {fileSizeLabel(file.size)}</p></div>
                <button type="button" onClick={() => removeFile(index)} className="grid h-9 w-9 place-items-center rounded-xl text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500" aria-label={`Remove ${file.name}`}><Trash2 size={15}/></button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-4 rounded-2xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-700 dark:text-red-200">{error}</p>}
        {success && <p className="mt-4 rounded-2xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-200">{success}</p>}

        <Button type="button" onClick={runConversion} disabled={processing || !files.length} className="mt-5 w-full">
          {processing
            ? <><Loader2 size={15} className="animate-spin"/> Converting {files.length > 1 ? `${files.length} files…` : "…"}</>
            : files.length
              ? <>Convert {files.length > 1 ? `${files.length} files` : `${formatLabel(from)} to ${formatLabel(to)}`}</>
              : <>Attach files to convert</>}
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
            <p className="mt-2 text-xs font-semibold text-[var(--text-muted)]">Your source files were cleared automatically. Attach the next batch above whenever you’re ready.</p>
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
