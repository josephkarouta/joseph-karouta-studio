import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdminApiUser, requireAdminApiCapability } from "@/lib/server/admin-api";
import { recordAdminAudit } from "@/lib/admin/audit";
import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { sitePath } from "@/lib/site-url";

const map = {
  careers: { table: "career_positions", key: "id" },
  pages: { table: "public_pages", key: "slug" },
  help: { table: "help_articles", key: "id" },
  contact: { table: "contact_submissions", key: "id" },
  applications: { table: "career_applications", key: "id" },
  generations: { table: "generation_jobs", key: "id" },
} as const;
type Resource = keyof typeof map | "users";
type AdminClient = ReturnType<typeof admin>;
type UnknownRow = Record<string, unknown>;

const CONTACT_ATTACHMENTS_BUCKET = "contact-attachments";

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

function asRecord(value: unknown): UnknownRow {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRow : {};
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function findText(value: unknown, keys: string[], depth = 0): string {
  if (depth > 2 || !value) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findText(item, keys, depth + 1);
      if (match) return match;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  const row = value as UnknownRow;
  for (const key of keys) {
    const candidate = firstText(row[key]);
    if (candidate) return candidate;
  }
  for (const nested of Object.values(row)) {
    const match = findText(nested, keys, depth + 1);
    if (match) return match;
  }
  return "";
}

function findNumber(value: unknown, keys: string[], depth = 0): number | null {
  if (depth > 2 || !value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findNumber(item, keys, depth + 1);
      if (match !== null) return match;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const row = value as UnknownRow;
  for (const key of keys) {
    const candidate = firstNumber(row[key]);
    if (candidate !== null) return candidate;
  }
  for (const nested of Object.values(row)) {
    const match = findNumber(nested, keys, depth + 1);
    if (match !== null) return match;
  }
  return null;
}

function studioFromTool(tool: unknown) {
  const value = String(tool || "").toLowerCase();
  if (value.startsWith("brand_")) return "Brand Studio";
  if (value.startsWith("marketing_")) return "Marketing Studio";
  if (value.startsWith("architecture_")) return "Architecture Studio";
  if (value.startsWith("interior_")) return "Interior Design Studio";
  return "";
}

function generationModel(row: UnknownRow) {
  const keys = ["model", "model_name", "modelName", "image_model", "video_model", "text_model"];
  return findText(row.input, keys) || findText(row.output, keys);
}

function generationCreditsReserved(row: UnknownRow) {
  return findNumber(row.input, [
    "credits_reserved",
    "reserved_credits",
    "credit_cost",
    "creditCost",
    "credits",
    "cost_credits",
    "costCredits",
  ]);
}

function generationCreditsUsed(row: UnknownRow) {
  return findNumber(row.output, [
    "credits_used",
    "credits_charged",
    "charged_credits",
    "credit_cost",
    "creditCost",
    "credits",
  ]);
}

function generationAssetUrl(row: UnknownRow) {
  return findText(row.output, [
    "asset_url",
    "assetUrl",
    "download_url",
    "downloadUrl",
    "image_url",
    "imageUrl",
    "video_url",
    "videoUrl",
    "url",
  ]);
}

function generationAssetId(row: UnknownRow) {
  return findText(row.output, ["asset_id", "assetId", "generated_asset_id", "generatedAssetId"]);
}

function generationDurationMs(row: UnknownRow) {
  const start = Date.parse(String(row.created_at || ""));
  const endValue = row.completed_at || (["succeeded", "failed", "cancelled"].includes(String(row.status || "").toLowerCase()) ? row.updated_at : null);
  const end = Date.parse(String(endValue || ""));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return end - start;
}

function generationFacets(rows: UnknownRow[]) {
  const unique = (key: "tool" | "provider" | "status") => Array.from(new Set(rows.map((row) => firstText(row[key])).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return {
    tools: unique("tool"),
    providers: unique("provider"),
    statuses: unique("status"),
  };
}

async function listAuthUsers(client: AdminClient) {
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    console.error("Generation monitoring could not load Auth users:", error.message);
    return [];
  }
  return data.users;
}

async function loadProjectRows(client: AdminClient, ids?: string[]) {
  let query = client.from("studio_projects").select("*");
  if (ids?.length) query = query.in("id", ids);
  else query = query.limit(2000);
  const { data, error } = await query;
  if (error) {
    console.error("Generation monitoring could not load studio projects:", error.message);
    return [] as UnknownRow[];
  }
  return (data || []) as UnknownRow[];
}


function contactAttachmentRecords(row: UnknownRow) {
  const metadata = asRecord(row.metadata);
  const stored = Array.isArray(metadata.attachments)
    ? metadata.attachments.map(asRecord)
    : [];
  if (stored.length) return stored;

  const names = Array.isArray(metadata.attachment_names) ? metadata.attachment_names : [];
  const sizes = Array.isArray(metadata.attachment_sizes) ? metadata.attachment_sizes : [];
  return names.map((name, index) => ({
    name: String(name || "Attachment"),
    size: firstNumber(sizes[index]) || 0,
    storage_path: "",
    content_type: "",
  }));
}

async function hydrateContactRows(client: AdminClient, rows: UnknownRow[]) {
  return Promise.all(rows.map(async (row) => {
    const metadata = asRecord(row.metadata);
    const attachments = await Promise.all(contactAttachmentRecords(row).map(async (attachment) => {
      const storagePath = firstText(attachment.storage_path);
      let url = "";
      if (storagePath) {
        const { data, error } = await client.storage
          .from(CONTACT_ATTACHMENTS_BUCKET)
          .createSignedUrl(storagePath, 60 * 60);
        if (!error) url = data?.signedUrl || "";
      }
      return {
        name: firstText(attachment.name) || "Attachment",
        size: firstNumber(attachment.size) || 0,
        content_type: firstText(attachment.content_type),
        storage_path: storagePath,
        url,
      };
    }));

    const replies = Array.isArray(metadata.admin_replies)
      ? metadata.admin_replies.map(asRecord).map((reply) => ({
          message: firstText(reply.message),
          sent_at: firstText(reply.sent_at),
          actor_user_id: firstText(reply.actor_user_id),
        })).filter((reply) => reply.message)
      : [];

    return {
      ...row,
      contact_subject: firstText(metadata.subject),
      contact_company: firstText(metadata.company),
      contact_topic_key: firstText(metadata.topic_key),
      contact_attachments: attachments,
      contact_admin_replies: replies,
    };
  }));
}

async function sendContactAdminReply(row: UnknownRow, message: string) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) throw new Error("Email delivery is not configured.");

  const email = firstText(row.email);
  if (!email) throw new Error("This contact submission has no reply email address.");

  const metadata = asRecord(row.metadata);
  const subject = firstText(metadata.subject, row.topic, "Heyy Studio request");
  const name = firstText(row.name, "there");
  const firstName = name.split(/\s+/)[0] || "there";
  const adminEmail = String(process.env.ADMIN_EMAIL || "hello@heyystudio.com").trim();
  const configuredFrom = String(process.env.RESEND_FROM_EMAIL || "hello@heyystudio.com").trim();
  const from = configuredFrom.includes("<") ? configuredFrom : `Heyy Studio <${configuredFrom}>`;

  const template = {
    eyebrow: "Heyy Studio reply",
    title: "A reply from the Heyy Studio team",
    intro: `Hi ${firstName}, here is our reply to your request.`,
    preheader: `Re: ${subject}`,
    status: "Reply",
    details: [
      { label: "Reply", value: message },
      { label: "Original subject", value: subject },
      { label: "Reference", value: firstText(row.id).slice(0, 8).toUpperCase() },
      { label: "Continue the conversation", value: "Reply directly to this email" },
    ],
    detailsTitle: "Reply",
    ctaLabel: "Reply to Heyy Studio",
    ctaUrl: `mailto:${adminEmail}?subject=${encodeURIComponent(`Re: ${subject}`)}`,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      reply_to: adminEmail,
      subject: `Re: ${subject}`,
      html: buildEmail(template),
      text: buildPlainTextEmail(template),
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    console.error("Contact Admin reply email failed:", response.status, responseText.slice(0, 300));
    throw new Error("The reply email could not be sent.");
  }
}

function projectSearchText(row: UnknownRow) {
  return [row.id, row.name, row.title, row.project_name, row.studio, row.project_type]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
}

function safeOrId(value: string) {
  return /^[a-zA-Z0-9_-]+$/.test(value) ? value : "";
}

async function resourceAccess(resource: string) {
  if (resource === "users" || resource === "generations") {
    return requireAdminApiUser();
  }
  const capability = resource === "careers" || resource === "applications" ? "careers" : "content";
  return requireAdminApiCapability(capability);
}

export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await params;
    const access = await resourceAccess(resource);
    if (access.response) return access.response;
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
            role: String(user.app_metadata?.role || (user.app_metadata?.is_admin === true ? "admin" : "customer")),
            summary: `${String(subscription?.plan || "free").toUpperCase()} · ${(wallet?.monthly_balance || 0) + (wallet?.purchased_balance || 0) - (wallet?.reserved_balance || 0)} credits`,
            created_at: user.created_at,
          };
        }),
      });
    }
    if (!(resource in map)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    const config = map[resource as keyof typeof map];

    if (resource === "applications") {
      const { data, error } = await client
        .from("career_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const rows = (data || []) as UnknownRow[];
      const positionIds = Array.from(
        new Set(rows.map((row) => firstText(row.position_id)).filter(Boolean)),
      );
      let positionRows: UnknownRow[] = [];
      if (positionIds.length) {
        const { data: positions, error: positionError } = await client
          .from("career_positions")
          .select("id,title,department,location")
          .in("id", positionIds);
        if (positionError) throw positionError;
        positionRows = (positions || []) as UnknownRow[];
      }

      const positionMap = new Map(
        positionRows.map((row) => [firstText(row.id), row]),
      );
      const items = rows.map((row) => {
        const position = positionMap.get(firstText(row.position_id));
        return {
          ...row,
          position_title: firstText(position?.title) || "Role unavailable",
          position_department: firstText(position?.department),
          position_location: firstText(position?.location),
        };
      });

      return NextResponse.json({ items });
    }

    if (resource === "generations") {
      const searchParams = new URL(request.url).searchParams;
      const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
      const parsedPageSize = Number.parseInt(searchParams.get("pageSize") || "25", 10);
      const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
      const pageSize = Number.isFinite(parsedPageSize) ? Math.min(100, Math.max(1, parsedPageSize)) : 25;
      const rawSearch = (searchParams.get("q") || "").trim();
      const search = rawSearch.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
      const tool = (searchParams.get("tool") || "").trim();
      const provider = (searchParams.get("provider") || "").trim();
      const status = (searchParams.get("status") || "").trim();
      const dateWindow = (searchParams.get("date") || "all").trim();
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const authUsers = await listAuthUsers(client);
      let searchableProjects: UnknownRow[] = [];
      if (search) searchableProjects = await loadProjectRows(client);

      let generationQuery = client
        .from(config.table)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (tool) generationQuery = generationQuery.eq("tool", tool);
      if (provider) generationQuery = generationQuery.eq("provider", provider);
      if (status) generationQuery = generationQuery.eq("status", status);

      const dateDays: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };
      if (dateDays[dateWindow]) {
        generationQuery = generationQuery.gte("created_at", new Date(Date.now() - dateDays[dateWindow] * 24 * 60 * 60 * 1000).toISOString());
      }

      if (search) {
        const pattern = `%${search}%`;
        const needle = search.toLowerCase();
        const matchingUserIds = authUsers
          .filter((user) => [user.email, user.user_metadata?.full_name, user.user_metadata?.name, user.id]
            .some((value) => String(value || "").toLowerCase().includes(needle)))
          .map((user) => user.id);
        const matchingProjectIds = searchableProjects
          .filter((row) => projectSearchText(row).includes(needle))
          .map((row) => safeOrId(String(row.id || "")))
          .filter(Boolean);
        const conditions = [
          `tool.ilike.${pattern}`,
          `provider.ilike.${pattern}`,
          `project_id.ilike.${pattern}`,
          `provider_job_id.ilike.${pattern}`,
          `status.ilike.${pattern}`,
          `error.ilike.${pattern}`,
          `request_key.ilike.${pattern}`,
          `active_key.ilike.${pattern}`,
        ];
        if (matchingUserIds.length) conditions.push(`user_id.in.(${matchingUserIds.join(",")})`);
        if (matchingProjectIds.length) conditions.push(`project_id.in.(${matchingProjectIds.join(",")})`);
        generationQuery = generationQuery.or(conditions.join(","));
      }

      const [pageResult, facetResult] = await Promise.all([
        generationQuery.range(from, to),
        client.from(config.table).select("tool,provider,status").order("created_at", { ascending: false }).limit(2000),
      ]);
      if (pageResult.error) throw pageResult.error;
      if (facetResult.error) console.error("Generation monitoring facets could not load:", facetResult.error.message);

      const rows = (pageResult.data || []) as UnknownRow[];
      const userMap = new Map<string, { id: string; name: string; email: string }>(authUsers.map((user) => [user.id, {
        id: user.id,
        name: firstText(user.user_metadata?.full_name, user.user_metadata?.name, user.email, user.id),
        email: firstText(user.email),
      }]));
      const pageUserIds = Array.from(new Set(rows.map((row) => firstText(row.user_id)).filter(Boolean)));
      const missingUserIds = pageUserIds.filter((id) => !userMap.has(id));
      if (missingUserIds.length) {
        const missingUsers = await Promise.all(missingUserIds.map((id) => client.auth.admin.getUserById(id)));
        missingUsers.forEach((result) => {
          const user = result.data.user;
          if (!user) return;
          userMap.set(user.id, {
            id: user.id,
            name: firstText(user.user_metadata?.full_name, user.user_metadata?.name, user.email, user.id),
            email: firstText(user.email),
          });
        });
      }

      const pageProjectIds = Array.from(new Set(rows.map((row) => firstText(row.project_id)).filter(Boolean)));
      let pageProjects = searchableProjects;
      if (!searchableProjects.length && pageProjectIds.length) pageProjects = await loadProjectRows(client, pageProjectIds);
      const projectMap = new Map(pageProjects.map((row) => [String(row.id || ""), row]));

      const items = rows.map((row) => {
        const input = asRecord(row.input);
        const userId = firstText(row.user_id);
        const projectId = firstText(row.project_id);
        const user = userMap.get(userId);
        const project = projectMap.get(projectId);
        const projectName = firstText(project?.name, project?.title, project?.project_name, findText(input, ["project_name", "projectName"]));
        const projectStudio = firstText(project?.studio, project?.project_type, findText(input, ["studio", "studio_name", "studioName"]), studioFromTool(row.tool));
        return {
          ...row,
          user_name: user?.name || (userId ? "Unknown user" : "System / no user"),
          user_email: user?.email || "",
          project_name: projectName || (projectId ? "Project record unavailable" : "Quick Tool / no project"),
          project_studio: projectStudio,
          project_href: project ? `/projects/${encodeURIComponent(projectId)}` : "",
          model_name: generationModel(row),
          credits_reserved: generationCreditsReserved(row),
          credits_used: generationCreditsUsed(row),
          duration_ms: generationDurationMs(row),
          asset_url: generationAssetUrl(row),
          asset_id: generationAssetId(row),
        };
      });

      const total = pageResult.count || 0;
      return NextResponse.json({
        items,
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        filters: generationFacets((facetResult.data || []) as UnknownRow[]),
      });
    }

    const { data, error } = await client.from(config.table).select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    const baseItems = (data || []).map((row) => resource === "pages" || resource === "help" || resource === "careers" ? { ...row, body: bodyText(resource, row) } : row);
    const items = resource === "contact"
      ? await hydrateContactRows(client, baseItems as UnknownRow[])
      : baseItems;
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load resource." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await params;
    const access = await resourceAccess(resource);
    if (access.response) return access.response;

    if (resource === "contact") {
      const body = await request.json() as Record<string, unknown>;
      const action = String(body.action || "").trim().toLowerCase();
      const id = String(body.id || "").trim();
      const message = String(body.message || "").replace(/\r\n/g, "\n").trim().slice(0, 5000);
      if (action !== "reply" || !id || message.length < 2) {
        return NextResponse.json({ error: "Contact submission and reply message are required." }, { status: 400 });
      }

      const client = admin();
      const { data: row, error: rowError } = await client
        .from("contact_submissions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (rowError) throw rowError;
      if (!row) return NextResponse.json({ error: "Contact submission not found." }, { status: 404 });

      await sendContactAdminReply(row as UnknownRow, message);

      const metadata = asRecord((row as UnknownRow).metadata);
      const existingReplies = Array.isArray(metadata.admin_replies)
        ? metadata.admin_replies.map(asRecord)
        : [];
      const adminReplies = [
        ...existingReplies,
        {
          message,
          sent_at: new Date().toISOString(),
          actor_user_id: access.user?.id || null,
        },
      ].slice(-20);

      const { data: updated, error: updateError } = await client
        .from("contact_submissions")
        .update({
          status: "replied",
          metadata: { ...metadata, admin_replies: adminReplies },
        })
        .eq("id", id)
        .select("*")
        .single();
      if (updateError) throw updateError;

      await recordAdminAudit({
        actorUserId: access.user?.id || null,
        action: "platform.contact.replied",
        entityType: "contact",
        entityId: id,
        summary: `Replied to contact submission from ${firstText((row as UnknownRow).email, id)}`,
      });

      const hydrated = await hydrateContactRows(client, [updated as UnknownRow]);
      return NextResponse.json({ success: true, item: hydrated[0] });
    }

    if (!(resource in map) || ["applications", "generations"].includes(resource)) {
      return NextResponse.json({ error: "Creation is not supported for this resource." }, { status: 400 });
    }
    const config = map[resource as keyof typeof map];
    const body = await request.json() as Record<string, unknown>;
    const payload = { ...sanitize(resource, body), status: "draft" };
    const { data, error } = await admin().from(config.table).insert(payload).select("*").single();
    if (error) throw error;
    await recordAdminAudit({ actorUserId: access.user?.id || null, action: `platform.${resource}.created`, entityType: resource, entityId: String((data as Record<string, unknown>)?.[config.key] || ""), summary: `Created ${resource} record: ${String((data as Record<string, unknown>)?.title || (data as Record<string, unknown>)?.name || (data as Record<string, unknown>)?.[config.key] || "record")}` });
    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create resource." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await params;
    const access = await resourceAccess(resource);
    if (access.response) return access.response;
    if (resource === "generations") {
      return NextResponse.json({ error: "Generation monitoring is read-only. Generation state is managed by the generation and credit workflows." }, { status: 405 });
    }
    const body = await request.json() as Record<string, unknown>;
    if (resource === "users") {
      const id = String(body.id || "").trim();
      const role = String(body.role || "customer").trim().toLowerCase();
      if (!id || !["customer", "business_admin", "admin"].includes(role)) {
        return NextResponse.json({ error: "User and valid role are required." }, { status: 400 });
      }
      if (id === access.user?.id && role !== "admin") {
        return NextResponse.json({ error: "You cannot remove your own full Admin access." }, { status: 409 });
      }
      const client = admin();
      const { data: current, error: currentError } = await client.auth.admin.getUserById(id);
      if (currentError || !current.user) throw currentError || new Error("User not found.");
      const metadata = { ...(current.user.app_metadata || {}) } as Record<string, unknown>;
      const existingRoles = Array.isArray(metadata.roles) ? metadata.roles.map(String).filter((value) => !["admin", "business_admin"].includes(value.toLowerCase())) : [];
      delete metadata.role;
      delete metadata.is_admin;
      if (role === "admin") { metadata.role = "admin"; metadata.is_admin = true; metadata.roles = [...existingRoles, "admin"]; }
      else if (role === "business_admin") { metadata.role = "business_admin"; metadata.roles = [...existingRoles, "business_admin"]; }
      else { metadata.roles = existingRoles; }
      const { data, error } = await client.auth.admin.updateUserById(id, { app_metadata: metadata });
      if (error) throw error;
      await recordAdminAudit({ actorUserId: access.user?.id || null, action: "admin_role.updated", entityType: "user", entityId: id, summary: `Changed Admin role for ${current.user.email || id} to ${role}`, metadata: { role } });
      return NextResponse.json({ success: true, item: { id, role, email: data.user?.email || current.user.email } });
    }
    if (!(resource in map)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    const config = map[resource as keyof typeof map];
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Missing record ID." }, { status: 400 });
    delete body.id;
    const update = sanitize(resource, body);
    // Only publishable content tables have a published_at column. Career
    // applications and contact submissions use workflow statuses but do not.
    if (["careers", "pages", "help"].includes(resource)) {
      if (update.status === "published") update.published_at = new Date().toISOString();
      if (update.status && update.status !== "published") update.published_at = null;
    }
    const { data, error } = await admin().from(config.table).update(update).eq(config.key, id).select("*").single();
    if (error) throw error;
    await recordAdminAudit({ actorUserId: access.user?.id || null, action: `platform.${resource}.updated`, entityType: resource, entityId: id, summary: `Updated ${resource} record: ${String((data as Record<string, unknown>)?.title || (data as Record<string, unknown>)?.name || id)}` });
    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update resource." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await params;
    const access = await resourceAccess(resource);
    if (access.response) return access.response;
    if (resource === "generations") {
      return NextResponse.json({ error: "Generation monitoring is read-only." }, { status: 405 });
    }
    if (!(resource in map)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    const config = map[resource as keyof typeof map];
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing record ID." }, { status: 400 });
    const client = admin();

    if (resource === "contact") {
      const { data: row } = await client
        .from("contact_submissions")
        .select("metadata")
        .eq("id", id)
        .maybeSingle();
      const paths = row
        ? contactAttachmentRecords(row as UnknownRow).map((attachment) => firstText(attachment.storage_path)).filter(Boolean)
        : [];
      if (paths.length) {
        const { error: storageError } = await client.storage.from(CONTACT_ATTACHMENTS_BUCKET).remove(paths);
        if (storageError) console.error("Contact attachment cleanup failed:", storageError.message);
      }
    }

    const { error } = await client.from(config.table).delete().eq(config.key, id);
    if (error) throw error;
    await recordAdminAudit({ actorUserId: access.user?.id || null, action: `platform.${resource}.deleted`, entityType: resource, entityId: id, summary: `Deleted ${resource} record: ${id}` });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete resource." }, { status: 500 });
  }
}
