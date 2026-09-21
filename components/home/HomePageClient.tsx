"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
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
    video: string;
  }
> = {
  brand_studio: {
    label: "Brand Studio",
    description: "Logos, identity, guidelines and real-world applications.",
    image: "/home/studios/brand-studio.png",
    video: "/home/studios/brand-studio.mp4",
  },
  marketing_studio: {
    label: "Marketing Studio",
    description: "Campaigns, content, messaging and creative direction.",
    image: "/home/studios/marketing-studio.png",
    video: "/home/studios/marketing-studio.mp4",
  },
  architecture_studio: {
    label: "Architecture Studio",
    description: "Concepts, plans, visuals and detailed outputs.",
    image: "/home/studios/architecture-studio.png",
    video: "/home/studios/architecture-studio.mp4",
  },
  interior_studio: {
    label: "Interior Design Studio",
    description: "Spaces, layouts, materials and polished interior visuals.",
    image: "/home/studios/interior-studio.png",
    video: "/home/studios/interior-studio.mp4",
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
    text: "Get strong creative directions and results.",
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

export default function HomePageClient() {
  const { user, loading: accountLoading, plan: currentPlan, credits } = useAuth();
  const currentPlanId = String(currentPlan || "free").toLowerCase();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [playingStudioVideo, setPlayingStudioVideo] = useState<string | null>(null);
  const hoveredStudioVideo = useRef<string | null>(null);
  const studioVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const canPlayStudioHoverVideo = () => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  };

  const startStudioHoverVideo = (studioId: string) => {
    if (!canPlayStudioHoverVideo()) return;

    const video = studioVideoRefs.current[studioId];
    if (!video) return;

    hoveredStudioVideo.current = studioId;
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      video.currentTime = 0;
    }

    void video.play().catch(() => {
      if (hoveredStudioVideo.current === studioId) {
        setPlayingStudioVideo(null);
      }
    });
  };

  const stopStudioHoverVideo = (studioId: string) => {
    if (hoveredStudioVideo.current === studioId) {
      hoveredStudioVideo.current = null;
    }
    if (playingStudioVideo === studioId) {
      setPlayingStudioVideo(null);
    }

    const video = studioVideoRefs.current[studioId];
    if (!video) return;

    video.pause();
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      video.currentTime = 0;
    }
  };

  useEffect(() => {
    const updateBackToTop = () => {
      if (window.innerWidth >= 768) {
        setShowBackToTop(false);
        return;
      }

      const studiosSection = document.getElementById("create");
      if (!studiosSection) return;

      const headerHeight = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--header-height"),
      ) || 72;
      setShowBackToTop(studiosSection.getBoundingClientRect().bottom <= headerHeight + 16);
    };

    updateBackToTop();
    window.addEventListener("scroll", updateBackToTop, { passive: true });
    window.addEventListener("resize", updateBackToTop);
    return () => {
      window.removeEventListener("scroll", updateBackToTop);
      window.removeEventListener("resize", updateBackToTop);
    };
  }, []);

  return (
    <main className="heyy-page home-page overflow-x-clip">
      <SiteHeader heroOverlay />

      <section className="home-hero relative isolate h-[200svh]">
        <div className="sticky top-0 h-[100svh] overflow-hidden">
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
        </div>

        <PageContainer className="absolute inset-x-0 top-0 z-10 flex min-h-[100svh] items-center justify-center pb-12 pt-[calc(var(--header-height)+2rem)] sm:pb-16 sm:pt-[calc(var(--header-height)+2.5rem)]">
          <div className="mx-auto w-full max-w-[760px] text-center">
            <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-white/75 sm:text-[0.7rem]">
              Create with Heyy. Build with Experts.
            </p>

            <h1 className="mt-4 text-[2.55rem] font-black leading-[0.98] tracking-[-0.05em] text-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.34)] sm:mt-5 sm:text-[clamp(3rem,5vw,4.6rem)] sm:leading-[1.01]">
              <span className="block">Bring your ideas</span>
              <span className="home-spectrum-text block">to life.</span>
            </h1>

            <div className="mt-7 flex flex-wrap justify-center gap-2.5 sm:mt-8">
              <ButtonLink
                href="#create"
                size="md"
                className="hero-primary-cta group min-w-[142px] !border-white/15 !bg-white shadow-[0_12px_34px_rgba(0,0,0,.25)] transition-[background-color,border-color,box-shadow] hover:!border-[#8b5cf6] hover:!bg-[#8b5cf6] hover:shadow-[0_14px_36px_rgba(139,92,246,.30)]"
              >
                <span
                  className="hero-primary-cta-label inline-flex items-center gap-2"
                >
                  Start creating <ArrowRight size={15} />
                </span>
              </ButtonLink>
              <ButtonLink href="#tools" variant="secondary" size="md" className="min-w-[142px] !border-white/20 !bg-black/20 !text-white backdrop-blur-md hover:!border-white/35 hover:!bg-white/10 hover:!text-white">
                Use a quick tool
              </ButtonLink>
            </div>
          </div>
        </PageContainer>
      </section>

      <div className="home-content-field relative isolate z-[60] -mt-[100svh] overflow-hidden">
      <section id="create" className="scroll-mt-[var(--header-height)] home-studios-section relative pb-4 pt-14 sm:pb-6 sm:pt-16 lg:pb-8 lg:pt-16">
        <PageContainer>
          <div className="mx-auto w-full max-w-[1320px]">
            <SectionHeading
              eyebrow="Creative Studios"
              title="What do you want to create?"
              description="Each Studio brings together specialised creative tools and workflows for a focused creative journey."
              align="left"
              nowrapDesktop
            />

            <div className="home-studio-showcase relative mt-7 sm:mt-9">
              <div className="-mr-4 snap-x snap-mandatory overflow-x-auto pb-5 pr-4 [scrollbar-width:none] sm:-mr-6 sm:pr-6 lg:mr-0 lg:overflow-visible lg:pb-6 lg:pr-0 [&::-webkit-scrollbar]:hidden">
                <div className="grid w-max grid-flow-col auto-cols-[84vw] gap-4 sm:auto-cols-[46vw] lg:w-full lg:grid-flow-row lg:grid-cols-4 lg:auto-cols-auto lg:gap-4 xl:gap-5">
                  {VISIBLE_STUDIOS.map((studio, studioIndex) => {
                    const content = studioContent[studio.id];
                    if (!content) return null;
                    return (
                      <Link
                        key={studio.id}
                        href={studio.href || "/dashboard"}
                        className={`studio-card group block snap-start ${studioIndex % 2 === 1 ? "lg:translate-y-5" : ""}`}
                        onMouseEnter={() => startStudioHoverVideo(studio.id)}
                        onMouseLeave={() => stopStudioHoverVideo(studio.id)}
                      >
                        <article
                          className="studio-card-shell relative min-h-[430px] overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#09070f] shadow-[0_24px_70px_rgba(18,10,35,0.18)] transition-[border-color,box-shadow] duration-300 sm:min-h-[450px] sm:rounded-[1.65rem] lg:min-h-[365px] xl:min-h-[395px]"
                          style={{ "--studio-accent": studio.accent } as CSSProperties}
                        >
                          <div className="studio-card-media absolute inset-0">
                            <Image
                              src={content.image}
                              alt={`${content.label} preview`}
                              fill
                              priority={studioIndex < 2}
                              unoptimized
                              sizes="(max-width: 639px) 84vw, (max-width: 1023px) 46vw, 25vw"
                              className="studio-card-art object-cover"
                            />
                            <video
                              ref={(node) => {
                                studioVideoRefs.current[studio.id] = node;
                              }}
                              src={content.video}
                              muted
                              loop
                              playsInline
                              preload="none"
                              poster={content.image}
                              aria-hidden="true"
                              tabIndex={-1}
                              onPlaying={() => {
                                if (hoveredStudioVideo.current === studio.id) {
                                  setPlayingStudioVideo(studio.id);
                                }
                              }}
                              onError={() => {
                                if (hoveredStudioVideo.current === studio.id) {
                                  setPlayingStudioVideo(null);
                                }
                              }}
                              className={`studio-card-video absolute inset-0 hidden h-full w-full object-cover lg:block ${
                                playingStudioVideo === studio.id ? "is-playing" : ""
                              }`}
                            />
                            <div className="studio-card-vignette absolute inset-0" />
                            <div className="studio-card-glow absolute inset-x-0 bottom-0 h-[56%]" />
                          </div>

                          <div className="absolute inset-x-0 bottom-0 z-10 flex min-h-[180px] flex-col justify-end p-5 text-white sm:p-6 lg:min-h-[164px] lg:p-5 xl:p-6">
                            <div className="mb-4 h-[2px] w-10 rounded-full bg-[var(--studio-accent)] shadow-[0_0_18px_var(--studio-accent)]" />
                            <h3 className="pr-14 text-[1.28rem] font-black tracking-[-0.045em] text-white sm:text-[1.45rem] lg:text-[1.08rem] xl:text-[1.25rem]">
                              {content.label}
                            </h3>
                            <p className="mt-2 max-w-[19rem] pr-14 text-[0.78rem] font-semibold leading-5 text-white/75 sm:text-sm sm:leading-6 lg:text-[0.7rem] lg:leading-5 xl:text-xs">
                              {content.description}
                            </p>
                            <span
                              className="studio-card-arrow absolute bottom-5 right-5 grid h-10 w-10 place-items-center rounded-full border border-white/18 bg-white/10 text-white backdrop-blur-md transition-[background-color,border-color,transform] duration-300 group-hover:border-white/32 group-hover:bg-white/20 sm:bottom-6 sm:right-6 lg:bottom-5 lg:right-5 xl:bottom-6 xl:right-6"
                              aria-hidden="true"
                            >
                              <ArrowRight size={16} />
                            </span>
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      <section id="tools" className="scroll-mt-[var(--header-height)] home-tools-section pb-5 pt-6 sm:pb-7 sm:pt-8 lg:pb-8 lg:pt-8">
        <PageContainer>
          <div className="mx-auto w-full max-w-[1320px]">
            <SectionHeading
              eyebrow="Creative tools"
              title="Quick tools. Big results."
              description="Create, enhance and convert without starting a full Studio project."
              align="left"
            />

            <div className="home-tools-stage relative mt-7 sm:mt-9">
              <div className="-mx-4 snap-x snap-mandatory overflow-x-auto px-6 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
                <div className="grid w-max grid-flow-col auto-cols-[calc(100vw-3rem)] gap-3.5 sm:auto-cols-[46vw] lg:w-full lg:grid-flow-row lg:[grid-template-columns:repeat(16,minmax(0,1fr))] lg:auto-cols-auto lg:gap-4">
                  {PLATFORM_TOOLS.map((tool, toolIndex) => {
                    const visual = toolVisuals[tool.id];
                    const desktopPlacement = toolIndex === 4 ? "lg:col-start-3" : "";

                    return (
                      <Link
                        key={tool.id}
                        href={tool.href}
                        className={`quick-tool-card group block h-full snap-center lg:col-span-4 ${desktopPlacement}`}
                      >
                        <article
                          className="quick-tool-shell flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-strong)] shadow-[0_12px_34px_rgba(42,28,66,0.08)] transition-[border-color,box-shadow] duration-300 sm:rounded-[1.4rem]"
                          style={{ "--tool-accent": tool.accent } as CSSProperties}
                        >
                          <div className="quick-tool-media relative aspect-[3/2] shrink-0 overflow-hidden bg-[var(--surface)]">
                            {visual && (
                              <Image
                                src={visual}
                                alt={`${tool.label} preview`}
                                fill
                                unoptimized
                                sizes="(max-width: 639px) 84vw, (max-width: 1023px) 46vw, 25vw"
                                className="quick-tool-art object-cover"
                              />
                            )}
                          </div>

                          <div className="flex min-h-[84px] flex-1 items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4 lg:min-h-[88px] lg:px-4 lg:py-3.5">
                            <div className="min-w-0">
                              <h3 className="text-sm font-black tracking-[-0.035em] text-[var(--text-primary)] sm:text-base lg:text-[0.92rem] xl:text-base">
                                {tool.label}
                              </h3>
                            </div>
                            <span
                              className="quick-tool-arrow grid h-9 w-9 shrink-0 place-items-center rounded-full transition-[filter,transform] duration-300 group-hover:brightness-[0.96] lg:h-9 lg:w-9"
                              style={{ background: tool.soft, color: tool.accent }}
                              aria-hidden="true"
                            >
                              <ArrowRight size={14} />
                            </span>
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      <section id="how-it-works" className="scroll-mt-[var(--header-height)] home-steps-section pb-8 pt-5 sm:pb-10 sm:pt-7 lg:pb-12 lg:pt-8">
        <PageContainer>
          <div className="mx-auto w-full max-w-[1320px]">
            <div className="home-workflow-panel overflow-hidden rounded-[1.55rem] border border-[var(--border)] shadow-[0_24px_64px_rgba(50,31,78,0.09)] sm:rounded-[1.9rem] lg:grid lg:grid-cols-[0.88fr_1.42fr]">
              <div className="home-workflow-intro relative flex flex-col overflow-hidden p-5 text-white sm:min-h-[285px] sm:p-7 lg:min-h-[340px] lg:p-8">
                <div className="home-workflow-orbit home-workflow-orbit-one" aria-hidden="true" />
                <div className="home-workflow-orbit home-workflow-orbit-two" aria-hidden="true" />
                <div className="relative z-10">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-white/70 sm:text-[0.68rem]">How it works</p>
                  <h2 className="mt-3 max-w-[520px] text-[1.85rem] font-black leading-[0.98] tracking-[-0.05em] text-white sm:mt-4 sm:text-[2.5rem] lg:text-[2.8rem]">
                    From idea to finished work, in a few simple steps.
                  </h2>
                </div>

                <div className="relative z-10 mt-6 rounded-[1.1rem] border border-white/15 bg-white/10 p-3.5 backdrop-blur-md sm:mt-auto sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-4">
                  <div>
                    <p className="text-sm font-black tracking-[-0.03em] text-white sm:text-base">Not sure which Studio or tool to use?</p>
                    <p className="mt-0.5 text-[0.68rem] font-semibold text-white/65 sm:text-xs">Tell Heyy what you want to make.</p>
                  </div>
                  <div className="mt-3 shrink-0 sm:mt-0">
                    <OpenAssistantButton className="home-workflow-ai-button !border-white/30 !bg-white shadow-sm hover:!border-[#7447e8] hover:!bg-[#7447e8] hover:shadow-[0_12px_30px_rgba(36,18,62,.24)]" />
                  </div>
                </div>
              </div>

              <div className="home-workflow-steps bg-[var(--surface-strong)] p-2.5 sm:p-4 lg:p-4">
                <div className="grid h-full grid-cols-2 gap-2 sm:gap-3 lg:gap-3">
                  {simpleSteps.map(({ icon: Icon, number, title, text }) => (
                    <article
                      key={title}
                      className="home-step-item relative min-h-[96px] overflow-hidden rounded-[1rem] border border-[var(--border)] bg-[var(--surface)] p-3 sm:min-h-[118px] sm:rounded-[1.1rem] sm:p-4 lg:min-h-0"
                    >
                      <div className="relative z-10 flex items-start justify-between gap-4">
                        <span className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--accent-strong)]">Step {number}</span>
                        <span className="home-step-icon grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)] sm:h-9 sm:w-9 sm:rounded-xl">
                          <Icon size={17} strokeWidth={2} />
                        </span>
                      </div>
                      <div className="relative z-10 mt-2.5 sm:mt-4">
                        <h3 className="text-[0.94rem] font-black tracking-[-0.035em] text-[var(--text-primary)] sm:text-[1.05rem]">{title}</h3>
                        <p className="mt-1 max-w-[17rem] text-[0.61rem] font-semibold leading-[0.95rem] text-[var(--text-secondary)] sm:text-[0.7rem] sm:leading-4">{text}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      <section id="pricing" className="scroll-mt-[var(--header-height)] home-pricing-section pb-14 pt-8 sm:pb-[4.5rem] sm:pt-10 lg:pb-20 lg:pt-12">
        <PageContainer>
          <div className="mx-auto w-full max-w-[1240px]">
            <SectionHeading
              eyebrow="Plans & credits"
              title="Start free. Upgrade when you need more."
              description="Choose yearly or monthly. Yearly includes two months free; subscription credits still refresh monthly. Top up anytime. Expert work is quoted separately."
              size="compact"
            />

            <div className="home-pricing-stage relative mt-7 sm:mt-9">
              {!accountLoading && user && (
                <div className="mx-auto flex max-w-[1240px] flex-col gap-3 rounded-[1.1rem] border border-[var(--accent-border)] bg-[color-mix(in_srgb,var(--accent-soft)_82%,var(--surface-strong))] p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:rounded-[1.35rem] sm:p-[1.125rem]">
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

              <div className="mx-auto mt-5 max-w-[1240px] sm:mt-6">
                <PlanCards compactMobile />
              </div>

              <div className="mx-auto mt-4 max-w-[1240px] overflow-hidden rounded-[1.1rem] border border-[var(--accent-border)] bg-[color-mix(in_srgb,var(--accent-soft)_78%,var(--surface-strong))] sm:mt-5 sm:rounded-[1.35rem]">
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
          </div>
        </PageContainer>
      </section>
      </div>

      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          title="Back to top"
          className="fixed bottom-[5.25rem] right-4 z-[75] grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-[var(--accent-border)] bg-[var(--surface-strong)] text-[var(--accent-strong)] shadow-[0_14px_36px_rgba(24,15,44,.18)] backdrop-blur-xl transition-[background-color,color,border-color,box-shadow] hover:border-[#8b5cf6] hover:bg-[#8b5cf6] hover:text-white hover:shadow-[0_16px_38px_rgba(139,92,246,.26)] md:hidden"
        >
          <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>
      )}

      <SiteFooter />

      <style jsx global>{`

        #create .overflow-x-auto,
        #tools .overflow-x-auto {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
        }


        .hero-image-overlay {
          background:
            linear-gradient(rgba(15, 8, 28, 0.32), rgba(15, 8, 28, 0.32)),
            radial-gradient(circle at 50% 44%, rgba(10, 7, 22, 0.06) 0%, rgba(10, 7, 22, 0.16) 44%, rgba(8, 6, 18, 0.42) 100%),
            linear-gradient(180deg, rgba(7, 5, 16, 0.24) 0%, rgba(7, 5, 16, 0.12) 38%, rgba(7, 5, 16, 0.28) 68%, rgba(7, 5, 16, 0.62) 100%);
        }

        .home-hero video {
          filter: brightness(0.76) saturate(0.98) contrast(1.03);
        }

        .home-hero .hero-primary-cta {
          color: #17131f !important;
        }

        .home-hero .hero-primary-cta-label {
          color: #17131f !important;
          -webkit-text-fill-color: #17131f !important;
          transition: color 180ms ease;
        }

        .home-hero .hero-primary-cta:hover .hero-primary-cta-label {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        .home-workflow-ai-button,
        .home-workflow-ai-button * {
          color: #2b0b56 !important;
          -webkit-text-fill-color: #2b0b56 !important;
        }

        .home-workflow-ai-button:hover,
        .home-workflow-ai-button:hover * {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        .home-content-field {
          background:
            radial-gradient(circle at 10% 8%, rgba(139, 92, 246, 0.12), transparent 24%),
            radial-gradient(circle at 90% 31%, rgba(239, 63, 180, 0.075), transparent 22%),
            radial-gradient(circle at 26% 69%, rgba(91, 140, 255, 0.075), transparent 27%),
            linear-gradient(180deg, color-mix(in srgb, var(--background) 84%, #eee6ff) 0%, color-mix(in srgb, var(--background) 90%, #f6efff) 46%, color-mix(in srgb, var(--background) 86%, #eee7ff) 100%);
        }

        .home-content-field::before,
        .home-content-field::after {
          content: "";
          position: absolute;
          z-index: 0;
          pointer-events: none;
          border-radius: 999px;
          filter: blur(18px);
          will-change: transform;
        }

        .home-content-field::before {
          right: -16vw;
          top: 10%;
          width: min(68vw, 980px);
          aspect-ratio: 1;
          background: radial-gradient(circle, rgba(137, 88, 255, 0.12), rgba(137, 88, 255, 0) 68%);
          animation: home-ambient-drift-a 18s ease-in-out infinite alternate;
        }

        .home-content-field::after {
          left: -22vw;
          top: 58%;
          width: min(74vw, 1040px);
          aspect-ratio: 1;
          background: radial-gradient(circle, rgba(225, 94, 247, 0.085), rgba(225, 94, 247, 0) 70%);
          animation: home-ambient-drift-b 22s ease-in-out infinite alternate;
        }

        .home-studios-section,
        .home-tools-section,
        .home-steps-section,
        .home-pricing-section {
          position: relative;
          z-index: 1;
          background: transparent;
        }

        [data-theme="dark"] .home-content-field {
          background:
            radial-gradient(circle at 10% 8%, rgba(139, 92, 246, 0.16), transparent 24%),
            radial-gradient(circle at 90% 31%, rgba(219, 39, 119, 0.09), transparent 22%),
            radial-gradient(circle at 26% 69%, rgba(59, 130, 246, 0.085), transparent 27%),
            linear-gradient(180deg, #191421 0%, #120f18 47%, #18111f 100%);
        }


        .studio-card-shell {
          isolation: isolate;
        }

        .studio-card-media {
          overflow: hidden;
          border-radius: inherit;
          -webkit-mask-image: -webkit-radial-gradient(white, black);
        }

        .studio-card-shell::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 12;
          pointer-events: none;
          border: 1px solid color-mix(in srgb, var(--studio-accent) 55%, transparent);
          border-radius: inherit;
          opacity: 0.34;
          box-shadow: inset 0 0 36px color-mix(in srgb, var(--studio-accent) 10%, transparent);
          transition: opacity 260ms ease, box-shadow 260ms ease;
        }

        .studio-card-vignette {
          z-index: 2;
          background:
            linear-gradient(180deg, rgba(5,4,10,.02) 0%, rgba(5,4,10,.08) 35%, rgba(5,4,10,.72) 72%, rgba(5,4,10,.96) 100%),
            linear-gradient(90deg, rgba(8,6,14,.08), transparent 55%);
        }

        .studio-card-glow {
          z-index: 3;
          background:
            radial-gradient(circle at 20% 100%, color-mix(in srgb, var(--studio-accent) 50%, transparent), transparent 50%),
            linear-gradient(180deg, transparent, color-mix(in srgb, var(--studio-accent) 18%, transparent));
          mix-blend-mode: screen;
          opacity: .74;
        }

        .studio-card-art {
          border-radius: inherit;
          transform: none;
          -webkit-transform: none;
          image-rendering: auto;
        }

        .studio-card-video {
          z-index: 1;
          opacity: 0;
          transform: none;
          -webkit-transform: none;
          border-radius: inherit;
          pointer-events: none;
          transition: opacity 160ms ease, transform 340ms cubic-bezier(.2,.75,.25,1);
          will-change: opacity;
        }

        .studio-card-video.is-playing {
          opacity: 1;
        }

        .studio-card-arrow {
          box-shadow: 0 12px 30px color-mix(in srgb, var(--studio-accent) 28%, transparent), inset 0 1px 0 rgba(255,255,255,.14);
        }

        .studio-card-art {
          transition: transform 340ms cubic-bezier(.2,.75,.25,1);
        }

        @media (hover: hover) {
          .studio-card:hover .studio-card-shell {
            border-color: color-mix(in srgb, var(--studio-accent) 52%, rgba(255,255,255,.12));
            box-shadow: 0 30px 80px color-mix(in srgb, var(--studio-accent) 22%, rgba(18,10,35,.2));
          }

          .studio-card:hover .studio-card-shell::after {
            opacity: .85;
            box-shadow: inset 0 0 48px color-mix(in srgb, var(--studio-accent) 14%, transparent);
          }

          .studio-card:hover .studio-card-art,
          .studio-card:hover .studio-card-video {
            transform: none;
          }

          .studio-card:hover .studio-card-arrow {
            transform: translate3d(3px, 0, 0) rotate(-5deg);
          }

          .quick-tool-card:hover .quick-tool-shell {
            border-color: color-mix(in srgb, var(--tool-accent) 48%, var(--border));
            box-shadow: 0 22px 54px color-mix(in srgb, var(--tool-accent) 18%, transparent);
          }

          .quick-tool-card:hover .quick-tool-art {
            transform: scale(1.04) translate3d(0, -2px, 0);
            will-change: transform;
          }

          .quick-tool-card:hover .quick-tool-arrow {
            transform: translate3d(3px, 0, 0) rotate(-7deg);
          }
        }


        .quick-tool-media {
          isolation: isolate;
        }

        .quick-tool-art {
          transform: none;
          transition: transform 320ms cubic-bezier(.2,.75,.25,1);
          image-rendering: auto;
        }

        .home-featured-tool-sheen {
          background:
            linear-gradient(135deg, rgba(255,255,255,.14), transparent 28%),
            linear-gradient(180deg, transparent 64%, color-mix(in srgb, var(--accent) 9%, transparent));
          pointer-events: none;
        }

        .home-workflow-panel {
          background: var(--surface-strong);
        }

        .home-workflow-intro {
          background:
            radial-gradient(circle at 92% 8%, rgba(255,255,255,.14), transparent 24%),
            radial-gradient(circle at 6% 100%, rgba(235,63,180,.32), transparent 35%),
            linear-gradient(145deg, #2b0b56 0%, #8b5cf6 52%, #8b5cf6 100%);
        }

        .home-workflow-intro::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px);
          background-size: 34px 34px;
          mask-image: linear-gradient(135deg, black, transparent 74%);
        }

        .home-workflow-orbit {
          position: absolute;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 999px;
          pointer-events: none;
        }

        .home-workflow-orbit::after {
          content: "";
          position: absolute;
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: rgba(255,255,255,.88);
          box-shadow: 0 0 22px rgba(255,255,255,.72);
        }

        .home-workflow-orbit-one {
          right: -90px;
          top: 70px;
          width: 250px;
          height: 250px;
          transform: rotate(24deg);
        }

        .home-workflow-orbit-one::after {
          left: 16%;
          top: 5%;
        }

        .home-workflow-orbit-two {
          right: -22px;
          top: 132px;
          width: 150px;
          height: 150px;
          opacity: .7;
          transform: rotate(-18deg);
        }

        .home-workflow-orbit-two::after {
          right: 4%;
          bottom: 22%;
          width: 6px;
          height: 6px;
        }

        .home-workflow-steps {
          background:
            radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent-soft) 70%, transparent), transparent 36%),
            var(--surface-strong);
        }

        .home-step-item {
          transition: border-color 220ms ease, background-color 220ms ease, box-shadow 220ms ease;
        }

        .home-step-icon {
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 8%, transparent);
        }

        @media (hover: hover) and (min-width: 640px) {
          .home-step-item:hover {
            border-color: var(--accent-border);
            background: color-mix(in srgb, var(--surface-strong) 86%, var(--accent-soft));
            box-shadow: 0 18px 42px color-mix(in srgb, var(--accent) 9%, transparent);
          }

        }


        @keyframes home-ambient-drift-a {
          from { transform: translate3d(0, 0, 0) scale(0.96); }
          to { transform: translate3d(-7vw, 6vh, 0) scale(1.08); }
        }

        @keyframes home-ambient-drift-b {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to { transform: translate3d(8vw, -5vh, 0) scale(1.08); }
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
          background: linear-gradient(135deg, rgba(139,92,246,.88), rgba(239,63,180,.68));
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

        .hero-static-block-violet { left: 10%; bottom: 13%; width: 27%; height: 39%; background: #8b5cf6; }
        .hero-static-block-pink { left: 40%; bottom: 13%; width: 18%; height: 27%; background: #eb3eae; }
        .hero-static-block-blue { right: 10%; bottom: 13%; width: 25%; height: 52%; background: #4b8cf5; }
        .hero-static-block-orange { left: 40%; top: 29%; width: 18%; height: 12%; background: #f4a04b; }

        .hero-static-outline {
          position: absolute;
          right: 12%;
          top: 8%;
          width: 29%;
          height: 29%;
          border: 2px solid color-mix(in srgb, #8b5cf6 75%, var(--surface-strong));
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

        .hero-static-bar span:first-child { background: #8b5cf6; }
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
          background: linear-gradient(135deg, #22d3ee, #8b5cf6);
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
            conic-gradient(from 210deg, rgba(139,92,246,.92), rgba(239,63,180,.82), rgba(255,176,74,.76), rgba(34,211,238,.84), rgba(139,92,246,.92));
          color: white;
          box-shadow: inset 0 0 42px rgba(255, 255, 255, 0.25), 0 0 70px rgba(139,92,246,.22);
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
          border: 1px solid rgba(139, 92, 246, 0.3);
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
          background: linear-gradient(180deg, #ef3fb4, #8b5cf6);
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
          background: linear-gradient(90deg, rgba(139, 92, 246, 0.5), transparent);
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
          50% { opacity: 0.85; filter: drop-shadow(0 0 5px rgba(139, 92, 246, 0.45)); }
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
          .home-content-field::before,
          .home-content-field::after {
            animation: none !important;
          }

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
          .studio-building,
          .studio-card-art,
          .studio-card-video,
          .quick-tool-art {
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
  nowrapDesktop = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  size?: "default" | "compact";
  nowrapDesktop?: boolean;
}) {
  const titleClass =
    size === "compact"
      ? "mt-4 text-[1.9rem] font-black leading-[1] tracking-[-0.045em] sm:mt-5 sm:text-[2.8rem] sm:leading-[0.98] lg:text-[3.2rem]"
      : "mt-4 text-[1.95rem] font-black leading-[0.98] tracking-[-0.05em] sm:mt-5 sm:text-6xl sm:leading-[0.95] sm:tracking-[-0.06em] lg:text-[4.15rem]";

  const wrapperClass = align === "center"
    ? "mx-auto w-full max-w-5xl text-center"
    : nowrapDesktop
      ? "w-full max-w-none"
      : "w-full max-w-3xl";

  return (
    <div className={wrapperClass}>
      <Eyebrow className={align === "left" ? "ml-[2px] sm:ml-0" : ""}>{eyebrow}</Eyebrow>
      <h2 className={`${titleClass} ${nowrapDesktop ? "lg:whitespace-nowrap" : ""}`}>{title}</h2>
      {description && (
        <p className={`mt-3.5 text-sm font-semibold leading-6 text-[var(--text-secondary)] sm:mt-4 sm:text-base sm:leading-7 ${align === "center" ? "mx-auto max-w-3xl" : ""}`}>
          {description}
        </p>
      )}
    </div>
  );
}

