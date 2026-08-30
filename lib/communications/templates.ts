import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  COMMUNICATION_TEMPLATE_CATALOG,
  communicationTemplateDefinition,
} from "./catalog";

export type EditableEmailFields = {
  subject: string;
  preheader?: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
};

type StoredTemplate = {
  template_key: string;
  subject?: string | null;
  preheader?: string | null;
  eyebrow?: string | null;
  title?: string | null;
  body?: string | null;
  cta_label?: string | null;
  enabled?: boolean | null;
};

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export function interpolateTemplate(value: string, variables: Record<string, unknown>) {
  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const next = variables[key];
    return next === undefined || next === null ? "" : String(next);
  });
}

export async function resolveCommunicationTemplate({
  templateKey,
  fallback,
  variables = {},
}: {
  templateKey: string;
  fallback: EditableEmailFields;
  variables?: Record<string, unknown>;
}) {
  let stored: StoredTemplate | null = null;
  try {
    const { data, error } = await adminClient()
      .from("communication_templates")
      .select("template_key,subject,preheader,eyebrow,title,body,cta_label,enabled")
      .eq("template_key", templateKey)
      .maybeSingle();
    if (!error) stored = data as StoredTemplate | null;
  } catch {
    // The migration may not be installed yet while working locally. Fall back to
    // the code-backed copy so transactional email delivery remains available.
  }

  const enabled = stored?.enabled !== false;
  const merged: EditableEmailFields = {
    subject: stored?.subject?.trim() || fallback.subject,
    preheader: stored?.preheader?.trim() || fallback.preheader || "",
    eyebrow: stored?.eyebrow?.trim() || fallback.eyebrow,
    title: stored?.title?.trim() || fallback.title,
    body: stored?.body?.trim() || fallback.body,
    ctaLabel: stored?.cta_label?.trim() || fallback.ctaLabel,
  };

  return {
    enabled,
    subject: interpolateTemplate(merged.subject, variables),
    preheader: interpolateTemplate(merged.preheader || "", variables),
    eyebrow: interpolateTemplate(merged.eyebrow, variables),
    title: interpolateTemplate(merged.title, variables),
    body: interpolateTemplate(merged.body, variables),
    ctaLabel: interpolateTemplate(merged.ctaLabel, variables),
  };
}

export async function listCommunicationTemplates() {
  const overrides = new Map<string, StoredTemplate>();
  try {
    const { data } = await adminClient()
      .from("communication_templates")
      .select("template_key,subject,preheader,eyebrow,title,body,cta_label,enabled");
    for (const item of (data || []) as StoredTemplate[]) overrides.set(item.template_key, item);
  } catch {
    // The Admin UI will still render the built-in catalogue before SQL is applied.
  }

  return COMMUNICATION_TEMPLATE_CATALOG.map((definition) => {
    const stored = overrides.get(definition.key);
    return {
      ...definition,
      subject: stored?.subject ?? definition.defaultSubject ?? "",
      preheader: stored?.preheader ?? definition.defaultPreheader ?? "",
      eyebrow: stored?.eyebrow ?? definition.defaultEyebrow ?? "",
      title: stored?.title ?? definition.defaultTitle ?? "",
      body: stored?.body ?? definition.defaultBody ?? "",
      ctaLabel: stored?.cta_label ?? definition.defaultCtaLabel ?? "",
      enabled: stored?.enabled !== false,
      overridden: Boolean(stored),
    };
  });
}

export function productionTemplateKey(event: string, recipient: "client" | "admin") {
  if (event === "production.message.client" && recipient === "admin") return "production.message.client.admin";
  if (event === "production.message.studio" && recipient === "client") return "production.message.studio.client";
  if (["production.assigned", "production.started", "production.review", "deliverables.uploaded", "project.completed"].includes(event) && recipient === "client") {
    return "production.status.client";
  }
  const exact = `${event}.${recipient}`;
  return communicationTemplateDefinition(exact) ? exact : null;
}
