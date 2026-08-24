import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { CreditAction } from "@/lib/credits/config";
import { getCreditCost } from "@/lib/credits/config";
import { getPlan, type PlanId } from "@/lib/platform/plans";
import { resolveSubscriptionPlan } from "@/lib/server/subscription-plan";

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

function creditSystemError(error: unknown, fallback: string) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || fallback)
      : fallback;

  if (/does not exist|schema cache|credit_wallets|credit_usage_events/i.test(message)) {
    return new CreditError(
      "The V13 credit migration has not been applied correctly.",
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
  const period = currentMonthlyPeriod();

  // New Free accounts are created with a zero-credit wallet. The allowance is
  // granted only after Supabase has confirmed ownership of the email address.
  // The database function is idempotent, so refreshes and parallel requests
  // cannot grant the signup allowance more than once.
  if (resolved.plan === "free" && !wallet?.verified_signup_granted_at) {
    const { error: grantError } = await admin.rpc("heyy_grant_verified_signup_credits", {
      p_user_id: userId,
      p_amount: plan.monthlyCredits,
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

  const walletExpired =
    !wallet?.period_end || new Date(wallet.period_end).getTime() <= Date.now();
  const untouchedFreeDefault = Boolean(
    wallet &&
      resolved.plan !== "free" &&
      Number(wallet.monthly_balance) === getPlan("free").monthlyCredits &&
      Number(wallet.purchased_balance || 0) === 0 &&
      Number(wallet.reserved_balance || 0) === 0,
  );

  let zeroBalanceNeedsRepair = false;
  if (
    wallet &&
    resolved.plan !== "free" &&
    Number(wallet.monthly_balance) === 0 &&
    Number(wallet.purchased_balance || 0) === 0 &&
    Number(wallet.reserved_balance || 0) === 0
  ) {
    const usageStart = wallet.period_start || period.start;
    const { count, error } = await admin
      .from("credit_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_type", "committed")
      .gte("created_at", usageStart);

    if (error) throw creditSystemError(error, "Credit usage could not be checked.");
    zeroBalanceNeedsRepair = Number(count || 0) === 0;
  }

  if (!wallet || walletExpired || untouchedFreeDefault || zeroBalanceNeedsRepair) {
    const { data, error } = await admin
      .from("credit_wallets")
      .upsert(
        {
          user_id: userId,
          monthly_balance: plan.monthlyCredits,
          period_start: period.start,
          period_end: period.end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("user_id,monthly_balance,purchased_balance,reserved_balance,period_start,period_end,verified_signup_granted_at")
      .single();

    if (error || !data) {
      throw creditSystemError(error, "The credit wallet could not be initialized.");
    }
    wallet = data as CreditWalletRow;
  }

  return {
    plan: resolved.plan,
    wallet,
    subscription: resolved.subscription,
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
  await ensureCreditWallet({ admin, userId });

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
        `You need ${amount} credits for this action. Add credits or choose a lower-cost mode.`,
        "INSUFFICIENT_CREDITS",
        402,
      );
    }
    if (/function.*does not exist|schema cache|heyy_reserve_credits/i.test(message)) {
      throw new CreditError(
        "The V13 credit migration has not been applied yet.",
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
  const { error } = await admin.rpc("heyy_commit_credits", {
    p_reservation_id: reservationId,
    p_metadata: metadata,
  });
  if (error) throw new CreditError(error.message || "Credits could not be committed.");
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
