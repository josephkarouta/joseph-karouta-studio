"use client";

import type { CSSProperties, ReactNode } from "react";
import { ArrowRightLeft, FileText, ImageIcon, Images, PanelsTopLeft, Presentation, Video } from "lucide-react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import StudioAccessGate from "@/components/studio-access-gate";
import { Eyebrow, PageContainer } from "@/components/ui/heyy";

export default function ToolFrame({
  path,
  title,
  eyebrow,
  description,
  iconName,
  accent,
  soft,
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
  const icons = { image: ImageIcon, video: Video, images: Images, presentation: Presentation, adaptation: PanelsTopLeft, pdf: FileText, convert: ArrowRightLeft };
  const Icon = icons[iconName];

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
                className="relative isolate min-h-[235px] overflow-hidden rounded-[1.65rem] border border-black/5 bg-white shadow-[0_24px_64px_rgba(42,36,62,.14)] sm:min-h-[330px] sm:rounded-[2rem] lg:min-h-[330px]"
                style={heroVars}
              >
                <div
                  className="pointer-events-none absolute inset-0 bg-cover bg-no-repeat"
                  style={{ backgroundImage: `url(${imageSrc})`, backgroundPosition: imagePosition }}
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute inset-0 sm:hidden"
                  style={{
                    background: "linear-gradient(180deg,rgba(7,4,20,.05) 0%,rgba(7,4,20,.16) 34%,rgba(7,4,20,.62) 66%,rgba(7,4,20,.94) 100%)",
                  }}
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute inset-0 hidden sm:block"
                  style={{
                    background:
                      "linear-gradient(90deg,rgba(255,255,255,.99) 0%,rgba(255,255,255,.97) 28%,rgba(255,255,255,.84) 42%,rgba(255,255,255,.30) 61%,rgba(255,255,255,.04) 78%),linear-gradient(180deg,rgba(255,255,255,.05) 0%,rgba(255,255,255,.08) 58%,rgba(255,255,255,.30) 100%)",
                  }}
                  aria-hidden="true"
                />

                <div className="relative z-10 flex min-h-[235px] flex-col justify-end gap-3 p-5 pb-6 sm:min-h-[330px] sm:justify-center sm:gap-5 sm:p-8 lg:min-h-[330px] lg:flex-row lg:items-center lg:justify-start lg:gap-10 lg:p-10 xl:p-12">
                  <div className="min-w-0 max-w-[650px] lg:max-w-[47%]">
                    <p className="text-[.56rem] font-black uppercase tracking-[.22em] text-white/75 sm:text-[.62rem] sm:tracking-[.24em] sm:text-[var(--accent-strong)]">
                      {eyebrow}
                    </p>
                    <h1 className="mt-2 text-[1.95rem] font-black leading-[.96] tracking-[-.055em] text-white sm:mt-4 sm:text-6xl sm:text-[#17131f] lg:text-[4rem]">
                      {title}
                    </h1>
                    <p className="mt-2 line-clamp-2 max-w-[90%] text-[.75rem] font-semibold leading-[1.15rem] text-white/80 sm:mt-4 sm:max-w-xl sm:text-base sm:leading-7 sm:text-[#5f5968]">
                      {description}
                    </p>
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
