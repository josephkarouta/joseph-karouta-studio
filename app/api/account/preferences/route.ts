import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  type AccountPreferences,
} from "@/lib/account/preferences";

export const dynamic = "force-dynamic";

const SELECT_FIELDS =
  "marketing_email,billing_email,production_email,in_app_production,in_app_billing,in_app_messages" as const;

function sanitise(body: Record<string, unknown>): Partial<AccountPreferences> {
  return {
    ...(typeof body.marketing_email === "boolean" ? { marketing_email: body.marketing_email } : {}),
    ...(typeof body.billing_email === "boolean" ? { billing_email: body.billing_email } : {}),
    ...(typeof body.production_email === "boolean" ? { production_email: body.production_email } : {}),
    ...(typeof body.in_app_production === "boolean" ? { in_app_production: body.in_app_production } : {}),
    ...(typeof body.in_app_billing === "boolean" ? { in_app_billing: body.in_app_billing } : {}),
    ...(typeof body.in_app_messages === "boolean" ? { in_app_messages: body.in_app_messages } : {}),
  };
}

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const { data, error } = await admin
      .from("account_preferences")
      .select(SELECT_FIELDS)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      const { data: inserted, error: insertError } = await admin
        .from("account_preferences")
        .insert({ user_id: user.id })
        .select(SELECT_FIELDS)
        .single();
      if (insertError) throw insertError;
      return NextResponse.json({ preferences: { ...DEFAULT_ACCOUNT_PREFERENCES, ...inserted } });
    }

    return NextResponse.json({ preferences: { ...DEFAULT_ACCOUNT_PREFERENCES, ...data } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load preferences." },
      { status: error instanceof ApiAuthError ? error.status : 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const changes = sanitise(body);
    if (!Object.keys(changes).length) {
      return NextResponse.json({ error: "No preference changes were provided." }, { status: 400 });
    }

    const { data, error } = await admin
      .from("account_preferences")
      .upsert({ user_id: user.id, ...changes }, { onConflict: "user_id" })
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, preferences: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save preferences." },
      { status: error instanceof ApiAuthError ? error.status : 500 },
    );
  }
}
