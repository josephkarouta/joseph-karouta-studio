"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  Check,
  Download,
  FileImage,
  ImagePlus,
  LayoutGrid,
  Loader2,
  Maximize2,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button, CreditPill, Eyebrow, GlassCard, cx } from "@/components/ui/heyy";
import {
  DIGITAL_ADAPTATION_PRESETS,
  familyForDimensions,
  type DigitalAdaptationFormat,
  uniqueFamilies,
} from "@/lib/tools/digital-adaptations";
import { CREDIT_COSTS } from "@/lib/credits/config";
import { generationFetch } from "@/lib/client/generation-request";

type AdaptationOutput = DigitalAdaptationFormat & {
  fileName: string;
  imageUrl: string;
  asset?: { id?: string };
};

type AdaptationResult = {
  outputs: AdaptationOutput[];
  creditsUsed: number;
  reviewNote: string;
};

const starterSelection = new Set([
  "instagram-square",
  "instagram-portrait",
  "instagram-story",
  "website-hero",
]);

export default function DigitalAdaptationsWorkbench() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { refreshAccount } = useAuth();
  const [source, setSource] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState("");
  const [projectName, setProjectName] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(starterSelection);
  const [customFormats, setCustomFormats] = useState<DigitalAdaptationFormat[]>([]);
  const [customWidth, setCustomWidth] = useState("1080");
  const [customHeight, setCustomHeight] = useState("1080");
  const [loading, setLoading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AdaptationResult | null>(null);

  useEffect(() => {
    if (!source) {
      setSourcePreview("");
      return;
    }
    const url = URL.createObjectURL(source);
    setSourcePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  const allFormats = useMemo(
    () => [
      ...DIGITAL_ADAPTATION_PRESETS,
      ...customFormats.map((format) => ({ ...format, category: "Custom" as const })),
    ],
    [customFormats],
  );

  const selectedFormats = useMemo(
    () => allFormats.filter((format) => selectedIds.has(format.id)),
    [allFormats, selectedIds],
  );
  const familyCount = uniqueFamilies(selectedFormats).length;
  const creditCost = familyCount * CREDIT_COSTS.digitalAdaptationFamily;

  function chooseSource(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setError("");
    setResult(null);
    if (!file) return setSource(null);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setSource(null);
      setError("Use a PNG, JPG or WebP key visual.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setSource(null);
      setError("The key visual must be 4 MB or smaller.");
      return;
    }
    setSource(file);
    if (!projectName.trim()) setProjectName(file.name.replace(/\.[^.]+$/, ""));
  }

  function toggleFormat(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResult(null);
  }

  function selectCategory(category: string) {
    const ids = allFormats.filter((format) => format.category === category).map((format) => format.id);
    setSelectedIds((current) => {
      const next = new Set(current);
      const everySelected = ids.every((id) => next.has(id));
      ids.forEach((id) => (everySelected ? next.delete(id) : next.add(id)));
      return next;
    });
    setResult(null);
  }

  function addCustomFormat() {
    const width = Number(customWidth);
    const height = Number(customHeight);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 100 || height < 100 || width > 5000 || height > 5000) {
      setError("Custom sizes must be between 100 and 5,000 pixels.");
      return;
    }
    const id = `custom-${width}x${height}-${Date.now()}`;
    const format: DigitalAdaptationFormat = {
      id,
      label: `Custom ${width} × ${height}`,
      platform: "Custom",
      width,
      height,
      family: familyForDimensions(width, height),
    };
    setCustomFormats((current) => [...current, format]);
    setSelectedIds((current) => new Set(current).add(id));
    setError("");
  }

  function removeCustomFormat(id: string) {
    setCustomFormats((current) => current.filter((format) => format.id !== id));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  async function generate() {
    if (!source) return setError("Upload the main key visual first.");
    if (!selectedFormats.length) return setError("Select at least one digital size.");
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const form = new FormData();
      form.set("source", source);
      form.set("notes", notes);
      form.set("projectName", projectName.trim() || "Digital campaign");
      form.set("projectId", new URLSearchParams(window.location.search).get("project") || "");
      form.set("formats", JSON.stringify(selectedFormats.map(({ id, label, platform, width, height, family }) => ({ id, label, platform, width, height, family }))));

      const response = await generationFetch("/api/tools/digital-adaptations/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }, {
        scope: "digital-adaptations",
        payload: {
          source: { name: source.name, size: source.size, lastModified: source.lastModified },
          notes,
          projectName: projectName.trim() || "Digital campaign",
          formats: selectedFormats.map(({ id, width, height, family }) => ({ id, width, height, family })),
        },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Digital adaptations failed.");
      setResult(payload);
      await refreshAccount();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Digital adaptations failed.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadOutput(output: AdaptationOutput) {
    try {
      const response = await fetch(output.imageUrl);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = output.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      const anchor = document.createElement("a");
      anchor.href = output.imageUrl;
      anchor.download = output.fileName;
      anchor.rel = "noreferrer";
      anchor.click();
    }
  }

  async function downloadAll() {
    if (!result?.outputs.length) return;
    setDownloadingAll(true);
    for (const output of result.outputs) {
      await downloadOutput(output);
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    setDownloadingAll(false);
  }

  const categories = ["Social", "Web", "Display", ...(customFormats.length ? ["Custom"] : [])];

  return (
    <div className="grid gap-5 xl:grid-cols-[.92fr_1.08fr]">
      <div className="space-y-5">
        <GlassCard className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Eyebrow>01 · Main artwork</Eyebrow>
              <h2 className="mt-3 text-2xl font-black tracking-[-.045em]">Upload the approved key visual</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">Use the finished campaign artwork with its real logo, typography and mandatory elements.</p>
            </div>
            <FileImage className="shrink-0 text-[var(--accent-strong)]" size={24} />
          </div>

          <label className="mt-5 grid min-h-48 cursor-pointer place-items-center overflow-hidden rounded-[1.5rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-hover)] text-center transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
            {sourcePreview ? (
              <img src={sourcePreview} alt="Uploaded key visual" className="max-h-72 w-full object-contain" />
            ) : (
              <div className="p-8">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--surface-strong)] text-[var(--accent-strong)] shadow-sm"><ImagePlus size={23} /></span>
                <p className="mt-4 text-sm font-black">Choose the main key visual</p>
                <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">PNG, JPG or WebP · maximum 4 MB</p>
              </div>
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={chooseSource} />
          </label>

          <label className="mt-5 block text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Campaign or asset name</label>
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} className="heyy-form-field mt-2" placeholder="e.g. Summer Launch Key Visual" />
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Eyebrow>02 · Art direction</Eyebrow>
              <h2 className="mt-3 text-2xl font-black tracking-[-.045em]">Guide the AI recomposition</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">AI automatically repositions and extends the approved key visual for every selected aspect family.</p>
            </div>
            <Sparkles className="shrink-0 text-[var(--accent-strong)]" size={24} />
          </div>
          <div className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-500/10 p-4 text-xs font-bold leading-5 text-amber-800 dark:text-amber-100">
            Review every result before publishing. Small typography, logos or mandatory elements may need final production checking.
          </div>
          <label className="mt-5 block text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Art-direction notes</label>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="heyy-form-field mt-2 resize-y" placeholder="Keep the product on the right, protect the headline area, maintain the existing CTA..." />
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><Eyebrow>03 · Digital sizes</Eyebrow><h2 className="mt-3 text-2xl font-black tracking-[-.045em]">Choose the required outputs</h2></div>
            <button type="button" onClick={() => setSelectedIds(selectedIds.size === allFormats.length ? new Set() : new Set(allFormats.map((format) => format.id)))} className="text-xs font-black text-[var(--accent-strong)] hover:underline">{selectedIds.size === allFormats.length ? "Clear all" : "Select all"}</button>
          </div>

          <div className="mt-5 space-y-5">
            {categories.map((category) => {
              const formats = allFormats.filter((format) => format.category === category);
              return (
                <section key={category}>
                  <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">{category}</h3><button type="button" onClick={() => selectCategory(category)} className="text-[.65rem] font-black text-[var(--accent-strong)] hover:underline">Toggle group</button></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {formats.map((format) => {
                      const selected = selectedIds.has(format.id);
                      return (
                        <div key={format.id} className={cx("flex items-center gap-3 rounded-2xl border p-3 transition", selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]")}>
                          <button type="button" onClick={() => toggleFormat(format.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg border", selected ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-strong)] bg-[var(--surface-strong)] text-transparent")}><Check size={14}/></span>
                            <span className="min-w-0"><strong className="block truncate text-xs font-black">{format.label}</strong><span className="mt-1 block text-[.65rem] font-semibold text-[var(--text-muted)]">{format.width} × {format.height} · {format.platform}</span></span>
                          </button>
                          {category === "Custom" && <button type="button" onClick={() => removeCustomFormat(format.id)} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600" aria-label={`Remove ${format.label}`}><Trash2 size={14}/></button>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-hover)] p-4">
            <div className="flex items-center gap-2"><Plus size={15} className="text-[var(--accent-strong)]"/><h3 className="text-xs font-black">Add a custom digital size</h3></div>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
              <input inputMode="numeric" value={customWidth} onChange={(event) => setCustomWidth(event.target.value.replace(/\D/g, ""))} className="heyy-form-field min-w-0" aria-label="Custom width" />
              <span className="text-xs font-black text-[var(--text-muted)]">×</span>
              <input inputMode="numeric" value={customHeight} onChange={(event) => setCustomHeight(event.target.value.replace(/\D/g, ""))} className="heyy-form-field min-w-0" aria-label="Custom height" />
              <Button variant="ghost" onClick={addCustomFormat}><Plus size={15}/> Add</Button>
            </div>
          </div>

          {error && <div className="mt-5 flex gap-3 rounded-2xl border border-red-300/60 bg-red-500/10 p-4 text-sm font-bold text-red-700 dark:text-red-200"><AlertCircle size={18} className="shrink-0"/>{error}</div>}

          <Button className="mt-6 w-full" size="lg" onClick={() => void generate()} disabled={loading || !source || !selectedFormats.length}>
            {loading ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} {loading ? "Creating adaptations…" : `Create ${selectedFormats.length} adaptation${selectedFormats.length === 1 ? "" : "s"} · ${creditCost} credits`}
          </Button>
          <p className="mt-3 text-center text-[.65rem] font-semibold text-[var(--text-muted)]">Credits are charged once per required aspect family, not once per individual output size.</p>
        </GlassCard>
      </div>

      <GlassCard className="min-h-[780px] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 px-1 pb-4">
          <div><Eyebrow>Adaptation output</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-[-.045em]">Digital campaign pack</h2><p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">Every result is saved as an individual project asset.</p></div>
          {result && <div className="flex items-center gap-2"><CreditPill credits={result.creditsUsed}/><Button variant="ghost" onClick={() => void downloadAll()} disabled={downloadingAll}>{downloadingAll ? <Loader2 size={15} className="animate-spin"/> : <Download size={15}/>} Download all</Button></div>}
        </div>

        {loading ? (
          <div className="grid min-h-[680px] place-items-center rounded-[1.5rem] border border-dashed border-[var(--border-strong)] bg-[linear-gradient(135deg,var(--surface-hover),rgba(124,58,237,.08))] p-8 text-center">
            <div><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--surface-strong)] shadow-lg"><Loader2 size={25} className="animate-spin text-[var(--accent-strong)]"/></span><p className="mt-4 text-sm font-black">Adapting your campaign artwork</p><p className="mt-1 max-w-sm text-xs font-semibold leading-5 text-[var(--text-muted)]">Creating the required aspect compositions, exporting exact pixel sizes and saving the files.</p></div>
          </div>
        ) : result ? (
          <div>
            <div className="mb-4 flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)] p-4 text-xs font-bold leading-5 text-[var(--text-secondary)]"><ShieldCheck size={18} className="shrink-0 text-emerald-600"/>{result.reviewNote}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              {result.outputs.map((output) => (
                <article key={`${output.id}-${output.width}x${output.height}`} className="overflow-hidden rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                  <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-[var(--surface-hover)]"><img src={output.imageUrl} alt={output.label} className="h-full w-full object-contain"/></div>
                  <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-black">{output.label}</h3><p className="mt-1 text-[.68rem] font-bold text-[var(--text-muted)]">{output.width} × {output.height} · {output.platform}</p></div><button type="button" onClick={() => void downloadOutput(output)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface-strong)] text-[var(--accent-strong)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]" aria-label={`Download ${output.label}`}><Download size={16}/></button></div></div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid min-h-[680px] place-items-center rounded-[1.5rem] border border-dashed border-[var(--border-strong)] bg-[linear-gradient(135deg,var(--surface-hover),rgba(124,58,237,.08))] p-8 text-center">
            <div className="max-w-sm"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--surface-strong)] text-[var(--accent-strong)] shadow-sm"><LayoutGrid size={25}/></span><h3 className="mt-4 text-xl font-black">Your complete size pack appears here</h3><p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">Upload the approved KV, add any art-direction notes and choose the digital sizes. AI will intelligently recompose the artwork for each required aspect family.</p><div className="mt-5 flex items-center justify-center gap-2 text-xs font-black text-[var(--text-muted)]"><Maximize2 size={15}/> Exact pixel exports</div></div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
