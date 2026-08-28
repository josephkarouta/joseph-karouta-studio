"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileText,
  Files,
  Loader2,
  LockKeyhole,
  LockOpen,
  Minimize2,
  Paperclip,
  Scissors,
  Trash2,
} from "lucide-react";
import { Button, Eyebrow, GlassCard } from "@/components/ui/heyy";
import UtilityUsageCard from "@/components/tools/UtilityUsageCard";
import { useUtilityUsage } from "@/hooks/use-utility-usage";
import {
  fileSizeLabel,
  processPdfOperation,
  type OutputFile,
  type PdfOperation,
} from "@/lib/tools/browser-document-utils";

type PreparedOutput = OutputFile & { url: string };

const OPERATIONS: Array<{
  id: PdfOperation;
  label: string;
  description: string;
  icon: typeof FileText;
}> = [
  { id: "compress", label: "Compress", description: "Reduce PDF size for easier sharing.", icon: Minimize2 },
  { id: "split", label: "Split", description: "Extract selected pages into a new PDF.", icon: Scissors },
  { id: "merge", label: "Combine", description: "Merge multiple PDFs into one document.", icon: Files },
  { id: "unlock", label: "Unlock", description: "Remove a password when you know the current password.", icon: LockOpen },
  { id: "protect", label: "Protect", description: "Create a password-protected PDF.", icon: LockKeyhole },
];

