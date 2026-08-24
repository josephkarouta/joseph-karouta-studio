"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  ImageIcon,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Save,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import StudioAccessGate from "@/components/studio-access-gate";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { GuidedStudioConfig, StudioField } from "@/lib/studio/generic-config";
import { Button, ButtonLink, CreditPill, Eyebrow, GlassCard, PageContainer, StatusPill, cx } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";
import { generationFetch } from "@/lib/client/generation-request";

type FormState = Record<string, string | string[]>;
type ResultData = Record<string, unknown> & { visualPrompt?: string; expertNotes?: string[] };

export default function GuidedStudio({ config }: { config: GuidedStudioConfig }) {
  return (
    <StudioAccessGate path={`/${config.id}-studio`}>
      <SiteHeader />
      <WorkspaceShell>
        <StudioExperience config={config} />
        <SiteFooter />
      </WorkspaceShell>
    </StudioAccessGate>
  );
}

function StudioExperience({ config }: { config: GuidedStudioConfig }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, refreshAccount } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => initialState(config));
  const [result, setResult] = useState<ResultData | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState("");

  const studioStyle = {
    "--accent": config.accent,
    "--accent-strong": config.accent,
    "--accent-soft": config.soft,
    "--accent-border": `color-mix(in srgb, ${config.accent} 52%, transparent)`,
    "--button-primary": config.accent,
    "--button-primary-hover": `color-mix(in srgb, ${config.accent} 84%, black)`,
    "--focus-ring": `color-mix(in srgb, ${config.accent} 25%, transparent)`,
  } as CSSProperties;

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("project");
    if (!id || !user) return;
    void (async () => {
      const { data } = await supabase.from("studio_projects").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (!data) return;
      setProjectId(String(data.id));
      setForm({ ...initialState(config), ...(data.input || {}) });
      setResult((data.output || null) as ResultData | null);
      setStep(data.output ? config.steps.length : 0);
    })();
  }, [config, supabase, user]);

  const allFields = config.steps.flatMap((item) => item.fields);
  const requiredMissing = config.steps[step]?.fields.filter((field) => field.required && isEmpty(form[field.id])) || [];
  const completedInputs = allFields.filter((field) => !isEmpty(form[field.id])).length;
  const progress = result ? 100 : Math.round(((step + completedInputs / Math.max(1, allFields.length)) / (config.steps.length + 1)) * 100);

  function updateField(id: string, value: string | string[]) {
    setForm((current) => ({ ...current, [id]: value }));
    setError("");
  }

  function nextStep() {
    if (requiredMissing.length) {
      setError(`Complete ${requiredMissing.map((field) => field.label.toLowerCase()).join(", ")} before continuing.`);
      return;
    }
    setStep((current) => Math.min(config.steps.length, current + 1));
  }

  async function generate() {
    const missing = allFields.filter((field) => field.required && isEmpty(form[field.id]));
    if (missing.length) {
      setError(`Complete ${missing.map((field) => field.label.toLowerCase()).join(", ")} before generating.`);
      setStep(Math.max(0, config.steps.findIndex((section) => section.fields.some((field) => missing.some((item) => item.id === field.id)))));
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await generationFetch(`/api/studios/${config.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input: form, projectId }),
      }, {
        scope: `guided-studio:${config.id}`,
        payload: { input: form, projectId },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed.");
      setResult(data.output);
      setProjectId(data.project?.id || projectId);
      setStep(config.steps.length);
      await refreshAccount();
      const newUrl = new URL(window.location.href);
      if (data.project?.id) newUrl.searchParams.set("project", data.project.id);
      window.history.replaceState({}, "", newUrl);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function requestProduction() {
    if (!user || !projectId || !result) return;
    setRequesting(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/studio-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          notes: `Please quote professional production for this ${config.title} concept.`,
          project_brief: JSON.stringify({ input: form, output: result }),
          metadata: {
            project_id: projectId,
            project_name: String(form[config.projectNameField] || config.title),
            studio: config.databaseId,
            service: config.productionService,
            service_id: config.productionServiceId,
            source: "v13_guided_studio",
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send the production request.");
      setRequestSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send the request.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <main className="heyy-page min-h-screen py-8 sm:py-10" style={studioStyle}>
      <PageContainer>
        <section className="relative overflow-hidden rounded-[2rem] border p-6 shadow-[var(--shadow-card)] sm:p-9" style={{ borderColor: `${config.accent}55`, background: `linear-gradient(120deg,${config.soft},var(--surface-strong),${config.soft})` }}>
          <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full border-[34px] border-white/20" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <Eyebrow style={{ color: config.accent }}>{config.eyebrow}</Eyebrow>
              <h1 className="mt-4 text-4xl font-black leading-[.94] tracking-[-.06em] sm:text-6xl">{config.title}</h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)] sm:text-base">{config.description}</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 backdrop-blur-xl">
              <CreditPill credits={config.creditCost} />
              <span className="text-xs font-bold text-[var(--text-secondary)]">for the concept plan</span>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div>
            <GlassCard className="p-3 sm:p-4">
              <div className="grid gap-2 sm:grid-cols-4">
                {[...config.steps.map((item) => item.title), "Your concept"].map((title, index) => {
                  const active = index === step;
                  const complete = index < step || Boolean(result && index === config.steps.length);
                  return (
                    <button
                      key={title}
                      type="button"
                      onClick={() => { if (!generating && (index <= step || result)) setStep(index); }}
                      className={cx("flex min-h-14 items-center gap-3 rounded-2xl border px-3 text-left transition", active ? "border-[var(--accent-border)] bg-[var(--accent-soft)]" : "border-transparent hover:bg-[var(--surface-hover)]", index > step && !result && "cursor-default opacity-55", generating && "cursor-wait")}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black" style={{ background: complete || active ? config.accent : "var(--surface-hover)", color: complete || active ? "white" : "var(--text-muted)" }}>{complete ? <Check size={14}/> : index + 1}</span>
                      <span className="hidden min-w-0 text-xs font-black sm:block">{title}</span>
                    </button>
                  );
                })}
              </div>
            </GlassCard>

            <GlassCard className="mt-5 p-5 sm:p-7">
              {step < config.steps.length ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><Eyebrow>Step {step + 1} of {config.steps.length}</Eyebrow><h2 className="mt-3 text-3xl font-black tracking-[-.05em]">{config.steps[step].title}</h2><p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">{config.steps[step].description}</p></div>
                    <StatusPill tone="info">{progress}% complete</StatusPill>
                  </div>
                  <div className="mt-7 grid gap-5 md:grid-cols-2">
                    {config.steps[step].fields.map((field) => <FieldControl key={field.id} field={field} value={form[field.id]} tone={studioSelectTone(config.id)} onChange={(value) => updateField(field.id, value)} />)}
                  </div>
                  {generating && <GenerationLoading config={config} />}
                  {error && <ErrorBanner message={error} />}
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
                    <Button type="button" variant="secondary" disabled={step === 0 || generating} onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft size={15}/> Back</Button>
                    {step === config.steps.length - 1 ? (
                      <Button type="button" onClick={() => void generate()} disabled={generating}>{generating ? <Loader2 size={15} className="animate-spin"/> : <Sparkles size={15}/>} {generating ? "Generating concept…" : `Generate concept · ${config.creditCost} credits`}</Button>
                    ) : <Button type="button" onClick={nextStep} disabled={generating}>Continue <ArrowRight size={15}/></Button>}
                  </div>
                </>
              ) : result ? (
                <ResultView config={config} result={result} projectId={projectId} onRegenerate={() => void generate()} generating={generating} onRequest={() => void requestProduction()} requesting={requesting} requestSent={requestSent} error={error} />
              ) : (
                <div className="py-12 text-center"><WandSparkles size={30} className="mx-auto text-[var(--accent-strong)]"/><h2 className="mt-4 text-2xl font-black">Ready to create your concept</h2><p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-[var(--text-secondary)]">Review the brief in the sidebar, then generate a structured project direction.</p><Button className="mt-6" onClick={() => void generate()} disabled={generating}>{generating ? <Loader2 className="animate-spin" size={15}/> : <Sparkles size={15}/>} Generate · {config.creditCost} credits</Button>{error && <ErrorBanner message={error}/>}</div>
              )}
            </GlassCard>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-[calc(var(--header-height)+20px)] xl:self-start">
            <GlassCard className="overflow-hidden p-0">
              <div className="p-5 text-white" style={{ background: `linear-gradient(135deg,${config.accent},color-mix(in srgb, ${config.accent} 72%, black))` }}><p className="text-[.6rem] font-black uppercase tracking-[.17em] text-white/70">Project summary</p><h3 className="mt-2 truncate text-xl font-black">{String(form[config.projectNameField] || "Untitled project")}</h3><p className="mt-1 text-xs font-semibold text-white/70">{String(form[config.projectTypeField] || config.title)}</p></div>
              <div className="p-5">
                <div className="flex items-center justify-between text-xs font-black"><span>Brief progress</span><span style={{ color: config.accent }}>{progress}%</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: `linear-gradient(90deg,${config.accent},color-mix(in srgb, ${config.accent} 72%, white))` }}/></div>
                <div className="mt-5 space-y-2">{allFields.filter((field) => !isEmpty(form[field.id])).slice(0, 7).map((field) => <div key={field.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"><p className="text-[.55rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">{field.label}</p><p className="mt-1 line-clamp-2 text-xs font-bold text-[var(--text-primary)]">{Array.isArray(form[field.id]) ? (form[field.id] as string[]).join(", ") : String(form[field.id])}</p></div>)}</div>
              </div>
            </GlassCard>
            <GlassCard className="p-5"><p className="text-[.6rem] font-black uppercase tracking-[.16em] text-amber-600">Concept-only guidance</p><p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{config.disclaimer}</p></GlassCard>
          </aside>
        </div>
      </PageContainer>
    </main>
  );
}

function FieldControl({ field, value, tone, onChange }: { field: StudioField; value: string | string[] | undefined; tone: "default" | "brand" | "architecture" | "interior" | "marketing"; onChange: (value: string | string[]) => void }) {
  const fullWidth = field.type === "textarea" || field.type === "multiselect";
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}>
      <label className="text-[.65rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">{field.label}{field.required && <span className="ml-1 text-[var(--accent-strong)]">*</span>}</label>
      {field.helper && <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">{field.helper}</p>}
      {field.type === "textarea" ? (
        <textarea value={String(value || "")} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} rows={4} className="heyy-form-field mt-2 resize-y" />
      ) : field.type === "select" ? (
        <div className="mt-2"><HeyySelect value={String(value || "")} tone={tone} ariaLabel={field.label} placeholder="Select an option" options={field.options || []} onChange={(next) => onChange(next)}/></div>
      ) : field.type === "multiselect" ? (
        <div className="mt-3 flex flex-wrap gap-2">{field.options?.map((option) => { const current = Array.isArray(value) ? value : []; const active = current.includes(option); return <button key={option} type="button" onClick={() => onChange(active ? current.filter((item) => item !== option) : [...current, option])} className={cx("rounded-full border px-3.5 py-2 text-xs font-black transition", active ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]")}>{active && <Check size={12} className="mr-1 inline"/>}{option}</button>; })}</div>
      ) : <input value={String(value || "")} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} className="heyy-form-field mt-2" />}
    </div>
  );
}

function studioSelectTone(id: string): "default" | "brand" | "architecture" | "interior" | "marketing" {
  if (id.includes("interior")) return "interior";
  if (id.includes("marketing")) return "marketing";
  if (id.includes("architecture")) return "architecture";
  if (id.includes("brand")) return "brand";
  return "default";
}

function ResultView({ config, result, projectId, onRegenerate, generating, onRequest, requesting, requestSent, error }: { config: GuidedStudioConfig; result: ResultData; projectId: string | null; onRegenerate: () => void; generating: boolean; onRequest: () => void; requesting: boolean; requestSent: boolean; error: string }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><Eyebrow>Your generated direction</Eyebrow><h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Concept plan ready</h2><p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">Review, refine and decide whether to create a visual or request expert production.</p></div><StatusPill tone="success"><CheckCircle2 size={12} className="mr-1"/> Saved</StatusPill></div>
      <div className="mt-7 grid gap-4 md:grid-cols-2">{config.resultSections.map((section) => <ResultCard key={section.key} title={section.title} description={section.description} value={result[section.key]} accent={config.accent} />)}</div>
      {result.visualPrompt && <GlassCard className="mt-4 border-[var(--accent-border)] bg-[var(--accent-soft)] p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-strong)] text-[var(--accent-strong)]"><ImageIcon size={17}/></span><div><p className="text-xs font-black">Visual direction prompt</p><p className="mt-2 text-xs font-semibold leading-6 text-[var(--text-secondary)]">{String(result.visualPrompt)}</p><Link href={`/tools/text-to-image?prompt=${encodeURIComponent(String(result.visualPrompt))}&project=${encodeURIComponent(projectId || "")}`} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[var(--accent-strong)] hover:underline">Generate a visual <ArrowRight size={13}/></Link></div></div></GlassCard>}
      {error && <ErrorBanner message={error}/>} 
      <div className="mt-8 flex flex-wrap gap-3 border-t border-[var(--border)] pt-5"><Button onClick={onRegenerate} variant="secondary" disabled={generating}>{generating ? <Loader2 size={15} className="animate-spin"/> : <RotateCcw size={15}/>} Regenerate · {config.creditCost} credits</Button><Button onClick={onRequest} disabled={requesting || requestSent}>{requesting ? <Loader2 size={15} className="animate-spin"/> : requestSent ? <CheckCircle2 size={15}/> : <MessageSquareText size={15}/>} {requestSent ? "Request sent" : "Request expert production"}</Button><ButtonLink href="/dashboard" variant="ghost"><Save size={15}/> Back to dashboard</ButtonLink></div>
    </>
  );
}

function GenerationLoading({ config }: { config: GuidedStudioConfig }) {
  const detail = config.id === "interior"
    ? "Building the layout, material palette, furniture direction, lighting strategy and procurement priorities."
    : "Building the campaign strategy, audience insight, creative platform, channel plan and content system.";

  return (
    <div
      className="mt-6 overflow-hidden rounded-2xl border p-5"
      style={{ borderColor: `color-mix(in srgb, ${config.accent} 48%, transparent)`, background: config.soft }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--surface-strong)] shadow-sm">
          <Loader2 size={20} className="animate-spin" style={{ color: config.accent }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[var(--text-primary)]">Generating your {config.id === "interior" ? "interior concept" : "campaign concept"}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{detail}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div className="h-full w-2/3 animate-pulse rounded-full" style={{ background: config.accent }} />
          </div>
          <p className="mt-2 text-[.64rem] font-bold text-[var(--text-muted)]">Please keep this page open. Your credits are automatically refunded if generation fails.</p>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ title, description, value, accent }: { title: string; description: string; value: unknown; accent: string }) {
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><span className="block h-1.5 w-12 rounded-full" style={{ background: accent }}/><h3 className="mt-5 text-lg font-black tracking-[-.035em]">{title}</h3><p className="mt-1 text-[.68rem] font-semibold leading-5 text-[var(--text-muted)]">{description}</p><div className="mt-4 text-sm font-semibold leading-6 text-[var(--text-secondary)]"><RenderValue value={value}/></div></section>;
}

function RenderValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) return <ul className="space-y-2">{value.map((item, index) => <li key={index} className="flex items-start gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"/><span>{typeof item === "string" ? item : formatObject(item)}</span></li>)}</ul>;
  if (value && typeof value === "object") return <div className="space-y-2">{Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key} className="rounded-xl bg-[var(--surface-hover)] p-3"><p className="text-[.58rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">{humanize(key)}</p><p className="mt-1 text-xs font-bold">{Array.isArray(item) ? item.join(", ") : String(item || "—")}</p></div>)}</div>;
  return <p>{String(value || "Not generated")}</p>;
}

function ErrorBanner({ message }: { message: string }) { return <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-300/60 bg-red-500/10 p-4 text-sm font-bold text-red-700 dark:text-red-200"><AlertCircle size={18} className="mt-0.5 shrink-0"/><span>{message}</span></div>; }
function initialState(config: GuidedStudioConfig) { const state: FormState = {}; config.steps.flatMap((item) => item.fields).forEach((field) => { state[field.id] = field.type === "multiselect" ? [] : ""; }); return state; }
function isEmpty(value: unknown) { return Array.isArray(value) ? value.length === 0 : !String(value || "").trim(); }
function humanize(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, (letter) => letter.toUpperCase()); }
function formatObject(value: unknown) { if (!value || typeof value !== "object") return String(value || ""); return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${humanize(key)}: ${Array.isArray(item) ? item.join(", ") : String(item)}`).join(" · "); }
