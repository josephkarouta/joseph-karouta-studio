"use client";
export default function BrandBookSkeleton(){
return <div className="animate-pulse space-y-4">
<div className="h-10 w-1/3 rounded bg-white/10"/>
<div className="h-64 rounded-3xl bg-white/5"/>
<div className="grid grid-cols-3 gap-4">
<div className="h-40 rounded-2xl bg-white/5"/>
<div className="h-40 rounded-2xl bg-white/5"/>
<div className="h-40 rounded-2xl bg-white/5"/>
</div></div>;
}