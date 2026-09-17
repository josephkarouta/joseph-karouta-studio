import type { Metadata } from "next";
import HomePageClient from "@/components/home/HomePageClient";
import PrelaunchHome from "@/components/public/PrelaunchHome";

function publicMode() {
  return String(process.env.HEYY_PUBLIC_MODE || "beta")
    .trim()
    .toLowerCase();
}

export async function generateMetadata(): Promise<Metadata> {
  if (publicMode() === "prelaunch") {
    return {
      title: "Heyy Studio — Coming Soon",
      description:
        "Heyy Studio is building an AI-powered creative operating system. Create with AI. Build with Experts.",
      alternates: { canonical: "/" },
      openGraph: {
        title: "Heyy Studio — Coming Soon",
        description:
          "Creativity is about to feel different. Create with AI. Build with Experts.",
        url: "/",
        type: "website",
        siteName: "Heyy Studio",
      },
      twitter: {
        card: "summary_large_image",
        title: "Heyy Studio — Coming Soon",
        description:
          "Creativity is about to feel different. Create with AI. Build with Experts.",
      },
    };
  }

  return {
    title: "Heyy Studio — Create with AI. Build with Experts.",
    description:
      "A connected creative operating system for brand, architecture, interior design, marketing, AI tools and expert production.",
    alternates: { canonical: "/" },
  };
}

export default function HomePage() {
  if (publicMode() === "prelaunch") {
    return <PrelaunchHome />;
  }

  return <HomePageClient />;
}
