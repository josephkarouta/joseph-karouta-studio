import { ArrowRight, CircleDollarSign, RefreshCcw, ShieldCheck } from "lucide-react";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { ButtonLink, CreditPill, Eyebrow, GlassCard, PageContainer } from "@/components/ui/heyy";
import { CUSTOMER_CREDIT_GUIDE } from "@/lib/credits/customer-catalog";

export const metadata = {
  title: "Credit Guide | Heyy Studio",
  description: "See how Heyy Studio credits are used across tools and Studios, including the daily utility allowance.",
};

const CATEGORIES = ["Utilities", "AI Tools", "Brand Studio", "Marketing Studio"] as const;

export default function CreditGuidePage() {
  return (
    <main className="heyy-page">
      <SiteHeader />
      <section className="relative overflow-hidden pt-[var(--header-height)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(124,60,255,.14),transparent_28rem),radial-gradient(circle_at_90%_5%,rgba(239,63,180,.12),transparent_28rem)]" />
        <PageContainer className="relative py-16 sm:py-24">
          <Eyebrow>Credit guide</Eyebrow>
          <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[.94] tracking-[-.065em] sm:text-7xl">
            Know the credit cost before you create.
          </h1>
          <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-[var(--text-secondary)] sm:text-lg">
            Credits work across Heyy Studio. Subscription credits reset at renewal and are used first. Purchased credits never expire.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/pricing">See plans & credit packs</ButtonLink>
            <ButtonLink href="/#create" variant="secondary">Explore Studios</ButtonLink>
          </div>
        </PageContainer>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--surface)] py-16 sm:py-20">
        <PageContainer>
          <div className="grid gap-4 md:grid-cols-3">
            <GlassCard className="p-5">
              <CircleDollarSign size={20} className="text-[var(--accent-strong)]" />
              <h2 className="mt-3 text-lg font-black">Subscription credits</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                Included with Starter and Pro. They are spent first, reset at each paid renewal and do not roll over.
              </p>
            </GlassCard>
            <GlassCard className="p-5">
              <ShieldCheck size={20} className="text-[var(--accent-strong)]" />
              <h2 className="mt-3 text-lg font-black">Purchased credits</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                Buy top-ups whenever you need them. Purchased credits stay separate and never expire.
              </p>
            </GlassCard>
            <GlassCard className="p-5">
              <RefreshCcw size={20} className="text-[var(--accent-strong)]" />
              <h2 className="mt-3 text-lg font-black">Failed generations</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                Credits are reserved while a generation runs and automatically returned when a generation fails before completion.
              </p>
            </GlassCard>
          </div>

          <div className="mt-12 space-y-10">
            {CATEGORIES.map((category) => {
              const items = CUSTOMER_CREDIT_GUIDE.filter((item) => item.category === category);
              return (
                <section key={category}>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <Eyebrow>{category}</Eyebrow>
                      <h2 className="mt-2 text-3xl font-black tracking-[-.045em]">{category} credit costs</h2>
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-strong)]">
                    <div className="hidden grid-cols-[1.3fr_auto_1.6fr] gap-5 border-b border-[var(--border)] bg-[var(--surface-hover)] px-5 py-3 text-[.62rem] font-black uppercase tracking-[.13em] text-[var(--text-muted)] sm:grid">
                      <span>Action</span>
                      <span>Credits</span>
                      <span>What it includes</span>
                    </div>
                    {items.map((item) => (
                      <div key={item.id} className="grid gap-3 border-b border-[var(--border)] px-5 py-5 last:border-b-0 sm:grid-cols-[1.3fr_auto_1.6fr] sm:items-center sm:gap-5">
                        <div>
                          <p className="text-sm font-black text-[var(--text-primary)]">{item.label}</p>
                          {item.unit && <p className="mt-1 text-[.65rem] font-bold text-[var(--text-muted)]">{item.unit}</p>}
                        </div>
                        <CreditPill credits={item.credits} />
                        <p className="text-xs font-semibold leading-5 text-[var(--text-secondary)]">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <GlassCard className="mt-12 p-6 sm:p-8">
            <h2 className="text-2xl font-black tracking-[-.04em]">A few important rules</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <p className="text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                <span className="font-black text-[var(--text-primary)]">Regenerating uses credits again.</span> Every AI generation creates a new result and can vary from the previous one.
              </p>
              <p className="text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                <span className="font-black text-[var(--text-primary)]">Expert production is separate.</span> Professional production requests are quoted before payment and do not use the self-service AI credit catalog.
              </p>
              <p className="text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                <span className="font-black text-[var(--text-primary)]">Some actions are variable.</span> Social Media Systems charge per selected generated format, Digital Adaptations charge per distinct AI composition, and longer PowerPoint decks use simple slide-count tiers.
              </p>
              <p className="text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                <span className="font-black text-[var(--text-primary)]">Your balance is always visible.</span> The Credits page shows your subscription balance, purchased balance and usage history.
              </p>
            </div>
            <ButtonLink href="/pricing" className="mt-7">
              Choose a plan or credit pack <ArrowRight size={15} />
            </ButtonLink>
          </GlassCard>
        </PageContainer>
      </section>
      <SiteFooter />
    </main>
  );
}
