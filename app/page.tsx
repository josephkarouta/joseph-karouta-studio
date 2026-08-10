"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  CirclePlay,
  FileCheck2,
  ImageIcon,
  Images,
  Layers3,
  Lightbulb,
  Megaphone,
  MessageCircleMore,
  PackageCheck,
  Palette,
  Presentation,
  Sofa,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
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

const studioContent: Record<
  string,
  {
    icon: LucideIcon;
    label: string;
    title: string;
    description: string;
    examples: string[];
  }
> = {
  brand_studio: {
    icon: Palette,
    label: "Brand Studio",
    title: "Create a brand",
    description: "Build your logo, colors, style and the everyday pieces your brand needs.",
    examples: ["Logo & identity", "Business cards & packaging", "Brand guidelines"],
  },
  architecture_studio: {
    icon: Building2,
    label: "Architecture Studio",
    title: "Design a space",
    description: "Turn an idea, sketch or plan into a clear design direction, plans and visuals.",
    examples: ["Ideas & layouts", "Materials & plans", "Exterior visuals"],
  },
  interior_studio: {
    icon: Sofa,
    label: "Interior Studio",
    title: "Design an interior",
    description: "Explore styles, furniture, materials, layouts and realistic room visuals.",
    examples: ["Room direction", "Furniture & materials", "Interior visuals"],
  },
  marketing_studio: {
    icon: Megaphone,
    label: "Marketing Studio",
    title: "Create a campaign",
    description: "Shape your message, campaign idea, content and creative visuals in one place.",
    examples: ["Campaign idea", "Content & messaging", "Creative visuals"],
  },
};

const toolIcons: Record<string, LucideIcon> = {
  text_to_image: ImageIcon,
  image_to_video: CirclePlay,
  digital_adaptations: Layers3,
  ai_upscaler: Images,
  powerpoint_generator: Presentation,
};

const toolCopy: Record<string, { title: string; description: string }> = {
  text_to_image: {
    title: "Generate an image",
    description: "Turn a simple prompt into a visual.",
  },
  image_to_video: {
    title: "Turn an image into video",
    description: "Add movement to an existing image.",
  },
  digital_adaptations: {
    title: "Resize a design",
    description: "Adapt one creative into new sizes and formats.",
  },
  ai_upscaler: {
    title: "Improve image quality",
    description: "Upscale an image when you need a cleaner result.",
  },
  powerpoint_generator: {
    title: "Create a presentation",
    description: "Build a polished presentation from your content.",
  },
};

const simpleSteps = [
  {
    icon: Lightbulb,
    number: "01",
    title: "Tell us what you want to make",
    text: "Answer a few simple questions or upload what you already have.",
  },
  {
    icon: WandSparkles,
    number: "02",
    title: "Create it with AI",
    text: "Explore ideas and visuals while Heyy Studio guides you through the next decision.",
  },
  {
    icon: PackageCheck,
    number: "03",
    title: "Finish it with an expert",
    text: "When you need professional files or technical work, send the selected result to our team.",
  },
] as const;

