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
  const isRolePage = Boolean(initialRoleSlug);

  return (
    <main className="heyy-page min-h-screen">
      <SiteHeader prelaunch={prelaunch} />

      {!isRolePage && (
        <>
          <section
            className="relative overflow-hidden border-b border-[var(--border)] pt-[var(--header-height)]"
            style={{
              background: "linear-gradient(135deg,rgba(139,92,246,.22) 0%,rgba(216,60,184,.10) 48%,var(--surface-strong) 100%)",
            }}
          >
            <div className="pointer-events-none absolute -left-20 top-12 h-64 w-64 rounded-full bg-[#8b5cf6]/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-24 bottom-0 h-60 w-60 rounded-full bg-fuchsia-400/10 blur-3xl" />
            <PageContainer className="relative py-7 sm:py-24">
              <div className="max-w-4xl">
                <p className="text-[.58rem] font-black uppercase tracking-[.18em] text-[var(--accent-strong)] sm:text-[.66rem] sm:tracking-[.2em]">Heyy Expert Network</p>
                <h1 className="mt-2 text-[2.2rem] font-black leading-[.94] tracking-[-.055em] sm:mt-5 sm:text-7xl">
                  <span className="sm:hidden">Create with us.</span>
                  <span className="hidden sm:inline">Great creative work needs great people.</span>
                </h1>
                <p className="mt-3 max-w-3xl text-[.86rem] font-semibold leading-5 text-[var(--text-secondary)] sm:mt-6 sm:text-lg sm:leading-8">
                  <span className="sm:hidden">Freelance creative and design projects matched to your skills.</span>
                  <span className="hidden sm:inline">Join a curated network of freelance creatives and design professionals. We contact selected experts when the right project matches their skills and availability.</span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[.66rem] font-black sm:mt-7 sm:text-xs">
                  <span className="rounded-full border border-[var(--accent-border)] bg-white/55 px-3 py-2 text-[var(--accent-strong)] backdrop-blur-sm dark:bg-white/10">Project-based · Remote</span>
                  <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 sm:inline-flex">Paid per approved project</span>
                </div>
              </div>
            </PageContainer>
          </section>

          <section className="hidden bg-[var(--surface)] py-12 sm:py-16 md:block">
            <PageContainer>
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard icon={UsersRound} title="Curated network" text="We review every application and invite only shortlisted experts into the active project network." />
                <InfoCard icon={BriefcaseBusiness} title="Projects, not employment" text="There is no fixed schedule or full-time commitment. We contact you when a suitable client project becomes available." />
                <InfoCard icon={ShieldCheck} title="Heyy Studio manages the client" text="Heyy Studio handles the client relationship, payment and production workflow while you focus on the specialist work." />
              </div>
            </PageContainer>
          </section>

          <section className="hidden border-y border-[var(--border)] bg-[var(--surface-strong)] py-12 sm:py-16 md:block">
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
        </>
      )}

      <section
        id="open-opportunities"
        className={
          isRolePage
            ? "bg-[var(--surface)] pb-8 pt-[calc(var(--header-height)+1rem)] sm:pb-20 sm:pt-[calc(var(--header-height)+2rem)]"
            : "bg-[var(--surface)] py-8 sm:py-20"
        }
      >
        <PageContainer>
          <ExpertsNetworkContent initialRoleSlug={initialRoleSlug} initialSource={initialSource} />
        </PageContainer>
      </section>

      {!isRolePage && (
        <section className="border-t border-[var(--border)] bg-[var(--surface-strong)] py-6 md:hidden">
          <PageContainer>
            <details className="group rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
              <summary className="cursor-pointer list-none text-sm font-black text-[var(--text-primary)]">
                How the Expert Network works
              </summary>
              <div className="mt-4 grid gap-4 border-t border-[var(--border)] pt-4">
                <CompactStep number="01" title="Apply once" text="Choose the role closest to your specialty and send your CV, portfolio and availability." />
                <CompactStep number="02" title="Get shortlisted" text="We review applications and build a small trusted bench for each Studio." />
                <CompactStep number="03" title="Quote when matched" text="If a project fits, we send the brief privately. You choose your fee and timeline before accepting." />
                <p className="text-xs font-semibold leading-5 text-[var(--text-muted)]">
                  Freelance, project-based and remote. Heyy Studio manages the client relationship and production workflow.
                </p>
              </div>
            </details>
          </PageContainer>
        </section>
      )}

      <section className="border-t border-[var(--border)] bg-[var(--surface-strong)] py-6 sm:py-10">
        <PageContainer>
          <GlassCard className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)] sm:h-11 sm:w-11"><Globe2 size={20} /></span>
              <div><h2 className="text-base font-black sm:text-lg">Built for a global expert network</h2><p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-[var(--text-secondary)] sm:text-sm sm:leading-6">Location is not a barrier. Project requirements, professional registration and local regulations may still affect which experts can work on specific scopes.</p></div>
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

function CompactStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[.62rem] font-black text-[var(--accent-strong)]">{number}</span>
      <div>
        <p className="text-sm font-black">{title}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{text}</p>
      </div>
    </div>
  );
}
