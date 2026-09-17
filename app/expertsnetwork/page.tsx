import type { Metadata } from "next";
import ExpertNetworkPage from "@/components/public/ExpertNetworkPage";

function publicMode() {
  return String(process.env.HEYY_PUBLIC_MODE || "beta")
    .trim()
    .toLowerCase();
}

export const metadata: Metadata = {
  title: "Heyy Studio Experts Network",
  description:
    "Join Heyy Studio's global project-based network of freelance brand, marketing, architecture and interior design experts.",
  alternates: { canonical: "/expertsnetwork" },
  openGraph: {
    title: "Join the Heyy Studio Experts Network",
    description:
      "Apply to Heyy Studio's global network for project-based brand, marketing, architecture and interior design opportunities.",
    url: "/expertsnetwork",
    type: "website",
    siteName: "Heyy Studio",
  },
  twitter: {
    card: "summary_large_image",
    title: "Join the Heyy Studio Experts Network",
    description:
      "Project-based opportunities for brand, marketing, architecture and interior design experts.",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; utm_source?: string }>;
}) {
  const query = await searchParams;
  return (
    <ExpertNetworkPage
      initialSource={query.source || query.utm_source || "direct"}
      prelaunch={publicMode() === "prelaunch"}
    />
  );
}
