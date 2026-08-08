import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Building2,
  Check,
  CirclePlay,
  Clock3,
  FileCheck2,
  FolderKanban,
  ImageIcon,
  Images,
  Layers3,
  Megaphone,
  MessageCircleMore,
  PackageCheck,
  Presentation,
  ShieldCheck,
  Sofa,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import OpenAssistantButton from "@/components/home/OpenAssistantButton";
import {
  ButtonLink,
  CreditPill,
  Eyebrow,
  GlassCard,
  PageContainer,
} from "@/components/ui/heyy";
import { PLATFORM_TOOLS, VISIBLE_STUDIOS } from "@/lib/platform/platform-registry";
import { PLANS } from "@/lib/platform/plans";

const studioIcons: Record<string, LucideIcon> = {
  brand_studio: WandSparkles,
  architecture_studio: Building2,
  interior_studio: Sofa,
  marketing_studio: Megaphone,
};

const toolIcons: Record<string, LucideIcon> = {
  text_to_image: ImageIcon,
  image_to_video: CirclePlay,
  ai_upscaler: Images,
  powerpoint_generator: Presentation,
};

const studioCapabilities: Record<string, string[]> = {
  brand_studio: ["Strategy & voice", "Identity directions", "Applications & brand book"],
  architecture_studio: ["Site & space planning", "Materials & concept plans", "Visuals & design packs"],
  interior_studio: ["Layouts & furniture", "Materials & lighting", "Room visuals & procurement direction"],
  marketing_studio: ["Campaign strategy", "Content & channel systems", "Creative production briefs"],
};

