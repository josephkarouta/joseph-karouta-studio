"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, LoaderCircle, Pencil, Save, UserRound, X } from "lucide-react";
import { Button, GlassCard } from "@/components/ui/heyy";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Profile = {
  customer_type: "personal" | "business";
  legal_name: string;
  company_name: string;
  company_number: string;
  tax_id: string;
  email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state_region: string;
  postal_code: string;
  country_code: string;
};

const empty: Profile = {
  customer_type: "personal",
  legal_name: "",
  company_name: "",
  company_number: "",
  tax_id: "",
  email: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state_region: "",
  postal_code: "",
  country_code: "AU",
};

export default function BillingInformationCard() {
  const [profile, setProfile] = useState<Profile>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savedProfile, setSavedProfile] = useState<Profile>(empty);

  async function token() {
    const { data } = await createSupabaseBrowserClient().auth.getSession();
    const access = data.session?.access_token;
    if (!access) throw new Error("Your session expired. Sign in again.");
    return access;
  }

  useEffect(() => {
    void (async () => {
      try {
        const access = await token();
        const response = await fetch("/api/account/billing-profile", { headers: { Authorization: `Bearer ${access}` }, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Billing information could not be loaded.");
        const loadedProfile = { ...empty, ...(result.profile || {}) };
        setProfile(loadedProfile);
        setSavedProfile(loadedProfile);
      } catch (value) {
        setError(value instanceof Error ? value.message : "Billing information could not be loaded.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const access = await token();
      const response = await fetch("/api/account/billing-profile", {
        method: "PUT",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Billing information could not be saved.");
      const nextProfile = { ...empty, ...(result.profile || profile) };
      setProfile(nextProfile);
      setSavedProfile(nextProfile);
      setSaved(true);
      setEditing(false);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Billing information could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="mt-5 p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[var(--accent-strong)]">Invoice details</p>
          <h2 className="mt-2 text-2xl font-black">Billing information</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">Saved details are used for future Heyy Studio invoices. Tax is calculated at secure checkout from the transaction location and applicable tax rules.</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="inline-flex items-center gap-2 text-xs font-black text-emerald-600"><CheckCircle2 size={15}/> Saved</span>}
          {!loading && !editing && (
            <Button type="button" variant="secondary" onClick={() => { setSaved(false); setError(""); setEditing(true); }}>
              <Pencil size={15}/> Edit
            </Button>
          )}
        </div>
      </div>

      {loading ? <div className="grid min-h-32 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent-strong)]"/></div> : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5">
            <button type="button" disabled={!editing} onClick={() => setProfile({ ...profile, customer_type: "personal" })} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${profile.customer_type === "personal" ? "bg-[var(--surface-strong)] text-[var(--accent-strong)] shadow-sm" : "text-[var(--text-muted)]"} ${!editing ? "cursor-default" : "hover:bg-[var(--surface-hover)]"}`}><UserRound size={15}/> Personal</button>
            <button type="button" disabled={!editing} onClick={() => setProfile({ ...profile, customer_type: "business" })} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${profile.customer_type === "business" ? "bg-[var(--surface-strong)] text-[var(--accent-strong)] shadow-sm" : "text-[var(--text-muted)]"} ${!editing ? "cursor-default" : "hover:bg-[var(--surface-hover)]"}`}><Building2 size={15}/> Business</button>
          </div>
          <Field label={profile.customer_type === "business" ? "Contact / legal name *" : "Legal name *"} value={profile.legal_name} editing={editing} onChange={(value) => setProfile({ ...profile, legal_name: value })}/>
          <Field label="Billing email *" type="email" value={profile.email} editing={editing} onChange={(value) => setProfile({ ...profile, email: value })}/>
          {profile.customer_type === "business" && <><Field label="Company / legal business name *" value={profile.company_name} editing={editing} onChange={(value) => setProfile({ ...profile, company_name: value })}/><Field label="Company registration number (optional)" value={profile.company_number} editing={editing} onChange={(value) => setProfile({ ...profile, company_number: value })}/></>}
          {profile.customer_type === "business" && <Field label={profile.country_code === "AU" ? "ABN (optional)" : "VAT / tax ID (optional)"} value={profile.tax_id} editing={editing} onChange={(value) => setProfile({ ...profile, tax_id: value })}/>}
          <Field label="Country code *" placeholder="AU" maxLength={2} value={profile.country_code} editing={editing} onChange={(value) => setProfile({ ...profile, country_code: value.toUpperCase() })}/>
          {profile.customer_type === "business" && profile.country_code === "AU" && <p className="text-xs font-semibold leading-5 text-[var(--text-muted)] sm:col-span-2">For Australian businesses, the ABN can be saved to the Stripe customer record. You do not need to declare whether your business is GST registered here; GST on a taxable Australian sale is determined by the supplier's tax obligations and the transaction.</p>}
          <Field className="sm:col-span-2" label="Address line 1 *" value={profile.address_line1} editing={editing} onChange={(value) => setProfile({ ...profile, address_line1: value })}/>
          <Field className="sm:col-span-2" label="Address line 2 (optional)" value={profile.address_line2} editing={editing} onChange={(value) => setProfile({ ...profile, address_line2: value })}/>
          <Field label="City *" value={profile.city} editing={editing} onChange={(value) => setProfile({ ...profile, city: value })}/>
          <Field label="State / region" value={profile.state_region} editing={editing} onChange={(value) => setProfile({ ...profile, state_region: value })}/>
          <Field label="Postcode / ZIP *" value={profile.postal_code} editing={editing} onChange={(value) => setProfile({ ...profile, postal_code: value })}/>
          {error && <p className="sm:col-span-2 text-sm font-bold text-red-500">{error}</p>}
          {editing && (
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <Button type="button" onClick={save} disabled={saving}>{saving ? <LoaderCircle size={16} className="animate-spin"/> : <Save size={16}/>} Save billing information</Button>
              <Button type="button" variant="secondary" disabled={saving} onClick={() => { setProfile(savedProfile); setError(""); setSaved(false); setEditing(false); }}>
                <X size={16}/> Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

function Field({ label, value, onChange, editing, type = "text", placeholder, maxLength, className = "" }: { label: string; value: string; onChange: (value: string) => void; editing: boolean; type?: string; placeholder?: string; maxLength?: number; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-2 block text-[.62rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)]">{label}</span>
      <input
        className={`heyy-input w-full transition ${editing ? "" : "pointer-events-none cursor-default select-none bg-[var(--surface-hover)] text-[var(--text-secondary)] opacity-100"}`}
        type={type}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value || ""}
        disabled={!editing}
        tabIndex={editing ? 0 : -1}
        aria-disabled={!editing}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
