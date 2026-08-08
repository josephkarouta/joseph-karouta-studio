"use client";

const pages=[
"01 Cover",
"02 Contents",
"03 Brand Foundation",
"04 Colour System",
"05 Typography",
"06 Creative Direction",
"07 Moodboard",
"08 Logo System",
"09 Logo Rules",
"10 Patterns",
"11 Icons",
"12 Photography",
"13 Applications",
"14 Social",
"15 Stationery",
"16 Checklist"
];

export function BrandBookContents(){
return(
<section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-10">
<p className="text-xs uppercase tracking-[0.35em] text-purple-300">Contents</p>
<h2 className="mt-4 text-5xl font-black">Brand Guidelines</h2>

<div className="mt-10 grid gap-3">
{pages.map((p)=>(
<div key={p} className="flex items-center justify-between border-b border-white/10 py-3">
<span className="font-medium">{p}</span>
<span className="text-white/25">•</span>
</div>
))}
</div>
</section>
)}
