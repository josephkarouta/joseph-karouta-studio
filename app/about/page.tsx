import { ArrowRight, BriefcaseBusiness, Layers3, Sparkles, Users } from "lucide-react";
import PublicPage from "@/components/public/PublicPage";
import { ButtonLink, GlassCard } from "@/components/ui/heyy";

export const metadata = { title: "About Heyy Studio" };

const ideas = [
  [Sparkles, "Start with the idea", "You do not need a perfect brief. Start with what you know and shape it as you go."],
  [Layers3, "Choose the right workspace", "Use a specialist Studio for a full project or a focused Tool when you only need one task done."],
  [BriefcaseBusiness, "Keep the work connected", "Projects, useful outputs, credits and production activity stay organized around the work instead of scattered across separate apps."],
  [Users, "Bring in an expert when it matters", "When a concept is ready to become real, request professional production without rebuilding the brief from scratch."],
] as const;

export default function AboutPage() {
  return (
    <PublicPage
      slug="about"
      eyebrow="About Heyy Studio"
      title="Create ideas. Shape them. Make them real."
      summary="Heyy Studio brings specialist creative Studios, focused tools and expert production into one connected place."
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-4 md:grid-cols-2">
          {ideas.map(([Icon, title, text]) => (
            <GlassCard key={title} className="p-7">
              <Icon className="text-[var(--accent-strong)]" size={23} />
              <h2 className="mt-6 text-2xl font-black tracking-[-.045em]">{title}</h2>
              <p className="mt-3 text-sm font-semibold leading-7 text-[var(--text-secondary)]">{text}</p>
            </GlassCard>
          ))}
        </div>
        <GlassCard className="mt-4 overflow-hidden bg-[linear-gradient(120deg,rgba(111,45,255,.12),rgba(239,63,180,.09),rgba(46,124,246,.1))] p-8 sm:p-10">
          <h2 className="max-w-4xl text-4xl font-black tracking-[-.06em] sm:text-5xl">One place for brands, spaces, campaigns, visuals, files and presentations.</h2>
          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)]">Built for founders, creators and teams who want to move from an idea to useful work without juggling a different platform for every step.</p>
          <ButtonLink href="/signup" className="mt-7">Start creating <ArrowRight size={15}/></ButtonLink>
        </GlassCard>
      </div>
    </PublicPage>
  );
}
