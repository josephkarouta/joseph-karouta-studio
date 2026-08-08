import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdminApiAccess } from "@/lib/server/admin-api";
const map = {
  careers: { table: "career_positions", key: "id" },
  pages: { table: "public_pages", key: "slug" },
  help: { table: "help_articles", key: "id" },
  contact: { table: "contact_submissions", key: "id" },
  applications: { table: "career_applications", key: "id" },
  generations: { table: "generation_jobs", key: "id" },
} as const;
type Resource = keyof typeof map | "users";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin is not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function slugify(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function paragraphs(value: unknown) {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function contentPayload(body: Record<string, unknown>) {
  const copy = { ...body };
  const text = copy.body;
  delete copy.body;
  if (String(text || "").trim()) {
    copy.content = { sections: [{ title: "Overview", paragraphs: paragraphs(text) }] };
  }
  return copy;
}

function careerPayload(body: Record<string, unknown>) {
  const copy = { ...body };
  const text = copy.body;
  delete copy.body;
  if (String(text || "").trim()) copy.description = { paragraphs: paragraphs(text) };
  return copy;
}

function sanitize(resource: string, body: Record<string, unknown>) {
  if (resource === "pages") {
    const payload = contentPayload(body);
    if (payload.slug) payload.slug = slugify(payload.slug);
    return pick(payload, ["slug", "title", "eyebrow", "summary", "content", "seo_title", "seo_description", "status"]);
  }
  if (resource === "help") {
    const payload = contentPayload(body);
    if (payload.slug) payload.slug = slugify(payload.slug);
    return pick(payload, ["slug", "title", "category", "summary", "content", "sort_order", "status"]);
  }
  if (resource === "careers") {
    return pick(careerPayload(body), ["title", "department", "location", "employment_type", "summary", "description", "closes_at", "status"]);
  }
  return pick(body, ["status"]);
}

function pick(source: Record<string, unknown>, keys: string[]) {
  const output: Record<string, unknown> = {};
  keys.forEach((key) => {
    if (source[key] !== undefined) output[key] = source[key];
  });
  return output;
}

function bodyText(resource: string, row: Record<string, unknown>) {
  const content = resource === "careers" ? row.description : row.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) return "";
  const sections = Array.isArray((content as Record<string, unknown>).sections)
    ? (content as Record<string, unknown>).sections as Array<Record<string, unknown>>
    : [];
  if (sections.length) {
    return sections.flatMap((section) => Array.isArray(section.paragraphs) ? section.paragraphs.map(String) : []).join("\n\n");
  }
  const items = Array.isArray((content as Record<string, unknown>).paragraphs)
    ? (content as Record<string, unknown>).paragraphs as unknown[]
    : [];
  return items.map(String).join("\n\n");
}

export async function GET(_request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  try {
    const { resource } = await params;
    const client = admin();
    if (resource === "users") {
      const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const ids = data.users.map((user) => user.id);
      const emptyId = "00000000-0000-0000-0000-000000000000";
      const [{ data: wallets }, { data: subscriptions }] = await Promise.all([
        client.from("credit_wallets").select("*").in("user_id", ids.length ? ids : [emptyId]),
        client.from("user_subscriptions").select("*").in("user_id", ids.length ? ids : [emptyId]),
      ]);
      const walletMap = new Map((wallets || []).map((item) => [item.user_id, item]));
      const subscriptionMap = new Map((subscriptions || []).map((item) => [item.user_id, item]));
      return NextResponse.json({
        items: data.users.map((user) => {
          const wallet = walletMap.get(user.id) as Record<string, number> | undefined;
          const subscription = subscriptionMap.get(user.id) as Record<string, unknown> | undefined;
          return {
            id: user.id,
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
            email: user.email,
            status: String(subscription?.status || "active"),
            summary: `${String(subscription?.plan || "free").toUpperCase()} · ${(wallet?.monthly_balance || 0) + (wallet?.purchased_balance || 0) - (wallet?.reserved_balance || 0)} credits`,
            created_at: user.created_at,
          };
        }),
      });
    }
    if (!(resource in map)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    const config = map[resource as keyof typeof map];
    const { data, error } = await client.from(config.table).select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    const items = (data || []).map((row) => resource === "pages" || resource === "help" || resource === "careers" ? { ...row, body: bodyText(resource, row) } : row);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load resource." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  try {
    const { resource } = await params;
    if (!(resource in map) || ["contact", "applications", "generations"].includes(resource)) {
      return NextResponse.json({ error: "Creation is not supported for this resource." }, { status: 400 });
    }
    const config = map[resource as keyof typeof map];
    const body = await request.json() as Record<string, unknown>;
    const payload = { ...sanitize(resource, body), status: "draft" };
    const { data, error } = await admin().from(config.table).insert(payload).select("*").single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create resource." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  try {
    const { resource } = await params;
    if (!(resource in map)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    const config = map[resource as keyof typeof map];
    const body = await request.json() as Record<string, unknown>;
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Missing record ID." }, { status: 400 });
    delete body.id;
    const update = sanitize(resource, body);
    if (update.status === "published") update.published_at = new Date().toISOString();
    if (update.status && update.status !== "published") update.published_at = null;
    const { data, error } = await admin().from(config.table).update(update).eq(config.key, id).select("*").single();
    if (error) throw error;
    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update resource." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  try {
    const { resource } = await params;
    if (!(resource in map)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    const config = map[resource as keyof typeof map];
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing record ID." }, { status: 400 });
    const { error } = await admin().from(config.table).delete().eq(config.key, id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete resource." }, { status: 500 });
  }
}
