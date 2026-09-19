import ExpertNetworkPage from "@/components/public/ExpertNetworkPage";

function publicMode() {
  return String(process.env.HEYY_PUBLIC_MODE || "beta")
    .trim()
    .toLowerCase();
}

export const metadata = {
  title: "Expert Network Opportunity | Heyy Studio",
  description: "Apply to join the Heyy Studio Expert Network for selected freelance, project-based creative work.",
};

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ source?: string; utm_source?: string }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  return (
    <ExpertNetworkPage
      initialRoleSlug={slug}
      initialSource={query.source || query.utm_source || "direct"}
      prelaunch={publicMode() === "prelaunch"}
    />
  );
}
