import type { User } from "@supabase/supabase-js";
import { normalizePlan, type PlanId } from "@/lib/platform/plans";

type SubscriptionRow = Record<string, unknown>;

const TERMINAL_STATUSES = new Set([
  "cancelled",
  "canceled",
  "inactive",
  "expired",
  "unpaid",
  "deleted",
]);

const ACTIVE_STATUSES = new Set([
  "active",
  "trialing",
  "trial",
  "paid",
  "complete",
  "completed",
]);

function valueFrom(row: SubscriptionRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return value;
  }
  return null;
}

function planRank(plan: PlanId) {
  return plan === "pro" ? 3 : plan === "starter" ? 2 : 1;
}

function statusRank(value: unknown) {
  const status = String(value || "").trim().toLowerCase();
  if (ACTIVE_STATUSES.has(status)) return 3;
  if (!status) return 2;
  if (TERMINAL_STATUSES.has(status)) return 0;
  return 1;
}

function dateScore(row: SubscriptionRow) {
  const raw = valueFrom(row, [
    "current_period_end",
    "updated_at",
    "created_at",
    "paid_at",
  ]);
  const time = raw ? new Date(String(raw)).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export function resolveSubscriptionPlan(
  rows: SubscriptionRow[] | null | undefined,
  user?: User | null,
): { plan: PlanId; subscription: SubscriptionRow | null } {
  const candidates = (rows || [])
    .map((row) => {
      const rawPlan = valueFrom(row, [
        "plan",
        "plan_id",
        "subscription_plan",
        "tier",
        "product_name",
      ]);
      const plan = normalizePlan(rawPlan);
      return {
        row,
        plan,
        status: statusRank(valueFrom(row, ["status", "subscription_status", "state"])),
        date: dateScore(row),
      };
    })
    .sort((a, b) => {
      if (a.status !== b.status) return b.status - a.status;
      if (planRank(a.plan) !== planRank(b.plan)) return planRank(b.plan) - planRank(a.plan);
      return b.date - a.date;
    });

  const selected = candidates.find((item) => item.status > 0);
  if (selected) return { plan: selected.plan, subscription: selected.row };

  const metadata = {
    ...(user?.app_metadata || {}),
    ...(user?.user_metadata || {}),
  } as Record<string, unknown>;
  const metadataPlan = valueFrom(metadata, [
    "plan",
    "plan_id",
    "subscription_plan",
    "tier",
    "account_plan",
  ]);

  return { plan: normalizePlan(metadataPlan), subscription: null };
}
