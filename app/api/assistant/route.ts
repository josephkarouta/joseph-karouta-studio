import "server-only";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type HistoryMessage = { role: "assistant" | "user"; content: string };

const platformRoutes = [
  ["Brand Studio", "/brand-studio"],
  ["Marketing Studio", "/marketing-studio"],
  ["Architecture Studio", "/architecture-studio"],
  ["Interior Design Studio", "/interior-studio"],
  ["Digital Adaptations", "/tools/digital-adaptations"],
  ["Text to Image", "/tools/text-to-image"],
  ["Image to Video", "/tools/image-to-video"],
  ["AI Upscaler", "/tools/ai-upscaler"],
  ["PowerPoint Generator", "/tools/powerpoint-generator"],
  ["Heyy Studio Experts", "/contact?topic=expert-production"],
  ["Help Center", "/help"],
  ["Plans & Credits", "/pricing"],
] as const;

function extractOutputText(data: any): string | null {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  for (const output of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(output?.content) ? output.content : []) {
      if (typeof content?.text === "string" && content.text.trim()) return content.text.trim();
    }
  }
  return null;
}

function safeJson(text: string | null) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body?.message || "").trim();
    const signedIn = Boolean(body?.signedIn);
    const history = (Array.isArray(body?.history) ? body.history : [])
      .slice(-8)
      .filter((item: HistoryMessage) => item?.role && item?.content)
      .map((item: HistoryMessage) => ({ role: item.role, content: String(item.content).slice(0, 1800) }));

    if (!message) {
      return NextResponse.json({ error: "Tell Heyy AI what you would like to create." }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Heyy AI is not configured yet." }, { status: 503 });
    }

    const prompt = `
You are Heyy AI, the concise platform guide for Heyy Studio.
Heyy Studio is a connected creative operating system: Create with AI. Build with Experts.

Your job:
1. Understand what the user wants to achieve.
2. Ask at most one necessary clarifying question when intent is genuinely unclear.
3. Recommend the single best Studio, AI tool, expert-production path, Help Center or pricing page.
4. Explain why in plain US English, in no more than 55 words.
5. Never pretend concept output is final engineering, permit, safety, legal, trademark or production documentation.
6. Do not invent unavailable products. Website Studio, Event Studio, Video Studio, AI Workspace and File Analyzer are hidden.
7. The user is ${signedIn ? "signed in" : "not signed in; remind them that signing in is required to save Studio work"}.
8. Credits apply to paid AI generation. Expert production is separately quoted.

Allowed routes:
${platformRoutes.map(([label, href]) => `- ${label}: ${href}`).join("\n")}

Return ONLY valid JSON:
{
  "answer": "concise helpful answer",
  "routeLabel": "one allowed route label or empty",
  "route": "exact allowed href or empty",
  "secondaryAction": { "label": "optional", "href": "exact allowed href or /#studios" },
  "suggestions": ["2 to 4 useful next user messages"]
}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.HEYY_ASSISTANT_MODEL || process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
        instructions: prompt,
        input: history,
        max_output_tokens: 450,
        text: { format: { type: "json_object" } },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Heyy assistant provider error:", data);
      return NextResponse.json({ error: "Heyy AI is temporarily unavailable." }, { status: 502 });
    }

    const parsed = safeJson(extractOutputText(data));
    const allowedRoutes = new Map<string, string>(platformRoutes.map(([label, href]) => [href, label]));
    const requestedRoute = String(parsed?.route || "");
    const route = allowedRoutes.has(requestedRoute) ? requestedRoute : "";
    const routeLabel = route ? allowedRoutes.get(route) || String(parsed?.routeLabel || "Continue") : "";
    const effectiveRoute = route && !signedIn && route.startsWith("/") && !["/pricing", "/help", "/contact"].some((publicPath) => route.startsWith(publicPath))
      ? `/login?next=${encodeURIComponent(route)}`
      : route;

    const secondaryHref = String(parsed?.secondaryAction?.href || "");
    const secondaryAllowed = secondaryHref === "/#studios" || allowedRoutes.has(secondaryHref);
    const actions = [];
    if (effectiveRoute) {
      actions.push({
        label: !signedIn && effectiveRoute.startsWith("/login") ? "Sign in to continue" : `Open ${routeLabel}`,
        href: effectiveRoute,
        kind: "primary",
      });
    }
    if (secondaryAllowed && secondaryHref !== route) {
      actions.push({
        label: String(parsed?.secondaryAction?.label || "Explore all Studios"),
        href: secondaryHref,
        kind: "secondary",
      });
    }

    return NextResponse.json({
      answer: String(parsed?.answer || "Tell me a little more about the outcome you need.").slice(0, 650),
      route,
      routeLabel,
      actions,
      suggestions: Array.isArray(parsed?.suggestions)
        ? parsed.suggestions.filter((item: unknown) => typeof item === "string").slice(0, 4)
        : [],
    });
  } catch (error) {
    console.error("Heyy assistant error:", error);
    return NextResponse.json({ error: "Unable to process that request." }, { status: 500 });
  }
}
