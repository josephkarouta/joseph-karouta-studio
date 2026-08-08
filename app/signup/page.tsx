import { Suspense } from "react";
import AuthScreen from "@/components/account/AuthScreen";
export default function SignupPage(){return <Suspense fallback={<main className="min-h-screen bg-[var(--background)]"/>}><AuthScreen mode="signup"/></Suspense>}
