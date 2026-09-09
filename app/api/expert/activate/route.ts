import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = (await request.json()) as { token?: string };
    const token = String(body.token || "").trim();
    if (!token) return NextResponse.json({ error: "Invitation token is required." }, { status: 400 });

    const { data: invitation, error: invitationError } = await admin
      .from("expert_invitations")
      .select("*")
      .eq("token_hash", hashToken(token))
      .maybeSingle();
    if (invitationError) throw invitationError;
    if (!invitation) return NextResponse.json({ error: "This Expert invitation is invalid or has already been replaced." }, { status: 404 });

    const userEmail = String(user.email || "").trim().toLowerCase();
    const invitedEmail = String(invitation.email || "").trim().toLowerCase();
    if (!userEmail || userEmail !== invitedEmail) {
      return NextResponse.json({ error: `Sign in with ${invitedEmail} to access this Expert profile.` }, { status: 403 });
    }

    const { data: existingProfile, error: profileError } = await admin
      .from("expert_profiles")
      .select("*")
      .eq("id", invitation.expert_profile_id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!existingProfile) return NextResponse.json({ error: "Expert profile not found." }, { status: 404 });
    if (existingProfile.user_id && String(existingProfile.user_id) !== user.id) {
      return NextResponse.json({ error: "This Expert profile is already linked to another account." }, { status: 409 });
    }

    if (invitation.accepted_at) {
      if (String(existingProfile.user_id || "") === user.id && ["active", "paused"].includes(String(existingProfile.status || ""))) {
        return NextResponse.json({
          success: true,
          alreadyActive: true,
          profile: { id: existingProfile.id, fullName: existingProfile.full_name, studio: existingProfile.studio },
        });
      }
      return NextResponse.json({ error: "This Expert invitation has already been used. Sign in with the approved Expert account and open the Expert Portal from your account menu." }, { status: 409 });
    }

    if (new Date(String(invitation.expires_at)).getTime() <= Date.now()) {
      return NextResponse.json({ error: "This Expert invitation has expired. Ask Heyy Studio to resend it." }, { status: 410 });
    }

    const now = new Date().toISOString();
    const { data: profile, error: updateError } = await admin
      .from("expert_profiles")
      .update({ user_id: user.id, status: "active", activated_at: existingProfile.activated_at || now, updated_at: now })
      .eq("id", existingProfile.id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    await admin.from("expert_invitations").update({ accepted_at: now }).eq("id", invitation.id);

    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(user.id);
    if (!authError && authUser.user) {
      const metadata = { ...(authUser.user.app_metadata || {}) } as Record<string, unknown>;
      const roles = Array.isArray(metadata.roles) ? metadata.roles.map(String) : [];
      if (!roles.some((role) => role.toLowerCase() === "expert")) roles.push("expert");
      metadata.roles = roles;
      metadata.expert_profile_id = profile.id;
      await admin.auth.admin.updateUserById(user.id, { app_metadata: metadata });
    }

    return NextResponse.json({ success: true, profile: { id: profile.id, fullName: profile.full_name, studio: profile.studio } });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Expert activation failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Expert profile could not be activated." }, { status: 500 });
  }
}
