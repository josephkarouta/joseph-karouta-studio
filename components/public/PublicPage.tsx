import type { ReactNode } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { Eyebrow, GlassCard, PageContainer } from "@/components/ui/heyy";
import { getPublishedPublicPage } from "@/lib/public/content";

export type PublicSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export default async function PublicPage({
  slug,
  eyebrow,
  title,
  summary,
  sections,
  children,
  updated,
}: {
  slug?: string;
  eyebrow: string;
  title: string;
  summary: string;
  sections?: PublicSection[];
  children?: ReactNode;
  updated?: string;
}) {
  const managed = slug ? await getPublishedPublicPage(slug) : null;
  const resolvedEyebrow = managed?.eyebrow || eyebrow;
  const resolvedTitle = managed?.title || title;
  const resolvedSummary = managed?.summary || summary;
  const resolvedSections = managed?.sections || sections;
  const resolvedUpdated = managed?.updated_at
    ? new Date(managed.updated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : updated;

  return (
    <main className="heyy-page">
      <SiteHeader />
      <section className="relative overflow-hidden pt-[var(--header-height)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(239,63,180,.11),transparent_26rem),radial-gradient(circle_at_86%_6%,rgba(46,124,246,.12),transparent_28rem)]" />
        <PageContainer className="relative py-16 sm:py-24">
          <Eyebrow>{resolvedEyebrow}</Eyebrow>
          <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[.93] tracking-[-.065em] sm:text-7xl">{resolvedTitle}</h1>
          <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-[var(--text-secondary)] sm:text-lg">{resolvedSummary}</p>
          {resolvedUpdated && <p className="mt-5 text-xs font-bold text-[var(--text-muted)]">Last updated: {resolvedUpdated}</p>}
        </PageContainer>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--surface)] py-14 sm:py-20">
        <PageContainer>
          {children || (
            <div className="mx-auto grid max-w-5xl gap-4">
              {resolvedSections?.map((section) => (
                <GlassCard key={section.title} className="p-6 sm:p-8">
                  <h2 className="text-2xl font-black tracking-[-.045em]">{section.title}</h2>
                  {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-4 text-sm font-semibold leading-7 text-[var(--text-secondary)]">{paragraph}</p>)}
                  {section.bullets && <ul className="mt-5 space-y-3">{section.bullets.map((bullet) => <li key={bullet} className="flex items-start gap-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"/>{bullet}</li>)}</ul>}
                </GlassCard>
              ))}
            </div>
          )}
        </PageContainer>
      </section>
      <SiteFooter />
    </main>
  );
}
