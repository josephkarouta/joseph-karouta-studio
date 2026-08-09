"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileClock,
  ImageIcon,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  RotateCcw,
  Search,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";

type Status = "draft" | "approved" | "rejected" | "final" | "source";
type Version = {
  id:string; studio:string; studioLabel:string; projectId:string|null; projectName:string; projectHref:string|null;
  familyKey:string; sourceKind:string; sourceId:string; versionNumber:number; title:string; assetType:string; assetTypeLabel:string;
  status:Status; provider:string|null; model:string|null; creditCost:number|null; changeSummary:string|null; userNote:string|null;
  isCurrent:boolean; restoredFromVersionId:string|null; createdAt:string; previewUrl:string|null; mimeType:string|null; canRestore:boolean;
};
type Family = {
  familyKey:string; studio:string; studioLabel:string; projectId:string|null; projectName:string; projectHref:string|null;
  title:string; assetType:string; assetTypeLabel:string; currentVersion:number; status:Status; previewUrl:string|null; updatedAt:string; versions:Version[];
};

const STUDIO_ACCENTS:Record<string,string>={brand:"#8b2cff",architecture:"#087bf1",interior:"#f18b22",marketing:"#ef2b8d",production:"#10a36b",tools:"#6067f2",other:"#6b7280"};

function date(value:string){try{return new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}catch{return value;}}
function statusLabel(value:Status){return value.charAt(0).toUpperCase()+value.slice(1);}
function fileKind(version:Version){const mime=String(version.mimeType||""); const url=String(version.previewUrl||""); if(mime.startsWith("image/")||/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url))return "image"; if(mime.includes("pdf")||/\.pdf(\?|$)/i.test(url))return "pdf"; return "file";}

