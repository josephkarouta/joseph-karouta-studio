import type { ReactNode } from "react";
import StudioAccessGate from "@/components/studio-access-gate";

export default function BrandStudioLayout({ children }: { children: ReactNode }) {
  return <StudioAccessGate path="/brand-studio">{children}</StudioAccessGate>;
}
