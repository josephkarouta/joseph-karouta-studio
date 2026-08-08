import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { PublicSection } from "@/components/public/PublicPage";

export type PublishedPublicPage = {
  slug: string;
  title?: string | null;
  eyebrow?: string | null;
  summary?: string | null;
  updated_at?: string | null;
  sections?: PublicSection[];
};

export async function getPublishedPublicPage(slug: string): Promise<PublishedPublicPage | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client
      .from("public_pages")
      .select("slug,title,eyebrow,summary,content,updated_at")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error || !data) return null;

    const content = data.content && typeof data.content === "object" && !Array.isArray(data.content)
      ? data.content as Record<string, unknown>
      : {};
    const rawSections = Array.isArray(content.sections) ? content.sections : [];
    const sections = rawSections
      .filter((section): section is Record<string, unknown> => Boolean(section) && typeof section === "object" && !Array.isArray(section))
      .map((section) => ({
        title: String(section.title || "Section"),
        paragraphs: Array.isArray(section.paragraphs) ? section.paragraphs.map(String) : undefined,
        bullets: Array.isArray(section.bullets) ? section.bullets.map(String) : undefined,
      }));

    return {
      slug: data.slug,
      title: data.title,
      eyebrow: data.eyebrow,
      summary: data.summary,
      updated_at: data.updated_at,
      sections: sections.length ? sections : undefined,
    };
  } catch {
    return null;
  }
}
