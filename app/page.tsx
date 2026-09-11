"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Layers3,
  Lightbulb,
  PackageCheck,
  PlusCircle,
  WandSparkles,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import PlanCards from "@/components/account/PlanCards";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import OpenAssistantButton from "@/components/home/OpenAssistantButton";
import {
  ButtonLink,
  Eyebrow,
  PageContainer,
} from "@/components/ui/heyy";
import { PLATFORM_TOOLS, VISIBLE_STUDIOS } from "@/lib/platform/platform-registry";
import { PLANS } from "@/lib/platform/plans";

const studioContent: Record<
  string,
  {
    label: string;
    description: string;
    image: string;
  }
> = {
  brand_studio: {
    label: "Brand Studio",
    description: "Logos, identity, guidelines and real-world applications.",
    image: "/home/studios/brand-studio.png",
  },
  marketing_studio: {
    label: "Marketing Studio",
    description: "Campaigns, content, messaging and creative direction.",
    image: "/home/studios/marketing-studio.png",
  },
  architecture_studio: {
    label: "Architecture Studio",
    description: "Concepts, plans, visuals and detailed outputs.",
    image: "/home/studios/architecture-studio.png",
  },
  interior_studio: {
    label: "Interior Design Studio",
    description: "Spaces, layouts, materials and polished interior visuals.",
    image: "/home/studios/interior-studio.png",
  },
};

const toolVisuals: Record<string, string> = {
  text_to_image: "/home/tools/text-to-image.webp",
  image_to_video: "/home/tools/image-to-video.webp",
  digital_adaptations: "/home/tools/digital-adaptations.webp",
  ai_upscaler: "/home/tools/ai-upscaler.webp",
  powerpoint_generator: "/home/tools/powerpoint-generator.webp",
  pdf_tools: "/home/tools/pdf-tools.webp",
  file_converter: "/home/tools/file-converter.webp",
};


const simpleSteps = [
  {
    icon: Lightbulb,
    number: "1",
    title: "Create",
    text: "Start with an idea or a simple brief.",
  },
  {
    icon: WandSparkles,
    number: "2",
    title: "Generate",
    text: "Get strong AI-powered directions and results.",
  },
  {
    icon: Layers3,
    number: "3",
    title: "Refine",
    text: "Compare, adjust and make the work yours.",
  },
  {
    icon: PackageCheck,
    number: "4",
    title: "Go further",
    text: "Bring in an expert when you need production-ready files.",
  },
] as const;

