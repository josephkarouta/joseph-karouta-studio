"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  CirclePlay,
  ImageIcon,
  Images,
  Layers3,
  Lightbulb,
  Megaphone,
  PackageCheck,
  Palette,
  Presentation,
  Sofa,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import CreditTopUps from "@/components/account/CreditTopUps";
import PlanCards from "@/components/account/PlanCards";
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
    description: "Build a clear identity people recognize.",
    examples: ["Logo & identity", "Business cards & packaging", "Brand guidelines"],
  },
  architecture_studio: {
    icon: Building2,
    label: "Architecture Studio",
    title: "Design a space",
    description: "Turn an idea or plan into a clear design direction.",
    examples: ["Ideas & layouts", "Materials & plans", "Exterior visuals"],
  },
  interior_studio: {
    icon: Sofa,
    label: "Interior Studio",
    title: "Design an interior",
    description: "Shape the look, layout and feeling of a room.",
    examples: ["Room direction", "Furniture & materials", "Interior visuals"],
  },
  marketing_studio: {
    icon: Megaphone,
    label: "Marketing Studio",
    title: "Create a campaign",
    description: "Turn one message into a complete campaign direction.",
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
    text: "Answer a few simple questions or upload what you have.",
  },
  {
    icon: WandSparkles,
    number: "02",
    title: "Create it with AI",
    text: "Explore ideas, compare directions and choose what works.",
  },
  {
    icon: PackageCheck,
    number: "03",
    title: "Finish it with an expert",
    text: "Send your chosen direction for professional final files.",
  },
] as const;

