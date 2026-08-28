"use client";

import type { ReactNode } from "react";
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
  children: ReactNode;
}) {
  const { plan } = useAuth();
  const icons = { image: ImageIcon, video: Video, images: Images, presentation: Presentation, adaptation: PanelsTopLeft, pdf: FileText, convert: ArrowRightLeft };
  const Icon = icons[iconName];
  const utilityTool = iconName === "pdf" || iconName === "convert";
  const subscribed = String(plan || "free").toLowerCase() !== "free";
  const displayCreditLabel = utilityTool && subscribed ? "Unlimited" : creditLabel;

  return (
    <StudioAccessGate path={path}>
      <SiteHeader />
      <WorkspaceShell>
        <main className="heyy-page min-h-screen py-8 sm:py-10">
          <PageContainer>
            <section className="relative overflow-hidden rounded-[2rem] border p-6 shadow-[var(--shadow-card)] sm:p-9" style={{ borderColor: `${accent}45`, background: `linear-gradient(118deg,${soft},var(--surface-strong),rgba(111,45,255,.08))` }}>
              <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full border-[34px] border-white/20" />
              <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex max-w-4xl items-start gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border shadow-sm" style={{ background: soft, borderColor: `${accent}40`, color: accent }}><Icon size={23}/></span>
                  <div><Eyebrow>{eyebrow}</Eyebrow><h1 className="mt-3 text-4xl font-black leading-[.94] tracking-[-.06em] sm:text-6xl">{title}</h1><p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)] sm:text-base">{description}</p></div>
                </div>
                <CreditPill credits={displayCreditLabel} label="" className="w-fit" />
              </div>
            </section>
            <div className="mt-5">{children}</div>
          </PageContainer>
        </main>
        <SiteFooter />
      </WorkspaceShell>
    </StudioAccessGate>
  );
}
