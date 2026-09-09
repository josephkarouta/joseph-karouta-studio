import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

function safeProfile(row: Record<string, any>) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    studio: row.studio,
    roleTitle: row.role_title,
    location: row.location,
    timezone: row.timezone,
    yearsExperience: row.years_experience,
    specialties: row.specialties || [],
    softwareTools: row.software_tools || [],
    languages: row.languages || [],
    availability: row.availability,
    portfolioUrl: row.portfolio_url,
    linkedinUrl: row.linkedin_url,
    status: row.status,
    payoutMethod: row.payout_method || null,
    payoutDetailsText: typeof row.payout_details?.details === "string" ? row.payout_details.details : "",
    invitedAt: row.invited_at,
    activatedAt: row.activated_at,
  };
}

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const { data, error } = await admin.from("expert_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "No active Expert profile is linked to this account." }, { status: 404 });
    return NextResponse.json({ profile: safeProfile(data) });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Expert profile could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = (await request.json()) as Record<string, unknown>;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (Object.prototype.hasOwnProperty.call(body, "availability")) {
      const availability = String(body.availability || "").trim();
      if (!["available", "limited", "unavailable"].includes(availability)) {
        return NextResponse.json({ error: "Choose a valid availability status." }, { status: 400 });
      }
      update.availability = availability;
    }

    if (Object.prototype.hasOwnProperty.call(body, "payoutMethod") || Object.prototype.hasOwnProperty.call(body, "payoutDetailsText")) {
      const payoutMethod = String(body.payoutMethod || "").trim();
      const payoutDetailsText = String(body.payoutDetailsText || "").trim().slice(0, 4000);
      if (payoutMethod && !["bank_transfer", "wise", "paypal", "other"].includes(payoutMethod)) {
        return NextResponse.json({ error: "Choose a valid payout method." }, { status: 400 });
      }
      update.payout_method = payoutMethod || null;
      update.payout_details = payoutDetailsText ? { details: payoutDetailsText } : {};
    }

    if (Object.keys(update).length === 1) {
      return NextResponse.json({ error: "No Expert profile changes were provided." }, { status: 400 });
    }

    const { data, error } = await admin
      .from("expert_profiles")
      .update(update)
      .eq("user_id", user.id)
      .eq("status", "active")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Active Expert profile not found." }, { status: 404 });
    return NextResponse.json({ success: true, profile: safeProfile(data) });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Expert profile could not be updated." }, { status: 500 });
  }
}