const workflow = [
  {
    icon: Sparkles,
    number: "01",
    title: "Start with the idea",
    text: "Choose a specialist Studio or tell Heyy AI what you are trying to create.",
  },
  {
    icon: Layers3,
    number: "02",
    title: "Build a connected direction",
    text: "Guided inputs, AI interpretation and saved decisions become one organized project.",
  },
  {
    icon: MessageCircleMore,
    number: "03",
    title: "Bring in experts when needed",
    text: "Request a quote from the exact concept, plan, campaign or asset you selected.",
  },
  {
    icon: PackageCheck,
    number: "04",
    title: "Review, revise and receive",
    text: "Track messages, revisions, approvals and final files without leaving the workspace.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="heyy-page overflow-hidden">
      <SiteHeader />

      <section className="home-hero relative isolate overflow-hidden pt-[var(--header-height)]">
        <div className="home-grid absolute inset-0 -z-20" />
        <div className="absolute -left-48 top-12 -z-10 h-[520px] w-[520px] rounded-full bg-fuchsia-400/15 blur-[110px]" />
        <div className="absolute -right-52 top-0 -z-10 h-[620px] w-[620px] rounded-full bg-blue-400/15 blur-[125px]" />
        <div className="absolute bottom-[-16rem] left-[38%] -z-10 h-[520px] w-[520px] rounded-full bg-violet-500/13 blur-[120px]" />

        <PageContainer className="grid min-h-[760px] items-center gap-12 py-14 lg:grid-cols-[0.92fr_1.08fr] lg:py-20">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-border)] bg-[var(--surface-strong)] px-4 py-2 shadow-sm backdrop-blur-xl">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
              </span>
              <span className="text-[0.66rem] font-black uppercase tracking-[0.19em] text-[var(--accent-strong)]">
                AI creation + expert production
              </span>
            </div>

            <h1 className="mt-7 max-w-[880px] text-[clamp(3.65rem,7vw,7.5rem)] font-black leading-[0.84] tracking-[-0.078em] text-[var(--text-primary)]">
              One idea.
              <br />
              <span className="home-spectrum-text">A complete creative journey.</span>
            </h1>

            <p className="mt-8 max-w-2xl text-base font-semibold leading-8 text-[var(--text-secondary)] sm:text-lg">
              Create brands, spaces, campaigns and AI media in specialist Studios. Keep every decision connected, then move selected work into professional production when it needs to be finished properly.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="#studios" size="lg">
                Explore the Studios <ArrowRight size={16} />
              </ButtonLink>
              <OpenAssistantButton />
            </div>

            <div className="mt-9 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                ["4", "specialist Studios"],
                ["Clear", "credit costs"],
                ["1", "connected workspace"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 backdrop-blur-xl">
                  <p className="text-lg font-black tracking-[-0.04em] text-[var(--text-primary)]">{value}</p>
                  <p className="mt-0.5 text-[0.68rem] font-extrabold text-[var(--text-muted)]">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <LivingProjectVisual />
        </PageContainer>

        <PageContainer className="pb-7">
          <div className="grid overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] backdrop-blur-2xl sm:grid-cols-3">
            {[
              [ShieldCheck, "Concepts stay honest", "AI outputs are clearly separated from final professional deliverables."],
              [Zap, "Costs stay visible", "See credit usage before paid generation actions."],
              [BadgeCheck, "Production stays connected", "Quotes, payment, messages, revisions and files live with the project."],
            ].map(([Icon, title, text], index) => {
              const TrustIcon = Icon as LucideIcon;
              return (
                <div key={String(title)} className={`flex gap-4 p-5 sm:p-6 ${index ? "border-t border-[var(--border)] sm:border-l sm:border-t-0" : ""}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    <TrustIcon size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-black text-[var(--text-primary)]">{String(title)}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{String(text)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </PageContainer>
      </section>

      <section id="studios" className="relative py-24 sm:py-32">
        <div className="absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[linear-gradient(180deg,var(--surface),transparent)]" />
        <PageContainer>
          <SectionHeading
            eyebrow="Four specialist Studios"
            title="Choose the discipline. Keep the same clear way of working."
            description="Every Studio has its own expertise and visual identity, while projects, credits, assets and expert production remain connected across the platform."
          />

          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            {VISIBLE_STUDIOS.map((studio, index) => {
              const Icon = studioIcons[studio.id] || Sparkles;
              const capabilities = studioCapabilities[studio.id] || [];
              return (
                <Link key={studio.id} href={studio.href || "/dashboard"} className="group block">
                  <article
                    className="home-studio-card relative min-h-[390px] overflow-hidden rounded-[2rem] border p-6 shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card-hover)] sm:p-8"
                    style={{
                      borderColor: studio.border,
                      background: `linear-gradient(145deg, ${studio.soft}, var(--surface-strong) 58%)`,
                    }}
                  >
                    <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full border-[38px] border-white/25 opacity-80 dark:border-white/5" />
                    <div
                      className="absolute bottom-[-7rem] right-[-3rem] h-72 w-72 rounded-full opacity-20 blur-3xl"
                      style={{ background: studio.accent }}
                    />

                    <div className="relative flex h-full flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <span
                          className="grid h-14 w-14 place-items-center rounded-2xl border shadow-sm"
                          style={{ background: studio.soft, borderColor: studio.border, color: studio.accent }}
                        >
                          <Icon size={23} />
                        </span>
                        <span className="text-[0.66rem] font-black uppercase tracking-[0.18em]" style={{ color: studio.accent }}>
                          Studio 0{index + 1}
                        </span>
                      </div>

                      <h3 className="mt-10 max-w-md text-4xl font-black leading-[0.94] tracking-[-0.06em] sm:text-5xl">
                        {studio.label}
                      </h3>
                      <p className="mt-4 max-w-lg text-sm font-semibold leading-7 text-[var(--text-secondary)]">
                        {studio.description}
                      </p>

                      <div className="mt-8 flex flex-wrap gap-2">
                        {capabilities.map((capability) => (
                          <span
                            key={capability}
                            className="rounded-full border bg-white/45 px-3 py-2 text-[0.68rem] font-extrabold text-[var(--text-secondary)] backdrop-blur-lg dark:bg-black/15"
                            style={{ borderColor: studio.border }}
                          >
                            {capability}
                          </span>
                        ))}
                      </div>

                      <div className="mt-auto flex items-end justify-between gap-6 pt-10">
                        <span className="flex items-center gap-2 text-sm font-black" style={{ color: studio.accent }}>
                          Enter {studio.shortLabel} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1.5" />
                        </span>
                        <div className="flex gap-1.5">
                          {[0, 1, 2, 3].map((step) => (
                            <span
                              key={step}
                              className="h-2 rounded-full transition-all duration-300 group-hover:w-8"
                              style={{
                                width: step === index ? 28 : 8,
                                background: step === index ? studio.accent : studio.border,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </PageContainer>
      </section>

      <section className="relative overflow-hidden border-y border-[var(--border)] bg-[var(--surface)] py-24 sm:py-32">
        <div className="absolute -left-40 top-24 h-96 w-96 rounded-full bg-violet-500/10 blur-[100px]" />
        <div className="absolute -right-40 bottom-10 h-96 w-96 rounded-full bg-pink-500/10 blur-[100px]" />
        <PageContainer>
          <SectionHeading
            eyebrow="One connected project"
            title="AI does not hand you a dead-end output."
            description="Every useful result becomes part of a workspace that can be refined, reused, quoted, produced and delivered."
          />

          <div className="relative mt-16 grid gap-5 lg:grid-cols-4">
            <div className="absolute left-[12%] right-[12%] top-12 hidden h-px bg-[linear-gradient(90deg,transparent,var(--accent-border),var(--accent-border),transparent)] lg:block" />
            {workflow.map(({ icon: Icon, number, title, text }, index) => (
              <GlassCard key={title} className="relative min-h-[285px] p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    <Icon size={20} />
                  </span>
                  <span className="text-[0.68rem] font-black tracking-[0.18em] text-[var(--text-muted)]">{number}</span>
                </div>
                <h3 className="mt-10 text-2xl font-black leading-[1] tracking-[-0.045em]">{title}</h3>
                <p className="mt-4 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{text}</p>
                {index < workflow.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-11 z-10 hidden text-[var(--accent-strong)] lg:block" size={20} />
                )}
              </GlassCard>
            ))}
          </div>
        </PageContainer>
      </section>

      <section id="workspace" className="py-24 sm:py-32">
        <PageContainer className="grid items-center gap-14 lg:grid-cols-[0.82fr_1.18fr]">
          <div>
            <SectionHeading
              eyebrow="Creative operating system"
              title="The workspace remembers what the project has become."
              description="Return to active work, reuse approved context, track credit usage and keep client-production communication beside the work itself."
              align="left"
            />

            <div className="mt-9 space-y-3">
              {[
                [FolderKanban, "Projects", "Continue from the exact stage you left."],
                [Images, "Assets", "Keep AI concepts, review files and final deliveries organized."],
                [Blocks, "Production", "See quotes, payment, progress, messages and revisions."],
                [Clock3, "Activity", "Understand what changed and what needs attention next."],
              ].map(([Icon, title, description]) => {
                const ItemIcon = Icon as LucideIcon;
                return (
                  <div key={String(title)} className="group flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent-border)] hover:bg-[var(--surface-strong)]">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)] transition group-hover:scale-105">
                      <ItemIcon size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-black text-[var(--text-primary)]">{String(title)}</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{String(description)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <ButtonLink href="/dashboard" className="mt-8">
              Open your workspace <ArrowRight size={15} />
            </ButtonLink>
          </div>

          <WorkspaceCanvas />
        </PageContainer>
      </section>

      <section id="tools" className="relative overflow-hidden border-y border-[var(--border)] py-24 sm:py-32">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,rgba(111,45,255,.08),rgba(239,63,180,.07),rgba(46,124,246,.08),rgba(240,128,52,.07))]" />
        <PageContainer>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow="Focused AI tools"
              title="Useful utilities without the clutter."
              description="Generate, animate, enhance and present. Credit costs are visible before every paid action."
              align="left"
            />
            <ButtonLink href="/tools" variant="secondary">
              View all tools <ArrowRight size={15} />
            </ButtonLink>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PLATFORM_TOOLS.map((tool, index) => {
              const Icon = toolIcons[tool.id] || Sparkles;
              return (
                <Link key={tool.id} href={tool.href} className="group block">
                  <article className="relative flex min-h-[315px] flex-col overflow-hidden rounded-[1.7rem] border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1.5 hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-card-hover)]">
                    <div
                      className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-15 blur-2xl"
                      style={{ background: tool.accent }}
                    />
                    <div className="relative flex items-start justify-between gap-4">
                      <span className="grid h-13 w-13 place-items-center rounded-2xl" style={{ background: tool.soft, color: tool.accent }}>
                        <Icon size={21} />
                      </span>
                      <span className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">0{index + 1}</span>
                    </div>
                    <h3 className="relative mt-10 text-2xl font-black tracking-[-0.045em]">{tool.label}</h3>
                    <p className="relative mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{tool.description}</p>
                    <div className="relative mt-auto flex items-center justify-between gap-3 pt-8">
                      <CreditPill credits={tool.creditLabel.replace("From ", "").replace(" credits", "")} />
                      <ArrowRight size={17} style={{ color: tool.accent }} className="transition-transform group-hover:translate-x-1.5" />
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </PageContainer>
      </section>

      <section className="py-24 sm:py-32">
        <PageContainer>
          <div className="grid overflow-hidden rounded-[2.2rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-[var(--shadow-card)] lg:grid-cols-2">
            <div className="relative overflow-hidden bg-[linear-gradient(145deg,#f7e9ff_0%,#fff0f8_48%,#eaf3ff_100%)] p-8 dark:bg-[linear-gradient(145deg,#25163a_0%,#32162a_48%,#142b46_100%)] sm:p-12 lg:p-14">
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[44px] border-white/25 dark:border-white/5" />
              <Eyebrow>AI + experts</Eyebrow>
              <h2 className="relative mt-6 max-w-xl text-4xl font-black leading-[0.92] tracking-[-0.065em] sm:text-6xl">
                Explore quickly. Finalize professionally.
              </h2>
              <p className="relative mt-6 max-w-xl text-sm font-semibold leading-7 text-[var(--text-secondary)] sm:text-base">
                AI helps you structure the brief, see directions and make decisions. Experts step in only where final craft, technical knowledge or production accountability matters.
              </p>
              <ButtonLink href="/contact?topic=expert-production" className="relative mt-9">
                Explore expert production <ArrowRight size={15} />
              </ButtonLink>
            </div>

            <div className="p-7 sm:p-10 lg:p-12">
              <div className="space-y-4">
                {[
                  [WandSparkles, "Create the direction", "Generate strategy, concepts, plans, campaigns or visual starting points."],
                  [FileCheck2, "Select what moves forward", "Approve the exact direction or asset that should become professional work."],
                  [MessageCircleMore, "Receive a clear quote", "Scope, timeline, revisions and price are connected to the project."],
                  [PackageCheck, "Manage delivery", "Message the Studio, review files, request revisions and download final work."],
                ].map(([Icon, title, text], index) => {
                  const StepIcon = Icon as LucideIcon;
                  return (
                    <div key={String(title)} className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                        <StepIcon size={18} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-[0.62rem] font-black tracking-[0.15em] text-[var(--text-muted)]">0{index + 1}</span>
                          <p className="text-sm font-black text-[var(--text-primary)]">{String(title)}</p>
                        </div>
                        <p className="mt-1.5 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{String(text)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      <section id="pricing" className="border-y border-[var(--border)] bg-[var(--surface)] py-24 sm:py-32">
        <PageContainer>
          <SectionHeading
            eyebrow="Plans & credits"
            title="Use AI at your pace. Pay experts only for real production work."
            description="Plans unlock the workspace and monthly AI credits. Expert work remains separately scoped and quoted so expectations stay clear."
          />

          <div className="mx-auto mt-14 grid max-w-6xl gap-5 md:grid-cols-3">
            {PLANS.map((plan) => {
              const featured = plan.id === "starter";
              return (
                <GlassCard
                  key={plan.id}
                  interactive
                  className={`flex min-h-[430px] flex-col p-7 sm:p-8 ${featured ? "border-[var(--accent-border)] bg-[linear-gradient(145deg,var(--accent-soft),var(--surface-strong)_48%)] shadow-[var(--shadow-card-hover)]" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--accent-strong)]">{plan.name}</p>
                      <p className="mt-5 text-5xl font-black tracking-[-0.065em]">
                        ${plan.monthlyPriceUsd}
                        <span className="ml-1 text-sm font-bold tracking-normal text-[var(--text-muted)]">/mo</span>
                      </p>
                    </div>
                    {featured && (
                      <span className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-[0.6rem] font-black uppercase tracking-[0.14em] text-white">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="mt-5 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{plan.description}</p>
                  <div className="my-7 border-t border-[var(--border)]" />
                  <CreditPill credits={plan.monthlyCredits} label="monthly credits" className="w-fit" />
                  <div className="mt-6 space-y-3">
                    {plan.features.slice(0, 4).map((feature) => (
                      <p key={feature} className="flex items-start gap-2.5 text-xs font-bold leading-5 text-[var(--text-secondary)]">
                        <Check size={14} className="mt-0.5 shrink-0 text-[var(--green)]" />
                        {feature}
                      </p>
                    ))}
                  </div>
                  <ButtonLink href="/pricing" variant={featured ? "primary" : "secondary"} className="mt-auto w-full pt-3">
                    View plan details
                  </ButtonLink>
                </GlassCard>
              );
            })}
          </div>
        </PageContainer>
      </section>

      <section className="px-4 py-6 sm:px-6">
        <div className="home-final-cta relative mx-auto max-w-[1500px] overflow-hidden rounded-[2.5rem] px-6 py-16 text-white shadow-[0_34px_100px_rgba(92,36,180,.3)] sm:px-10 lg:flex lg:items-end lg:justify-between lg:gap-12 lg:px-14 lg:py-20">
          <div className="absolute -right-20 -top-36 h-96 w-96 rounded-full border-[58px] border-white/10" />
          <div className="absolute bottom-[-11rem] left-[40%] h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.23em] text-white/70">Start with an idea</p>
            <h2 className="mt-5 max-w-4xl text-4xl font-black leading-[0.9] tracking-[-0.065em] sm:text-6xl lg:text-7xl">
              Create something that can actually move forward.
            </h2>
          </div>
          <div className="relative mt-9 flex shrink-0 flex-wrap gap-3 lg:mt-0">
            <ButtonLink href="/signup" size="lg" className="bg-white text-[#28113f] hover:bg-white/90 hover:text-[#28113f]">
              Create free account <ArrowRight size={16} />
            </ButtonLink>
            <OpenAssistantButton className="border-white/30 bg-white/10 text-white hover:border-white/50 hover:bg-white/20 hover:text-white" />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-5xl text-center" : "max-w-3xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-5 text-4xl font-black leading-[0.94] tracking-[-0.064em] sm:text-6xl lg:text-[4.25rem]">
        {title}
      </h2>
      {description && (
        <p className={`mt-6 text-sm font-semibold leading-7 text-[var(--text-secondary)] sm:text-base ${align === "center" ? "mx-auto max-w-3xl" : ""}`}>
          {description}
        </p>
      )}
    </div>
  );
}

function LivingProjectVisual() {
  const floatingStudios = [
    { label: "Brand", icon: WandSparkles, color: "#9f2ce0", className: "left-0 top-[12%] home-float-one" },
    { label: "Marketing", icon: Megaphone, color: "#eb3d87", className: "right-0 top-[20%] home-float-two" },
    { label: "Architecture", icon: Building2, color: "#1676e8", className: "left-[3%] bottom-[18%] home-float-two" },
    { label: "Interior", icon: Sofa, color: "#d06b14", className: "right-[2%] bottom-[10%] home-float-one" },
  ];

  return (
    <div className="relative mx-auto h-[610px] w-full max-w-[760px]">
      <div className="absolute left-1/2 top-1/2 h-[430px] w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--accent-border)] opacity-60" />
      <div className="home-orbit-ring absolute left-1/2 top-1/2 h-[530px] w-[530px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[var(--border-strong)]" />
      <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_0deg,#6f2dff,#ef3fb4,#2e7cf6,#f08034,#6f2dff)] opacity-25 blur-[85px]" />

      <div className="home-float-center absolute left-1/2 top-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[3rem] border border-white/40 bg-[rgba(18,12,28,.88)] p-4 shadow-[0_42px_110px_rgba(62,28,105,.33)] backdrop-blur-3xl sm:h-[390px] sm:w-[390px]">
        <div className="relative h-full overflow-hidden rounded-[2.2rem] bg-[#100b18]">
          <video className="absolute inset-0 h-full w-full object-cover opacity-85" autoPlay muted loop playsInline aria-hidden="true">
            <source src="/ai-orb.webm" type="video/webm" />
          </video>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,rgba(12,8,18,.18)_55%,rgba(12,8,18,.78)_100%)]" />
          <div className="absolute inset-x-5 top-5 flex items-center justify-between">
            <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.15em] text-white/75 backdrop-blur-xl">
              Heyy AI
            </span>
            <CreditPill credits="6" className="border-white/20 bg-white/10 text-white" />
          </div>
          <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/15 bg-black/35 p-4 text-white backdrop-blur-xl">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-white/55">Project intelligence</p>
            <p className="mt-2 text-sm font-extrabold leading-5">“Build a premium identity and launch campaign for a modern restaurant.”</p>
            <div className="mt-4 flex items-center gap-2 text-[0.62rem] font-black text-fuchsia-200">
              Brand Studio <ArrowRight size={12} /> Marketing Studio
            </div>
          </div>
        </div>
      </div>

      {floatingStudios.map(({ label, icon: Icon, color, className }) => (
        <div key={label} className={`absolute z-10 ${className}`}>
          <div className="flex min-w-[145px] items-center gap-3 rounded-2xl border border-white/45 bg-[var(--surface-strong)] p-3.5 shadow-[0_18px_48px_rgba(32,22,47,.16)] backdrop-blur-2xl dark:border-white/10">
            <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: color }}>
              <Icon size={17} />
            </span>
            <div>
              <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">Studio</p>
              <p className="mt-0.5 text-xs font-black text-[var(--text-primary)]">{label}</p>
            </div>
          </div>
        </div>
      ))}

      <GlassCard className="absolute bottom-0 left-1/2 z-20 w-[88%] -translate-x-1/2 p-4 shadow-[0_24px_65px_rgba(50,31,75,.18)] sm:w-[76%]">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.15em] text-[var(--accent-strong)]">Connected project</p>
            <p className="mt-1 truncate text-sm font-black">Restaurant launch system</p>
          </div>
          <span className="rounded-full bg-emerald-500/12 px-3 py-1.5 text-[0.6rem] font-black uppercase tracking-[0.12em] text-[var(--green)]">In progress</span>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {["Brief", "Direction", "Production", "Delivery"].map((item, index) => (
            <div key={item}>
              <span className={`block h-1.5 rounded-full ${index < 2 ? "bg-[var(--accent)]" : "bg-[var(--surface-hover)]"}`} />
              <p className="mt-1.5 text-[0.54rem] font-bold text-[var(--text-muted)]">{item}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function WorkspaceCanvas() {
  return (
    <div className="relative min-h-[620px]">
      <div className="absolute inset-[8%] rounded-full bg-[conic-gradient(from_90deg,#6f2dff,#ef3fb4,#2e7cf6,#f08034,#6f2dff)] opacity-15 blur-[90px]" />

      <GlassCard className="absolute inset-x-0 top-0 min-h-[500px] overflow-hidden p-0 shadow-[0_35px_100px_rgba(48,30,72,.18)] sm:inset-x-[4%]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <p className="text-[0.58rem] font-black uppercase tracking-[0.17em] text-[var(--text-muted)]">Heyy Studio Workspace</p>
        </div>

        <div className="grid min-h-[440px] grid-cols-[82px_1fr] sm:grid-cols-[116px_1fr]">
          <div className="border-r border-[var(--border)] bg-[var(--surface)] p-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className={`mb-2 h-10 rounded-xl ${item === 0 ? "bg-[var(--accent)]" : "bg-[var(--surface-hover)]"}`} />
            ))}
          </div>
          <div className="p-4 sm:p-6">
            <div className="rounded-2xl bg-[linear-gradient(115deg,#f3e7ff,#ffedf8,#e8f2ff)] p-5 dark:bg-[linear-gradient(115deg,#25163a,#35152e,#142a45)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.57rem] font-black uppercase tracking-[0.16em] text-[var(--accent-strong)]">Continue creating</p>
                  <h3 className="mt-2 text-xl font-black tracking-[-0.045em] sm:text-2xl">Trio Cafe Brand System</h3>
                </div>
                <CreditPill credits="286" />
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/55 dark:bg-white/10">
                <div className="h-full w-[72%] rounded-full bg-[linear-gradient(90deg,#6f2dff,#ef3fb4)]" />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                ["Active projects", "12"],
                ["Needs attention", "2"],
                ["Files ready", "8"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <p className="text-[0.54rem] font-black uppercase tracking-[0.13em] text-[var(--text-muted)]">{label}</p>
                  <p className="mt-2 text-2xl font-black">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black">Logo master files</p>
                  <p className="mt-1 text-[0.63rem] font-semibold text-[var(--text-muted)]">Production · Client review</p>
                </div>
                <span className="rounded-full bg-amber-500/12 px-3 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.12em] text-amber-600 dark:text-amber-300">Needs review</span>
              </div>
              <div className="mt-5 grid grid-cols-4 gap-2">
                {["Quoted", "Paid", "In progress", "Review"].map((item, index) => (
                  <div key={item}>
                    <span className={`block h-2 rounded-full ${index < 4 ? "bg-[var(--accent)]" : "bg-[var(--surface-hover)]"}`} />
                    <p className="mt-2 text-[0.54rem] font-bold text-[var(--text-muted)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="home-float-two absolute bottom-5 left-0 w-[54%] p-4 shadow-xl sm:w-[43%]">
        <p className="text-[0.56rem] font-black uppercase tracking-[0.14em] text-[var(--accent-strong)]">New notification</p>
        <p className="mt-2 text-xs font-black">Your revised logo files are ready to review.</p>
      </GlassCard>

      <GlassCard className="home-float-one absolute bottom-0 right-0 w-[48%] p-4 shadow-xl sm:w-[38%]">
        <p className="text-[0.56rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">Project files</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <FileCheck2 size={17} />
          </span>
          <div>
            <p className="text-xs font-black">Logo_Master_v03.zip</p>
            <p className="mt-0.5 text-[0.58rem] font-bold text-[var(--green)]">Final delivery</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
