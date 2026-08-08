"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CreditCard, FolderKanban, Search, Sparkles, Wrench } from "lucide-react";
import { Button, GlassCard } from "@/components/ui/heyy";

type Content = { sections?: Array<{ title?: string; paragraphs?: string[]; bullets?: string[] }> };
type Article = { id: string; slug: string; title: string; category: string; summary?: string; content?: Content };
const defaults: Article[] = [
  { id: "1", slug: "getting-started", title: "Getting started with Heyy Studio", category: "Getting started", summary: "Choose a Studio, create a project and understand the connected workspace.", content: { sections: [{ title: "Choose the clearest starting point", paragraphs: ["Start in a specialist Studio when you already know the kind of project you need. Use Heyy AI when you need help choosing between a Studio, a focused AI tool or expert support."], bullets: ["Save useful outputs to the workspace.", "Review credit cost before generation.", "Request expert production only when the concept and scope are clear."] }] } },
  { id: "2", slug: "credits", title: "How credits work", category: "Plans & credits", summary: "See costs before generation, reservation behavior and failed-generation refunds.", content: { sections: [{ title: "Credits are transparent", paragraphs: ["Every paid generation action shows its credit cost before it runs. Credits are reserved while the provider is working, committed after success and released after a confirmed failure."], bullets: ["Viewing saved work costs nothing.", "Monthly and purchased balances are tracked separately.", "Top-up credits can be added from the Credits page."] }] } },
  { id: "3", slug: "production", title: "From production request to delivery", category: "Expert production", summary: "Understand requests, quotes, payments, revisions and deliverables.", content: { sections: [{ title: "The production lifecycle", paragraphs: ["A production request is reviewed before a quote is created. After the quote is paid, the existing production engine creates an operational job and keeps messages, revisions and deliverables connected."], bullets: ["Request", "Quote", "Payment", "Production", "Review and revisions", "Delivery"] }] } },
  { id: "4", slug: "ai-output", title: "What AI output is ready to use?", category: "Responsible AI", summary: "Know when an output is a concept and when professional review is needed.", content: { sections: [{ title: "Treat concepts as concepts", paragraphs: ["AI output can be a strong working direction, but final commercial, technical, legal, print, construction and installation decisions may require qualified review."], bullets: ["Architecture output is not permit or construction documentation.", "Brand concepts are not automatically trademark cleared.", "Marketing claims should be verified before publication."] }] } },
];

export default function HelpCenter() {
  const [articles, setArticles] = useState<Article[]>(defaults);
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("article") || "";
    setSelectedSlug(initial);
    void fetch("/api/public/help")
      .then((response) => response.json())
      .then((data) => { if (data.articles?.length) setArticles(data.articles); })
      .catch(() => {});
  }, []);

  const filtered = useMemo(
    () => articles.filter((item) => `${item.title} ${item.category} ${item.summary}`.toLowerCase().includes(query.toLowerCase())),
    [articles, query],
  );
  const selected = articles.find((article) => article.slug === selectedSlug);

  function open(slug: string) {
    setSelectedSlug(slug);
    const url = new URL(window.location.href);
    url.searchParams.set("article", slug);
    window.history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function close() {
    setSelectedSlug("");
    const url = new URL(window.location.href);
    url.searchParams.delete("article");
    window.history.pushState({}, "", url);
  }

  if (selected) {
    const sections = Array.isArray(selected.content?.sections) ? selected.content.sections : [];
    return (
      <div className="mx-auto max-w-4xl">
        <Button variant="ghost" onClick={close}><ArrowLeft size={15}/>All help articles</Button>
        <GlassCard className="mt-4 p-6 sm:p-9">
          <p className="text-[.62rem] font-black uppercase tracking-[.16em] text-[var(--accent-strong)]">{selected.category}</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-.055em]">{selected.title}</h2>
          {selected.summary && <p className="mt-4 text-base font-semibold leading-7 text-[var(--text-secondary)]">{selected.summary}</p>}
          <div className="mt-8 grid gap-7 border-t border-[var(--border)] pt-7">
            {(sections.length ? sections : [{ title: "Overview", paragraphs: [selected.summary || "This article is being prepared."] }]).map((section, index) => (
              <section key={`${section.title || "Section"}-${index}`}>
                <h3 className="text-xl font-black tracking-[-.035em]">{section.title || "Overview"}</h3>
                {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-3 text-sm font-semibold leading-7 text-[var(--text-secondary)]">{paragraph}</p>)}
                {section.bullets && <ul className="mt-4 space-y-3">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-3 text-sm font-semibold text-[var(--text-secondary)]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"/>{bullet}</li>)}</ul>}
              </section>
            ))}
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"/>
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="heyy-form-field min-h-14 pl-12" placeholder="Search Studios, credits, production, billing or account help..."/>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {filtered.map((article, index) => {
          const icons = [BookOpen, CreditCard, FolderKanban, Sparkles, Wrench];
          const Icon = icons[index % icons.length];
          return (
            <GlassCard key={article.id} interactive className="p-6">
              <Icon size={20} className="text-[var(--accent-strong)]"/>
              <p className="mt-5 text-[.62rem] font-black uppercase tracking-[.14em] text-[var(--text-muted)]">{article.category}</p>
              <h2 className="mt-2 text-xl font-black tracking-[-.035em]">{article.title}</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{article.summary}</p>
              <button type="button" onClick={() => open(article.slug)} className="mt-5 flex items-center gap-2 text-xs font-black text-[var(--accent-strong)]">Read article <ArrowRight size={13}/></button>
            </GlassCard>
          );
        })}
      </div>
      <GlassCard className="mt-5 p-6 text-center">
        <h2 className="text-xl font-black">Still need help?</h2>
        <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">Send a support request with the account email and project name.</p>
        <a href="/contact?topic=support" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[var(--accent-strong)]">Contact support <ArrowRight size={14}/></a>
      </GlassCard>
    </div>
  );
}
