"use client";
export default function PdfExportProgress({step}:{step:string}){
 return <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
  <p className="text-xs uppercase tracking-[0.25em] text-purple-300">PDF Export</p>
  <p className="mt-2 font-bold">{step}</p>
 </div>
}
