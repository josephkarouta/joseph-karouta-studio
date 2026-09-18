"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ExternalLink, FileText, Loader2, MapPin, Send, Upload, X } from "lucide-react";
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
  const [emailRegistered, setEmailRegistered] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [profileLinkError, setProfileLinkError] = useState(false);
  const [sent, setSent] = useState(false);
  const resumeRef = useRef<HTMLInputElement>(null);
  const emailCheckRef = useRef(0);
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

  async function checkEmailRegistration() {
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailRegistered(false);
      return;
    }

    const checkId = emailCheckRef.current + 1;
    emailCheckRef.current = checkId;
    setCheckingEmail(true);
    try {
      const response = await fetch(`/api/public/expert-network?mode=email-check&email=${encodeURIComponent(email)}`, { cache: "no-store" });
      const result = await response.json();
      if (checkId !== emailCheckRef.current) return;
      setEmailRegistered(response.ok && Boolean(result.registered));
    } catch {
      if (checkId === emailCheckRef.current) setEmailRegistered(false);
    } finally {
      if (checkId === emailCheckRef.current) setCheckingEmail(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (emailRegistered) return;
    if (!resume) { setError("Attach your CV or resume."); return; }
    if (!form.portfolioUrl.trim() && !form.linkedinUrl.trim()) { setProfileLinkError(true); setError(""); return; }
    setProfileLinkError(false);
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
      if (!response.ok && result.code === "expert_network_email_exists") {
        setEmailRegistered(true);
        return;
      }
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
        <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
          <div><p className="text-[.6rem] font-black uppercase tracking-[.16em] text-[var(--accent-strong)] sm:text-[.64rem] sm:tracking-[.18em]">Open Expert Network opportunities</p><h2 className="mt-2 text-2xl font-black tracking-[-.05em] sm:mt-3 sm:text-4xl">Choose the Studio that matches your work.</h2></div>
          <p className="max-w-md text-xs font-semibold leading-5 text-[var(--text-secondary)] sm:text-sm sm:leading-6">Apply to the closest match. Shortlisted experts may later be considered for related project types across the network.</p>
        </div>
        <div className="mt-5 grid gap-3 sm:mt-8 sm:gap-4 md:grid-cols-2">
          {positions.length ? positions.map((position) => {
            const slug = position.slug || expertRoleSlug(position.title);
            return <GlassCard key={position.id} interactive className="p-5 sm:p-7"><div className="flex h-full flex-col"><div className="flex flex-wrap gap-2"><StatusPill tone="info">{expertStudioLabel(position)}</StatusPill><StatusPill>{position.employment_type || "Freelance / Project-based"}</StatusPill></div><h3 className="mt-5 text-2xl font-black tracking-[-.045em]">{position.title}</h3><p className="mt-3 flex-1 text-sm font-semibold leading-7 text-[var(--text-secondary)]">{position.summary || "Join Heyy Studio for selected project-based expert work."}</p><p className="mt-5 flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]"><MapPin size={14}/>{position.location || "Remote / Worldwide"}</p><Link href={`/expertsnetwork/${slug}${source !== "direct" ? `?source=${encodeURIComponent(source)}` : ""}`} className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--text-primary)] px-4 py-2.5 text-xs font-black text-[var(--surface-strong)] transition hover:bg-[var(--accent-strong)] hover:text-white">View & apply <ArrowRight size={14}/></Link></div></GlassCard>;
          }) : <GlassCard className="p-8 text-center md:col-span-2"><h3 className="text-2xl font-black">Applications will open shortly</h3><p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">The first Expert Network opportunities are being prepared.</p></GlassCard>}
        </div>
      </div>
    );
  }

  const sections = expertRoleSections(selected);
  const linkedInUrl = process.env.NEXT_PUBLIC_HEYY_LINKEDIN_URL;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid gap-5 sm:gap-7 xl:grid-cols-[minmax(0,1.04fr)_minmax(480px,.96fr)] xl:items-start">
        <div className="min-w-0 grid gap-5">
          <GlassCard className="overflow-hidden">
            <div className="bg-[linear-gradient(135deg,#17131f,#6f2dff_78%,#dc36c8)] p-5 text-white sm:p-9">
              <p className="text-[.58rem] font-black uppercase tracking-[.16em] text-white/70 sm:text-[.62rem] sm:tracking-[.18em]">{expertStudioLabel(selected)} · Expert Network</p>
              <h2 className="mt-3 text-3xl font-black leading-[.98] tracking-[-.055em] sm:mt-4 sm:text-5xl">{selected.title}</h2>
              <div className="mt-4 flex flex-wrap gap-2 text-[.68rem] font-black sm:mt-5 sm:text-xs"><span className="rounded-full bg-white/12 px-3 py-2">{selected.employment_type || "Freelance / Project-based"}</span><span className="rounded-full bg-white/12 px-3 py-2">{selected.location || "Remote / Worldwide"}</span></div>
            </div>
            <div className="p-5 sm:p-8">
              <p className="text-sm font-semibold leading-6 text-[var(--text-secondary)] sm:text-base sm:leading-8">{selected.summary}</p>
              <details className="group mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] xl:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black">
                  View role details
                  <ChevronDown size={16} className="transition group-open:rotate-180"/>
                </summary>
                <div className="border-t border-[var(--border)] px-4 pb-4">
                  {sections.map((section) => <section key={section.title} className="mt-5"><h3 className="text-base font-black">{section.title}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-2 whitespace-pre-wrap text-xs font-semibold leading-5 text-[var(--text-secondary)]">{paragraph}</p>)}{section.bullets.length > 0 && <ul className="mt-3 space-y-2">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"/>{bullet}</li>)}</ul>}</section>)}
                  {selected.closes_at && <p className="mt-5 text-xs font-bold text-[var(--text-muted)]">Applications close {new Date(selected.closes_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}.</p>}
                </div>
              </details>

              <div className="hidden xl:block">
                {sections.map((section) => <section key={section.title} className="mt-7 border-t border-[var(--border)] pt-6"><h3 className="text-xl font-black">{section.title}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-[var(--text-secondary)]">{paragraph}</p>)}{section.bullets.length > 0 && <ul className="mt-4 space-y-3">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"/>{bullet}</li>)}</ul>}</section>)}
                {selected.closes_at && <p className="mt-7 text-xs font-bold text-[var(--text-muted)]">Applications close {new Date(selected.closes_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}.</p>}
              </div>
            </div>
          </GlassCard>
        </div>

        <GlassCard id="expert-application" className="min-w-0 scroll-mt-24 p-5 sm:p-7">
          {sent ? <div className="py-8 text-center"><CheckCircle2 size={42} className="mx-auto text-emerald-500"/><h3 className="mt-4 text-2xl font-black">Application received</h3><p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">Thanks, {form.name.split(/\s+/)[0] || "there"}. Your application is now in the Heyy Studio Expert Network review queue.</p><p className="mt-3 text-xs font-semibold leading-5 text-[var(--text-muted)]">If you’re shortlisted, Heyy Studio will contact you directly. You do not need to apply again for the same opportunity.</p>{linkedInUrl && <a href={linkedInUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0a66c2] px-4 py-2.5 text-xs font-black text-white">Follow Heyy Studio on LinkedIn <ExternalLink size={13}/></a>}</div> : (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <div className="mb-1 sm:col-span-2 sm:mb-2"><p className="text-[.6rem] font-black uppercase tracking-[.16em] text-[var(--accent-strong)] sm:text-[.62rem] sm:tracking-[.17em]">Apply to the Expert Network</p><h3 className="mt-2 text-xl font-black tracking-[-.045em] sm:text-2xl">Your expert profile starts here.</h3><p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-muted)]">Shortlisted candidates are invited separately. This application does not create an Expert Portal account.</p></div>
              <Field label="Full name *"><input className="heyy-input" required minLength={2} value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></Field>
              <Field label="Email address *">
                <input
                  className="heyy-input"
                  type="email"
                  required
                  aria-invalid={emailRegistered}
                  aria-describedby={emailRegistered ? "expert-email-error" : undefined}
                  style={emailRegistered ? { borderColor: "#ef4444", boxShadow: "0 0 0 4px rgba(239,68,68,.10)" } : undefined}
                  value={form.email}
                  onBlur={() => void checkEmailRegistration()}
                  onChange={(e)=>{
                    emailCheckRef.current += 1;
                    setCheckingEmail(false);
                    setEmailRegistered(false);
                    setForm({...form,email:e.target.value});
                  }}
                />
                {checkingEmail && <span className="mt-1.5 block text-[.62rem] font-semibold text-[var(--text-muted)]">Checking email…</span>}
                {emailRegistered && <span id="expert-email-error" className="mt-1.5 block text-[.62rem] font-bold text-red-600">This email is already registered with the Heyy Studio Expert Network.</span>}
              </Field>
              <Field label="Current city & country *"><input className="heyy-input" required placeholder="Melbourne, Australia" value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})}/></Field>
              <Field label="Current availability *"><HeyySelect value={form.availability} options={AVAILABILITY} placeholder="Select availability" ariaLabel="Current availability" onChange={(value)=>setForm({...form,availability:value})}/></Field>
              <div className="sm:col-span-2 -mb-2 flex items-center justify-between gap-2 text-[.61rem] font-black uppercase tracking-[.12em] text-[var(--text-muted)]"><span>Portfolio or LinkedIn *</span><span className="normal-case tracking-normal text-[.58rem] font-semibold">Add at least one</span></div>
              <Field label="Portfolio"><input className="heyy-input" inputMode="url" aria-invalid={profileLinkError} style={profileLinkError ? { borderColor: "#ef4444" } : undefined} placeholder="www.yourportfolio.com" value={form.portfolioUrl} onChange={(e)=>{setProfileLinkError(false);setForm({...form,portfolioUrl:e.target.value});}}/></Field>
              <Field label="LinkedIn"><input className="heyy-input" inputMode="url" aria-invalid={profileLinkError} style={profileLinkError ? { borderColor: "#ef4444" } : undefined} placeholder="linkedin.com/in/yourname" value={form.linkedinUrl} onChange={(e)=>{setProfileLinkError(false);setForm({...form,linkedinUrl:e.target.value});}}/></Field>
              {profileLinkError && <p className="-mt-2 text-[.62rem] font-bold text-red-600 sm:col-span-2">Add at least one portfolio or LinkedIn link.</p>}
              <Field className="sm:col-span-2" label="Specialties *" hint="Separate with commas"><input className="heyy-input" required placeholder="Brand identity, packaging, typography" value={form.specialties} onChange={(e)=>setForm({...form,specialties:e.target.value})}/></Field>

              <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] sm:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-black">
                  Add more profile details <span className="font-semibold text-[var(--text-muted)]">(optional)</span>
                  <ChevronDown size={15}/>
                </summary>
                <div className="grid gap-4 border-t border-[var(--border)] p-4">
                  <Field label="Time zone"><input className="heyy-input" placeholder="AEST / GMT+10" value={form.timezone} onChange={(e)=>setForm({...form,timezone:e.target.value})}/></Field>
                  <Field label="Years of relevant experience"><input className="heyy-input" type="number" min="0" max="60" inputMode="numeric" placeholder="8" value={form.yearsExperience} onChange={(e)=>setForm({...form,yearsExperience:e.target.value})}/></Field>
                  <Field label="Software / tools" hint="Separate with commas"><input className="heyy-input" placeholder="Illustrator, InDesign, Figma" value={form.softwareTools} onChange={(e)=>setForm({...form,softwareTools:e.target.value})}/></Field>
                  <Field label="Languages" hint="Separate with commas"><input className="heyy-input" placeholder="English, Spanish" value={form.languages} onChange={(e)=>setForm({...form,languages:e.target.value})}/></Field>
                </div>
              </details>

              <div className="hidden sm:contents">
                <Field label="Time zone"><input className="heyy-input" placeholder="AEST / GMT+10" value={form.timezone} onChange={(e)=>setForm({...form,timezone:e.target.value})}/></Field>
                <Field label="Years of relevant experience"><input className="heyy-input" type="number" min="0" max="60" inputMode="numeric" placeholder="8" value={form.yearsExperience} onChange={(e)=>setForm({...form,yearsExperience:e.target.value})}/></Field>
                <Field label="Software / tools" hint="Separate with commas"><input className="heyy-input" placeholder="Illustrator, InDesign, Figma" value={form.softwareTools} onChange={(e)=>setForm({...form,softwareTools:e.target.value})}/></Field>
                <Field label="Languages" hint="Separate with commas"><input className="heyy-input" placeholder="English, Spanish" value={form.languages} onChange={(e)=>setForm({...form,languages:e.target.value})}/></Field>
              </div>

              <input ref={resumeRef} type="file" className="hidden" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e)=>chooseResume(e.target.files?.[0])}/>
              <div className="flex min-h-20 items-center justify-between gap-3 rounded-2xl border border-dashed sm:col-span-2 border-[var(--border-strong)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
                <button type="button" onClick={()=>resumeRef.current?.click()} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">{resume?<FileText size={17}/>:<Upload size={17}/>}</span>
                  <span className="min-w-0"><span className="block truncate text-xs font-black">{resume?resume.name:"Attach CV / resume *"}</span><span className="mt-1 block text-[.65rem] font-semibold text-[var(--text-muted)]">PDF, DOC or DOCX · max 10 MB</span></span>
                </button>
                {resume&&<button type="button" onClick={()=>{setResume(null);if(resumeRef.current)resumeRef.current.value="";}} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--border)]" aria-label="Remove CV"><X size={13}/></button>}
              </div>

              <Field className="sm:col-span-2" label="Tell us about your work *" hint="What kind of projects are you strongest at?"><textarea className="heyy-input min-h-28 w-full resize-y" required minLength={30} value={form.message} onChange={(e)=>setForm({...form,message:e.target.value})}/></Field>
              <div className="rounded-2xl bg-[var(--surface)] p-3 text-xs sm:col-span-2 font-semibold leading-5 text-[var(--text-secondary)]">
                <div className="flex items-start gap-3">
                  <input
                    id="expert-network-consent"
                    type="checkbox"
                    required
                    className="mt-1 cursor-pointer"
                    checked={form.consent}
                    onChange={(e)=>setForm({...form,consent:e.target.checked})}
                  />
                  <p>
                    I confirm the information is accurate, allow Heyy Studio to store and review this application for Expert Network opportunities, and agree to the{" "}
                    <Link href="/terms" target="_blank" rel="noreferrer" className="font-black text-[var(--accent-strong)] underline underline-offset-2 hover:text-[var(--text-primary)]">Terms</Link>{" "}
                    and{" "}
                    <Link href="/privacy" target="_blank" rel="noreferrer" className="font-black text-[var(--accent-strong)] underline underline-offset-2 hover:text-[var(--text-primary)]">Privacy Policy</Link>. *
                  </p>
                </div>
                <p className="mt-2 pl-7 text-[.64rem] font-semibold leading-5 text-[var(--text-muted)]">
                  Project invitations are optional. Scope, fee, timeline and payment terms are confirmed with you before each project begins.
                </p>
              </div>
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
