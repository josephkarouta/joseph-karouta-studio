import { BriefcaseBusiness, CheckCircle2, Globe2, ShieldCheck, UsersRound } from "lucide-react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { GlassCard, PageContainer } from "@/components/ui/heyy";
import ExpertsNetworkContent from "@/components/public/ExpertsNetworkContent";

export default function ExpertNetworkPage({
  initialRoleSlug,
  initialSource,
  prelaunch = false,
}: {
  initialRoleSlug?: string;
  initialSource?: string;
  prelaunch?: boolean;
}) {
  return (
    <main className="heyy-page min-h-screen">
      <SiteHeader prelaunch={prelaunch} />

      <section className="relative overflow-hidden border-b border-[var(--border)] pt-[var(--header-height)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_8%,rgba(111,45,255,.16),transparent_27rem),radial-gradient(circle_at_88%_4%,rgba(239,63,180,.12),transparent_30rem)]" />
        <PageContainer className="relative py-16 sm:py-24">
          <div className="max-w-4xl">
            <p className="text-[.66rem] font-black uppercase tracking-[.2em] text-[var(--accent-strong)]">Heyy Studio Expert Network</p>
            <h1 className="mt-5 text-5xl font-black leading-[.94] tracking-[-.065em] sm:text-7xl">Great AI concepts still need great people.</h1>
            <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-[var(--text-secondary)] sm:text-lg">
              Join a curated global network of freelance creatives and design professionals. Heyy Studio contacts selected experts when a project matches their skills, availability and experience.
            </p>
            <div className="mt-7 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2 text-[var(--accent-strong)]">Freelance / project-based</span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2">Remote / worldwide</span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2">Paid per approved project</span>
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="bg-[var(--surface)] py-12 sm:py-16">
        <PageContainer>
          <div className="grid gap-4 md:grid-cols-3">
            <InfoCard icon={UsersRound} title="Curated network" text="We review every application and invite only shortlisted experts into the active project network." />
            <InfoCard icon={BriefcaseBusiness} title="Projects, not employment" text="There is no fixed schedule or full-time commitment. We contact you when a suitable client project becomes available." />
            <InfoCard icon={ShieldCheck} title="Heyy Studio manages the client" text="Heyy Studio handles the client relationship, payment and production workflow while you focus on the specialist work." />
          </div>
        </PageContainer>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--surface-strong)] py-12 sm:py-16">
        <PageContainer>
          <p className="text-[.64rem] font-black uppercase tracking-[.18em] text-[var(--accent-strong)]">How it works</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-.05em] sm:text-4xl">Apply once. Get contacted when the right project arrives.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Step number="01" title="Apply to the network" text="Choose the opportunity closest to your specialty and send your portfolio, CV, experience and availability." />
            <Step number="02" title="Get shortlisted" text="Heyy Studio reviews applications and builds a small trusted bench of experts for each Studio." />
            <Step number="03" title="Quote project opportunities" text="When a project matches you, we send the brief privately. You quote your fee and timeline before accepting anything." />
          </div>
        </PageContainer>
      </section>

      <section id="open-opportunities" className="bg-[var(--surface)] py-14 sm:py-20">
        <PageContainer>
          <ExpertsNetworkContent initialRoleSlug={initialRoleSlug} initialSource={initialSource} />
        </PageContainer>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--surface-strong)] py-10">
        <PageContainer>
          <GlassCard className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Globe2 size={20} /></span>
              <div><h2 className="text-lg font-black">Built for a global expert network</h2><p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-[var(--text-secondary)]">Location is not a barrier. Project requirements, professional registration and local regulations may still affect which experts can work on specific scopes.</p></div>
            </div>
          </GlassCard>
        </PageContainer>
      </section>

      <SiteFooter prelaunch={prelaunch} />
    </main>
  );
}

function InfoCard({ icon: Icon, title, text }: { icon: typeof CheckCircle2; title: string; text: string }) {
  return <GlassCard className="p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Icon size={18} /></span><h3 className="mt-4 text-lg font-black">{title}</h3><p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{text}</p></GlassCard>;
}
function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface)] p-5"><p className="text-[.62rem] font-black tracking-[.18em] text-[var(--accent-strong)]">{number}</p><h3 className="mt-3 text-lg font-black">{title}</h3><p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{text}</p></div>;
}
