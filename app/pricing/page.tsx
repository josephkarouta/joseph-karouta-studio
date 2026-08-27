"use client";

import { CircleDollarSign } from "lucide-react";
import CreditTopUps from "@/components/account/CreditTopUps";
import PlanCards from "@/components/account/PlanCards";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { ButtonLink, Eyebrow, GlassCard, PageContainer } from "@/components/ui/heyy";

export default function PricingPage() {
  return (
    <main className="heyy-page">
      <SiteHeader />
      <section className="relative overflow-hidden pt-[var(--header-height)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_5%,rgba(239,63,180,.13),transparent_30rem),radial-gradient(circle_at_85%_15%,rgba(46,124,246,.14),transparent_32rem)]" />
        <PageContainer className="relative py-16 sm:py-24">
          <Eyebrow>Plans & credits</Eyebrow>
          <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[.94] tracking-[-.065em] sm:text-7xl">
            Subscribe monthly or simply buy credits.
          </h1>
          <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-[var(--text-secondary)] sm:text-lg">
            Use a free account for occasional projects, or subscribe for a fresh monthly credit allowance. Expert production is quoted separately.
          </p>
        </PageContainer>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--surface)] py-16">
        <PageContainer>
          <div className="mx-auto max-w-6xl">
            <PlanCards />
          </div>

          <GlassCard className="mt-5 p-5 sm:p-7">
            <CreditTopUps />
          </GlassCard>

          <div className="mt-5 flex justify-center">
            <ButtonLink href="/credit-guide" variant="secondary">See the full credit guide</ButtonLink>
          </div>

          <GlassCard className="mt-5 grid gap-6 p-7 md:grid-cols-[auto_1fr] md:items-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <CircleDollarSign size={22} />
            </span>
            <div>
              <h2 className="text-xl font-black tracking-[-.035em]">
                Two credit balances, one clear rule.
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
                Subscription credits are used first and reset at each renewal. Purchased credits never expire and remain in your account through renewals or cancellation.
              </p>
            </div>
          </GlassCard>

          <p className="mt-6 text-center text-xs font-bold text-[var(--text-muted)]">
            Prices are in US dollars. Unused subscription credits do not roll over.
          </p>
        </PageContainer>
      </section>
      <SiteFooter />
    </main>
  );
}
