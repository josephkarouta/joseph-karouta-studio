import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSubscriptionRow } from "@/lib/billing/stripe";
import { normalizePlan, type PlanId } from "@/lib/platform/plans";

export type WorkspaceStorageMode = "active" | "grace" | "paused" | "free" | "expired";

export type WorkspaceStorageEntitlement = {
  mode: WorkspaceStorageMode;
  plan: PlanId;
  paidPlan: "starter" | "pro" | null;
  canBrowse: boolean;
  canDownload: boolean;
  canManage: boolean;
  canSave: boolean;
  graceEndsAt: string | null;
  daysRemaining: number | null;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const PAUSED_STATUSES = new Set(["past_due", "unpaid", "incomplete", "incomplete_expired", "paused"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 30;

function text(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function timestamp(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function paidPlanFromRow(row: Record<string, unknown> | null): "starter" | "pro" | null {
  if (!row) return null;
  const direct = normalizePlan(row.plan);
  if (direct === "starter" || direct === "pro") return direct;

  const priceId = text(row.stripe_price_id);
  if (priceId && priceId === text(process.env.STRIPE_STARTER_PRICE_ID_USD)) return "starter";
  if (priceId && priceId === text(process.env.STRIPE_PRO_PRICE_ID_USD)) return "pro";
  return null;
}

function endedAt(row: Record<string, unknown>) {
  const status = String(row.status || "").toLowerCase();
  if (["canceled", "cancelled", "inactive"].includes(status)) {
    return timestamp(row.canceled_at) || timestamp(row.current_period_end) || timestamp(row.updated_at);
  }
  return timestamp(row.current_period_end) || timestamp(row.canceled_at) || timestamp(row.updated_at);
}

export async function getWorkspaceStorageEntitlement(
  admin: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<WorkspaceStorageEntitlement> {
  const row = await getSubscriptionRow(admin, userId);
  if (!row) {
    return {
      mode: "free",
      plan: "free",
      paidPlan: null,
      canBrowse: false,
      canDownload: false,
      canManage: false,
      canSave: false,
      graceEndsAt: null,
      daysRemaining: null,
    };
  }

  const plan = normalizePlan(row.plan);
  const paidPlan = paidPlanFromRow(row);
  const status = String(row.status || "").toLowerCase();

  if (paidPlan && ACTIVE_STATUSES.has(status)) {
    return {
      mode: "active",
      plan: paidPlan,
      paidPlan,
      canBrowse: true,
      canDownload: true,
      canManage: true,
      canSave: true,
      graceEndsAt: null,
      daysRemaining: null,
    };
  }

  if (paidPlan && PAUSED_STATUSES.has(status)) {
    return {
      mode: "paused",
      plan: paidPlan,
      paidPlan,
      canBrowse: true,
      canDownload: true,
      canManage: false,
      canSave: false,
      graceEndsAt: null,
      daysRemaining: null,
    };
  }

  if (paidPlan) {
    const ended = endedAt(row);
    if (ended) {
      const graceEnd = ended + GRACE_DAYS * DAY_MS;
      const nowMs = now.getTime();
      if (nowMs < graceEnd) {
        return {
          mode: "grace",
          plan,
          paidPlan,
          canBrowse: true,
          canDownload: true,
          canManage: false,
          canSave: false,
          graceEndsAt: new Date(graceEnd).toISOString(),
          daysRemaining: Math.max(1, Math.ceil((graceEnd - nowMs) / DAY_MS)),
        };
      }
      return {
        mode: "expired",
        plan,
        paidPlan,
        canBrowse: false,
        canDownload: false,
        canManage: false,
        canSave: false,
        graceEndsAt: new Date(graceEnd).toISOString(),
        daysRemaining: 0,
      };
    }
  }

  return {
    mode: "free",
    plan: "free",
    paidPlan: null,
    canBrowse: false,
    canDownload: false,
    canManage: false,
    canSave: false,
    graceEndsAt: null,
    daysRemaining: null,
  };
}

export function storageAccessError(entitlement: WorkspaceStorageEntitlement) {
  if (entitlement.mode === "paused") {
    return "Saved workspace files are read-only while your subscription needs attention.";
  }
  if (entitlement.mode === "grace") {
    return "Saved workspace files are read-only during the 30-day download grace period.";
  }
  if (entitlement.mode === "expired") {
    return "The 30-day storage grace period has ended. Resubscribe to restore cloud workspace access where files are still available.";
  }
  return "Cloud Assets and Versions are included with Starter and Pro.";
}
