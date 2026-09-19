"use client";

import type { CSSProperties, ReactNode } from "react";
import { ArrowRightLeft, FileText, ImageIcon, Images, PanelsTopLeft, Presentation, Video } from "lucide-react";
import SiteHeader from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import SiteFooter from "@/components/site-footer";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import StudioAccessGate from "@/components/studio-access-gate";
import { CreditPill, Eyebrow, PageContainer } from "@/components/ui/heyy";

export default function ToolFrame({
  path,
  title,
  eyebrow,
  description,
  iconName,
  accent,
  soft,
  creditLabel,
  imageSrc,
  imagePosition = "center 54%",
  children,
}: {
  path: string;
  title: string;
  eyebrow: string;
  description: string;
  iconName: "image" | "video" | "images" | "presentation" | "adaptation" | "pdf" | "convert";
  accent: string;
  soft: string;
  creditLabel: string;
  imageSrc?: string;
  imagePosition?: string;
  children: ReactNode;
}) {
  const { plan } = useAuth();
  const icons = { image: ImageIcon, video: Video, images: Images, presentation: Presentation, adaptation: PanelsTopLeft, pdf: FileText, convert: ArrowRightLeft };
  const Icon = icons[iconName];
  const utilityTool = iconName === "pdf" || iconName === "convert";
  const subscribed = String(plan || "free").toLowerCase() !== "free";
  const displayCreditLabel = utilityTool && subscribed ? "Unlimited" : creditLabel;

  const heroVars = imageSrc
    ? ({
        "--accent-strong": accent,
        "--accent-soft": soft,
        "--accent-border": `${accent}45`,
      } as CSSProperties)
    : undefined;

  return (
    <StudioAccessGate path={path}>
      <SiteHeader />
      <WorkspaceShell>
        <main className="heyy-page min-h-screen py-8 sm:py-10">
          <PageContainer>
            {imageSrc ? (
              <section
                className="relative isolate min-h-[390px] overflow-hidden rounded-[2rem] border border-black/5 bg-white shadow-[0_28px_80px_rgba(42,36,62,.16)] sm:min-h-[410px] lg:min-h-[330px]"
                style={heroVars}
              >
                <div
                  className="pointer-events-none absolute inset-0 bg-cover bg-no-repeat"
                  style={{ backgroundImage: `url(${imageSrc})`, backgroundPosition: imagePosition }}
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(90deg,rgba(255,255,255,.99) 0%,rgba(255,255,255,.97) 28%,rgba(255,255,255,.84) 42%,rgba(255,255,255,.30) 61%,rgba(255,255,255,.04) 78%),linear-gradient(180deg,rgba(255,255,255,.05) 0%,rgba(255,255,255,.08) 58%,rgba(255,255,255,.30) 100%)",
                  }}
                  aria-hidden="true"
                />

                <div className="relative z-10 flex min-h-[390px] flex-col justify-between gap-8 p-6 sm:min-h-[410px] sm:p-8 lg:min-h-[330px] lg:flex-row lg:items-center lg:gap-10 lg:p-10 xl:p-12">
                  <div className="min-w-0 max-w-[650px] lg:max-w-[47%]">
                    <p className="text-[.62rem] font-black uppercase tracking-[.24em]" style={{ color: accent }}>
                      {eyebrow}
                    </p>
                    <h1 className="mt-4 text-4xl font-black leading-[.92] tracking-[-.06em] text-[#17131f] sm:text-6xl lg:text-[4rem]">
                      {title}
                    </h1>
                    <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-[#5f5968] sm:text-base">
                      {description}
                    </p>
                    <div className="mt-5">
                      <CreditPill credits={displayCreditLabel} label="" className="w-fit bg-white/80 shadow-sm backdrop-blur-xl" />
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="relative overflow-hidden rounded-[2rem] border p-6 shadow-[var(--shadow-card)] sm:p-9" style={{ borderColor: `${accent}45`, background: `linear-gradient(118deg,${soft},var(--surface-strong),rgba(139,92,246,.08))` }}>
                <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full border-[34px] border-white/20" />
                <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex max-w-4xl items-start gap-4">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border shadow-sm" style={{ background: soft, borderColor: `${accent}40`, color: accent }}><Icon size={23}/></span>
                    <div><Eyebrow>{eyebrow}</Eyebrow><h1 className="mt-3 text-4xl font-black leading-[.94] tracking-[-.06em] sm:text-6xl">{title}</h1><p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)] sm:text-base">{description}</p></div>
                  </div>
                  <CreditPill credits={displayCreditLabel} label="" className="w-fit" />
                </div>
              </section>
            )}
            <div className="mt-5">{children}</div>
          </PageContainer>
        </main>
        <SiteFooter />
      </WorkspaceShell>
    </StudioAccessGate>
  );
}
