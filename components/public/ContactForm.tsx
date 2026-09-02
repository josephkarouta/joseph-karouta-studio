"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Paperclip,
  Send,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button, Eyebrow, GlassCard } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";

const INQUIRY_TYPES = [
  { value: "expert", label: "Expert / Project Request" },
  { value: "general", label: "General Inquiry" },
  { value: "billing", label: "Billing & Payments" },
  { value: "technical", label: "Technical Support" },
  { value: "careers", label: "Careers" },
  { value: "partnership", label: "Partnership / Business" },
  { value: "other", label: "Other" },
] as const;

type InquiryType = (typeof INQUIRY_TYPES)[number]["value"];

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_TOTAL_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt",
  "png", "jpg", "jpeg", "webp",
]);

export default function ContactForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user } = useAuth();
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [inquiryType, setInquiryType] = useState<InquiryType>("expert");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState("");

  useEffect(() => {
    if (!user) return;
    if (!name) {
      setName(String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim());
    }
    if (!email) setEmail(String(user.email || "").trim());
  }, [user, name, email]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const topic = new URLSearchParams(window.location.search).get("topic")?.trim().toLowerCase();
    if (topic && INQUIRY_TYPES.some((item) => item.value === topic)) {
      setInquiryType(topic as InquiryType);
    }
  }, []);

  function addAttachments(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (!incoming.length) return;

    const next = [...attachments];
    let nextTotal = next.reduce((sum, file) => sum + file.size, 0);

    for (const file of incoming) {
      if (next.length >= MAX_ATTACHMENTS) {
        setError(`Attach no more than ${MAX_ATTACHMENTS} files.`);
        break;
      }
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        setError(`${file.name} is not a supported file type.`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`${file.name} is larger than 5 MB.`);
        continue;
      }
      if (nextTotal + file.size > MAX_ATTACHMENT_TOTAL_BYTES) {
        setError("Attachments can be up to 5 MB combined.");
        break;
      }
      if (next.some((existing) => existing.name.toLowerCase() === file.name.toLowerCase())) {
        setError(`${file.name} is already attached.`);
        continue;
      }
      next.push(file);
      nextTotal += file.size;
    }

    setAttachments(next);
  }

  function removeAttachment(file: File) {
    setAttachments((current) => current.filter((item) => item !== file));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessId("");

    if (!name.trim()) {
      setError("Enter your name before sending.");
      return;
    }
    if (!email.trim().includes("@")) {
      setError("Enter a valid email address before sending.");
      return;
    }
    if (subject.trim().length < 3) {
      setError("Add a subject of at least 3 characters.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Please add a little more detail to your message — at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("email", email.trim());
      form.set("company", company.trim());
      form.set("topic", inquiryType);
      form.set("subject", subject.trim());
      form.set("message", message.trim());
      form.set("website", website);
      attachments.forEach((file) => form.append("attachments", file, file.name));

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const payload = await readSafePayload(response);
      if (!response.ok) {
        throw new Error(payload.error || "We couldn’t send your request. Please try again.");
      }

      setSuccessId(String(payload.id || "received"));
      setSubject("");
      setMessage("");
      setAttachments([]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We couldn’t send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (successId) {
    return (
      <GlassCard className="mx-auto max-w-3xl p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 size={25} />
        </div>
        <div className="mt-5"><Eyebrow>Request received</Eyebrow></div>
        <h2 className="mt-2 text-2xl font-black tracking-[-.04em] sm:text-3xl">Thanks — we’ve got your message.</h2>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">
          The Heyy Studio team will review your request and route it to the right person. A confirmation has also been sent to your email when email delivery is available.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={() => setSuccessId("")}>Send another message</Button>
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border-strong)] px-5 text-sm font-black text-[var(--text-primary)] transition hover:border-[var(--accent-border)]">
            Back to Heyy Studio
          </Link>
        </div>
      </GlassCard>
    );
  }

  return (
    <div id="contact-form" className="grid gap-5 lg:grid-cols-[1.22fr_.78fr]">
      <GlassCard className="p-5 sm:p-7">
        <div>
          <Eyebrow>Send a request</Eyebrow>
          <h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Tell us what you need.</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">
            Choose the closest inquiry type, add a clear subject and include any files that help us understand your request.
          </p>
        </div>

        <form onSubmit={submit} className="mt-7 grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" required>
              <input className="heyy-form-field" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Your name" autoComplete="name" required />
            </Field>
            <Field label="Email" required>
              <input className="heyy-form-field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} placeholder="you@company.com" autoComplete="email" required />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Company" optional>
              <input className="heyy-form-field" value={company} onChange={(event) => setCompany(event.target.value)} maxLength={160} placeholder="Company or organization" autoComplete="organization" />
            </Field>
            <Field label="Inquiry type" required>
              <HeyySelect
                value={inquiryType}
                tone="admin"
                ariaLabel="Inquiry type"
                options={INQUIRY_TYPES.map((item) => ({ value: item.value, label: item.label }))}
                onChange={(value) => setInquiryType(value as InquiryType)}
                triggerClassName="!min-h-[46px] !rounded-[14px]"
              />
            </Field>
          </div>

          {inquiryType === "careers" && (
            <div className="rounded-2xl border border-violet-300/40 bg-violet-500/10 p-4 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
              Looking to apply for a role? Use the dedicated <Link href="/careers" className="font-black text-[var(--accent-strong)] underline underline-offset-4">Careers page</Link>. This form is best for general career questions.
            </div>
          )}

          <Field label="Subject" required>
            <input className="heyy-form-field" value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={160} placeholder={inquiryType === "expert" ? "e.g. Help finishing a brand identity project" : "Give your request a clear subject"} required />
          </Field>

          <Field label={inquiryType === "expert" ? "Project brief / message" : "Message"} required>
            <textarea className="heyy-form-field resize-y" rows={7} value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={5000} placeholder={inquiryType === "expert" ? "Tell us what you’re creating, where you are in the process, what you need help with and any timing that matters." : "Tell us how we can help."} required />
          </Field>

          <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-hover)] p-4">
            <input
              ref={attachmentInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
              onChange={(event) => {
                if (event.target.files) addAttachments(event.target.files);
                event.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black">Attachments <span className="font-semibold text-[var(--text-muted)]">(optional)</span></p>
                <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">Add up to 3 useful documents or images, 5 MB combined.</p>
              </div>
              <button
                type="button"
                onClick={() => attachmentInputRef.current?.click()}
                disabled={submitting || attachments.length >= MAX_ATTACHMENTS}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-xs font-black text-[var(--text-primary)] transition hover:border-[var(--accent-border)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Paperclip size={15} /> Attach files
              </button>
            </div>

            {attachments.length > 0 && (
              <div className="mt-4 grid gap-2">
                {attachments.map((file) => (
                  <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"><FileText size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black">{file.name}</p>
                      <p className="mt-0.5 text-[.62rem] font-semibold text-[var(--text-muted)]">{formatFileSize(file.size)}</p>
                    </div>
                    <button type="button" onClick={() => removeAttachment(file)} disabled={submitting} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[var(--text-secondary)] transition hover:border-red-300 hover:text-red-500 disabled:opacity-40" aria-label={`Remove ${file.name}`}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hidden" aria-hidden="true">
            <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
          </div>

          {error && (
            <div className="flex gap-3 rounded-2xl border border-red-300/60 bg-red-500/10 p-4 text-sm font-bold text-red-700 dark:text-red-200">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-fit">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {submitting ? "Sending request…" : "Send request"}
          </Button>
        </form>
      </GlassCard>

      <div className="grid content-start gap-4">
        <GlassCard className="p-5 sm:p-6">
          <Eyebrow>Expert help</Eyebrow>
          <h3 className="mt-2 text-xl font-black tracking-[-.035em]">Need a professional to take it further?</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
            Choose <span className="font-black text-[var(--text-primary)]">Expert / Project Request</span> and tell us what you have, what you need and where you want the project to go.
          </p>
        </GlassCard>

        <InfoCard icon={<Users size={18} />} title="Routed to the right team" copy="Your inquiry type helps us send the request to the right Heyy Studio team from the start." />
        <InfoCard icon={<Paperclip size={18} />} title="Add useful context" copy="Attach a brief, screenshot, reference, presentation or other file when it makes your request easier to understand." />
        <InfoCard icon={<Clock3 size={18} />} title="Clear confirmation" copy="Once the request is accepted, you’ll see an on-screen confirmation and receive an email when email delivery is available." />
        <InfoCard icon={<ShieldCheck size={18} />} title="Private request handling" copy="Contact files are used only to review your request and are not exposed publicly." />

        <p className="px-1 text-xs font-semibold leading-5 text-[var(--text-muted)]">
          You can also email <a href="mailto:hello@heyystudio.com" className="font-black text-[var(--accent-strong)]">hello@heyystudio.com</a>.
        </p>
      </div>
    </div>
  );
}

function Field({ label, required, optional, children }: { label: string; required?: boolean; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">
        {label}{required ? " *" : ""}{optional ? <span className="normal-case tracking-normal text-[var(--text-muted)]"> — optional</span> : null}
      </span>
      {children}
    </label>
  );
}

function InfoCard({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">{icon}</span>
        <div>
          <p className="text-sm font-black">{title}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{copy}</p>
        </div>
      </div>
    </div>
  );
}

async function readSafePayload(response: Response): Promise<{ success?: boolean; id?: string; error?: string }> {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return { error: response.ok ? undefined : "We couldn’t send your request. Please try again." };
    }
    const payload = await response.json();
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return { error: response.ok ? undefined : "We couldn’t send your request. Please try again." };
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