export default function HomePage() {
  useHomepageMotion();
  const { user, loading: accountLoading, plan: currentPlan, credits } = useAuth();
  const currentPlanId = String(currentPlan || "free").toLowerCase();
  return (
    <main className="heyy-page overflow-hidden">
      <SiteHeader />

      <section className="home-hero relative isolate overflow-hidden pt-[var(--header-height)]">
        <div className="home-grid absolute inset-0 -z-20 opacity-60" />
        <div data-home-parallax="0.08" className="home-motion-parallax absolute -left-52 top-10 -z-10 h-[540px] w-[540px] rounded-full bg-fuchsia-400/14 blur-[120px]" />
        <div data-home-parallax="-0.06" className="home-motion-parallax absolute -right-52 top-4 -z-10 h-[620px] w-[620px] rounded-full bg-blue-400/12 blur-[130px]" />
        <div data-home-parallax="0.04" className="home-motion-parallax absolute bottom-[-18rem] left-[38%] -z-10 h-[520px] w-[520px] rounded-full bg-violet-500/12 blur-[120px]" />

        <PageContainer className="grid min-h-[690px] items-center gap-14 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:py-24">
          <div data-home-reveal className="relative z-10 max-w-4xl">
            <p className="text-[0.72rem] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">
              Create with AI. Build with Experts.
            </p>

            <h1 className="mt-6 max-w-[680px] text-[clamp(3.15rem,5.4vw,5.65rem)] font-bold leading-[1.02] tracking-[-0.045em] text-[var(--text-primary)]">
              <span className="block">Turn your idea</span>
              <span className="home-spectrum-text block">into finished work.</span>
            </h1>

            <p className="mt-8 max-w-2xl text-base font-semibold leading-8 text-[var(--text-secondary)] sm:text-lg">
              Play with ideas, shape what you love, and call in an expert when you are ready to finish it.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="#create" size="lg">
                Start creating <ArrowRight size={16} />
              </ButtonLink>
              <ButtonLink href="#tools" variant="secondary" size="lg">
                Use a quick tool
              </ButtonLink>
            </div>
          </div>

          <HeroPlayground />
        </PageContainer>
      </section>

      <section id="create" className="relative py-24 sm:py-32">
        <PageContainer>
          <SectionHeading
            eyebrow="Studios"
            title="What do you want to create?"
            description="Pick a Studio and start playing with ideas."
          />

          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            {VISIBLE_STUDIOS.map((studio, studioIndex) => {
              const content = studioContent[studio.id];
              if (!content) return null;
              const Icon = content.icon;

              return (
                <Link
                  key={studio.id}
                  href={studio.href || "/dashboard"}
                  data-home-reveal
                  className="studio-card group block"
                  style={{ transitionDelay: `${studioIndex * 80}ms` }}
                >
                  <article
                    className="relative min-h-[390px] overflow-hidden rounded-[2rem] border p-7 shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] sm:p-9"
                    style={{
                      borderColor: studio.border,
                      background: `linear-gradient(145deg, ${studio.soft}, var(--surface-strong) 62%)`,
                    }}
                  >
                    <div
                      className="absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-15 blur-3xl"
                      style={{ background: studio.accent }}
                    />

                    <div className="relative grid h-full gap-8 sm:grid-cols-[0.92fr_1.08fr] sm:items-stretch">
                      <div className="flex flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <span
                          className="grid h-14 w-14 place-items-center rounded-2xl border shadow-sm"
                          style={{ background: studio.soft, borderColor: studio.border, color: studio.accent }}
                        >
                          <Icon size={24} />
                        </span>
                      </div>

                      <p className="mt-7 text-[0.62rem] font-black uppercase tracking-[0.16em]" style={{ color: studio.accent }}>
                        {content.label}
                      </p>
                      <h3 className="mt-3 text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-5xl">
                        {content.title}
                      </h3>
                      <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-[var(--text-secondary)] sm:text-base">
                        {content.description}
                      </p>

                      <div className="mt-6 space-y-2">
                        {content.examples.slice(0, 2).map((item) => (
                          <p key={item} className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
                            <Check size={13} style={{ color: studio.accent }} /> {item}
                          </p>
                        ))}
                      </div>

                      <div className="mt-auto flex items-center gap-2 pt-9 text-sm font-black" style={{ color: studio.accent }}>
                        Open Studio <ArrowRight size={16} className="transition-transform group-hover:translate-x-1.5" />
                      </div>
                      </div>

                      <div data-home-parallax={studioIndex % 2 === 0 ? "0.018" : "-0.018"} className="home-motion-parallax">
                        <StudioPreview studioId={studio.id} accent={studio.accent} soft={studio.soft} />
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </PageContainer>
      </section>

      <section id="tools" className="border-y border-[var(--border)] bg-[var(--surface)] py-24 sm:py-32">
        <PageContainer>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow="Quick tools"
              title="Quick idea? Make it happen."
              description="Use a focused tool without starting a full Studio project."
              align="left"
            />
            <ButtonLink href="/tools" variant="secondary">
              View all tools <ArrowRight size={15} />
            </ButtonLink>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {PLATFORM_TOOLS.map((tool, toolIndex) => {
              const Icon = toolIcons[tool.id] || Sparkles;
              const copy = toolCopy[tool.id] || { title: tool.label, description: tool.description };

              return (
                <Link
                  key={tool.id}
                  href={tool.href}
                  data-home-reveal
                  className="quick-tool-card group block"
                  style={{ transitionDelay: `${toolIndex * 60}ms` }}
                >
                  <article className="flex h-full min-h-[285px] flex-col overflow-hidden rounded-[1.7rem] border border-[var(--border)] bg-[var(--surface-strong)] p-5 shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1 hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-card-hover)]">
                    <div className="relative h-24 overflow-hidden rounded-[1.15rem]" style={{ background: `linear-gradient(135deg, ${tool.soft}, var(--surface))` }}>
                      <div className="absolute -right-4 -top-7 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: tool.accent }} />
                      <span className="absolute bottom-4 left-4 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-strong)] shadow-sm" style={{ color: tool.accent }}>
                        <Icon size={21} />
                      </span>
                    </div>
                    <p className="mt-6 text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{tool.label}</p>
                    <h3 className="mt-2 text-xl font-black tracking-[-0.04em]">{copy.title}</h3>
                    <p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{copy.description}</p>
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

      <section id="how-it-works" className="pb-12 pt-24 sm:pb-16 sm:pt-32">
        <PageContainer>
          <SectionHeading
            eyebrow="How it works"
            title="From idea to finished work."
            description="Start simple, explore quickly and bring in an expert only when you need one."
          />

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {simpleSteps.map(({ icon: Icon, number, title, text }, stepIndex) => (
              <div
                key={title}
                data-home-reveal
                style={{ transitionDelay: `${stepIndex * 90}ms` }}
              >
                <GlassCard className="how-step min-h-[270px] p-7 sm:p-8">
                  <div className="flex items-center justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                      <Icon size={20} />
                    </span>
                    <span className="text-[0.68rem] font-black tracking-[0.18em] text-[var(--text-muted)]">{number}</span>
                  </div>
                  <h3 className="mt-9 text-2xl font-black leading-[1] tracking-[-0.045em]">{title}</h3>
                  <p className="mt-4 text-sm font-semibold leading-6 text-[var(--text-secondary)]">{text}</p>
                </GlassCard>
              </div>
            ))}
          </div>

          <div data-home-reveal className="mt-6 flex flex-col gap-5 rounded-[1.7rem] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="text-lg font-black tracking-[-0.03em]">Not sure which Studio or tool to use?</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">Tell Heyy what you want to make.</p>
            </div>
            <div className="shrink-0">
              <OpenAssistantButton />
            </div>
          </div>
        </PageContainer>
      </section>

      <section id="pricing" className="pb-24 pt-10 sm:pb-32 sm:pt-14">
        <PageContainer>
          <SectionHeading
            eyebrow="Plans & credits"
            title="Start free. Upgrade when you need more."
            description="AI credits are included. Expert work is quoted separately."
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
                  Your current plan is highlighted below.
                </p>
              </div>
              <ButtonLink href="/billing" variant="secondary" className="shrink-0">
                Manage billing
              </ButtonLink>
            </div>
          )}

          <div className="mx-auto mt-10 max-w-6xl">
            <PlanCards />
          </div>

          <div className="mx-auto mt-10 max-w-6xl rounded-[1.7rem] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
            <CreditTopUps />
          </div>

          <div className="mx-auto mt-7 flex max-w-6xl flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-center text-xs font-semibold leading-6 text-[var(--text-secondary)] sm:flex-row sm:justify-between sm:text-left">
            <span>Prices are in US dollars. Expert production is quoted separately before you pay.</span>
            <ButtonLink href="/credit-guide" variant="secondary" size="sm" className="shrink-0">
              See credit costs
            </ButtonLink>
          </div>
        </PageContainer>
      </section>

      <SiteFooter />

      <style jsx global>{`
        [data-home-reveal] {
          opacity: 0;
          transform: translate3d(0, 28px, 0) scale(0.985);
          transition:
            opacity 700ms cubic-bezier(0.22, 1, 0.36, 1),
            transform 850ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        [data-home-reveal].is-visible {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
        }

        .home-motion-parallax {
          transform: translate3d(0, var(--home-parallax-y, 0px), 0);
          will-change: transform;
        }

        .hero-playground-stage {
          transform: perspective(900px) rotateX(var(--hero-tilt-x, 0deg)) rotateY(var(--hero-tilt-y, 0deg));
          transform-style: preserve-3d;
          transition: transform 240ms ease-out;
        }

        .hero-orbit {
          position: absolute;
          left: 50%;
          top: 50%;
          border: 1px solid color-mix(in srgb, var(--text-primary) 13%, transparent);
          border-radius: 999px;
          transform-style: preserve-3d;
        }

        .hero-orbit span {
          position: absolute;
          left: 50%;
          top: -7px;
          height: 14px;
          width: 14px;
          border-radius: 999px;
          background: linear-gradient(135deg, #ef3fb4, #ffb04a);
          box-shadow: 0 0 24px rgba(239, 63, 180, 0.55);
        }

        .hero-orbit-one {
          height: 300px;
          width: 300px;
          animation: hero-orbit-spin 13s linear infinite;
        }

        .hero-orbit-two {
          height: 390px;
          width: 390px;
          border-style: dashed;
          animation: hero-orbit-spin-reverse 19s linear infinite;
        }

        .hero-orbit-two span {
          background: linear-gradient(135deg, #22d3ee, #6f2dff);
          box-shadow: 0 0 24px rgba(34, 211, 238, 0.45);
        }

        .hero-orbit-three {
          height: 470px;
          width: 470px;
          opacity: 0.5;
          animation: hero-orbit-spin 28s linear infinite;
        }

        .hero-orbit-three span {
          height: 9px;
          width: 9px;
          background: #ffcf64;
        }

        .hero-ai-hub-shell {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 4;
          height: 205px;
          width: 205px;
          transform: translate3d(calc(-50% + var(--hero-shift-x, 0px)), calc(-50% + var(--hero-shift-y, 0px)), 70px);
          filter: drop-shadow(0 35px 55px rgba(95, 45, 170, 0.28));
          transition: transform 260ms ease-out;
          animation: hero-hub-float 5.5s ease-in-out infinite;
        }

        .hero-ai-hub {
          position: relative;
          z-index: 2;
          display: flex;
          height: 100%;
          width: 100%;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.55);
          background: conic-gradient(from 210deg, #6f2dff, #ef3fb4, #ffb04a, #22d3ee, #6f2dff);
          color: white;
          box-shadow: inset 0 0 35px rgba(255, 255, 255, 0.24);
          animation: hero-hub-morph 8s ease-in-out infinite, hero-hue 14s linear infinite;
        }

        .hero-ai-hub::after {
          content: "";
          position: absolute;
          inset: 8px;
          border: 1px solid rgba(255, 255, 255, 0.32);
          border-radius: inherit;
        }

        .hero-ai-shine {
          position: absolute;
          left: 18%;
          top: 12%;
          height: 38%;
          width: 30%;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.48);
          filter: blur(18px);
          transform: rotate(-28deg);
        }

        .hero-ai-spark {
          position: absolute;
          right: 25%;
          top: 22%;
          z-index: 3;
          opacity: 0.9;
          animation: hero-icon-pulse 3s ease-in-out infinite;
        }

        .hero-ai-kicker,
        .hero-ai-label {
          position: relative;
          z-index: 3;
          font-size: 0.52rem;
          font-weight: 900;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          opacity: 0.7;
        }

        .hero-ai-hub strong {
          position: relative;
          z-index: 3;
          margin: 0.1rem 0 0.2rem;
          font-size: 4rem;
          font-weight: 850;
          line-height: 0.9;
          letter-spacing: -0.09em;
          text-shadow: 0 10px 25px rgba(42, 20, 70, 0.28);
        }

        .hero-ai-pulse {
          position: absolute;
          inset: 0;
          z-index: 1;
          border: 1px solid rgba(111, 45, 255, 0.3);
          border-radius: 999px;
          animation: hero-ai-pulse 3.2s ease-out infinite;
        }

        .hero-ai-pulse-two {
          animation-delay: 1.6s;
        }

        .hero-capability {
          position: absolute;
          z-index: 5;
          width: 158px;
          padding: 0.85rem;
          border: 1px solid var(--border);
          border-radius: 1.25rem;
          background: color-mix(in srgb, var(--surface-strong) 88%, transparent);
          box-shadow: 0 18px 50px rgba(47, 28, 70, 0.15);
          backdrop-filter: blur(18px);
          scale: 1;
          transition: box-shadow 280ms ease, border-color 280ms ease, scale 280ms ease;
        }

        .hero-capability:hover {
          border-color: var(--accent-border);
          box-shadow: 0 24px 58px rgba(65, 32, 100, 0.22);
          scale: 1.06;
        }

        .hero-capability-title {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .hero-capability-icon {
          display: grid;
          height: 30px;
          width: 30px;
          place-items: center;
          border-radius: 0.7rem;
        }

        .hero-capability-brand {
          left: 1%;
          top: 10%;
          animation: hero-satellite-brand 7.5s ease-in-out infinite;
        }

        .hero-capability-marketing {
          right: 0;
          top: 11%;
          animation: hero-satellite-marketing 8.2s ease-in-out infinite;
        }

        .hero-capability-architecture {
          bottom: 8%;
          left: 2%;
          animation: hero-satellite-architecture 8.8s ease-in-out infinite;
        }

        .hero-capability-interior {
          bottom: 7%;
          right: 1%;
          animation: hero-satellite-interior 7.9s ease-in-out infinite;
        }

        .hero-brand-colors {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.35rem;
          margin-top: 0.75rem;
        }

        .hero-brand-colors span {
          height: 27px;
          border-radius: 0.55rem;
          animation: hero-color-dance 2.8s ease-in-out infinite;
        }

        .hero-brand-colors span:nth-child(2) { animation-delay: 0.18s; }
        .hero-brand-colors span:nth-child(3) { animation-delay: 0.36s; }
        .hero-brand-colors span:nth-child(4) { animation-delay: 0.54s; }

        .hero-strategy-chart {
          position: relative;
          height: 44px;
          margin-top: 0.65rem;
          overflow: hidden;
          border-radius: 0.75rem;
          background: linear-gradient(180deg, rgba(239, 63, 180, 0.08), transparent);
        }

        .hero-strategy-chart::after {
          content: "";
          position: absolute;
          left: 9px;
          right: 9px;
          top: 21px;
          height: 2px;
          background: linear-gradient(90deg, #ef3fb4, #ffb04a);
          transform: rotate(-10deg);
          transform-origin: center;
          animation: hero-strategy-line 2.6s ease-in-out infinite;
        }

        .hero-strategy-chart > span {
          position: absolute;
          bottom: 5px;
          width: 12px;
          border-radius: 5px 5px 2px 2px;
          background: linear-gradient(180deg, #ef3fb4, #7c3cff);
          transform-origin: bottom;
          animation: hero-strategy-bar 2.4s ease-in-out infinite;
        }

        .hero-strategy-chart > span:nth-child(1) { left: 12px; height: 14px; }
        .hero-strategy-chart > span:nth-child(2) { left: 42px; height: 22px; animation-delay: 0.15s; }
        .hero-strategy-chart > span:nth-child(3) { left: 72px; height: 29px; animation-delay: 0.3s; }
        .hero-strategy-chart > span:nth-child(4) { left: 102px; height: 37px; animation-delay: 0.45s; }
        .hero-strategy-chart > i { display: none; }

        .hero-mini-buildings {
          display: flex;
          height: 48px;
          align-items: flex-end;
          gap: 0.35rem;
          margin-top: 0.6rem;
          padding: 0 0.35rem;
          border-bottom: 2px solid rgba(46, 124, 246, 0.3);
        }

        .hero-mini-buildings span {
          flex: 1;
          border: 2px solid #2e7cf6;
          border-bottom: 0;
          border-radius: 0.55rem 0.55rem 0 0;
          background: rgba(46, 124, 246, 0.09);
          transform-origin: bottom;
          animation: hero-building-rise 3s ease-in-out infinite;
        }

        .hero-mini-buildings span:nth-child(1) { height: 26px; }
        .hero-mini-buildings span:nth-child(2) { height: 42px; animation-delay: 0.2s; }
        .hero-mini-buildings span:nth-child(3) { height: 33px; animation-delay: 0.4s; }

        .hero-mini-room {
          position: relative;
          height: 48px;
          margin-top: 0.6rem;
          overflow: hidden;
          border-radius: 0.75rem;
          background: linear-gradient(180deg, rgba(240, 128, 52, 0.07) 0 62%, rgba(240, 128, 52, 0.14) 62%);
        }

        .hero-mini-sofa {
          position: absolute;
          bottom: 7px;
          left: 14px;
          height: 22px;
          width: 76px;
          border-radius: 12px 12px 6px 6px;
          background: #f3a86d;
          animation: hero-sofa-slide 3.3s ease-in-out infinite;
        }

        .hero-mini-cushion {
          position: absolute;
          bottom: 16px;
          left: 51px;
          height: 16px;
          width: 17px;
          border-radius: 5px;
          background: #fff1e5;
          transform: rotate(8deg);
          animation: hero-cushion-bounce 2.6s ease-in-out infinite;
        }

        .hero-mini-table {
          position: absolute;
          bottom: 6px;
          right: 15px;
          height: 18px;
          width: 25px;
          border-radius: 50%;
          background: #a75b32;
        }

        .hero-mini-lamp {
          position: absolute;
          right: 18px;
          top: 5px;
          height: 20px;
          width: 3px;
          background: #a75b32;
          animation: hero-lamp-sway 3.5s ease-in-out infinite;
        }

        .hero-mini-lamp::before {
          content: "";
          position: absolute;
          left: -7px;
          top: -1px;
          height: 10px;
          width: 17px;
          border-radius: 10px 10px 3px 3px;
          background: #ffbd78;
          box-shadow: 0 4px 16px rgba(255, 189, 120, 0.5);
        }

        .hero-hub-signal {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 2;
          height: 1px;
          width: 165px;
          background: linear-gradient(90deg, rgba(111, 45, 255, 0.5), transparent);
          transform-origin: left center;
          animation: hero-signal-pulse 2.8s ease-in-out infinite;
        }

        .hero-hub-signal-one { transform: rotate(-145deg); }
        .hero-hub-signal-two { transform: rotate(-35deg); animation-delay: 0.7s; }
        .hero-hub-signal-three { transform: rotate(145deg); animation-delay: 1.4s; }
        .hero-hub-signal-four { transform: rotate(35deg); animation-delay: 2.1s; }
        }

        .studio-preview {
          transition: transform 520ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 520ms ease;
          transform: translateZ(0);
        }

        .studio-piece,
        .studio-building,
        .studio-spark,
        .studio-ground,
        .studio-rug {
          transition: transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .studio-preview-grid {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.11) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.11) 1px, transparent 1px);
          background-size: 24px 24px;
        }

        .studio-preview-architecture .studio-preview-grid {
          background-image:
            linear-gradient(rgba(46, 124, 246, 0.18) 1px, transparent 1px),
            linear-gradient(90deg, rgba(46, 124, 246, 0.18) 1px, transparent 1px);
        }

        .studio-card:hover .studio-preview {
          transform: translateY(-5px) rotate(-1deg) scale(1.025);
          box-shadow: 0 28px 55px rgba(43, 24, 66, 0.2);
        }

        .studio-card:hover .studio-piece-main,
        .studio-card:hover .studio-piece-poster {
          transform: translateY(-7px) rotate(1.2deg);
        }

        .studio-card:hover .studio-piece-bottom {
          transform: translateY(5px);
        }

        .studio-card:hover .brand-symbol {
          animation: studio-symbol-spin 1.8s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .studio-card:hover .studio-spark {
          transform: rotate(150deg) scale(1.35);
        }

        .studio-card:hover .studio-building:nth-child(1) {
          transform: translateY(-7px);
        }

        .studio-card:hover .studio-building:nth-child(2) {
          transform: translateY(-13px);
        }

        .studio-card:hover .studio-building:nth-child(3) {
          transform: translateY(-5px);
        }

        .studio-card:hover .studio-sun {
          transform: translate(-8px, 7px) scale(1.08);
        }

        .studio-card:hover .studio-art {
          transform: translateY(-7px) rotate(-3deg);
        }

        .studio-card:hover .studio-lamp {
          transform: translateY(-4px) rotate(2deg);
        }

        .studio-card:hover .studio-sofa {
          transform: translateX(5px) scale(1.02);
        }

        .studio-card:hover .studio-table {
          transform: translate(-4px, -5px) rotate(4deg);
        }

        .studio-card:hover .studio-rug {
          transform: scaleX(1.08);
        }

        .quick-tool-card article > div:first-child,
        .quick-tool-card article > div:first-child span,
        .how-step {
          transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 420ms ease;
        }

        .quick-tool-card:hover article > div:first-child {
          transform: scale(1.04) rotate(-1.5deg);
        }

        .quick-tool-card:hover article > div:first-child span {
          transform: translate(5px, -5px) rotate(7deg);
        }

        .how-step:hover {
          transform: translateY(-7px) rotate(-0.5deg);
          box-shadow: var(--shadow-card-hover);
        }

        @keyframes hero-orbit-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes hero-orbit-spin-reverse {
          from { transform: translate(-50%, -50%) rotate(360deg); }
          to { transform: translate(-50%, -50%) rotate(0deg); }
        }

        @keyframes hero-hub-morph {
          0%, 100% { border-radius: 45% 55% 58% 42% / 52% 45% 55% 48%; }
          33% { border-radius: 58% 42% 44% 56% / 43% 58% 42% 57%; }
          66% { border-radius: 42% 58% 55% 45% / 58% 42% 58% 42%; }
        }

        @keyframes hero-hue {
          to { filter: hue-rotate(360deg); }
        }

        @keyframes hero-hub-float {
          0%, 100% { margin-top: -6px; }
          50% { margin-top: 8px; }
        }

        @keyframes hero-icon-pulse {
          0%, 100% { transform: scale(0.92) rotate(-5deg); opacity: 0.88; }
          50% { transform: scale(1.08) rotate(6deg); opacity: 1; }
        }

        @keyframes hero-ai-pulse {
          0% { opacity: 0.58; transform: scale(0.86); }
          75%, 100% { opacity: 0; transform: scale(1.55); }
        }

        @keyframes hero-satellite-brand {
          0%, 100% { transform: translate(0, 0) rotate(-5deg); }
          25% { transform: translate(9px, -7px) rotate(-2deg); }
          50% { transform: translate(15px, 3px) rotate(1deg); }
          75% { transform: translate(3px, 10px) rotate(-3deg); }
        }

        @keyframes hero-satellite-marketing {
          0%, 100% { transform: translate(0, 0) rotate(5deg); }
          25% { transform: translate(-8px, 7px) rotate(2deg); }
          50% { transform: translate(-14px, -2px) rotate(-1deg); }
          75% { transform: translate(-3px, -10px) rotate(3deg); }
        }

        @keyframes hero-satellite-architecture {
          0%, 100% { transform: translate(0, 0) rotate(4deg); }
          25% { transform: translate(7px, 9px) rotate(1deg); }
          50% { transform: translate(14px, -1px) rotate(-2deg); }
          75% { transform: translate(3px, -9px) rotate(2deg); }
        }

        @keyframes hero-satellite-interior {
          0%, 100% { transform: translate(0, 0) rotate(-4deg); }
          25% { transform: translate(-7px, -9px) rotate(-1deg); }
          50% { transform: translate(-14px, 1px) rotate(2deg); }
          75% { transform: translate(-3px, 9px) rotate(-2deg); }
        }

        @keyframes hero-color-dance {
          0%, 100% { transform: translateY(0) scaleY(0.86); border-radius: 0.55rem; }
          50% { transform: translateY(-5px) scaleY(1.08); border-radius: 999px; }
        }

        @keyframes hero-strategy-line {
          0%, 100% { opacity: 0.45; transform: rotate(-10deg) scaleX(0.75); }
          50% { opacity: 1; transform: rotate(-10deg) scaleX(1); }
        }

        @keyframes hero-strategy-bar {
          0%, 100% { transform: scaleY(0.55); opacity: 0.6; }
          50% { transform: scaleY(1); opacity: 1; }
        }

        @keyframes hero-building-rise {
          0%, 100% { transform: scaleY(0.7); opacity: 0.65; }
          50% { transform: scaleY(1); opacity: 1; }
        }

        @keyframes hero-sofa-slide {
          0%, 100% { transform: translateX(-4px); }
          50% { transform: translateX(5px); }
        }

        @keyframes hero-cushion-bounce {
          0%, 100% { transform: translateY(0) rotate(8deg); }
          50% { transform: translateY(-5px) rotate(-5deg); }
        }

        @keyframes hero-lamp-sway {
          0%, 100% { transform: rotate(-4deg); transform-origin: bottom; }
          50% { transform: rotate(5deg); transform-origin: bottom; }
        }

        @keyframes hero-signal-pulse {
          0%, 100% { opacity: 0.15; filter: blur(0); }
          50% { opacity: 0.85; filter: drop-shadow(0 0 5px rgba(111, 45, 255, 0.45)); }
        }

        @keyframes studio-symbol-spin {
          from { transform: rotate(0deg) scale(1); }
          to { transform: rotate(180deg) scale(1.08); }
        }

        @media (max-width: 640px) {
          .hero-orbit-three { display: none; }
          .hero-orbit-two { height: 340px; width: 340px; }
          .hero-orbit-one { height: 255px; width: 255px; }
          .hero-ai-hub-shell { height: 155px; width: 155px; }
          .hero-ai-hub strong { font-size: 3rem; }
          .hero-capability { width: 124px; padding: 0.65rem; }
          .hero-capability-title { font-size: 0.63rem; }
          .hero-capability-icon { height: 25px; width: 25px; }
          .hero-capability-brand { left: 0; top: 7%; }
          .hero-capability-marketing { right: 0; top: 8%; }
          .hero-capability-architecture { bottom: 5%; left: 0; }
          .hero-capability-interior { bottom: 4%; right: 0; }
          .hero-hub-signal { width: 118px; }
        }

        @media (prefers-reduced-motion: reduce) {
          [data-home-reveal] {
            opacity: 1;
            transform: none;
            transition: none;
          }

          .home-motion-parallax,
          .hero-playground-stage,
          .hero-orbit,
          .hero-ai-hub-shell,
          .hero-ai-hub,
          .hero-ai-spark,
          .hero-ai-pulse,
          .hero-capability,
          .hero-brand-colors span,
          .hero-strategy-chart,
          .hero-mini-buildings span,
          .hero-mini-sofa,
          .hero-mini-cushion,
          .hero-mini-lamp,
          .hero-hub-signal,
          .studio-preview,
          .studio-piece,
          .studio-building {
            animation: none !important;
            transform: none !important;
            transition: none !important;
          }
        }
      `}</style>
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
    <div data-home-reveal className={align === "center" ? "mx-auto max-w-5xl text-center" : "max-w-3xl"}>
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

function HeroPlayground() {
  const playgroundRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = playgroundRef.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    element.style.setProperty("--hero-tilt-x", `${-y * 8}deg`);
    element.style.setProperty("--hero-tilt-y", `${x * 10}deg`);
    element.style.setProperty("--hero-shift-x", `${x * 18}px`);
    element.style.setProperty("--hero-shift-y", `${y * 18}px`);
  };

  const resetPointer = () => {
    const element = playgroundRef.current;
    if (!element) return;
    element.style.setProperty("--hero-tilt-x", "0deg");
    element.style.setProperty("--hero-tilt-y", "0deg");
    element.style.setProperty("--hero-shift-x", "0px");
    element.style.setProperty("--hero-shift-y", "0px");
  };

  return (
    <div
      ref={playgroundRef}
      data-home-reveal
      className="hero-playground relative mx-auto h-[430px] w-full max-w-[620px] py-5 lg:h-[520px] lg:py-0"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      aria-hidden="true"
    >
      <div className="absolute inset-[8%] rounded-full bg-[conic-gradient(from_90deg,#6f2dff,#ef3fb4,#2e7cf6,#f08034,#6f2dff)] opacity-20 blur-[78px]" />
      <div className="hero-playground-stage relative h-full w-full">
        <div className="hero-orbit hero-orbit-one"><span /></div>
        <div className="hero-orbit hero-orbit-two"><span /></div>
        <div className="hero-orbit hero-orbit-three"><span /></div>

        <div className="hero-ai-hub-shell">
          <span className="hero-ai-pulse hero-ai-pulse-one" />
          <span className="hero-ai-pulse hero-ai-pulse-two" />
          <div className="hero-ai-hub">
            <div className="hero-ai-shine" />
            <Sparkles className="hero-ai-spark" size={24} />
            <span className="hero-ai-kicker">HEYY</span>
            <strong>AI</strong>
            <span className="hero-ai-label">Creative hub</span>
          </div>
        </div>

        <div className="hero-capability hero-capability-brand">
          <div className="hero-capability-title">
            <span className="hero-capability-icon bg-fuchsia-500/12 text-fuchsia-500"><Palette size={16} /></span>
            <span>Brand</span>
          </div>
          <div className="hero-brand-colors">
            <span className="bg-[#6f2dff]" />
            <span className="bg-[#ef3fb4]" />
            <span className="bg-[#ffb04a]" />
            <span className="bg-[#22d3ee]" />
          </div>
        </div>

        <div className="hero-capability hero-capability-marketing">
          <div className="hero-capability-title">
            <span className="hero-capability-icon bg-pink-500/12 text-pink-500"><Megaphone size={16} /></span>
            <span>Marketing</span>
          </div>
          <div className="hero-strategy-chart">
            <span /><span /><span /><span />
            <i /><i /><i /><i />
          </div>
        </div>

        <div className="hero-capability hero-capability-architecture">
          <div className="hero-capability-title">
            <span className="hero-capability-icon bg-blue-500/12 text-blue-500"><Building2 size={16} /></span>
            <span>Architecture</span>
          </div>
          <div className="hero-mini-buildings">
            <span /><span /><span />
          </div>
        </div>

        <div className="hero-capability hero-capability-interior">
          <div className="hero-capability-title">
            <span className="hero-capability-icon bg-orange-500/12 text-orange-500"><Sofa size={16} /></span>
            <span>Interior</span>
          </div>
          <div className="hero-mini-room">
            <span className="hero-mini-sofa" />
            <span className="hero-mini-cushion" />
            <span className="hero-mini-table" />
            <span className="hero-mini-lamp" />
          </div>
        </div>

        <span className="hero-hub-signal hero-hub-signal-one" />
        <span className="hero-hub-signal hero-hub-signal-two" />
        <span className="hero-hub-signal hero-hub-signal-three" />
        <span className="hero-hub-signal hero-hub-signal-four" />
      </div>
    </div>
  );
}

function StudioPreview({ studioId, accent, soft }: { studioId: string; accent: string; soft: string }) {
  if (studioId === "brand_studio") {
    return (
      <div className="studio-preview studio-preview-brand relative min-h-[270px] overflow-hidden rounded-[1.5rem] border border-white/50 bg-[#201429] p-4 text-white shadow-xl">
        <div className="studio-preview-grid absolute inset-0 opacity-20" />
        <div className="studio-piece studio-piece-main relative rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
          <p className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-white/45">Identity system</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="brand-symbol relative h-20 w-20">
              <span className="absolute left-0 top-0 h-14 w-14 rounded-full bg-[#ef3fb4]" />
              <span className="absolute bottom-0 right-0 h-14 w-14 rounded-[1.2rem] bg-[#7c3cff] mix-blend-screen" />
              <span className="absolute left-[1.65rem] top-[1.65rem] h-7 w-7 rounded-full bg-[#ffcf64]" />
            </div>
            <span className="text-5xl font-black tracking-[-0.12em]">Aa</span>
          </div>
        </div>
        <div className="studio-piece studio-piece-bottom absolute bottom-4 left-4 right-4 grid grid-cols-[1fr_0.72fr] gap-3">
          <div className="grid grid-cols-4 gap-2 rounded-xl border border-white/10 bg-black/15 p-3">
            {[accent, "#ef3fb4", "#ffcf64", "#f7efff"].map((color) => (
              <span key={color} className="h-9 rounded-lg border border-white/10" style={{ background: color }} />
            ))}
          </div>
          <div className="rounded-xl bg-[#f7efff] p-3 text-[#201429]">
            <div className="h-2 w-10 rounded-full bg-[#201429]/20" />
            <div className="mt-2 h-2 w-full rounded-full bg-[#201429]/10" />
            <div className="mt-2 h-2 w-2/3 rounded-full bg-[#201429]/10" />
          </div>
        </div>
        <span className="studio-spark absolute right-5 top-5 text-lg text-[#ffcf64]">✦</span>
      </div>
    );
  }

  if (studioId === "marketing_studio") {
    return (
      <div className="studio-preview studio-preview-marketing relative min-h-[270px] overflow-hidden rounded-[1.5rem] border border-white/50 bg-[var(--surface-strong)] p-4 shadow-xl">
        <div className="studio-piece studio-piece-poster relative h-44 overflow-hidden rounded-2xl text-white" style={{ background: `linear-gradient(145deg, ${accent}, #251329 72%)` }}>
          <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[#ffb04a] opacity-90" />
          <div className="absolute right-7 top-7 h-20 w-20 rounded-full border-[10px] border-white/85" />
          <div className="absolute bottom-5 left-5 h-4 w-28 rounded-full bg-white" />
          <div className="absolute bottom-12 left-5 h-12 w-12 rotate-12 rounded-xl bg-[#65e4ff]" />
          <div className="absolute bottom-12 left-20 h-12 w-12 -rotate-6 rounded-full bg-[#ef3fb4]" />
          <span className="absolute left-5 top-4 text-[0.5rem] font-black uppercase tracking-[0.18em] text-white/65">Campaign direction</span>
        </div>
        <div className="studio-piece studio-piece-bottom mt-3 grid grid-cols-[1fr_0.72fr] gap-3">
          <div className="rounded-xl p-3" style={{ background: soft }}>
            <div className="flex gap-2">
              <span className="h-7 w-7 rounded-full" style={{ background: accent }} />
              <span className="h-7 flex-1 rounded-lg bg-white/65 dark:bg-white/10" />
            </div>
            <div className="mt-2 h-2 w-2/3 rounded-full bg-black/10 dark:bg-white/10" />
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border)] p-2">
            <span className="rounded-lg bg-[#65e4ff]" />
            <span className="rounded-lg bg-[#ffb04a]" />
          </div>
        </div>
        <span className="studio-spark absolute right-7 top-6 text-xl text-white">✦</span>
      </div>
    );
  }

  if (studioId === "architecture_studio") {
    return (
      <div className="studio-preview studio-preview-architecture relative min-h-[270px] overflow-hidden rounded-[1.5rem] border border-white/50 bg-[#eaf4ff] p-5 shadow-xl dark:bg-[#111a25]">
        <div className="studio-preview-grid absolute inset-0 opacity-55" />
        <div className="studio-piece studio-sun absolute right-6 top-8 h-20 w-20 rounded-full bg-[linear-gradient(145deg,#fff5b8,#ffb04a)] shadow-[0_0_45px_rgba(255,176,74,.35)]" />
        <div className="relative flex items-center justify-between">
          <p className="text-[0.55rem] font-black uppercase tracking-[0.16em]" style={{ color: accent }}>Spatial concept</p>
          <Building2 size={18} style={{ color: accent }} />
        </div>
        <div className="absolute bottom-5 left-5 right-5 flex items-end gap-2">
          <div className="studio-building h-24 flex-1 rounded-t-2xl border-2 border-b-0 bg-white/65 p-2 dark:bg-black/25" style={{ borderColor: accent }}>
            <div className="grid grid-cols-2 gap-1.5">{[0, 1, 2, 3].map((item) => <span key={item} className="h-5 rounded bg-blue-300/35" />)}</div>
          </div>
          <div className="studio-building h-40 flex-[1.35] rounded-t-2xl border-2 border-b-0 bg-white/80 p-2 dark:bg-black/30" style={{ borderColor: accent }}>
            <div className="grid grid-cols-2 gap-1.5">{[0, 1, 2, 3, 4, 5].map((item) => <span key={item} className="h-5 rounded bg-blue-400/30" />)}</div>
          </div>
          <div className="studio-building h-20 flex-1 rounded-t-2xl border-2 border-b-0 bg-white/55 p-2 dark:bg-black/20" style={{ borderColor: accent }}>
            <div className="grid grid-cols-2 gap-1.5">{[0, 1].map((item) => <span key={item} className="h-5 rounded bg-blue-300/35" />)}</div>
          </div>
        </div>
        <div className="studio-ground absolute bottom-4 left-3 right-3 h-1 rounded-full" style={{ background: accent }} />
      </div>
    );
  }

  return (
    <div className="studio-preview studio-preview-interior relative min-h-[270px] overflow-hidden rounded-[1.5rem] border border-white/50 bg-[#f8eee5] p-4 shadow-xl dark:bg-[#2b211e]">
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[#e8cbb2]/60 dark:bg-[#684c3f]/35" />
      <div className="studio-piece studio-art absolute left-6 top-6 h-20 w-28 rounded-xl border-[7px] border-white bg-[linear-gradient(145deg,#ffcf9d,#ee8d48)] shadow-md dark:border-[#4a3932]">
        <span className="absolute bottom-2 left-3 h-8 w-8 rounded-full bg-white/55" />
        <span className="absolute right-3 top-2 h-11 w-4 rounded-full bg-[#8c4c2c]/45" />
      </div>
      <div className="studio-piece studio-lamp absolute right-8 top-7">
        <div className="mx-auto h-20 w-1.5 rounded-full bg-[#724630]" />
        <div className="-mt-1 h-14 w-20 rounded-t-full bg-[#f2a15d] shadow-[0_8px_28px_rgba(242,161,93,.35)]" />
      </div>
      <div className="studio-piece studio-sofa absolute bottom-8 left-7 right-20 h-24 rounded-[2rem_2rem_1rem_1rem] bg-[#fffaf4] shadow-xl dark:bg-[#5a4339]">
        <div className="absolute -left-2 top-7 h-14 w-7 rounded-xl bg-[#fffaf4] dark:bg-[#5a4339]" />
        <div className="absolute -right-2 top-7 h-14 w-7 rounded-xl bg-[#fffaf4] dark:bg-[#5a4339]" />
        <div className="absolute left-[42%] top-4 h-12 w-12 rotate-6 rounded-xl bg-[#e9904d]" />
      </div>
      <div className="studio-piece studio-table absolute bottom-5 right-7 h-14 w-16 rounded-[50%] bg-[#8c573c] shadow-lg">
        <span className="absolute left-1/2 top-9 h-12 w-1.5 -translate-x-1/2 bg-[#68402d]" />
      </div>
      <div className="studio-rug absolute bottom-3 left-16 h-10 w-44 rounded-[50%] bg-[#d99c73]/50" />
    </div>
  );
}

function useHomepageMotion() {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealElements = Array.from(document.querySelectorAll<HTMLElement>("[data-home-reveal]"));

    if (reducedMotion) {
      revealElements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    revealElements.forEach((element) => revealObserver.observe(element));

    const parallaxElements = Array.from(document.querySelectorAll<HTMLElement>("[data-home-parallax]"));
    let animationFrame = 0;

    const updateParallax = () => {
      const viewportCenter = window.innerHeight / 2;
      parallaxElements.forEach((element) => {
        const bounds = element.getBoundingClientRect();
        const elementCenter = bounds.top + bounds.height / 2;
        const speed = Number(element.dataset.homeParallax || 0);
        const movement = Math.max(-38, Math.min(38, (elementCenter - viewportCenter) * speed));
        element.style.setProperty("--home-parallax-y", `${movement}px`);
      });
      animationFrame = 0;
    };

    const requestParallaxUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateParallax);
    };

    updateParallax();
    window.addEventListener("scroll", requestParallaxUpdate, { passive: true });
    window.addEventListener("resize", requestParallaxUpdate);

    return () => {
      revealObserver.disconnect();
      window.removeEventListener("scroll", requestParallaxUpdate);
      window.removeEventListener("resize", requestParallaxUpdate);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);
}
