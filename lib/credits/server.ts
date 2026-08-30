import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { CreditAction } from "@/lib/credits/config";
import { getCreditCost } from "@/lib/credits/config";
import { getPlan, type PlanId } from "@/lib/platform/plans";
import { resolveSubscriptionPlan } from "@/lib/server/subscription-plan";
import { commitReservedCredits } from "@/lib/credits/lifecycle";
import { getWelcomeCreditAmount } from "@/lib/credits/welcome";

export type CreditReservation = {
  id: string;
  amount: number;
  action: CreditAction;
};

type CreditWalletRow = {
  user_id: string;
  monthly_balance: number;
  purchased_balance: number;
  reserved_balance: number;
  period_start: string | null;
  period_end: string | null;
  verified_signup_granted_at: string | null;
};

export type EnsuredCreditWallet = {
  plan: PlanId;
  wallet: CreditWalletRow;
  subscription: Record<string, unknown> | null;
  renewalPending: boolean;
};

export type MonthlyCreditGrant = {
  userId: string;
  plan: PlanId;
  amount: number;
  periodStart: string;
  periodEnd: string;
  grantKey: string;
  source: string;
  metadata?: Record<string, unknown>;
};

export class CreditError extends Error {
  code: "INSUFFICIENT_CREDITS" | "EMAIL_VERIFICATION_REQUIRED" | "CREDIT_SYSTEM_UNAVAILABLE" | "CREDIT_OPERATION_FAILED";
  status: number;

