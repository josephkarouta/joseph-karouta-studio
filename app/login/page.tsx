import { Suspense } from "react";
import AuthScreen from "@/components/account/AuthScreen";
export default function LoginPage(){return <Suspense fallback={<main className="min-h-screen bg-[var(--background)]"/>}><AuthScreen mode="login"/></Suspense>}
