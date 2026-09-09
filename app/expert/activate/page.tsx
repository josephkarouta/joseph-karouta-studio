import { Suspense } from "react";
import ExpertActivation from "@/components/expert/ExpertActivation";

export default function Page() {
  return <Suspense fallback={<main className="min-h-screen bg-[var(--background)]"/>}><ExpertActivation/></Suspense>;
}
