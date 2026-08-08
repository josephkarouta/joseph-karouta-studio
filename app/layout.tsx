import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import Providers from "@/components/providers";
import HeyyAssistant from "@/components/assistant/HeyyAssistant";
import RouteStateRestorer from "@/components/navigation/RouteStateRestorer";

export const metadata: Metadata = {
  metadataBase: new URL("https://heyystudio.com"),
  title: {
    default: "Heyy Studio — Create with AI. Build with Experts.",
    template: "%s | Heyy Studio",
  },
  description:
    "A connected creative operating system for brand, architecture, interior design, marketing, AI tools and expert production.",
  openGraph: {
    title: "Heyy Studio",
    description: "Create with AI. Build with Experts.",
    type: "website",
    url: "https://heyystudio.com",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0b10" },
  ],
};

const themeScript = `
  try {
    const saved = localStorage.getItem('heyy-theme') || 'system';
    const resolved = saved === 'system'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : saved;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  } catch (_) {}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US" suppressHydrationWarning>
      <head>
        <Script id="heyy-theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body>
        <Providers>
          <RouteStateRestorer />
          {children}
          <HeyyAssistant />
        </Providers>
      </body>
    </html>
  );
}
