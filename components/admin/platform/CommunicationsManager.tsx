"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Mail, Save, Send, Sparkles } from "lucide-react";

type Template = {
  key: string;
  name: string;
  category: string;
  description: string;
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  enabled: boolean;
  overridden: boolean;
};

type SendRow = {
  id: string;
  recipient_email: string;
  template_key: string;
  subject: string;
  status: string;
  created_at: string;
};

export default function CommunicationsManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [history, setHistory] = useState<SendRow[]>([]);
  const [testEmail, setTestEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selected = useMemo(
    () => templates.find((item) => item.key === selectedKey) || templates[0] || null,
    [selectedKey, templates],
  );

  async function load() {
    setLoading(true);
    const [templatesResponse, historyResponse] = await Promise.all([
      fetch("/api/admin/communications/templates", { cache: "no-store" }),
      fetch("/api/admin/communications/history", { cache: "no-store" }),
    ]);
    const templateData = await templatesResponse.json();
    const historyData = await historyResponse.json();
    setTemplates(templateData.templates || []);
    setHistory(historyData.sends || []);
    setSelectedKey((current) => current || templateData.templates?.[0]?.key || "");
    setLoading(false);
  }

  useEffect(() => void load(), []);

  function updateSelected(field: keyof Template, value: string | boolean) {
    if (!selected) return;
    setTemplates((items) =>
      items.map((item) => (item.key === selected.key ? { ...item, [field]: value } : item)),
    );
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/communications/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey: selected.key,
        subject: selected.subject,
        preheader: selected.preheader,
        eyebrow: selected.eyebrow,
        title: selected.title,
        body: selected.body,
        ctaLabel: selected.ctaLabel,
        enabled: selected.enabled,
      }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Template saved." : result.error || "Template could not be saved.");
    setSaving(false);
    if (response.ok) await load();
  }

  async function sendTest() {
    if (!selected || !testEmail) return;
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/communications/test-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateKey: selected.key, email: testEmail }),
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? `Test sent to ${testEmail}.${result.ctaPath ? ` CTA: ${result.ctaPath}.` : ""}${result.invoiceAttached ? " Sample PDF invoice attached." : ""}`
        : result.error || "Test could not be sent.",
    );
    setSaving(false);
    if (response.ok) await load();
  }

  if (loading) {
    return <div className="grid min-h-80 place-items-center rounded-3xl border border-violet-100 bg-white"><LoaderCircle className="animate-spin text-violet-600" /></div>;
  }

  return (
    <div className="grid gap-5 2xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="h-fit rounded-3xl border border-violet-100 bg-white p-3 shadow-sm">
        <div className="p-3">
          <p className="text-[.62rem] font-black uppercase tracking-[.16em] text-violet-600">Email library</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">One Heyy Studio shell, editable transactional copy and a shared send history.</p>
        </div>
        <div className="grid gap-1">
          {templates.map((template) => (
            <button key={template.key} type="button" onClick={() => setSelectedKey(template.key)} className={`rounded-2xl px-3 py-3 text-left transition ${selected?.key === template.key ? "bg-violet-600 text-white" : "hover:bg-violet-50"}`}>
              <p className="text-sm font-black">{template.name}</p>
              <p className={`mt-1 text-[.68rem] font-bold ${selected?.key === template.key ? "text-violet-100" : "text-slate-400"}`}>{template.category}</p>
            </button>
          ))}
        </div>
      </aside>

      <div className="grid gap-5">
        {selected && (
          <section className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-violet-600"><Sparkles size={17}/><p className="text-[.62rem] font-black uppercase tracking-[.16em]">{selected.category}</p></div>
                <h2 className="mt-2 text-2xl font-black">{selected.name}</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{selected.description}</p>
                {selected.category === "Production" && <p className="mt-2 text-xs font-bold text-amber-600">These fields show the current built-in production copy. Edit and save only when you want an Admin override; clearing a field keeps the built-in event-specific value.</p>}
              </div>
              <label className="flex items-center gap-2 text-xs font-black text-slate-600"><input type="checkbox" checked={selected.enabled} onChange={(event) => updateSelected("enabled", event.target.checked)} /> Enabled</label>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Subject" value={selected.subject} onChange={(value) => updateSelected("subject", value)} />
              <Field label="Preheader" value={selected.preheader} onChange={(value) => updateSelected("preheader", value)} />
              <Field label="Eyebrow" value={selected.eyebrow} onChange={(value) => updateSelected("eyebrow", value)} />
              <Field label="Heading" value={selected.title} onChange={(value) => updateSelected("title", value)} />
              <div className="md:col-span-2"><Field label="Body" value={selected.body} multiline onChange={(value) => updateSelected("body", value)} /></div>
              <Field label="Button label" value={selected.ctaLabel} onChange={(value) => updateSelected("ctaLabel", value)} />
            </div>

            <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">Supported placeholders depend on the email, including <code>{"{{first_name}}"}</code>, <code>{"{{project_name}}"}</code>, <code>{"{{service}}"}</code>, <code>{"{{amount}}"}</code>, <code>{"{{description}}"}</code>, <code>{"{{invoice_number}}"}</code>, <code>{"{{role_title}}"}</code> and <code>{"{{applicant_name}}"}</code>. Buttons keep their secure system-generated destination rather than storing a hard-coded domain.</p>

            <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-xs font-semibold leading-5 text-slate-600">
              <span className="font-black text-violet-700">Test-email note:</span> Test buttons now use the relevant Heyy Studio destination. Client production tests use the test recipient’s most recent production project when one exists; Admin tests use the latest request or production job. Live transactional emails still use the exact resource that triggered the event. Payment confirmation tests include a sample Heyy Studio PDF invoice; real payments generate the real invoice and Payment History record.
            </div>

            <div className="mt-6 flex flex-wrap items-end gap-3">
              <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-xs font-black text-white disabled:opacity-50"><Save size={14}/>{saving ? "Saving…" : "Save template"}</button>
              <label className="min-w-64 flex-1 max-w-sm"><span className="mb-2 block text-[.62rem] font-black uppercase tracking-[.14em] text-slate-500">Test recipient</span><input value={testEmail} onChange={(event) => setTestEmail(event.target.value)} type="email" placeholder="you@example.com" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-violet-400" /></label>
              <button type="button" disabled={saving || !testEmail} onClick={() => void sendTest()} className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-5 py-3 text-xs font-black text-violet-700 disabled:opacity-50"><Send size={14}/>Send test</button>
            </div>
            {message && <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">{message}</p>}
          </section>
        )}

        <section className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2"><Mail size={18} className="text-violet-600"/><h2 className="text-xl font-black">Recent email activity</h2></div>
          <div className="mt-4 divide-y divide-slate-100">
            {history.length === 0 ? <p className="py-6 text-sm font-semibold text-slate-400">No tracked sends yet.</p> : history.slice(0, 30).map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-black">{row.subject}</p><p className="mt-1 text-xs font-semibold text-slate-400">{row.recipient_email} · {row.template_key}</p></div><div className="text-right"><p className={`text-xs font-black uppercase ${row.status === "sent" ? "text-emerald-600" : row.status === "failed" ? "text-red-500" : "text-amber-600"}`}>{row.status}</p><p className="mt-1 text-[.68rem] font-bold text-slate-400">{new Date(row.created_at).toLocaleString()}</p></div></div>)}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <label><span className="mb-2 block text-[.62rem] font-black uppercase tracking-[.14em] text-slate-500">{label}</span>{multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold leading-6 outline-none focus:border-violet-400"/> : <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-violet-400"/>}</label>;
}
