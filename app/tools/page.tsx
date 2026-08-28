import Link from "next/link";
import {
  ArrowRight,
  ArrowRightLeft,
  FileText,
  ImageIcon,
  Images,
  PanelsTopLeft,
  Presentation,
  Sparkles,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { CreditPill, Eyebrow, PageContainer } from "@/components/ui/heyy";
import { PLATFORM_TOOLS } from "@/lib/platform/platform-registry";

export const metadata = { title: "Tools" };

const icons: Record<string, LucideIcon> = {
  text_to_image: ImageIcon,
  image_to_video: Video,
  digital_adaptations: PanelsTopLeft,
  ai_upscaler: Images,
  powerpoint_generator: Presentation,
  pdf_tools: FileText,
  file_converter: ArrowRightLeft,
};

export default function ToolsPage() {
  const aiTools = PLATFORM_TOOLS.filter((tool) => tool.group === "ai");
  const utilities = PLATFORM_TOOLS.filter((tool) => tool.group === "utility");

  return (
    <main className="heyy-page min-h-screen">
      <SiteHeader />
      <div className="pt-[var(--header-height)]">
        <PageContainer className="py-14 sm:py-20">
          <section className="max-w-3xl">
            <Eyebrow>Heyy Studio tools</Eyebrow>
            <h1 className="mt-4 text-5xl font-black leading-[.95] tracking-[-.06em] sm:text-7xl">Quick tools for everyday creative work.</h1>
            <p className="mt-6 text-base font-semibold leading-8 text-[var(--text-secondary)]">Generate, adapt, improve, convert and prepare files without starting a full Studio project.</p>
          </section>

          <ToolSection title="AI Tools" description="Focused generation and production utilities." tools={aiTools} />
          <ToolSection title="File Utilities" description="Fast document and conversion tools with no persistent source-file storage." tools={utilities} />
        </PageContainer>
      </div>
      <SiteFooter />
    </main>
  );
}

function ToolSection({ title, description, tools }: { title: string; description: string; tools: typeof PLATFORM_TOOLS }) {
  return (
    <section className="mt-16">
      <div><Eyebrow>{title}</Eyebrow><p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">{description}</p></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = icons[tool.id] || Sparkles;
          return (
            <Link key={tool.id} href={tool.href} className="group flex min-h-64 flex-col rounded-[1.7rem] border border-[var(--border)] bg-[var(--surface-strong)] p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-card-hover)]">
              <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: tool.soft, color: tool.accent }}><Icon size={20}/></span>
              <h2 className="mt-6 text-2xl font-black tracking-[-.045em]">{tool.label}</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{tool.description}</p>
              <div className="mt-auto flex items-center justify-between gap-3 pt-7">
                <CreditPill credits={tool.creditLabel} label="" />
                <ArrowRight size={17} style={{ color: tool.accent }} className="transition group-hover:translate-x-1"/>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