export default function HomePage() {
  const { user, loading: accountLoading, plan: currentPlan, credits } = useAuth();
  const currentPlanId = String(currentPlan || "free").toLowerCase();
  return (
    <main className="heyy-page overflow-hidden">
      <SiteHeader />

      <section className="home-hero relative isolate overflow-hidden pt-[var(--header-height)]">
        <div className="home-grid absolute inset-0 -z-20 opacity-60" />
        <div className="absolute -left-52 top-10 -z-10 h-[540px] w-[540px] rounded-full bg-fuchsia-400/14 blur-[120px]" />
        <div className="absolute -right-52 top-4 -z-10 h-[620px] w-[620px] rounded-full bg-blue-400/12 blur-[130px]" />
        <div className="absolute bottom-[-18rem] left-[38%] -z-10 h-[520px] w-[520px] rounded-full bg-violet-500/12 blur-[120px]" />
<video
  autoPlay
  loop
  muted
  playsInline
  preload="metadata"
  poster="/hero-video-poster.jpg"
  aria-hidden="true"
  className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center"
>
  <source src="/hero-video-web.mp4" type="video/mp4" />
</video>
        <div className="hero-image-overlay pointer-events-none absolute inset-0 z-[1]" />

        <PageContainer className="relative z-10 flex min-h-[600px] items-end py-10 sm:min-h-[660px] sm:py-16 lg:min-h-[680px] lg:items-center lg:py-20">
          <div className="relative z-10 w-full max-w-[1320px] mx-auto">
            <div className="max-w-[650px]">
            <p className="text-[0.72rem] font-black uppercase tracking-[0.2em] text-white/80 lg:text-[var(--accent-strong)]">
              Create with AI. Build with Experts.
            </p>

            <h1 className="mt-4 max-w-[680px] text-[2.65rem] font-black leading-[0.98] tracking-[-0.045em] text-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.28)] sm:mt-6 sm:text-[clamp(3.15rem,5.4vw,5.65rem)] sm:leading-[1.02] lg:text-[var(--text-primary)] lg:drop-shadow-none">
              <span className="block">Turn your idea</span>
              <span className="home-spectrum-text block">into finished work.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/80 sm:mt-8 sm:text-lg sm:leading-8 lg:text-[var(--text-secondary)]">
              Play with ideas, shape what you love, and call in an expert when you are ready to finish it.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5 sm:mt-9 sm:gap-3">
              <ButtonLink href="#create" size="lg" className="min-w-[154px]">
                Start creating <ArrowRight size={16} />
              </ButtonLink>
              <ButtonLink href="#tools" variant="secondary" size="lg" className="min-w-[154px]">
                Use a quick tool
              </ButtonLink>
            </div>
          </div>
          </div>

        </PageContainer>
      </section>

      <section id="create" className="scroll-mt-[var(--header-height)] home-studios-section relative py-16 sm:py-24 lg:py-28">
        <PageContainer>
          <div className="mx-auto w-full max-w-[1320px]">
          <SectionHeading
            eyebrow="AI Studios"
            title="What do you want to create?"
            description="Each Studio brings together specialised AI tools and workflows for a focused creative journey."
            align="left"
          />

          <div className="-mx-4 mt-8 snap-x snap-mandatory overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:-mx-6 sm:mt-10 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
            <div className="grid w-max grid-flow-col auto-cols-[82vw] gap-4 sm:auto-cols-[46vw] lg:w-full lg:grid-flow-row lg:grid-cols-4 lg:auto-cols-auto">
            {VISIBLE_STUDIOS.map((studio, studioIndex) => {
              const content = studioContent[studio.id];
              if (!content) return null;
              return (
                <Link
                  key={studio.id}
                  href={studio.href || "/dashboard"}
                  className="studio-card group block snap-start"
                >
                  <article className="studio-card-shell flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#0d0b12] shadow-[0_18px_50px_rgba(18,10,35,0.14)] transition-[border-color,box-shadow] duration-200 hover:border-white/18 hover:shadow-[0_24px_64px_rgba(18,10,35,0.20)] sm:rounded-[1.55rem]">
                    <div className="studio-card-image relative aspect-[1.5/1] shrink-0 overflow-hidden rounded-t-[1.25rem] bg-[#09070f] sm:rounded-t-[1.45rem]">
                      <Image
                        src={content.image}
                        alt={`${content.label} preview`}
                        fill
                        priority={studioIndex < 2}
                        sizes="(max-width: 639px) 82vw, (max-width: 1023px) 46vw, 25vw"
                        className="scale-[1.08] object-cover transition-transform duration-700 ease-out group-hover:scale-[1.095]"
                      />
                    </div>

                    <div
                      className="studio-card-footer relative flex min-h-[140px] flex-1 flex-col overflow-hidden p-[1.125rem] text-white sm:min-h-[156px] sm:p-5"
                      style={{ "--studio-accent": studio.accent } as CSSProperties}
                    >
                      <div className="relative z-10">
                        <h3 className="text-[0.98rem] font-black tracking-[-0.035em] text-white sm:text-lg">
                          {content.label}
                        </h3>
                        <p className="mt-2 max-w-[18rem] text-[0.72rem] font-semibold leading-5 text-white/72 sm:text-xs sm:leading-5">
                          {content.description}
                        </p>
                      </div>
                      <div className="relative z-10 mt-auto flex justify-end pt-4">
                        <span
                          className="studio-card-arrow grid h-9 w-9 place-items-center rounded-full border border-white/18 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-sm transition-[background-color,border-color] duration-200 group-hover:border-white/32 group-hover:bg-white/16"
                          aria-hidden="true"
                        >
                          <ArrowRight size={15} />
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
            </div>
          </div>
          </div>
        </PageContainer>
      </section>

      <section id="tools" className="scroll-mt-[var(--header-height)] home-tools-section py-16 sm:py-20 lg:py-24">
        <PageContainer>
          <div className="mx-auto w-full max-w-[1320px]">
          <SectionHeading
            eyebrow="AI tools"
            title="Quick tools. Big results."
            description="Create, enhance and convert without starting a full Studio project."
            align="left"
          />

          <div className="-mx-4 mt-8 snap-x snap-mandatory overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:mt-10 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
            <div className="grid w-max grid-flow-col auto-cols-[82vw] gap-4 sm:auto-cols-[46vw] lg:w-full lg:grid-flow-row lg:grid-cols-3 lg:auto-cols-auto xl:grid-cols-4">
              {PLATFORM_TOOLS.map((tool) => {
                const visual = toolVisuals[tool.id];

                return (
                  <Link
                    key={tool.id}
                    href={tool.href}
                      className="quick-tool-card group block snap-start"
                  >
                    <article className="flex h-full flex-col overflow-hidden rounded-[1.3rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-200 ease-out hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-card-hover)] sm:rounded-[1.45rem]">
                      <div className="relative aspect-[3/2] shrink-0 overflow-hidden bg-[var(--surface)]">
                        {visual && (
                          <Image
                            src={visual}
                            alt={`${tool.label} preview`}
                            fill
                            sizes="(max-width: 639px) 82vw, (max-width: 1023px) 46vw, (max-width: 1279px) 33vw, 25vw"
                            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025]"
                          />
                        )}
                      </div>

                      <div className="flex min-h-[92px] flex-1 items-center justify-between gap-3 px-4 py-3.5 sm:min-h-[100px] sm:px-5 sm:py-4">
                        <div className="min-w-0">
                          <h3 className="text-sm font-black tracking-[-0.03em] text-[var(--text-primary)] sm:text-base">
                            {tool.label}
                          </h3>
                          <p className="mt-1 line-clamp-1 text-[0.68rem] font-bold text-[var(--text-muted)] sm:text-xs">
                            {tool.creditLabel}
                          </p>
                        </div>
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors duration-200"
                          style={{ background: tool.soft, color: tool.accent }}
                          aria-hidden="true"
                        >
                          <ArrowRight size={15} />
                        </span>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          </div>
          </div>
        </PageContainer>
      </section>

      <section id="how-it-works" className="scroll-mt-[var(--header-height)] home-steps-section py-14 sm:py-20 lg:py-24">
        <PageContainer>
          <div className="mx-auto w-full max-w-[1320px]">
          <div className="home-steps-panel rounded-[1.45rem] border border-[var(--border)] bg-[var(--surface-strong)] p-4 shadow-[0_20px_60px_rgba(40,24,68,0.08)] sm:rounded-[1.8rem] sm:p-7 lg:p-9">
            <SectionHeading
              eyebrow="How it works"
              title="From idea to finished work, in a few simple steps."
              description="Brief your idea, explore with AI, refine it, then bring in an expert when needed."
              align="left"
              size="compact"
            />

            <div className="mt-5 grid grid-cols-1 sm:mt-8 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4 lg:gap-4">
              {simpleSteps.map(({ icon: Icon, number, title, text }) => (
                <article
                  key={title}
                  className="home-step-item grid grid-cols-[2rem_minmax(0,1fr)_2.25rem] items-center gap-x-3 border-b border-[var(--border)] py-3.5 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_2.4rem] sm:items-start sm:rounded-[1.15rem] sm:border sm:bg-[var(--surface)] sm:p-4 sm:first:p-4 sm:last:border sm:last:p-4 lg:min-h-[154px]"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-soft)] text-[0.7rem] font-black text-[var(--accent-strong)] sm:hidden">
                    {number}
                  </span>
                  <div className="min-w-0">
                    <span className="hidden text-[0.62rem] font-black uppercase tracking-[0.15em] text-[var(--accent-strong)] sm:block">
                      Step {number}
                    </span>
                    <h3 className="text-[0.96rem] font-black tracking-[-0.03em] text-[var(--text-primary)] sm:mt-4 sm:text-base lg:text-[1.02rem]">{title}</h3>
                    <p className="mt-1 text-[0.69rem] font-semibold leading-[1.15rem] text-[var(--text-secondary)] sm:mt-1.5 sm:text-[0.72rem] sm:leading-5">{text}</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)] sm:h-10 sm:w-10">
                    <Icon size={17} strokeWidth={2} />
                  </span>
                </article>
              ))}
            </div>

            <div className="mt-3 flex flex-col gap-3 rounded-[1.05rem] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3.5 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div>
                <p className="text-sm font-black tracking-[-0.03em] sm:text-base">Not sure which Studio or tool to use?</p>
                <p className="mt-0.5 text-[0.68rem] font-semibold text-[var(--text-secondary)] sm:text-xs">Tell Heyy what you want to make.</p>
              </div>
              <div className="shrink-0">
                <OpenAssistantButton />
              </div>
            </div>
          </div>
          </div>
        </PageContainer>
      </section>

      <section id="pricing" className="scroll-mt-[var(--header-height)] home-pricing-section py-14 sm:py-20 lg:py-24">
        <PageContainer>
          <div className="mx-auto w-full max-w-[1240px]">
          <SectionHeading
            eyebrow="Plans & credits"
            title="Start free. Upgrade when you need more."
            description="Plans include AI credits. Top up anytime; Expert work is quoted separately."
            size="compact"
          />

          {!accountLoading && user && (
            <div className="mx-auto mt-6 flex max-w-[1240px] flex-col gap-3 rounded-[1.2rem] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3.5 sm:mt-9 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:rounded-[1.55rem] sm:p-5">
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.15em] text-[var(--accent-strong)]">Your account</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <p className="text-base font-black text-[var(--text-primary)] sm:text-lg">
                    Current plan: {PLANS.find((item) => item.id === currentPlanId)?.name || currentPlan}
                  </p>
                  <span className="rounded-full border border-[var(--accent-border)] bg-[var(--surface-strong)] px-2.5 py-1 text-[0.68rem] font-black text-[var(--accent-strong)] sm:px-3 sm:py-1.5 sm:text-xs">
                    {credits.available.toLocaleString("en-US")} credits
                  </span>
                </div>
                <p className="mt-1.5 hidden text-xs font-semibold text-[var(--text-secondary)] sm:block">
                  Your current plan is marked below.
                </p>
              </div>
              <ButtonLink href="/billing" variant="secondary" className="shrink-0">
                Manage billing
              </ButtonLink>
            </div>
          )}

          <div className="mx-auto mt-5 max-w-[1240px] sm:mt-8">
            <PlanCards compactMobile />
          </div>

          <div className="mx-auto mt-5 max-w-[1240px] overflow-hidden rounded-[1.2rem] border border-[var(--accent-border)] bg-[var(--accent-soft)] sm:mt-7 sm:rounded-[1.45rem]">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--surface-strong)] text-[var(--accent-strong)] shadow-sm">
                  <PlusCircle size={17} />
                </span>
                <div>
                  <p className="text-sm font-black tracking-[-0.03em] text-[var(--text-primary)] sm:text-base">Buy credits</p>
                  <p className="mt-0.5 text-[0.68rem] font-semibold text-[var(--text-secondary)] sm:text-xs">Top up anytime. Purchased credits never expire.</p>
                </div>
              </div>
              <ButtonLink href="/credits" variant="secondary" size="sm" className="shrink-0 sm:min-w-[154px]">
                View credit packs <ArrowRight size={14} />
              </ButtonLink>
            </div>
            <div className="flex flex-col gap-2 border-t border-[var(--accent-border)] px-4 py-3 text-[0.66rem] font-semibold leading-5 text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:text-[0.7rem]">
              <span>Prices are in US dollars. Expert production is quoted separately before you pay.</span>
              <ButtonLink href="/credit-guide" variant="ghost" size="sm" className="shrink-0 self-start sm:self-auto">
                See credit costs <ArrowRight size={13} />
              </ButtonLink>
            </div>
          </div>
          </div>
        </PageContainer>
      </section>

      <SiteFooter />

      <style jsx global>{`

        #create .overflow-x-auto,
        #tools .overflow-x-auto {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
        }


        .hero-image-overlay {
          background:
            linear-gradient(
              180deg,
              rgba(8, 6, 20, 0.10) 0%,
              rgba(8, 6, 20, 0.20) 34%,
              rgba(8, 6, 20, 0.56) 66%,
              rgba(8, 6, 20, 0.88) 100%
            );
        }

        .home-hero > video {
          filter: brightness(0.84) saturate(0.96);
        }

        .home-studios-section {
          background:
            radial-gradient(circle at 8% 2%, color-mix(in srgb, var(--accent-soft) 44%, transparent), transparent 32%),
            linear-gradient(180deg, var(--surface-strong) 0%, color-mix(in srgb, var(--surface) 96%, var(--accent-soft)) 100%);
        }

        .studio-card-shell {
          isolation: isolate;
        }

        .studio-card-image {
          border-bottom: 1px solid rgba(255,255,255,.08);
        }

        .studio-card-footer {
          background:
            radial-gradient(circle at 88% 6%, color-mix(in srgb, var(--studio-accent) 42%, transparent) 0%, transparent 32%),
            radial-gradient(circle at 4% 104%, color-mix(in srgb, var(--studio-accent) 26%, transparent) 0%, transparent 40%),
            linear-gradient(145deg, color-mix(in srgb, var(--studio-accent) 34%, #18141e) 0%, #15111a 56%, #0d0b11 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.08),
            inset 0 0 0 1px color-mix(in srgb, var(--studio-accent) 13%, transparent);
        }

        .studio-card-footer::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(115deg, rgba(255,255,255,.055), transparent 34%);
        }

        .studio-card-footer::after {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 2px;
          background: linear-gradient(180deg, color-mix(in srgb, var(--studio-accent) 72%, white), color-mix(in srgb, var(--studio-accent) 38%, transparent));
          opacity: .9;
        }

        .studio-card-arrow {
          box-shadow: 0 10px 28px color-mix(in srgb, var(--studio-accent) 22%, transparent), inset 0 1px 0 rgba(255,255,255,.14);
        }

        .home-tools-section {
          background:
            radial-gradient(circle at 90% 6%, color-mix(in srgb, #5b8cff 8%, transparent), transparent 30%),
            linear-gradient(180deg, color-mix(in srgb, var(--surface) 98%, #eef4ff) 0%, color-mix(in srgb, var(--surface-strong) 98%, var(--accent-soft)) 100%);
        }

        .home-steps-section {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 96%, var(--accent-soft)) 0%, var(--surface-strong) 100%);
        }

        .home-steps-panel {
          background:
            radial-gradient(circle at 96% 0%, color-mix(in srgb, var(--accent-soft) 64%, transparent), transparent 32%),
            linear-gradient(145deg, color-mix(in srgb, var(--surface-strong) 98%, var(--accent-soft)), var(--surface-strong));
        }

        .home-pricing-section {
          background:
            radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--accent-soft) 36%, transparent), transparent 34%),
            linear-gradient(180deg, var(--surface) 0%, color-mix(in srgb, var(--accent-soft) 16%, var(--surface-strong)) 100%);
        }

        @media (min-width: 1024px) {
          .hero-image-overlay {
            background: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.97) 0%,
              rgba(255, 255, 255, 0.88) 28%,
              rgba(255, 255, 255, 0.48) 45%,
              rgba(255, 255, 255, 0.08) 61%,
              rgba(255, 255, 255, 0) 72%
            );
          }

          .home-hero > video {
            filter: none;
          }

          [data-theme="dark"] .hero-image-overlay {
            background: linear-gradient(
              90deg,
              rgba(18, 16, 24, 0.96) 0%,
              rgba(18, 16, 24, 0.84) 30%,
              rgba(18, 16, 24, 0.42) 47%,
              rgba(18, 16, 24, 0.05) 64%,
              rgba(18, 16, 24, 0) 76%
            );
          }

          [data-theme="dark"] .home-hero > video {
            filter: brightness(0.72) saturate(0.9);
          }
        }

        .hero-static-wrap {
          display: grid;
          place-items: center;
        }

        .hero-static-frame {
          position: relative;
          width: min(100%, 560px);
          aspect-ratio: 1.05 / 1;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--text-primary) 11%, transparent);
          border-radius: 2.2rem;
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--surface-strong) 96%, #f5f0fb), color-mix(in srgb, var(--surface) 92%, #eef6ff));
          box-shadow: 0 34px 90px rgba(40, 24, 68, 0.14);
        }

        .hero-static-grid {
          position: absolute;
          inset: 0;
          opacity: 0.46;
          background-image:
            linear-gradient(color-mix(in srgb, var(--text-primary) 7%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 7%, transparent) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: linear-gradient(to bottom right, black 12%, transparent 82%);
        }

        .hero-static-plane {
          position: absolute;
          overflow: hidden;
          border-radius: 1.75rem;
        }

        .hero-static-plane-dark {
          left: 8%;
          top: 9%;
          width: 47%;
          height: 64%;
          background:
            linear-gradient(155deg, #17111f 0%, #25172f 55%, #11151d 100%);
          box-shadow: 0 28px 50px rgba(24, 12, 34, 0.28);
        }

        .hero-static-plane-dark::after {
          content: "";
          position: absolute;
          right: -14%;
          bottom: -18%;
          width: 72%;
          height: 62%;
          border-radius: 1.6rem;
          background: linear-gradient(135deg, rgba(111,45,255,.88), rgba(239,63,180,.68));
          transform: rotate(-18deg);
        }

        .hero-static-line {
          position: absolute;
          left: 13%;
          z-index: 2;
          display: block;
          height: 1px;
          background: rgba(255,255,255,.42);
        }

        .hero-static-line-one { top: 18%; width: 55%; }
        .hero-static-line-two { top: 24%; width: 31%; opacity: .55; }

        .hero-static-plane-light {
          right: 7%;
          bottom: 13%;
          width: 54%;
          height: 50%;
          border: 1px solid rgba(255,255,255,.72);
          background: color-mix(in srgb, var(--surface-strong) 93%, transparent);
          box-shadow: 0 25px 55px rgba(39, 27, 58, .16);
          backdrop-filter: blur(12px);
        }

        .hero-static-plane-light::before {
          content: "";
          position: absolute;
          left: 9%;
          right: 9%;
          top: 18%;
          height: 1px;
          background: color-mix(in srgb, var(--text-primary) 17%, transparent);
        }

        .hero-static-block {
          position: absolute;
          border-radius: .85rem;
        }

        .hero-static-block-violet { left: 10%; bottom: 13%; width: 27%; height: 39%; background: #7135f4; }
        .hero-static-block-pink { left: 40%; bottom: 13%; width: 18%; height: 27%; background: #eb3eae; }
        .hero-static-block-blue { right: 10%; bottom: 13%; width: 25%; height: 52%; background: #4b8cf5; }
        .hero-static-block-orange { left: 40%; top: 29%; width: 18%; height: 12%; background: #f4a04b; }

        .hero-static-outline {
          position: absolute;
          right: 12%;
          top: 8%;
          width: 29%;
          height: 29%;
          border: 2px solid color-mix(in srgb, #7135f4 75%, var(--surface-strong));
          border-radius: 1.5rem;
          transform: rotate(8deg);
        }

        .hero-static-bar {
          position: absolute;
          left: 7%;
          bottom: 7%;
          display: flex;
          width: 34%;
          gap: .45rem;
          border-radius: 999px;
          background: color-mix(in srgb, var(--surface-strong) 92%, transparent);
          padding: .55rem;
          box-shadow: 0 13px 32px rgba(41, 24, 62, .12);
        }

        .hero-static-bar span {
          height: .52rem;
          flex: 1;
          border-radius: 999px;
          background: color-mix(in srgb, var(--text-primary) 11%, transparent);
        }

        .hero-static-bar span:first-child { background: #7135f4; }
        .hero-static-bar span:nth-child(2) { background: #eb3eae; }

        .hero-static-caption {
          position: absolute;
          right: 7%;
          top: 47%;
          z-index: 4;
          display: flex;
          align-items: center;
          gap: .45rem;
          padding: .55rem .7rem;
          border: 1px solid color-mix(in srgb, var(--text-primary) 10%, transparent);
          border-radius: 999px;
          background: color-mix(in srgb, var(--surface-strong) 93%, transparent);
          color: var(--text-muted);
          font-size: .48rem;
          font-weight: 900;
          letter-spacing: .13em;
        }

        .hero-static-caption i {
          width: 13px;
          height: 1px;
          background: color-mix(in srgb, var(--text-primary) 18%, transparent);
        }

        @media (max-width: 640px) {
          .hero-static-frame { width: min(100%, 430px); border-radius: 1.8rem; }
          .hero-static-caption { font-size: .42rem; }
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

        .hero-particle-field {
          position: absolute;
          inset: 3%;
          z-index: 1;
          pointer-events: none;
        }

        .hero-particle {
          position: absolute;
          height: var(--particle-size, 5px);
          width: var(--particle-size, 5px);
          border-radius: 999px;
          background: color-mix(in srgb, var(--particle-color, #8b5cf6) 86%, white);
          box-shadow: 0 0 18px color-mix(in srgb, var(--particle-color, #8b5cf6) 45%, transparent);
          opacity: 0.55;
          animation: hero-particle-twinkle var(--particle-speed, 4.8s) ease-in-out infinite;
          animation-delay: var(--particle-delay, 0s);
          transition: transform 180ms ease-out;
        }

        .hero-particle-depth-1 { transform: translate3d(var(--hero-particle-x-1, 0px), var(--hero-particle-y-1, 0px), 14px); }
        .hero-particle-depth-2 { transform: translate3d(var(--hero-particle-x-2, 0px), var(--hero-particle-y-2, 0px), 32px); }
        .hero-particle-depth-3 { transform: translate3d(var(--hero-particle-x-3, 0px), var(--hero-particle-y-3, 0px), 54px); }

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
          border: 1px solid rgba(255, 255, 255, 0.7);
          background:
            radial-gradient(circle at 34% 30%, rgba(255,255,255,.82), rgba(255,255,255,.16) 22%, transparent 42%),
            radial-gradient(circle at 70% 68%, rgba(34,211,238,.44), transparent 38%),
            conic-gradient(from 210deg, rgba(111,45,255,.92), rgba(239,63,180,.82), rgba(255,176,74,.76), rgba(34,211,238,.84), rgba(111,45,255,.92));
          color: white;
          box-shadow: inset 0 0 42px rgba(255, 255, 255, 0.25), 0 0 70px rgba(111,45,255,.22);
          animation: hero-hub-morph 8s ease-in-out infinite, hero-hue 18s linear infinite;
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

        .hero-core-symbol {
          position: relative;
          z-index: 4;
          display: grid;
          height: 66px;
          width: 66px;
          place-items: center;
          border: 1px solid rgba(255,255,255,.52);
          border-radius: 22px;
          background: rgba(23, 10, 42, .22);
          box-shadow: inset 0 0 24px rgba(255,255,255,.14), 0 16px 38px rgba(40,18,72,.24);
          backdrop-filter: blur(12px);
          animation: hero-icon-pulse 3.4s ease-in-out infinite;
        }

        .hero-core-ring {
          position: absolute;
          z-index: 2;
          border: 1px solid rgba(255,255,255,.28);
          border-radius: 999px;
          animation: hero-orbit-spin 9s linear infinite;
        }

        .hero-core-ring-one { inset: 24px; }
        .hero-core-ring-two { inset: 46px; border-style: dashed; animation-direction: reverse; animation-duration: 13s; }

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

        @keyframes hero-orbit-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes hero-orbit-spin-reverse {
          from { transform: translate(-50%, -50%) rotate(360deg); }
          to { transform: translate(-50%, -50%) rotate(0deg); }
        }

        @keyframes hero-particle-twinkle {
          0%, 100% { opacity: .28; scale: .72; }
          50% { opacity: .92; scale: 1.22; }
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
  size = "default",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  size?: "default" | "compact";
}) {
  const titleClass =
    size === "compact"
      ? "mt-4 text-[1.9rem] font-black leading-[1] tracking-[-0.045em] sm:mt-5 sm:text-[2.8rem] sm:leading-[0.98] lg:text-[3.2rem]"
      : "mt-4 text-[1.95rem] font-black leading-[0.98] tracking-[-0.05em] sm:mt-5 sm:text-6xl sm:leading-[0.95] sm:tracking-[-0.06em] lg:text-[4.15rem]";

  return (
    <div className={align === "center" ? "mx-auto max-w-5xl text-center" : "max-w-3xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={titleClass}>{title}</h2>
      {description && (
        <p className={`mt-3.5 text-sm font-semibold leading-6 text-[var(--text-secondary)] sm:mt-4 sm:text-base sm:leading-7 ${align === "center" ? "mx-auto max-w-3xl" : ""}`}>
          {description}
        </p>
      )}
    </div>
  );
}

