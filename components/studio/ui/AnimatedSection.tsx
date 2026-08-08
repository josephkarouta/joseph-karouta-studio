"use client";
export default function AnimatedSection({children}:{children:React.ReactNode}){
return <div className="animate-in fade-in duration-500 slide-in-from-bottom-2">{children}</div>;
}