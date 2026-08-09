import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = (await request.json().catch(() => ({}))) as { confirmation?: string; reason?: string };
    if (String(body.confirmation || "").trim() !== "DELETE MY ACCOUNT") {
      return NextResponse.json(
        { error: "Type DELETE MY ACCOUNT to confirm the deletion request." },
        { status: 400 },
      );
    }

    const { data: existing, error: existingError } = await admin
      .from("account_data_requests")
      .select("id,status,requested_at")
      .eq("user_id", user.id)
      .eq("request_type", "deletion")
      .in("status", ["requested", "processing"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return NextResponse.json({ success: true, request: existing, alreadyRequested: true });

    const { data, error } = await admin
      .from("account_data_requests")
      .insert({
        user_id: user.id,
        request_type: "deletion",
        status: "requested",
        metadata: {
          email: user.email || null,
          reason: String(body.reason || "").trim().slice(0, 1000) || null,
          requested_from: "account_privacy_controls",
        },
      })
      .select("id,status,requested_at")
      .single();
    if (error) throw error;

    return NextResponse.json({
      success: true,
      request: data,
      message:
        "Your account deletion request has been recorded. Paid transaction and completed production records may be retained where required for accounting, fraud prevention or legal obligations, while personal workspace data will be handled through the deletion process.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Account deletion could not be requested." },
      { status: error instanceof ApiAuthError ? error.status : 500 },
    );
  }
}