export default function VersionHistory(){
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  async function token() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Your session expired. Sign in again.");
    return data.session.access_token;
  }

  const [families,setFamilies]=useState<Family[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const [search,setSearch]=useState(""); const [studio,setStudio]=useState("all"); const [project,setProject]=useState("all");
  const [active,setActive]=useState<Family|null>(null); const [compare,setCompare]=useState<string[]>([]); const [busy,setBusy]=useState(""); const [actionError,setActionError]=useState("");

  async function load(){setLoading(true);setError("");try{const accessToken=await token();const r=await fetch("/api/versions/history",{headers:{Authorization:`Bearer ${accessToken}`},cache:"no-store"});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.error||"Could not load version history.");const nextFamilies:Family[]=j.families||[];setFamilies(nextFamilies);const requestedFamily=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("family"):null;if(requestedFamily){setActive(nextFamilies.find((x:Family)=>x.familyKey===requestedFamily)||null);}else if(active){const next=nextFamilies.find((x:Family)=>x.familyKey===active.familyKey);setActive(next||null);}}catch(e){setError(e instanceof Error?e.message:"Could not load version history.");}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);

  const projects=useMemo(()=>Array.from(new Map(families.filter(x=>x.projectId).map(x=>[`${x.studio}:${x.projectId}`,{key:`${x.studio}:${x.projectId}`,name:x.projectName}])).values()).sort((a,b)=>a.name.localeCompare(b.name)),[families]);
  const filtered=useMemo(()=>families.filter(f=>{if(studio!=="all"&&f.studio!==studio)return false;if(project!=="all"&&`${f.studio}:${f.projectId}`!==project)return false;const q=search.trim().toLowerCase();return !q||`${f.title} ${f.projectName} ${f.assetTypeLabel}`.toLowerCase().includes(q);}),[families,studio,project,search]);
  const metrics=useMemo(()=>({families:families.length,versions:families.reduce((s,f)=>s+f.versions.length,0),approved:families.filter(f=>["approved","final"].includes(f.status)).length,restored:families.reduce((s,f)=>s+f.versions.filter(v=>v.restoredFromVersionId).length,0)}),[families]);

  async function action(version:Version,kind:"restore"|"status"|"note",extra:Record<string,unknown>={}){setBusy(`${kind}:${version.id}`);setActionError("");try{const accessToken=await token();const r=await fetch("/api/versions/action",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${accessToken}`},body:JSON.stringify({action:kind,versionId:version.id,...extra})});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.error||"Could not update the version.");await load();}catch(e){setActionError(e instanceof Error?e.message:"Could not update the version.");}finally{setBusy("");}}

  return <main className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--text-primary)] sm:px-7 lg:px-10">
    <div className="mx-auto max-w-[1500px]">
      <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,var(--surface),var(--accent-soft))] p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-[.62rem] font-black uppercase tracking-[.22em] text-[var(--accent-strong)]">Workspace history</p><h1 className="mt-2 text-3xl font-black tracking-[-.045em] sm:text-4xl">Project Version History</h1><p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">Every regeneration stays traceable. Compare versions, record decisions, restore earlier work and see the AI model and credit cost when that data was captured.</p></div><button onClick={()=>void load()} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-black"><RefreshCcw size={14} className={loading?"animate-spin":""}/>Refresh</button></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Tracked assets" value={metrics.families}/><Metric label="Saved versions" value={metrics.versions}/><Metric label="Approved / final" value={metrics.approved}/><Metric label="Restores" value={metrics.restored}/></div>
      </section>

      <section className="mt-5 rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"><div className="grid gap-3 lg:grid-cols-[1fr_210px_250px]">
        <label className="relative"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search versions, projects or asset types" className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] pl-11 pr-4 text-sm font-semibold outline-none focus:border-[var(--accent-strong)]"/></label>
        <Select value={studio} onChange={setStudio} options={[{value:"all",label:"All Studios"},...Array.from(new Set(families.map(f=>f.studio))).sort().map(s=>({value:s,label:families.find(f=>f.studio===s)?.studioLabel||s}))]}/>
        <Select value={project} onChange={setProject} options={[{value:"all",label:"All Projects"},...projects.map(p=>({value:p.key,label:p.name}))]}/>
      </div></section>

      {loading?<State icon={<Loader2 className="animate-spin"/>} title="Loading version history" text="Collecting saved generations and delivery versions."/>:error?<State icon={<XCircle/>} title="Version history could not load" text={error} action={<button onClick={()=>void load()} className="rounded-full bg-[var(--accent-strong)] px-5 py-2.5 text-xs font-black text-white">Retry</button>}/>:filtered.length===0?<State icon={<FileClock/>} title="No versions match these filters" text="Try another Studio, project or search term."/>:
      <section className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{filtered.map(f=><FamilyCard key={f.familyKey} family={f} onOpen={()=>{setActive(f);setCompare([]);setActionError("");}}/>)}</section>}
    </div>
    {active&&<HistoryModal family={active} compare={compare} setCompare={setCompare} busy={busy} error={actionError} onClose={()=>setActive(null)} onRestore={(v)=>void action(v,"restore")} onStatus={(v,s)=>void action(v,"status",{status:s})} onNote={(v,n)=>void action(v,"note",{note:n})}/>} 
  </main>;
}

function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4"><p className="text-[.58rem] font-black uppercase tracking-[.16em] text-[var(--text-muted)]">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>}
function Select({value,onChange,options}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[]}){return <label className="relative"><select value={value} onChange={e=>onChange(e.target.value)} className="h-12 w-full appearance-none rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 pr-10 text-sm font-bold outline-none focus:border-[var(--accent-strong)]">{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"/></label>}
function State({icon,title,text,action}:{icon:ReactNode;title:string;text:string;action?:ReactNode}){return <div className="mt-5 grid min-h-[310px] place-items-center rounded-[1.8rem] border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">{icon}</div><h3 className="mt-4 text-xl font-black">{title}</h3><p className="mt-2 max-w-md text-sm font-semibold text-[var(--text-secondary)]">{text}</p>{action&&<div className="mt-4">{action}</div>}</div></div>}
function FamilyCard({family,onOpen}:{family:Family;onOpen:()=>void}){const accent=STUDIO_ACCENTS[family.studio]||STUDIO_ACCENTS.other;return <button onClick={onOpen} className="group overflow-hidden rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface)] text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="relative grid aspect-[16/8] place-items-center overflow-hidden bg-[var(--surface-hover)]">{family.previewUrl?<img src={family.previewUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]"/>:<ImageIcon size={34} className="text-[var(--text-muted)]"/>}<span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[.55rem] font-black uppercase tracking-[.13em] text-white" style={{background:accent}}>{family.studioLabel}</span><span className="absolute right-3 top-3 rounded-full bg-black/75 px-2.5 py-1 text-[.55rem] font-black uppercase tracking-[.13em] text-white">{family.versions.length} version{family.versions.length===1?"":"s"}</span></div><div className="p-4"><p className="text-[.58rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">{family.assetTypeLabel} · Current V{family.currentVersion}</p><h3 className="mt-2 line-clamp-2 text-lg font-black">{family.title}</h3><p className="mt-1 truncate text-xs font-semibold text-[var(--text-secondary)]">{family.projectName}</p><div className="mt-4 flex items-center justify-between"><Status status={family.status}/><span className="text-[.62rem] font-bold text-[var(--text-muted)]">{date(family.updatedAt)}</span></div></div></button>}
function Status({status}:{status:Status}){const icon=status==="approved"||status==="final"?<Check size={11}/>:status==="rejected"?<X size={11}/>:<Clock3 size={11}/>;return <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-2.5 py-1 text-[.56rem] font-black uppercase tracking-[.1em]">{icon}{statusLabel(status)}</span>}

function HistoryModal({family,compare,setCompare,busy,error,onClose,onRestore,onStatus,onNote}:{family:Family;compare:string[];setCompare:(v:string[])=>void;busy:string;error:string;onClose:()=>void;onRestore:(v:Version)=>void;onStatus:(v:Version,s:Status)=>void;onNote:(v:Version,n:string)=>void}){
  const selected=family.versions.filter(v=>compare.includes(v.id));
  return <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/70 p-3 backdrop-blur-md sm:p-6" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="mx-auto max-w-[1450px] rounded-[1.8rem] border border-white/10 bg-[var(--surface-strong)] shadow-2xl"><header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[color:var(--surface-strong)]/95 px-5 py-4 backdrop-blur"><div><p className="text-[.58rem] font-black uppercase tracking-[.18em] text-[var(--accent-strong)]">Version history · {family.projectName}</p><h2 className="mt-1 text-xl font-black">{family.title}</h2></div><div className="flex items-center gap-2">{selected.length===2&&<span className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--accent-soft)] px-4 text-xs font-black text-[var(--accent-strong)]"><ArrowLeftRight size={14}/>Comparing V{selected[0].versionNumber} & V{selected[1].versionNumber}</span>}<button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)]"><X size={16}/></button></div></header>
    {error&&<div className="m-5 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">{error}</div>}
    {selected.length===2&&<div className="grid gap-4 border-b border-[var(--border)] p-5 lg:grid-cols-2">{selected.map(v=><ComparePane key={v.id} version={v}/>)}</div>}
    <div className="p-5"><p className="mb-3 text-[.6rem] font-black uppercase tracking-[.18em] text-[var(--text-muted)]">Select any two versions to compare</p><div className="space-y-3">{family.versions.map(v=><VersionRow key={v.id} version={v} compare={compare} setCompare={setCompare} busy={busy} onRestore={onRestore} onStatus={onStatus} onNote={onNote}/>)}</div></div>
  </div></div>;
}
function ComparePane({version}:{version:Version}){return <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"><div className="flex items-center justify-between px-4 py-3"><strong>Version {version.versionNumber}</strong><Status status={version.status}/></div><div className="grid min-h-[300px] place-items-center bg-[#0e0d12] p-3">{version.previewUrl&&fileKind(version)==="image"?<img src={version.previewUrl} alt="" className="max-h-[58vh] max-w-full object-contain"/>:<div className="text-sm font-bold text-white/60">Visual preview unavailable</div>}</div></div>}
function VersionRow({version,compare,setCompare,busy,onRestore,onStatus,onNote}:{version:Version;compare:string[];setCompare:(v:string[])=>void;busy:string;onRestore:(v:Version)=>void;onStatus:(v:Version,s:Status)=>void;onNote:(v:Version,n:string)=>void}){const [note,setNote]=useState(version.userNote||"");const checked=compare.includes(version.id);function toggle(){if(checked)setCompare(compare.filter(id=>id!==version.id));else setCompare([...compare.slice(-1),version.id]);}return <div className={`rounded-2xl border p-4 ${version.isCurrent?"border-[var(--accent-border)] bg-[var(--accent-soft)]":"border-[var(--border)] bg-[var(--surface)]"}`}><div className="grid gap-4 xl:grid-cols-[110px_1fr_auto]"><button onClick={toggle} className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-[#0e0d12]">{version.previewUrl&&fileKind(version)==="image"?<img src={version.previewUrl} alt="" className="h-full w-full object-cover"/>:<ImageIcon className="text-white/50"/>}<span className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border ${checked?"border-[var(--accent-strong)] bg-[var(--accent-strong)] text-white":"border-white/60 bg-black/50 text-white"}`}>{checked?<Check size={12}/>:<ArrowLeftRight size={11}/>}</span></button><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">Version {version.versionNumber}</h3>{version.isCurrent&&<span className="rounded-full bg-[var(--accent-strong)] px-2 py-1 text-[.52rem] font-black uppercase tracking-[.12em] text-white">Current</span>}<Status status={version.status}/>{version.restoredFromVersionId&&<span className="rounded-full border border-[var(--border)] px-2 py-1 text-[.52rem] font-black uppercase tracking-[.1em]">Restored</span>}</div><p className="mt-2 text-xs font-semibold text-[var(--text-secondary)]">{version.changeSummary||"Saved project version"}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[.64rem] font-bold text-[var(--text-muted)]"><span>{date(version.createdAt)}</span>{version.provider&&<span>Provider: {version.provider}</span>}{version.model&&<span>Model: {version.model}</span>}{version.creditCost!==null&&<span>{version.creditCost} credits</span>}</div><div className="mt-3 flex max-w-2xl gap-2"><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a note about this version" className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-xs font-semibold outline-none focus:border-[var(--accent-strong)]"/><button onClick={()=>onNote(version,note)} disabled={busy===`note:${version.id}`} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)]">{busy===`note:${version.id}`?<Loader2 size={14} className="animate-spin"/>:<MessageSquareText size={14}/>}</button></div></div><div className="flex flex-wrap items-start justify-end gap-2"><select value={version.status} onChange={e=>onStatus(version,e.target.value as Status)} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-xs font-black"><option value="draft">Draft</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="final">Final</option>{version.status==="source"&&<option value="source">Source</option>}</select>{version.canRestore&&!version.isCurrent&&<button onClick={()=>onRestore(version)} disabled={busy===`restore:${version.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-3 text-xs font-black text-white disabled:opacity-50">{busy===`restore:${version.id}`?<Loader2 size={14} className="animate-spin"/>:<RotateCcw size={14}/>}Restore</button>}{version.projectHref&&<Link href={version.projectHref} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)]" title="Open project"><ExternalLink size={14}/></Link>}</div></div></div>}