  constructor(
    message: string,
    code: CreditError["code"] = "CREDIT_OPERATION_FAILED",
    status = 400,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function currentMonthlyPeriod() {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function validIsoDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

const UNPAID_SUBSCRIPTION_STATUSES = new Set([
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

function subscriptionStatus(subscription: Record<string, unknown> | null) {
  return String(
    subscription?.status ||
      subscription?.subscription_status ||
      subscription?.state ||
      "",
  )
    .trim()
    .toLowerCase();
}

function monthlyPeriodForPlan(
  plan: PlanId,
  subscription: Record<string, unknown> | null,
) {
  if (plan !== "free" && subscription) {
    const start = validIsoDate(subscription.current_period_start);
    const end = validIsoDate(subscription.current_period_end);
    const subscriptionId = String(subscription.stripe_subscription_id || "").trim();

    if (start && end && new Date(end).getTime() > new Date(start).getTime()) {
      return {
        start,
        end,
        grantKey: `stripe:${subscriptionId || plan}:${start}`,
        source: "stripe_subscription",
      };
    }
  }

  const period = currentMonthlyPeriod();
  return {
    ...period,
    grantKey: `${plan}:${plan === "free" ? "payg" : "calendar"}:${period.start}`,
    source: plan === "free" ? "free_payg_reconciliation" : "account_reconciliation",
  };
}

export async function applyMonthlyCredits(
  admin: SupabaseClient,
  grant: MonthlyCreditGrant,
) {
  const { data, error } = await admin.rpc("heyy_apply_monthly_credits", {
    p_user_id: grant.userId,
    p_grant_key: grant.grantKey,
    p_plan: grant.plan,
    p_amount: grant.amount,
    p_period_start: grant.periodStart,
    p_period_end: grant.periodEnd,
    p_source: grant.source,
    p_metadata: grant.metadata || {},
  });

  if (error) {
    throw creditSystemError(error, "Monthly credits could not be applied.");
  }

  return data === true;
}

function creditSystemError(error: unknown, fallback: string) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || fallback)
      : fallback;

  if (/does not exist|schema cache|credit_wallets|credit_usage_events|credit_monthly_grants|heyy_apply_monthly_credits/i.test(message)) {
    return new CreditError(
      "The required credit database migration has not been applied correctly.",
      "CREDIT_SYSTEM_UNAVAILABLE",
      503,
    );
  }

  return new CreditError(message, "CREDIT_OPERATION_FAILED", 500);
}

export async function ensureCreditWallet({
  admin,
  userId,
  user,
}: {
  admin: SupabaseClient;
  userId: string;
  user?: User | null;
}): Promise<EnsuredCreditWallet> {
  const [subscriptionResult, walletResult, authUserResult] = await Promise.all([
    admin.from("user_subscriptions").select("*").eq("user_id", userId),
    admin
      .from("credit_wallets")
      .select("user_id,monthly_balance,purchased_balance,reserved_balance,period_start,period_end,verified_signup_granted_at")
      .eq("user_id", userId)
      .maybeSingle(),
    user
      ? Promise.resolve({ data: { user }, error: null })
      : admin.auth.admin.getUserById(userId),
  ]);

  if (subscriptionResult.error) {
    throw creditSystemError(subscriptionResult.error, "The subscription could not be loaded.");
  }
  if (walletResult.error) {
    throw creditSystemError(walletResult.error, "The credit wallet could not be loaded.");
  }

  if (authUserResult.error) {
    throw creditSystemError(authUserResult.error, "The authenticated user could not be verified.");
  }

  let wallet = walletResult.data as CreditWalletRow | null;
  let authUser = authUserResult.data?.user || user || null;

  // API routes authenticate normal requests from verified JWT claims. That
  // lightweight User shape intentionally does not include email_confirmed_at.
  // For an established wallet the verified_signup_granted_at marker is already
  // our durable proof that the account passed email verification. For a brand
  // new wallet, do one authoritative Auth lookup before granting Free credits.
  // This keeps the normal account-summary path fast while preserving the
  // verified-email security boundary for first-time grants.
  if (!wallet?.verified_signup_granted_at && !authUser?.email_confirmed_at) {
    const { data: verifiedAuthData, error: verifiedAuthError } =
      await admin.auth.admin.getUserById(userId);

    if (verifiedAuthError) {
      throw creditSystemError(
        verifiedAuthError,
        "The authenticated user could not be verified.",
      );
    }

    authUser = verifiedAuthData.user || null;
  }

  if (!wallet?.verified_signup_granted_at && !authUser?.email_confirmed_at) {
    throw new CreditError(
      "Verify your email address before using Heyy Studio credits.",
      "EMAIL_VERIFICATION_REQUIRED",
      403,
    );
  }

  const resolved = resolveSubscriptionPlan(
    (subscriptionResult.data || []) as Record<string, unknown>[],
    authUser,
  );
  const plan = getPlan(resolved.plan);
  const period = monthlyPeriodForPlan(resolved.plan, resolved.subscription);
  const stripeSubscriptionStatus = subscriptionStatus(resolved.subscription);
  const subscriptionPaymentOutstanding = Boolean(
    resolved.plan !== "free" &&
      resolved.subscription &&
      UNPAID_SUBSCRIPTION_STATUSES.has(stripeSubscriptionStatus),
  );
  const expectedMonthlyCredits = subscriptionPaymentOutstanding
    ? 0
    : plan.monthlyCredits;
  const reconciliationGrantKey = subscriptionPaymentOutstanding
    ? `stripe-unpaid:${String(
        resolved.subscription?.stripe_subscription_id || resolved.plan,
      ).trim()}:${period.start}`
    : period.grantKey;
  const reconciliationSource = subscriptionPaymentOutstanding
    ? "account_reconciliation_unpaid"
    : period.source;

  // New Free accounts are created with a zero-credit wallet. The allowance is
  // granted only after Supabase has confirmed ownership of the email address.
  // The database function is idempotent, so refreshes and parallel requests
  // cannot grant the signup allowance more than once.
  if (resolved.plan === "free" && !wallet?.verified_signup_granted_at) {
    const { error: grantError } = await admin.rpc("heyy_grant_verified_signup_credits", {
      p_user_id: userId,
      p_amount: getWelcomeCreditAmount(),
    });

    if (grantError) {
      throw creditSystemError(grantError, "Verified signup credits could not be granted.");
    }

    const { data: refreshedWallet, error: refreshedWalletError } = await admin
      .from("credit_wallets")
      .select(
        "user_id,monthly_balance,purchased_balance,reserved_balance,period_start,period_end,verified_signup_granted_at",
      )
      .eq("user_id", userId)
      .single();

    if (refreshedWalletError || !refreshedWallet) {
      throw creditSystemError(refreshedWalletError, "The verified credit wallet could not be loaded.");
    }

    wallet = refreshedWallet as CreditWalletRow;
  }

  const periodStartTime = new Date(period.start).getTime();
  const walletStartTime = wallet?.period_start
    ? new Date(wallet.period_start).getTime()
    : 0;
  const walletExpired =
    !wallet?.period_end || new Date(wallet.period_end).getTime() <= Date.now();
  const periodAdvanced = Number.isFinite(periodStartTime) && periodStartTime > walletStartTime;
  const hasActiveWelcomeCredits = Boolean(
    resolved.plan === "free" &&
      wallet?.verified_signup_granted_at &&
      Number(wallet?.monthly_balance || 0) > 0 &&
      wallet?.period_end &&
      new Date(wallet.period_end).getTime() > Date.now(),
  );
  const needsFreePaygReset =
    resolved.plan === "free" &&
    Number(wallet?.monthly_balance || 0) > 0 &&
    !hasActiveWelcomeCredits;
  const needsUnpaidSubscriptionReset =
    subscriptionPaymentOutstanding && Number(wallet?.monthly_balance || 0) > 0;

  // A successful retry can move Stripe back to active before the paid-invoice
  // webhook reaches us (or that webhook can be retried later). A zero monthly
  // balance alone is not enough evidence to grant credits because the customer
  // may simply have spent the allowance. Only recover automatically when this
  // exact subscription period has a recorded zero-credit suspension caused by
  // a failed/unpaid renewal. The normal paid grant key remains idempotent, so
  // duplicate invoice events or repeated account refreshes cannot grant twice.
  let needsRecoveredSubscriptionGrant = false;
  if (
    !subscriptionPaymentOutstanding &&
    resolved.plan !== "free" &&
    resolved.subscription &&
    Number(wallet?.monthly_balance || 0) === 0
  ) {
    const { data: suspendedGrant, error: suspendedGrantError } = await admin
      .from("credit_monthly_grants")
      .select("id")
      .eq("user_id", userId)
      .eq("amount", 0)
      .eq("period_start", period.start)
      .in("source", ["renewal_failed", "account_reconciliation_unpaid"])
      .limit(1)
      .maybeSingle();

    if (suspendedGrantError) {
      throw creditSystemError(
        suspendedGrantError,
        "The subscription credit recovery state could not be verified.",
      );
    }

    needsRecoveredSubscriptionGrant = Boolean(suspendedGrant?.id);
  }

  const needsMonthlyGrant =
    !wallet ||
    walletExpired ||
    (!hasActiveWelcomeCredits && periodAdvanced) ||
    needsFreePaygReset ||
    needsUnpaidSubscriptionReset ||
    needsRecoveredSubscriptionGrant;

  if (needsMonthlyGrant) {
    const effectiveGrantKey = needsRecoveredSubscriptionGrant
      ? `stripe-recovery:${String(
          resolved.subscription?.stripe_subscription_id || resolved.plan,
        ).trim()}:${period.start}`
      : reconciliationGrantKey;
    const effectiveSource = needsRecoveredSubscriptionGrant
      ? "payment_recovery"
      : reconciliationSource;

    await applyMonthlyCredits(admin, {
      userId,
      plan: resolved.plan,
      amount: expectedMonthlyCredits,
      periodStart: period.start,
      periodEnd: period.end,
      grantKey: effectiveGrantKey,
      source: effectiveSource,
      metadata: {
        stripe_subscription_id: resolved.subscription?.stripe_subscription_id || null,
        subscription_status: stripeSubscriptionStatus || null,
        entitlement_suspended: subscriptionPaymentOutstanding,
        entitlement_recovered: needsRecoveredSubscriptionGrant,
      },
    });

    const { data, error } = await admin
      .from("credit_wallets")
      .select("user_id,monthly_balance,purchased_balance,reserved_balance,period_start,period_end,verified_signup_granted_at")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      throw creditSystemError(error, "The credit wallet could not be initialized.");
    }
    wallet = data as CreditWalletRow;
  }

  if (!wallet) {
    throw new CreditError(
      "The credit wallet could not be initialized.",
      "CREDIT_SYSTEM_UNAVAILABLE",
      503,
    );
  }

  const refreshedStartTime = wallet.period_start
    ? new Date(wallet.period_start).getTime()
    : 0;
  const renewalPending = Boolean(
    needsMonthlyGrant &&
      (new Date(wallet.period_end || 0).getTime() <= Date.now() ||
        periodStartTime > refreshedStartTime),
  );

  return {
    plan: resolved.plan,
    wallet,
    subscription: resolved.subscription,
    renewalPending,
  };
}

export async function reserveCredits({
  admin,
  userId,
  action,
  metadata = {},
  amountOverride,
}: {
  admin: SupabaseClient;
  userId: string;
  action: CreditAction;
  metadata?: Record<string, unknown>;
  amountOverride?: number;
}): Promise<CreditReservation> {
  const configuredAmount = getCreditCost(action);
  const amount = Number.isInteger(amountOverride) && Number(amountOverride) > 0
    ? Number(amountOverride)
    : configuredAmount;

  // The account badge and the generation APIs now use the exact same wallet.
  // This also repairs untouched Pro/Starter wallets created with the old 40-credit default.
  const ensured = await ensureCreditWallet({ admin, userId });
  if (ensured.renewalPending) {
    throw new CreditError(
      "Your monthly credits are refreshing. Please try again shortly.",
      "CREDIT_OPERATION_FAILED",
      409,
    );
  }

  const { data, error } = await admin.rpc("heyy_reserve_credits", {
    p_user_id: userId,
    p_action: action,
    p_amount: amount,
    p_metadata: metadata,
  });

  if (error) {
    const message = String(error.message || "");
    if (/insufficient/i.test(message)) {
      throw new CreditError(
        `You need ${amount} credits for this action. Buy more credits or choose a lower-cost mode.`,
        "INSUFFICIENT_CREDITS",
        402,
      );
    }
    if (/function.*does not exist|schema cache|heyy_reserve_credits/i.test(message)) {
      throw new CreditError(
        "The required credit database migration has not been applied yet.",
        "CREDIT_SYSTEM_UNAVAILABLE",
        503,
      );
    }
    throw new CreditError(message || "Credits could not be reserved.");
  }

  const reservationId = typeof data === "string" ? data : data?.id || data?.reservation_id;
  if (!reservationId) throw new CreditError("Credit reservation returned no identifier.");
  return { id: String(reservationId), amount, action };
}

export async function commitCredits(
  admin: SupabaseClient,
  reservationId: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await commitReservedCredits(admin, reservationId, metadata);
  } catch (error) {
    throw new CreditError(
      error instanceof Error ? error.message : "Credits could not be committed.",
    );
  }
}

export async function refundCredits(
  admin: SupabaseClient,
  reservationId: string,
  reason: string,
) {
  const { error } = await admin.rpc("heyy_refund_credits", {
    p_reservation_id: reservationId,
    p_reason: reason.slice(0, 500),
  });
  if (error) console.error("Credit refund failed:", error);
}

export async function withCreditReservation<T>({
  admin,
  userId,
  action,
  metadata,
  work,
  amountOverride,
}: {
  admin: SupabaseClient;
  userId: string;
  action: CreditAction;
  metadata?: Record<string, unknown>;
  work: (reservation: CreditReservation) => Promise<T>;
  amountOverride?: number;
}) {
  const reservation = await reserveCredits({ admin, userId, action, metadata, amountOverride });
  try {
    const result = await work(reservation);
    await commitCredits(admin, reservation.id, metadata);
    return { result, reservation };
  } catch (error) {
    await refundCredits(
      admin,
      reservation.id,
      error instanceof Error ? error.message : "Generation failed",
    );
    throw error;
  }
}
