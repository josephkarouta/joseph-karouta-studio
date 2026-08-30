"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardList, LoaderCircle, Pencil, Plus, Save, Trash2, X } from "lucide-react";

type Kind = "quote" | "checklist";
type Row = { id:string; kind:Kind; name:string; studio?:string|null; service_id?:string|null; content:Record<string,unknown>; enabled:boolean; updated_at:string };

type Form = { name:string; studio:string; serviceId:string; title:string; description:string; amount:string; estimatedDays:string; revisions:string; extraRevisionFee:string; checklist:string; enabled:boolean };
const emptyForm: Form={name:"",studio:"",serviceId:"",title:"",description:"",amount:"",estimatedDays:"",revisions:"",extraRevisionFee:"",checklist:"",enabled:true};

export default function OperationalTemplatesManager(){
  const[kind,setKind]=useState<Kind>("quote");
  const[rows,setRows]=useState<Row[]>([]);
  const[loading,setLoading]=useState(true);
  const[editing,setEditing]=useState<Row|"new"|null>(null);
  const[form,setForm]=useState<Form>(emptyForm);
  const[message,setMessage]=useState("");
  const filtered=useMemo(()=>rows.filter(row=>row.kind===kind),[rows,kind]);

  async function load(){setLoading(true);const response=await fetch("/api/admin/templates",{cache:"no-store"});const data=await response.json();setRows(data.templates||[]);setLoading(false);}
  useEffect(()=>{void load();},[]);
  function open(row:Row|"new"){
    setEditing(row);setMessage("");
    if(row==="new"){setForm(emptyForm);return;}
    const c=row.content||{};
    setForm({
      name:row.name||"",studio:row.studio||"",serviceId:row.service_id||"",
      title:String(c.title||""),description:String(c.description||""),amount:String(c.amount||""),
      estimatedDays:String(c.estimated_days||""),revisions:String(c.included_revisions||""),extraRevisionFee:String(c.extra_revision_fee||""),
      checklist:Array.isArray(c.items)?c.items.map(String).join("\n"):"",enabled:row.enabled!==false,
    });
  }
  async function save(){
    const content=kind==="quote"?{
      title:form.title,description:form.description,
      ...(form.amount?{amount:Number(form.amount)}:{}),
      ...(form.estimatedDays?{estimated_days:Number(form.estimatedDays)}:{}),
      ...(form.revisions?{included_revisions:Number(form.revisions)}:{}),
      ...(form.extraRevisionFee?{extra_revision_fee:Number(form.extraRevisionFee)}:{}),
    }:{items:form.checklist.split("\n").map(v=>v.trim()).filter(Boolean)};
    const payload={kind,name:form.name,studio:form.studio,serviceId:form.serviceId,enabled:form.enabled,content,...(editing!=="new"&&editing?{id:editing.id}:{})};
    const response=await fetch("/api/admin/templates",{method:editing==="new"?"POST":"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await response.json();
    if(!response.ok){setMessage(data.error||"Template could not be saved.");return;}setEditing(null);setForm(emptyForm);setMessage("Template saved.");await load();
  }
  async function remove(row:Row){if(!confirm(`Delete ${row.name}?`))return;const response=await fetch(`/api/admin/templates?id=${encodeURIComponent(row.id)}`,{method:"DELETE"});if(response.ok)await load();}

  return <div className="grid gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
      <div className="flex gap-2">{(["quote","checklist"] as Kind[]).map(item=><button key={item} onClick={()=>setKind(item)} className={`rounded-full px-4 py-2 text-xs font-black capitalize ${kind===item?"bg-violet-600 text-white":"bg-violet-50 text-violet-700"}`}>{item} templates</button>)}</div>
      <button onClick={()=>open("new")} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"><Plus size={14}/>New {kind}</button>
    </div>
    {message&&<p className="rounded-2xl bg-slate-100 px-4 py-3 text-xs font-bold text-slate-600">{message}</p>}
    <section className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
      {loading?<div className="grid min-h-40 place-items-center"><LoaderCircle className="animate-spin text-violet-600"/></div>:filtered.length===0?<p className="py-10 text-center text-sm font-semibold text-slate-400">No {kind} templates yet.</p>:<div className="divide-y divide-slate-100">{filtered.map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><div className="flex items-center gap-2"><ClipboardList size={16} className="text-violet-600"/><p className="text-sm font-black">{row.name}</p>{!row.enabled&&<span className="rounded-full bg-slate-100 px-2 py-1 text-[.62rem] font-black text-slate-500">Disabled</span>}</div><p className="mt-1 text-xs font-semibold text-slate-400">{row.studio||"Any Studio"}{row.service_id?` · ${row.service_id}`:""}</p></div><div className="flex gap-2"><button onClick={()=>open(row)} className="grid h-9 w-9 place-items-center rounded-full border border-violet-100 text-violet-600"><Pencil size={14}/></button><button onClick={()=>void remove(row)} className="grid h-9 w-9 place-items-center rounded-full border border-red-100 text-red-500"><Trash2 size={14}/></button></div></div>)}</div>}
    </section>
    {editing&&<div className="fixed inset-0 z-[140] grid place-items-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm"><div className="my-8 w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[.62rem] font-black uppercase tracking-[.16em] text-violet-600">{editing==="new"?"New":"Edit"} {kind} template</p><h3 className="mt-2 text-3xl font-black">Reusable defaults</h3></div><button onClick={()=>setEditing(null)} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200"><X size={16}/></button></div>
      <div className="mt-6 grid gap-4 md:grid-cols-2"><Field label="Template name" value={form.name} onChange={v=>setForm({...form,name:v})}/><Field label="Studio (optional)" value={form.studio} onChange={v=>setForm({...form,studio:v})} placeholder="brand_studio"/><Field label="Service ID (optional)" value={form.serviceId} onChange={v=>setForm({...form,serviceId:v})} placeholder="business-card-production"/>
      {kind==="quote"?<><Field label="Quote title" value={form.title} onChange={v=>setForm({...form,title:v})}/><div className="md:col-span-2"><Field label="Scope & inclusions" value={form.description} onChange={v=>setForm({...form,description:v})} multiline/></div><Field label="Default amount (optional)" value={form.amount} onChange={v=>setForm({...form,amount:v})}/><Field label="Delivery days" value={form.estimatedDays} onChange={v=>setForm({...form,estimatedDays:v})}/><Field label="Included revisions" value={form.revisions} onChange={v=>setForm({...form,revisions:v})}/><Field label="Extra revision fee" value={form.extraRevisionFee} onChange={v=>setForm({...form,extraRevisionFee:v})}/></>:<div className="md:col-span-2"><Field label="Checklist items — one per line" value={form.checklist} onChange={v=>setForm({...form,checklist:v})} multiline/></div>}
      </div><label className="mt-5 flex items-center gap-2 text-xs font-black text-slate-600"><input type="checkbox" checked={form.enabled} onChange={e=>setForm({...form,enabled:e.target.checked})}/><Check size={14}/>Enabled</label><div className="mt-6 flex gap-2"><button onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-xs font-black text-white"><Save size={14}/>Save template</button><button onClick={()=>setEditing(null)} className="rounded-full border border-slate-200 px-5 py-3 text-xs font-black">Cancel</button></div></div></div>}
  </div>;
}

function Field({label,value,onChange,placeholder="",multiline=false}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;multiline?:boolean}){return <label><span className="mb-2 block text-[.62rem] font-black uppercase tracking-[.14em] text-slate-500">{label}</span>{multiline?<textarea rows={6} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"/>:<input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-violet-400"/>}</label>}
