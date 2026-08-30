import "server-only";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { listCommunicationTemplates } from "@/lib/communications/templates";
import { COMMUNICATION_TEMPLATE_CATALOG } from "@/lib/communications/catalog";
import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdminApiCapability } from "@/lib/server/admin-api";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  const access = await requireAdminApiCapability("communications");
  if (access.response) return access.response;
  return NextResponse.json({ success: true, templates: await listCommunicationTemplates() });
}

export async function PUT(request: Request) {
  const access = await requireAdminApiCapability("communications");
  if (access.response) return access.response;

  try {
    const body = await request.json();
    const key = String(body.templateKey || "").trim();
    const definition = COMMUNICATION_TEMPLATE_CATALOG.find((item) => item.key === key);
    if (!definition) return NextResponse.json({ success: false, error: "Unknown email template." }, { status: 400 });

    const payload = {
      template_key: key,
      subject: cleanOverride(body.subject, definition.defaultSubject),
      preheader: cleanOverride(body.preheader, definition.defaultPreheader),
      eyebrow: cleanOverride(body.eyebrow, definition.defaultEyebrow),
      title: cleanOverride(body.title, definition.defaultTitle),
      body: cleanOverride(body.body, definition.defaultBody),
      cta_label: cleanOverride(body.ctaLabel, definition.defaultCtaLabel),
      enabled: body.enabled !== false,
      updated_by: access.user?.id || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await admin.from("communication_templates").upsert(payload, { onConflict: "template_key" });
    if (error) throw error;

    await recordAdminAudit({
      actorUserId: access.user?.id || null,
      action: "communication_template.updated",
      entityType: "communication_template",
      entityId: key,
      summary: `Updated email template: ${key}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update communication template error:", error);
    return NextResponse.json({ success: false, error: "Template could not be saved." }, { status: 500 });
  }
}

function clean(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function cleanOverride(value: unknown, builtInValue?: string) {
  const next = clean(value);
  const builtIn = clean(builtInValue);
  return next === builtIn ? null : next;
}
