import PublicPage from "@/components/public/PublicPage";
import HelpCenter from "@/components/public/HelpCenter";

export const metadata = { title: "Help Center | Heyy Studio" };

export default function HelpPage() {
  return (
    <PublicPage
      eyebrow="Help center"
      title="Find the answer and keep moving."
      summary="Learn how Studios, Tools, credits, subscriptions, utility allowances, saved work and expert production fit together."
    >
      <HelpCenter />
    </PublicPage>
  );
}
