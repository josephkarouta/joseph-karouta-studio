"use client";

export default function BrandPage({
  number,
  title,
  eyebrow,
  children,
}:{
  number:string;
  title:string;
  eyebrow:string;
  children:React.ReactNode;
}){
  return(
    <section className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] overflow-hidden">
      <div className="border-b border-white/10 px-8 py-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-purple-300">{eyebrow}</p>
          <h2 className="mt-3 text-4xl font-black">{title}</h2>
        </div>
        <div className="text-6xl font-black text-white/10">{number}</div>
      </div>
      <div className="p-8 md:p-10">
        {children}
      </div>
    </section>
  )
}
