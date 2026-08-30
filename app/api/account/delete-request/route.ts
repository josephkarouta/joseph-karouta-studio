import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { getStripe, getSubscriptionRow } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function missingStorage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /bucket.*not found|not found|does not exist/i.test(message);
}

async function removeStorageTree(admin: SupabaseClient, bucket: string, prefix: string) {
  const paths: string[] = [];

  async function walk(path: string) {
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage.from(bucket).list(path, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        if (missingStorage(error)) return;
        throw error;
      }

      const items = data || [];
      if (!items.length) break;

      for (const item of items) {
        const child = path ? `${path}/${item.name}` : item.name;
        if (item.id) paths.push(child);
        else await walk(child);
      }

      if (items.length < 100) break;
      offset += items.length;
    }
  }

  await walk(prefix);
  for (let index = 0; index < paths.length; index += 100) {
    const chunk = paths.slice(index, index + 100);
    if (!chunk.length) continue;
    const { error } = await admin.storage.from(bucket).remove(chunk);
    if (error && !missingStorage(error)) throw error;
  }
}

async function cancelSubscriptionBeforeDeletion(admin: SupabaseClient, userId: string) {
  const row = await getSubscriptionRow(admin, userId);
  const subscriptionId = String(row?.stripe_subscription_id || "").trim();
  if (!subscriptionId) return;

  const stripe = getStripe();
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (["canceled", "incomplete_expired"].includes(subscription.status)) return;
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code || "")
        : "";
    const message = error instanceof Error ? error.message : String(error || "");
    if (code === "resource_missing" || /no such subscription/i.test(message)) return;

    console.error("Account deletion subscription cancellation failed:", error);
    // Never delete the login while a paid subscription might continue billing.
    throw new Error(
      "Your subscription could not be stopped, so the account was not deleted. Please try again or contact support.",
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = (await request.json().catch(() => ({}))) as { confirm?: boolean };
    if (body.confirm !== true) {
      return NextResponse.json(
        { error: "Confirm account deletion to continue." },
        { status: 400 },
      );
    }

    // Stop recurring billing before removing the account so a deleted user can
    // never continue being charged because of a later cleanup failure.
    await cancelSubscriptionBeforeDeletion(admin, user.id);

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
    if (deleteError) throw deleteError;

    // Database rows linked to auth.users are removed by their FK policies. User
    // files live outside those rows, so clean their storage prefixes separately.
    const buckets = ["project-assets", "architecture-files", "project-files", "profile-avatars"];
    const cleanupResults = await Promise.allSettled(
      buckets.map((bucket) => removeStorageTree(admin, bucket, user.id)),
    );
    cleanupResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Account storage cleanup failed for ${buckets[index]}:`, result.reason);
      }
    });

    return NextResponse.json({
      success: true,
      message: "Your Heyy Studio account has been deleted.",
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.startsWith("Your subscription could not be stopped")) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("Account deletion failed:", error);
    return NextResponse.json(
      { error: "Account deletion could not be completed. Please try again or contact support." },
      { status: 500 },
    );
  }
}
