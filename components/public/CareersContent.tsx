"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  Send,
  Upload,
  X,
} from "lucide-react";
import { Button, GlassCard, StatusPill } from "@/components/ui/heyy";

type Position = {
  id: string;
  title: string;
  department?: string;
  location?: string;
  employment_type?: string;
  summary?: string;
  description?: { paragraphs?: unknown[]; sections?: Array<{ paragraphs?: unknown[] }> } | null;
  closes_at?: string | null;
};
type Application = {
  name: string;
  email: string;
  location: string;
  portfolioUrl: string;
  linkedinUrl: string;
  message: string;
};
const empty: Application = { name: "", email: "", location: "", portfolioUrl: "", linkedinUrl: "", message: "" };
const ACCEPTED_RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function roleParagraphs(position: Position) {
  const description = position.description;
  if (!description || typeof description !== "object") return [];
  if (Array.isArray(description.paragraphs)) return description.paragraphs.map(String).filter(Boolean);
  if (Array.isArray(description.sections)) {
    return description.sections.flatMap((section) => Array.isArray(section.paragraphs) ? section.paragraphs.map(String) : []).filter(Boolean);
  }
  return [];
}

export default function CareersContent() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<Position | null>(null);
  const [form, setForm] = useState<Application>(empty);
  const [resume, setResume] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const resumeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetch("/api/public/careers")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Careers are temporarily unavailable.");
        return data;
      })
      .then((data) => {
        setPositions(data.positions || []);
        setLoadError("");
      })
      .catch((value) => {
        setPositions([]);
        setLoadError(value instanceof Error ? value.message : "Careers are temporarily unavailable.");
      })
      .finally(() => setLoading(false));
  }, []);

  function chooseResume(file?: File) {
    if (!file) return;
    setError("");
    const acceptedByName = /\.(pdf|doc|docx)$/i.test(file.name);
    if (!ACCEPTED_RESUME_TYPES.includes(file.type) && !acceptedByName) {
      setResume(null);
      setError("CV must be a PDF, DOC or DOCX file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setResume(null);
      setError("CV must be 10 MB or smaller.");
      return;
    }
    setResume(file);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (!resume) {
      setError("Attach your CV or resume.");
      return;
    }
    if (form.message.trim().length < 20) {
      setError("Tell us a little more about why the role fits you (at least 20 characters).");
      return;
    }

    setSending(true);
    setError("");
    try {
      const body = new FormData();
      body.append("positionId", selected.id);
      body.append("name", form.name);
      body.append("email", form.email);
      body.append("location", form.location);
      body.append("portfolioUrl", form.portfolioUrl);
      body.append("linkedinUrl", form.linkedinUrl);
      body.append("message", form.message);
      body.append("resume", resume, resume.name);

      const response = await fetch("/api/public/careers", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Application could not be sent.");
      setSent(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Application could not be sent.");
    } finally {
      setSending(false);
    }
  }

  function close() {
    setSelected(null);
    setForm(empty);
    setResume(null);
    setSent(false);
    setError("");
  }

  if (loading) return <GlassCard className="mx-auto grid min-h-52 max-w-4xl place-items-center"><Loader2 className="animate-spin text-[var(--accent-strong)]" /></GlassCard>;
  if (loadError) return <GlassCard className="mx-auto max-w-4xl p-8 text-center"><BriefcaseBusiness size={28} className="mx-auto text-[var(--accent-strong)]" /><h2 className="mt-4 text-2xl font-black">Careers are temporarily unavailable</h2><p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">{loadError}</p></GlassCard>;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-4">
        {positions.length ? positions.map((position) => (
          <GlassCard key={position.id} interactive className="p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="info">{position.department || "Heyy Studio"}</StatusPill>
                  <StatusPill>{position.employment_type || "Contract"}</StatusPill>
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-[-.045em]">{position.title}</h2>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">{position.summary || "Help build a thoughtful AI + experts creative platform."}</p>
                <p className="mt-4 flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]"><MapPin size={14} />{position.location || "Remote / Worldwide"}</p>
              </div>
              <button type="button" onClick={() => setSelected(position)} className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-strong)] px-4 py-2.5 text-xs font-black transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">View role <ArrowRight size={14} /></button>
            </div>
          </GlassCard>
        )) : (
          <GlassCard className="p-8 text-center"><BriefcaseBusiness size={28} className="mx-auto text-[var(--accent-strong)]" /><h2 className="mt-4 text-2xl font-black">No open positions right now</h2><p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">Roles will appear here when they are published from the Admin Careers area. You can still introduce yourself through the contact page.</p><a href="/contact?topic=career" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[var(--accent-strong)]">Send an introduction <ArrowRight size={14} /></a></GlassCard>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/45 p-4 backdrop-blur-sm">
          <div className="mx-auto flex min-h-full max-w-4xl items-center justify-center py-6">
            <GlassCard className="w-full bg-[var(--surface-strong)] p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[.62rem] font-black uppercase tracking-[.17em] text-[var(--accent-strong)]">Career opportunity</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-.05em]">{selected.title}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill tone="info">{selected.department || "Heyy Studio"}</StatusPill>
                    <StatusPill>{selected.employment_type || "Contract"}</StatusPill>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)]"><MapPin size={13} />{selected.location || "Remote / Worldwide"}</span>
                  </div>
                </div>
                <button type="button" onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border)] hover:bg-[var(--surface-hover)]"><X size={18} /></button>
              </div>

              <div className="mt-7 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
                <h3 className="text-lg font-black">About the role</h3>
                {selected.summary && <p className="mt-3 text-sm font-semibold leading-7 text-[var(--text-secondary)]">{selected.summary}</p>}
                {roleParagraphs(selected).length > 0 && (
                  <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-5">
                    {roleParagraphs(selected).map((paragraph, index) => <p key={index} className="whitespace-pre-wrap text-sm font-semibold leading-7 text-[var(--text-secondary)]">{paragraph}</p>)}
                  </div>
                )}
                {selected.closes_at && <p className="mt-5 text-xs font-bold text-[var(--text-muted)]">Applications close {new Date(selected.closes_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}.</p>}
              </div>

              {sent ? (
                <div className="py-14 text-center"><CheckCircle2 size={38} className="mx-auto text-emerald-500" /><h3 className="mt-4 text-2xl font-black">Application received</h3><p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">Thanks for applying. The Heyy Studio team will review your application.</p><Button className="mt-6" onClick={close}>Done</Button></div>
              ) : (
                <form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><h3 className="text-xl font-black">Apply for this role</h3><p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">Fields marked required must be completed before submission.</p></div>
                  <input className="heyy-input" placeholder="Full name *" required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                  <input className="heyy-input" type="email" placeholder="Email address *" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                  <input className="heyy-input" placeholder="Current location (optional)" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
                  <input className="heyy-input" inputMode="url" placeholder="Portfolio (optional) · www.yoursite.com" value={form.portfolioUrl} onChange={(event) => setForm({ ...form, portfolioUrl: event.target.value })} />
                  <input className="heyy-input sm:col-span-2" inputMode="url" placeholder="LinkedIn (optional) · linkedin.com/in/yourname" value={form.linkedinUrl} onChange={(event) => setForm({ ...form, linkedinUrl: event.target.value })} />

                  <input ref={resumeRef} type="file" className="hidden" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => chooseResume(event.target.files?.[0])} />
                  <button type="button" onClick={() => resumeRef.current?.click()} className="sm:col-span-2 flex min-h-24 items-center justify-between gap-4 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
                    <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">{resume ? <FileText size={18} /> : <Upload size={18} />}</span><span><span className="block text-sm font-black">{resume ? resume.name : "Attach CV / resume *"}</span><span className="mt-1 block text-xs font-semibold text-[var(--text-muted)]">PDF, DOC or DOCX · maximum 10 MB</span></span></span>
                    {resume && <span className="text-xs font-black text-emerald-600">Ready</span>}
                  </button>

                  <div className="sm:col-span-2"><textarea className="heyy-input min-h-36 w-full resize-y" placeholder="Why are you interested in this role? *" required minLength={20} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /><p className="mt-1 text-[.68rem] font-semibold text-[var(--text-muted)]">Minimum 20 characters.</p></div>
                  {error && <p className="text-sm font-bold text-red-500 sm:col-span-2">{error}</p>}
                  <div className="sm:col-span-2"><Button type="submit" disabled={sending}>{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Submit application</Button></div>
                </form>
              )}
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
