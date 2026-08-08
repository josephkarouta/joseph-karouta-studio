"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Mail, ShieldCheck, UserRound } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import { useAuth } from "@/components/auth-provider";
import { Button, Eyebrow, GlassCard } from "@/components/ui/heyy";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function AccountPage(){
  const {user,refreshUser}=useAuth();
  const [name,setName]=useState(String(user?.user_metadata?.full_name||user?.user_metadata?.name||""));
  const [saving,setSaving]=useState(false); const [message,setMessage]=useState("");
  useEffect(()=>{setName(String(user?.user_metadata?.full_name||user?.user_metadata?.name||""));},[user]);
  async function save(){setSaving(true);setMessage("");const supabase=createSupabaseBrowserClient();const {error}=await supabase.auth.updateUser({data:{full_name:name}});setMessage(error?error.message:"Profile updated.");if(!error)await refreshUser();setSaving(false);}
  return <AccountLayout><Eyebrow>Account</Eyebrow><h1 className="mt-3 text-4xl font-black tracking-[-.055em] sm:text-5xl">Profile & access</h1><p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">Manage the identity used across your workspace, production requests and account menu.</p><div className="mt-7 grid gap-4 xl:grid-cols-2"><GlassCard className="p-7"><UserRound size={21} className="text-[var(--accent-strong)]"/><h2 className="mt-5 text-xl font-black">Profile</h2><label className="mt-5 block text-xs font-black uppercase tracking-[.14em] text-[var(--text-muted)]">Display name</label><input value={name} onChange={e=>setName(e.target.value)} className="heyy-input mt-2 w-full" placeholder="Your name"/><label className="mt-5 block text-xs font-black uppercase tracking-[.14em] text-[var(--text-muted)]">Email</label><div className="mt-2 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--text-secondary)]"><Mail size={16}/>{user?.email}</div>{message&&<p className={`mt-3 text-xs font-bold ${message.includes("updated")?"text-emerald-600":"text-red-500"}`}>{message}</p>}<Button onClick={save} disabled={saving} className="mt-6">{saving&&<LoaderCircle size={16} className="animate-spin"/>}Save changes</Button></GlassCard><GlassCard className="p-7"><ShieldCheck size={21} className="text-emerald-500"/><h2 className="mt-5 text-xl font-black">Security</h2><p className="mt-3 text-sm font-semibold leading-7 text-[var(--text-secondary)]">Authentication is handled by Supabase. Password reset and account verification are sent to your registered email address.</p><Button variant="secondary" className="mt-6" onClick={async()=>{const supabase=createSupabaseBrowserClient();if(user?.email){await supabase.auth.resetPasswordForEmail(user.email,{redirectTo:`${window.location.origin}/account`});setMessage("Password reset email sent.");}}}>Send password reset email</Button></GlassCard></div></AccountLayout>;
}
