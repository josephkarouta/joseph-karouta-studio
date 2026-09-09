"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, FileText, Loader2, MapPin, Send, Upload, X } from "lucide-react";
import { Button, GlassCard, StatusPill } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";
import { expertRoleSections, expertRoleSlug, expertStudioLabel, type ExpertNetworkPosition } from "@/lib/expert-network/public";

type Position = ExpertNetworkPosition & { slug?: string };
type Application = {
  name: string;
  email: string;
  location: string;
  timezone: string;
  portfolioUrl: string;
  linkedinUrl: string;
  yearsExperience: string;
  specialties: string;
  softwareTools: string;
  languages: string;
  availability: string;
  message: string;
  consent: boolean;
};

const empty: Application = {
  name: "", email: "", location: "", timezone: "", portfolioUrl: "", linkedinUrl: "", yearsExperience: "",
  specialties: "", softwareTools: "", languages: "", availability: "", message: "", consent: false,
};
const ACCEPTED_RESUME_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const AVAILABILITY = [
  { value: "available", label: "Available for new projects" },
  { value: "limited", label: "Limited availability" },
  { value: "unavailable", label: "Not available right now, keep me in the network" },
];

export default function ExpertsNetworkContent({ initialRoleSlug, initialSource = "direct" }: { initialRoleSlug?: string; initialSource?: string }) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<Application>(empty);
  const [resume, setResume] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const resumeRef = useRef<HTMLInputElement>(null);
  const source = String(initialSource || "direct").trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/expert-network", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "The Expert Network is temporarily unavailable.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setPositions(data.positions || []);
        setLoadError("");
      })
      .catch((value) => {
        if (cancelled) return;
        setPositions([]);
        setLoadError(value instanceof Error ? value.message : "The Expert Network is temporarily unavailable.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => {
    if (!initialRoleSlug) return null;
    return positions.find((position) => (position.slug || expertRoleSlug(position.title)) === initialRoleSlug) || null;
  }, [initialRoleSlug, positions]);

  function chooseResume(file?: File) {
    if (!file) return;
    setError("");
    const acceptedByName = /\.(pdf|doc|docx)$/i.test(file.name);
    if (!ACCEPTED_RESUME_TYPES.includes(file.type) && !acceptedByName) {
      setResume(null); setError("CV must be a PDF, DOC or DOCX file."); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setResume(null); setError("CV must be 10 MB or smaller."); return;
    }
    setResume(file);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (!resume) { setError("Attach your CV or resume."); return; }
    if (!form.portfolioUrl.trim() && !form.linkedinUrl.trim()) { setError("Add either a portfolio or LinkedIn profile."); return; }
    if (form.message.trim().length < 30) { setError("Tell us a little about your experience and the projects you enjoy (at least 30 characters)."); return; }
    setSending(true); setError("");
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, String(value)));
      body.append("positionId", selected.id);
      body.append("source", source || "direct");
      body.append("resume", resume, resume.name);
      const response = await fetch("/api/public/expert-network", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Application could not be sent.");
      setSent(true);
      window.scrollTo({ top: document.getElementById("expert-application")?.offsetTop || 0, behavior: "smooth" });
    } catch (value) {
      setError(value instanceof Error ? value.message : "Application could not be sent.");
    } finally { setSending(false); }
  }

  if (loading) return <GlassCard className="grid min-h-56 place-items-center"><Loader2 className="animate-spin text-[var(--accent-strong)]" /></GlassCard>;
  if (loadError) return <GlassCard className="p-8 text-center"><h2 className="text-2xl font-black">Expert Network temporarily unavailable</h2><p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">{loadError}</p></GlassCard>;

  if (initialRoleSlug && !selected) {
    return <GlassCard className="p-8 text-center"><h2 className="text-2xl font-black">This opportunity is not currently available</h2><p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">It may have closed or the link may have changed.</p><Link href="/expertsnetwork" className="mt-6 inline-flex items-center gap-2 font-black text-[var(--accent-strong)]"><ArrowLeft size={15}/>View all Expert Network opportunities</Link></GlassCard>;
  }

  if (!selected) {
    return (
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-[.64rem] font-black uppercase tracking-[.18em] text-[var(--accent-strong)]">Open Expert Network opportunities</p><h2 className="mt-3 text-3xl font-black tracking-[-.05em] sm:text-4xl">Choose the Studio that matches your work.</h2></div>
          <p className="max-w-md text-sm font-semibold leading-6 text-[var(--text-secondary)]">Apply to the closest match. Shortlisted experts may later be considered for related project types across the network.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {positions.length ? positions.map((position) => {
            const slug = position.slug || expertRoleSlug(position.title);
            return <GlassCard key={position.id} interactive className="p-6 sm:p-7"><div className="flex h-full flex-col"><div className="flex flex-wrap gap-2"><StatusPill tone="info">{expertStudioLabel(position)}</StatusPill><StatusPill>{position.employment_type || "Freelance / Project-based"}</StatusPill></div><h3 className="mt-5 text-2xl font-black tracking-[-.045em]">{position.title}</h3><p className="mt-3 flex-1 text-sm font-semibold leading-7 text-[var(--text-secondary)]">{position.summary || "Join Heyy Studio for selected project-based expert work."}</p><p className="mt-5 flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]"><MapPin size={14}/>{position.location || "Remote / Worldwide"}</p><Link href={`/expertsnetwork/${slug}${source !== "direct" ? `?source=${encodeURIComponent(source)}` : ""}`} className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--text-primary)] px-4 py-2.5 text-xs font-black text-[var(--surface-strong)] transition hover:bg-[var(--accent-strong)] hover:text-white">View & apply <ArrowRight size={14}/></Link></div></GlassCard>;
          }) : <GlassCard className="p-8 text-center md:col-span-2"><h3 className="text-2xl font-black">Applications will open shortly</h3><p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">The first Expert Network opportunities are being prepared.</p></GlassCard>}
        </div>
      </div>
    );
  }

  const sections = expertRoleSections(selected);
  const linkedInUrl = process.env.NEXT_PUBLIC_HEYY_LINKEDIN_URL;

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/expertsnetwork" className="inline-flex items-center gap-2 text-xs font-black text-[var(--text-secondary)] hover:text-[var(--accent-strong)]"><ArrowLeft size={14}/>All Expert Network opportunities</Link>
      <div className="mt-5 grid gap-7 xl:grid-cols-[minmax(0,1.08fr)_minmax(500px,.92fr)] xl:items-start">
        <div className="grid gap-5">
          <GlassCard className="overflow-hidden">
            <div className="bg-[linear-gradient(135deg,#17131f,#6f2dff_78%,#dc36c8)] p-7 text-white sm:p-9">
              <p className="text-[.62rem] font-black uppercase tracking-[.18em] text-white/70">{expertStudioLabel(selected)} · Expert Network</p>
              <h2 className="mt-4 text-4xl font-black leading-[.98] tracking-[-.055em] sm:text-5xl">{selected.title}</h2>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-white/12 px-3 py-2">{selected.employment_type || "Freelance / Project-based"}</span><span className="rounded-full bg-white/12 px-3 py-2">{selected.location || "Remote / Worldwide"}</span></div>
            </div>
            <div className="p-6 sm:p-8"><p className="text-base font-semibold leading-8 text-[var(--text-secondary)]">{selected.summary}</p>{sections.map((section) => <section key={section.title} className="mt-7 border-t border-[var(--border)] pt-6"><h3 className="text-xl font-black">{section.title}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-[var(--text-secondary)]">{paragraph}</p>)}{section.bullets.length > 0 && <ul className="mt-4 space-y-3">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"/>{bullet}</li>)}</ul>}</section>)}{selected.closes_at && <p className="mt-7 text-xs font-bold text-[var(--text-muted)]">Applications close {new Date(selected.closes_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}.</p>}</div>
          </GlassCard>
        </div>

        <GlassCard id="expert-application" className="p-6 sm:p-7 xl:sticky xl:top-24">
          {sent ? <div className="py-8 text-center"><CheckCircle2 size={42} className="mx-auto text-emerald-500"/><h3 className="mt-4 text-2xl font-black">Application received</h3><p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">Thanks, {form.name.split(/\s+/)[0] || "there"}. Your application is now in the Heyy Studio Expert Network review queue.</p><p className="mt-3 text-xs font-semibold leading-5 text-[var(--text-muted)]">If you’re shortlisted, Heyy Studio will contact you directly. You do not need to apply again for the same opportunity.</p>{linkedInUrl && <a href={linkedInUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0a66c2] px-4 py-2.5 text-xs font-black text-white">Follow Heyy Studio on LinkedIn <ExternalLink size={13}/></a>}</div> : (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <div className="mb-2 sm:col-span-2"><p className="text-[.62rem] font-black uppercase tracking-[.17em] text-[var(--accent-strong)]">Apply to the Expert Network</p><h3 className="mt-2 text-2xl font-black tracking-[-.045em]">Your expert profile starts here.</h3><p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-muted)]">This application does not create an Expert Portal account. Shortlisted candidates are invited separately.</p></div>
              <Field label="Full name *"><input className="heyy-input" required minLength={2} value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></Field>
              <Field label="Email address *"><input className="heyy-input" type="email" required value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></Field>
              <Field label="Current city & country *"><input className="heyy-input" required placeholder="Melbourne, Australia" value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})}/></Field>
              <Field label="Time zone"><input className="heyy-input" placeholder="AEST / GMT+10" value={form.timezone} onChange={(e)=>setForm({...form,timezone:e.target.value})}/></Field>
              <Field label="Years of relevant experience"><input className="heyy-input" type="number" min="0" max="60" inputMode="numeric" placeholder="8" value={form.yearsExperience} onChange={(e)=>setForm({...form,yearsExperience:e.target.value})}/></Field>
              <Field label="Current availability *"><HeyySelect value={form.availability} options={AVAILABILITY} placeholder="Select availability" ariaLabel="Current availability" onChange={(value)=>setForm({...form,availability:value})}/></Field>
              <Field label="Portfolio"><input className="heyy-input" inputMode="url" placeholder="www.yourportfolio.com" value={form.portfolioUrl} onChange={(e)=>setForm({...form,portfolioUrl:e.target.value})}/></Field>
              <Field label="LinkedIn"><input className="heyy-input" inputMode="url" placeholder="linkedin.com/in/yourname" value={form.linkedinUrl} onChange={(e)=>setForm({...form,linkedinUrl:e.target.value})}/></Field>
              <Field className="sm:col-span-2" label="Specialties *" hint="Separate with commas"><input className="heyy-input" required placeholder="Brand identity, packaging, typography" value={form.specialties} onChange={(e)=>setForm({...form,specialties:e.target.value})}/></Field>
              <Field label="Software / tools" hint="Separate with commas"><input className="heyy-input" placeholder="Illustrator, InDesign, Figma" value={form.softwareTools} onChange={(e)=>setForm({...form,softwareTools:e.target.value})}/></Field>
              <Field label="Languages" hint="Separate with commas"><input className="heyy-input" placeholder="English, Arabic" value={form.languages} onChange={(e)=>setForm({...form,languages:e.target.value})}/></Field>

              <input ref={resumeRef} type="file" className="hidden" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e)=>chooseResume(e.target.files?.[0])}/>
              <div className="flex min-h-20 items-center justify-between gap-3 rounded-2xl border border-dashed sm:col-span-2 border-[var(--border-strong)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
                <button type="button" onClick={()=>resumeRef.current?.click()} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">{resume?<FileText size={17}/>:<Upload size={17}/>}</span>
                  <span className="min-w-0"><span className="block truncate text-xs font-black">{resume?resume.name:"Attach CV / resume *"}</span><span className="mt-1 block text-[.65rem] font-semibold text-[var(--text-muted)]">PDF, DOC or DOCX · max 10 MB</span></span>
                </button>
                {resume&&<button type="button" onClick={()=>{setResume(null);if(resumeRef.current)resumeRef.current.value="";}} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--border)]" aria-label="Remove CV"><X size={13}/></button>}
              </div>

              <Field className="sm:col-span-2" label="Tell us about your work *" hint="What kind of projects are you strongest at?"><textarea className="heyy-input min-h-28 w-full resize-y" required minLength={30} value={form.message} onChange={(e)=>setForm({...form,message:e.target.value})}/></Field>
              <label className="flex items-start gap-3 rounded-2xl bg-[var(--surface)] p-3 text-xs sm:col-span-2 font-semibold leading-5 text-[var(--text-secondary)]"><input type="checkbox" className="mt-1" checked={form.consent} onChange={(e)=>setForm({...form,consent:e.target.checked})}/><span>I confirm the information is accurate and allow Heyy Studio to store and review this application for Expert Network opportunities. *</span></label>
              {source !== "direct" && <p className="text-[.62rem] sm:col-span-2 font-bold text-[var(--text-muted)]">Application source: {source}</p>}
              {error&&<p className="rounded-xl bg-red-500/10 sm:col-span-2 px-3 py-2 text-xs font-bold text-red-600">{error}</p>}
              <div className="sm:col-span-2"><Button type="submit" className="w-full" disabled={sending || !form.consent}>{sending?<Loader2 size={15} className="animate-spin"/>:<Send size={15}/>}Submit Expert Network application</Button></div>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return <label className={className}><span className="mb-1.5 flex items-center justify-between gap-2 text-[.61rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]"><span>{label}</span>{hint&&<span className="normal-case tracking-normal text-[.58rem] font-semibold">{hint}</span>}</span>{children}</label>;
}