export default function HomePage() {
  const { user, loading: accountLoading, plan: currentPlan, credits } = useAuth();
  const currentPlanId = String(currentPlan || "free").toLowerCase();
  const planOrder: Record<string, number> = { free: 0, starter: 1, pro: 2 };
  const brandStudioHref = VISIBLE_STUDIOS.find((studio) => studio.id === "brand_studio")?.href || "/dashboard";

  return (
    <main className="heyy-page overflow-hidden">
      <SiteHeader />

      <section className="home-hero relative isolate overflow-hidden pt-[var(--header-height)]">
        <div className="home-grid absolute inset-0 -z-20 opacity-60" />
        <div className="absolute -left-52 top-10 -z-10 h-[540px] w-[540px] rounded-full bg-fuchsia-400/14 blur-[120px]" />
        <div className="absolute -right-52 top-4 -z-10 h-[620px] w-[620px] rounded-full bg-blue-400/12 blur-[130px]" />
        <div className="absolute bottom-[-18rem] left-[38%] -z-10 h-[520px] w-[520px] rounded-full bg-violet-500/12 blur-[120px]" />

        <PageContainer className="grid min-h-[720px] items-center gap-14 py-16 lg:grid-cols-[1.04fr_0.96fr] lg:py-24">
          <div className="relative z-10 max-w-4xl">
            <p className="text-[0.72rem] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">
              Create with AI. Build with Experts.
            </p>

            <h1 className="mt-5 text-[clamp(3.7rem,7.5vw,7.8rem)] font-black leading-[0.86] tracking-[-0.075em] text-[var(--text-primary)]">
              Whatever you want to create,
              <br />
              <span className="home-spectrum-text">start here.</span>
            </h1>

            <p className="mt-8 max-w-2xl text-base font-semibold leading-8 text-[var(--text-secondary)] sm:text-lg">
              Build your brand, space or campaign with AI — then work with real experts when you are ready to make it real.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="#create" size="lg">
                Start creating <ArrowRight size={16} />
              </ButtonLink>
              <ButtonLink href="#how-it-works" variant="secondary" size="lg">
                See how it works
              </ButtonLink>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-[var(--text-muted)]">
              {["No design experience needed", "Start free", "Experts when you need them"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <HeroPreview />
        </PageContainer>
      </section>

      <section id="create" className="relative py-24 sm:py-32">
        <PageContainer>
          <SectionHeading
            eyebrow="Choose what you want to make"
            title="What do you want to create?"
            description="Pick the option that feels closest. You do not need to know the professional terms — we will guide you from there."
          />

          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            {VISIBLE_STUDIOS.map((studio) => {
              const content = studioContent[studio.id];
              if (!content) return null;
              const Icon = content.icon;

              return (
                <Link key={studio.id} href={studio.href || "/dashboard"} className="group block">
                  <article
                    className="relative min-h-[360px] overflow-hidden rounded-[2rem] border p-7 shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] sm:p-9"
                    style={{
                      borderColor: studio.border,
                      background: `linear-gradient(145deg, ${studio.soft}, var(--surface-strong) 62%)`,
                    }}
                  >
                    <div
                      className="absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-15 blur-3xl"
                      style={{ background: studio.accent }}
                    />

                    <div className="relative flex h-full flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <span
                          className="grid h-14 w-14 place-items-center rounded-2xl border shadow-sm"
                          style={{ background: studio.soft, borderColor: studio.border, color: studio.accent }}
                        >
                          <Icon size={24} />
                        </span>
                        <span
                          className="rounded-full border px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.16em]"
                          style={{ borderColor: studio.border, color: studio.accent }}
                        >
                          {content.label}
                        </span>
                      </div>

                      <h3 className="mt-9 text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-5xl">
                        {content.title}
                      </h3>
                      <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-[var(--text-secondary)] sm:text-base">
                        {content.description}
                      </p>

                      <div className="mt-7 flex flex-wrap gap-2">
                        {content.examples.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border bg-white/45 px-3 py-2 text-[0.68rem] font-extrabold text-[var(--text-secondary)] backdrop-blur-lg dark:bg-black/10"
                            style={{ borderColor: studio.border }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>

                      <div className="mt-auto flex items-center gap-2 pt-9 text-sm font-black" style={{ color: studio.accent }}>
                        Start here <ArrowRight size={16} className="transition-transform group-hover:translate-x-1.5" />
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </PageContainer>
      </section>

      <section id="how-it-works" className="border-y border-[var(--border)] bg-[var(--surface)] py-24 sm:py-32">
        <PageContainer>
          <SectionHeading
            eyebrow="How it works"
            title="From an idea to finished work."
            description="Heyy Studio keeps the process simple: tell us what you need, explore it with AI, and bring in an expert only when the work needs professional finishing."
          />

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {simpleSteps.map(({ icon: Icon, number, title, text }) => (
              <GlassCard key={title} className="min-h-[300px] p-7 sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    <Icon size={20} />
                  </span>
                  <span className="text-[0.68rem] font-black tracking-[0.18em] text-[var(--text-muted)]">{number}</span>
                </div>
                <h3 className="mt-10 text-2xl font-black leading-[1] tracking-[-0.045em]">{title}</h3>
                <p className="mt-4 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{text}</p>
              </GlassCard>
            ))}
          </div>
        </PageContainer>
      </section>

      <section className="py-24 sm:py-32">
        <PageContainer>
          <div className="grid gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
            <div>
              <SectionHeading
                eyebrow="A simple example"
                title="See how one idea grows."
                description="You do not need a perfect brief. Start with what you know, then make decisions as the project becomes clearer."
                align="left"
              />
              <ButtonLink href={user ? brandStudioHref : "/signup"} className="mt-8">
                Create something like this <ArrowRight size={15} />
              </ButtonLink>
            </div>

            <ProjectExample />
          </div>
        </PageContainer>
      </section>

      <section className="relative overflow-hidden border-y border-[var(--border)] bg-[var(--surface)] py-24 sm:py-32">
        <div className="absolute -left-44 top-16 h-96 w-96 rounded-full bg-violet-500/10 blur-[100px]" />
        <div className="absolute -right-44 bottom-0 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-[100px]" />
        <PageContainer>
          <div className="grid overflow-hidden rounded-[2.2rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-[var(--shadow-card)] lg:grid-cols-2">
            <div className="relative p-8 sm:p-12 lg:p-14">
              <Eyebrow>AI + experts</Eyebrow>
              <h2 className="mt-6 max-w-xl text-4xl font-black leading-[0.94] tracking-[-0.06em] sm:text-6xl">
                AI when you want speed. Experts when it needs to be real.
              </h2>
              <p className="mt-6 max-w-xl text-sm font-semibold leading-7 text-[var(--text-secondary)] sm:text-base">
                Explore freely with AI. When you need final files, technical work or professional production, send the exact result you chose to our team.
              </p>
            </div>

            <div className="grid border-t border-[var(--border)] lg:grid-cols-2 lg:border-l lg:border-t-0">
              <div className="p-7 sm:p-8">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <Sparkles size={18} />
                </span>
                <h3 className="mt-6 text-xl font-black">Create with AI</h3>
                <div className="mt-5 space-y-3">
                  {["Explore ideas", "Generate visuals", "Try new directions", "Work at your own pace"].map((item) => (
                    <p key={item} className="flex items-center gap-2.5 text-sm font-semibold text-[var(--text-secondary)]">
                      <Check size={14} className="text-[var(--green)]" /> {item}
                    </p>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--border)] p-7 sm:p-8 lg:border-l lg:border-t-0">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <FileCheck2 size={18} />
                </span>
                <h3 className="mt-6 text-xl font-black">Build with Experts</h3>
                <div className="mt-5 space-y-3">
                  {["Professional files", "Technical support", "Human review", "Production-ready delivery"].map((item) => (
                    <p key={item} className="flex items-center gap-2.5 text-sm font-semibold text-[var(--text-secondary)]">
                      <Check size={14} className="text-[var(--green)]" /> {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      <section id="tools" className="py-24 sm:py-32">
        <PageContainer>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow="Quick tools"
              title="Need one thing done quickly?"
              description="Use a focused AI tool without starting a full Studio project."
              align="left"
            />
            <ButtonLink href="/tools" variant="secondary">
              View all tools <ArrowRight size={15} />
            </ButtonLink>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {PLATFORM_TOOLS.map((tool) => {
              const Icon = toolIcons[tool.id] || Sparkles;
              const copy = toolCopy[tool.id] || { title: tool.label, description: tool.description };

              return (
                <Link key={tool.id} href={tool.href} className="group block">
                  <article className="flex min-h-[275px] h-full flex-col rounded-[1.7rem] border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1 hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-card-hover)]">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: tool.soft, color: tool.accent }}>
                      <Icon size={20} />
                    </span>
                    <p className="mt-8 text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{tool.label}</p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.04em]">{copy.title}</h3>
                    <p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{copy.description}</p>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-7">
                      <CreditPill credits={tool.creditLabel.replace("From ", "").replace(" credits", "")} />
                      <ArrowRight size={16} style={{ color: tool.accent }} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </PageContainer>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--surface)] py-24 sm:py-32">
        <PageContainer>
          <div className="mx-auto max-w-5xl rounded-[2.2rem] border border-[var(--accent-border)] bg-[linear-gradient(145deg,var(--accent-soft),var(--surface-strong)_55%)] p-8 text-center shadow-[var(--shadow-card)] sm:p-12 lg:p-14">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent)] text-white shadow-lg">
              <MessageCircleMore size={22} />
            </span>
            <h2 className="mx-auto mt-7 max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.06em] sm:text-6xl">
              You do not need to know where to start.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)] sm:text-base">
              Tell Heyy AI what you are trying to make. We will help point you to the right Studio or tool.
            </p>
            <div className="mt-8 flex justify-center">
              <OpenAssistantButton />
            </div>
          </div>
        </PageContainer>
      </section>

      <section id="pricing" className="py-24 sm:py-32">
        <PageContainer>
          <SectionHeading
            eyebrow="Plans & credits"
            title="Start free. Upgrade when you need more."
            description="Compare every plan right here. Your plan gives you AI credits, while expert production is quoted separately only when you choose to use it."
          />

          {!accountLoading && user && (
            <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-4 rounded-[1.7rem] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.15em] text-[var(--accent-strong)]">Your account</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <p className="text-xl font-black text-[var(--text-primary)]">
                    Current plan: {PLANS.find((item) => item.id === currentPlanId)?.name || currentPlan}
                  </p>
                  <span className="rounded-full border border-[var(--accent-border)] bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-black text-[var(--accent-strong)]">
                    {credits.available.toLocaleString("en-US")} credits available
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold text-[var(--text-secondary)]">
                  Your current plan is highlighted below. You can upgrade or manage billing without leaving this section to compare plans.
                </p>
              </div>
              <ButtonLink href="/billing" variant="secondary" className="shrink-0">
                Manage billing
              </ButtonLink>
            </div>
          )}

          <div className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-3">
            {PLANS.map((plan) => {
              const featured = plan.id === "starter";
              const isCurrent = Boolean(user) && plan.id === currentPlanId;
              const currentRank = planOrder[currentPlanId] ?? 0;
              const planRank = planOrder[plan.id] ?? 0;
              const actionLabel = !user
                ? plan.id === "free"
                  ? "Start free"
                  : `Choose ${plan.name}`
                : isCurrent
                  ? "Manage current plan"
                  : planRank > currentRank
                    ? `Upgrade to ${plan.name}`
                    : "Manage plan";
              const actionHref = user ? "/billing" : "/signup";

              return (
                <GlassCard
                  key={plan.id}
                  className={`flex min-h-[470px] flex-col p-7 sm:p-8 ${
                    isCurrent
                      ? "border-emerald-400/70 bg-[linear-gradient(145deg,rgba(16,185,129,.08),var(--surface-strong)_48%)] shadow-[var(--shadow-card-hover)]"
                      : featured
                        ? "border-[var(--accent-border)] bg-[linear-gradient(145deg,var(--accent-soft),var(--surface-strong)_48%)]"
                        : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent-strong)]">{plan.name}</p>
                      <p className="mt-4 text-5xl font-black tracking-[-0.06em]">
                        ${plan.monthlyPriceUsd}
                        <span className="ml-1 text-sm font-bold tracking-normal text-[var(--text-muted)]">/mo</span>
                      </p>
                    </div>
                    {isCurrent ? (
                      <span className="rounded-full bg-emerald-500 px-3 py-1.5 text-[0.6rem] font-black uppercase tracking-[0.13em] text-white shadow-sm">
                        Current plan
                      </span>
                    ) : featured ? (
                      <span className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-[0.6rem] font-black uppercase tracking-[0.13em] text-white">
                        Popular
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-5 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{plan.description}</p>
                  <div className="my-6 border-t border-[var(--border)]" />
                  <CreditPill credits={plan.monthlyCredits} label="monthly credits" className="w-fit" />

                  <div className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <p key={feature} className="flex items-start gap-2.5 text-xs font-bold leading-5 text-[var(--text-secondary)]">
                        <Check size={14} className="mt-0.5 shrink-0 text-[var(--green)]" />
                        {feature}
                      </p>
                    ))}
                  </div>

                  <div className="mt-auto pt-8">
                    <ButtonLink
                      href={actionHref}
                      variant={isCurrent ? "secondary" : featured || planRank > currentRank ? "primary" : "secondary"}
                      className="w-full justify-center text-center"
                    >
                      {actionLabel}
                    </ButtonLink>
                  </div>
                </GlassCard>
              );
            })}
          </div>

          <div className="mx-auto mt-7 max-w-6xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-center text-xs font-semibold leading-6 text-[var(--text-secondary)]">
            Expert production is not bundled into a subscription. If you want professional final files, technical work or production support, Heyy Studio will quote that work separately before you pay.
          </div>
        </PageContainer>
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
      <h2 className="mt-5 text-4xl font-black leading-[0.95] tracking-[-0.06em] sm:text-6xl lg:text-[4.15rem]">
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

function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] py-10 lg:py-0">
      <div className="absolute inset-[8%] rounded-full bg-[conic-gradient(from_90deg,#6f2dff,#ef3fb4,#2e7cf6,#f08034,#6f2dff)] opacity-15 blur-[80px]" />

      <GlassCard className="relative overflow-hidden p-5 shadow-[0_34px_90px_rgba(42,28,68,.18)] sm:p-6">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-[var(--accent-strong)]">Start here</p>
            <p className="mt-1 text-sm font-black">What are you working on?</p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Sparkles size={18} />
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            [Palette, "I need a brand", "Brand"],
            [Building2, "I am designing a space", "Architecture"],
            [Sofa, "I want to design a room", "Interior"],
            [Megaphone, "I need a campaign", "Marketing"],
          ].map(([Icon, title, label]) => {
            const CardIcon = Icon as LucideIcon;
            return (
              <div key={String(title)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <CardIcon size={16} />
                </span>
                <p className="mt-4 text-sm font-black">{String(title)}</p>
                <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{String(label)} Studio</p>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-dashed border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
          <div>
            <p className="text-sm font-black">I&apos;m not sure yet</p>
            <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">Tell Heyy AI what you have in mind.</p>
          </div>
          <ArrowRight size={17} className="shrink-0 text-[var(--accent-strong)]" />
        </div>
      </GlassCard>
    </div>
  );
}

function ProjectExample() {
  return (
    <div className="relative self-start overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] p-5 shadow-[0_32px_90px_rgba(48,30,72,.16)] sm:p-7">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/12 blur-[70px]" />
      <div className="relative grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Lightbulb size={17} />
          </span>
          <p className="mt-6 text-[0.6rem] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">01 · Your idea</p>
          <p className="mt-3 text-sm font-black leading-6">“I&apos;m opening a modern Lebanese coffee shop.”</p>
        </div>

        <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-white">
            <WandSparkles size={17} />
          </span>
          <p className="mt-6 text-[0.6rem] font-black uppercase tracking-[0.15em] text-[var(--accent-strong)]">02 · Create</p>
          <p className="mt-3 text-sm font-black leading-6">Choose a direction, logo, colors and applications.</p>
          <div className="mt-5 flex gap-2">
            <span className="h-8 w-8 rounded-full bg-[#2a1738]" />
            <span className="h-8 w-8 rounded-full bg-[#d9ad75]" />
            <span className="h-8 w-8 rounded-full bg-[#efe7dc]" />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[#1b1520] p-5 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/12 text-white">
            <PackageCheck size={17} />
          </span>
          <p className="mt-6 text-[0.6rem] font-black uppercase tracking-[0.15em] text-white/50">03 · Make it real</p>
          <p className="mt-3 text-sm font-black leading-6">Send the selected work for professional final files.</p>
          <div className="mt-5 rounded-xl bg-white/10 p-3">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-white/45">Ready for expert</p>
            <p className="mt-1 text-xs font-bold">Brand launch package</p>
          </div>
        </div>
      </div>
    </div>
  );
}