export default function PdfToolsWorkbench() {
  const { usage, loadingUsage, usageError, authorize, complete, fail } = useUtilityUsage("pdf_tools");
  const inputRef = useRef<HTMLInputElement>(null);
  const [operation, setOperation] = useState<PdfOperation>("compress");
  const [files, setFiles] = useState<File[]>([]);
  const [pageSelection, setPageSelection] = useState("1");
  const [sourcePassword, setSourcePassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [outputs, setOutputs] = useState<PreparedOutput[]>([]);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const subscribed = usage.unlimited;
  const maxFileBytes = (subscribed ? 100 : 25) * 1024 * 1024;
  const maxMergeFiles = subscribed ? 20 : 10;

  useEffect(() => () => outputs.forEach((output) => URL.revokeObjectURL(output.url)), [outputs]);

  function resetOutputs() {
    outputs.forEach((output) => URL.revokeObjectURL(output.url));
    setOutputs([]);
    setSuccess("");
  }

  function chooseFiles(selected: FileList | File[] | null) {
    if (!selected) return;
    const next = Array.from(selected);
    if (!next.length) return;
    if (next.some((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
      setError("Attach PDF files only.");
      return;
    }
    if (next.some((file) => file.size > maxFileBytes)) {
      setError(`Each PDF must be ${subscribed ? "100 MB" : "25 MB"} or smaller${subscribed ? "." : " on the Free plan."}`);
      return;
    }
    if (operation !== "merge" && next.length > 1) {
      setFiles([next[0]]);
    } else {
      setFiles(next.slice(0, maxMergeFiles));
    }
    setError("");
    resetOutputs();
  }

  function changeOperation(next: PdfOperation) {
    setOperation(next);
    setFiles([]);
    setError("");
    resetOutputs();
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    resetOutputs();
  }

  async function runOperation() {
    if (!files.length) {
      setError(operation === "merge" ? "Attach at least two PDFs to combine." : "Attach a PDF first.");
      return;
    }
    if (operation === "merge" && files.length < 2) {
      setError("Attach at least two PDFs to combine.");
      return;
    }

    setProcessing(true);
    setError("");
    resetOutputs();
    let authorization: Awaited<ReturnType<typeof authorize>> | null = null;

    try {
      authorization = await authorize(operation);
      const result = await processPdfOperation({
        operation,
        files,
        pageSelection,
        sourcePassword,
        newPassword,
        maxPages: subscribed ? 150 : 50,
      });

      await complete(authorization.operationId, {
        operation,
        input_files: files.length,
        output_files: result.length,
        input_bytes: files.reduce((total, file) => total + file.size, 0),
      });

      const prepared = result.map((output) => ({ ...output, url: URL.createObjectURL(output.blob) }));
      setOutputs(prepared);
      setSuccess(
        authorization.chargeType === "subscriber"
          ? "Done — included with your plan."
          : authorization.chargeType === "free"
            ? "Done — this used one of today’s free PDF operations."
            : "Done — 1 credit used.",
      );
    } catch (operationError) {
      const message = operationError instanceof Error ? operationError.message : "The PDF could not be processed.";
      if (authorization?.operationId) await fail(authorization.operationId, message);
      setError(message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
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
          <Eyebrow>Choose an action</Eyebrow>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {OPERATIONS.map(({ id, label, description, icon: Icon }) => {
              const active = operation === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => changeOperation(id)}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${active ? "border-[var(--accent-border)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent-border)]"}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-strong)] text-[var(--accent-strong)]"><Icon size={16}/></span>
                  <span><span className="block text-sm font-black">{label}</span><span className="mt-1 block text-xs font-semibold leading-5 text-[var(--text-secondary)]">{description}</span></span>
                </button>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><Eyebrow>{OPERATIONS.find((item) => item.id === operation)?.label}</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Attach your PDF{operation === "merge" ? "s" : ""}</h2></div>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[.64rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">No storage</span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple={operation === "merge"}
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
          className={`mt-5 flex min-h-32 w-full flex-col items-center justify-center rounded-2xl border border-dashed px-5 text-center transition ${dragActive ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_0_3px_var(--accent-soft)]" : "border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"}`}
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Paperclip size={18}/></span>
          <span className="mt-3 text-sm font-black">{dragActive ? "Drop your PDF here" : operation === "merge" ? "Attach or drag & drop PDF files" : "Attach or drag & drop a PDF"}</span>
          <span className="mt-1 text-xs font-semibold text-[var(--text-muted)]">Up to {subscribed ? "100 MB" : "25 MB"} per file · up to {subscribed ? "150" : "50"} PDF pages{operation === "merge" ? ` total · max ${maxMergeFiles} PDFs` : ""}</span>
        </button>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file, index) => (
              <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--surface-strong)] text-[var(--accent-strong)]"><FileText size={16}/></span>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{file.name}</p><p className="mt-1 text-[.66rem] font-semibold text-[var(--text-muted)]">{fileSizeLabel(file.size)}</p></div>
                <button type="button" onClick={() => removeFile(index)} className="grid h-8 w-8 place-items-center rounded-xl text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500" aria-label={`Remove ${file.name}`}><Trash2 size={14}/></button>
              </div>
            ))}
          </div>
        )}

        {operation === "split" && (
          <label className="mt-5 block">
            <span className="text-xs font-black">Pages to keep</span>
            <span className="ml-2 text-[.66rem] font-semibold text-[var(--text-muted)]">Examples: 1-3 or 1,3,5-8</span>
            <input value={pageSelection} onChange={(event) => setPageSelection(event.target.value)} className="heyy-input mt-2" placeholder="1-3" />
          </label>
        )}
        {operation === "unlock" && (
          <label className="mt-5 block">
            <span className="text-xs font-black">Current password</span>
            <input type="password" value={sourcePassword} onChange={(event) => setSourcePassword(event.target.value)} className="heyy-input mt-2" placeholder="Enter the PDF password" autoComplete="off" />
          </label>
        )}
        {operation === "protect" && (
          <label className="mt-5 block">
            <span className="text-xs font-black">New password</span>
            <span className="ml-2 text-[.66rem] font-semibold text-[var(--text-muted)]">At least 4 characters. Heyy Studio does not save this password.</span>
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="heyy-input mt-2" placeholder="Create a password" autoComplete="new-password" />
          </label>
        )}

        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[.68rem] font-semibold leading-5 text-[var(--text-muted)]">
          PDF Tools preserves the visual appearance of pages. Interactive forms, links and editable PDF layers may be flattened in the processed copy.
        </div>

        {error && <p className="mt-4 rounded-2xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-700 dark:text-red-200">{error}</p>}
        {success && <p className="mt-4 rounded-2xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-200">{success}</p>}

        <Button type="button" onClick={runOperation} disabled={processing || !files.length || outputs.length > 0} className="mt-5 w-full">
          {processing
            ? <><Loader2 size={15} className="animate-spin"/> Processing securely…</>
            : outputs.length > 0
              ? <>Processed — attach another PDF to process again</>
              : <>Process PDF</>}
        </Button>

        {outputs.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-black uppercase tracking-[.13em] text-[var(--text-muted)]">Ready to download</p>
            {outputs.map((output) => (
              <div key={output.url} className="flex items-center gap-3 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-sm font-black text-[var(--accent-strong)]">{output.name}</span>
                <a href={output.url} download={output.name} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 py-2 text-xs font-black text-[var(--background)] transition hover:opacity-85">
                  <Download size={14}/> Download
                </a>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
