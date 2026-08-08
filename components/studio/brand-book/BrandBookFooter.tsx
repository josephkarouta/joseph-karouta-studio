"use client";

export default function BrandBookFooter({project}:{project:any}){
  return(
    <div className="mt-12 flex items-center justify-between border-t border-white/10 pt-6 text-xs uppercase tracking-[0.25em] text-white/30">
      <span>{project?.project_name || "Brand Project"}</span>
      <span>Generated with Heyy Studio</span>
    </div>
  )
}
