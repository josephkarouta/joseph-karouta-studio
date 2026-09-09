"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import ProductionPanel from "@/components/studio/production/ProductionPanel";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function DirectProductionProjectPage() {
  const params = useParams();
  const projectId = String(params.projectId || "");
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [latest, setLatest] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading) return;
      if (!user || !projectId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Your session expired. Sign in again.");
        const response = await fetch(`/api/production/client-status?projectId=${encodeURIComponent(projectId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || "Could not load this production project.");
        if (!cancelled) setLatest(payload.latest || null);
      } catch (value) {
        if (!cancelled) setError(value instanceof Error ? value.message : "Could not load this production project.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [authLoading, projectId, user]);

  if (authLoading || loading) {
    return (
      <main className="grid min-h-[65vh] place-items-center p-6">
        <div className="flex items-center gap-3 text-sm font-black text-[var(--text-secondary)]"><Loader2 size={18} className="animate-spin" />Opening production workspace…</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl p-6 py-16 text-center">
        <h1 className="text-3xl font-black">Sign in to open this production project</h1>
        <p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">Your Expert quote, payment, files and revisions are kept inside your private Heyy Studio account.</p>
        <Link href={`/login?next=${encodeURIComponent(`/dashboard/production/${projectId}`)}`} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[var(--text-primary)] px-5 text-sm font-black text-[var(--surface-strong)]">Sign in</Link>
      </main>
    );
  }

  if (error || !latest) {
    return (
      <main className="mx-auto max-w-2xl p-6 py-16 text-center">
        <h1 className="text-3xl font-black">Production project unavailable</h1>
        <p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">{error || "We could not find a production request connected to this project."}</p>
        <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-full border border-[var(--border-strong)] px-5 text-sm font-black">Back to dashboard</Link>
      </main>
    );
  }

  const project = {
    id: projectId,
    project_name: latest.projectName || "Expert production project",
    user_id: user.id,
  };

  return (
    <main className="mx-auto w-full max-w-[1380px] p-4 sm:p-6 lg:p-8">
      <section className="mb-5 rounded-[26px] border border-[var(--border)] bg-[var(--surface-strong)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <p className="text-[.62rem] font-black uppercase tracking-[.18em] text-[var(--accent-strong)]">Expert production</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-.05em] sm:text-4xl">{project.project_name}</h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">This production-only project does not require an AI concept. Your request, quote, payment, files and revisions stay connected here.</p>
      </section>

      <ProductionPanel
        project={project}
        brand={{}}
        studio={latest.studio}
        service={latest.service}
        serviceId={latest.serviceId}
        description="Expert production requested directly through Heyy Studio."
        buttonLabel="Send production request →"
      />
    </main>
  );
}
