import ExpertNetworkPage from "@/components/public/ExpertNetworkPage";

export const metadata = {
  title: "Heyy Studio Expert Network",
  description: "Join Heyy Studio's global project-based network of freelance brand, marketing, architecture and interior design experts.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ source?: string; utm_source?: string }> }) {
  const query = await searchParams;
  return <ExpertNetworkPage initialSource={query.source || query.utm_source || "direct"} />;
}
