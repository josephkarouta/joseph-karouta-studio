import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { recordAdminAudit } from "@/lib/admin/audit";
import { buildEmail, buildPlainTextEmail } from "@/lib/notifications/templates";
import { sendTrackedEmail } from "@/lib/communications/send-email";
import { sitePath } from "@/lib/site-url";

type Row = Record<string, any>;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function studioFromDepartment(value: unknown) {
  const department = clean(value).toLowerCase();
  if (department.includes("brand")) return "brand_studio";
  if (department.includes("marketing")) return "marketing_studio";
  if (department.includes("architect")) return "architecture_studio";
  if (department.includes("interior")) return "interior_studio";
  return null;
}

function studioLabel(value: string) {
  if (value === "brand_studio") return "Brand Studio";
  if (value === "marketing_studio") return "Marketing Studio";
  if (value === "architecture_studio") return "Architecture Studio";
  if (value === "interior_studio") return "Interior Studio";
  return "Heyy Studio";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function findAuthUserIdByEmail(admin: ReturnType<typeof adminClient>, email: string) {
  const target = clean(email).toLowerCase();
  if (!target) return null;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const match = data.users.find((user) => String(user.email || "").trim().toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function notifyExistingHeyyAccount(admin: ReturnType<typeof adminClient>, input: {
  email: string;
  invitationId: string;
  activationPath: string;
  roleTitle: string;
}) {
  const userId = await findAuthUserIdByEmail(admin, input.email);
  if (!userId) return false;
  const notificationKey = `expert-invitation:${input.invitationId}`;
  const { data: existing } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .contains("metadata", { notification_key: notificationKey })
    .limit(1)
    .maybeSingle();
  if (existing) return true;
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    type: "expert.network.invitation",
    title: "Your Expert Network application was approved",
    message: `Activate your private Expert Portal${input.roleTitle ? ` for ${input.roleTitle}` : ""}.`,
    href: input.activationPath,
    metadata: { notification_key: notificationKey, expert_invitation_id: input.invitationId },
  });
  if (error) console.error("Expert invitation in-app notification failed:", error);
  return !error;
}

export async function POST(request: Request) {
  try {
    const access = await requireAdminApiCapability("careers");
    if (access.response) return access.response;

    const body = (await request.json()) as { applicationId?: string; profileId?: string };
    const applicationId = clean(body.applicationId);
    const requestedProfileId = clean(body.profileId);
    if (!applicationId && !requestedProfileId) {
      return NextResponse.json({ error: "Application or Expert profile is required." }, { status: 400 });
    }

    const admin = adminClient();
    let application: Row | null = null;
    let position: Row | null = null;
    let profile: Row | null = null;

    if (requestedProfileId) {
      const { data, error } = await admin.from("expert_profiles").select("*").eq("id", requestedProfileId).maybeSingle();
      if (error) throw error;
      profile = data as Row | null;
      if (!profile) return NextResponse.json({ error: "Expert profile not found." }, { status: 404 });
      if (profile.application_id) {
        const { data } = await admin.from("career_applications").select("*").eq("id", profile.application_id).maybeSingle();
        application = data as Row | null;
      }
    } else {
      const { data, error } = await admin.from("career_applications").select("*").eq("id", applicationId).maybeSingle();
      if (error) throw error;
      application = data as Row | null;
      if (!application) return NextResponse.json({ error: "Expert application not found." }, { status: 404 });
      if (application.status === "rejected") {
        return NextResponse.json({ error: "A rejected application must be reopened before inviting the candidate." }, { status: 409 });
      }
    }

    if (application?.position_id) {
      const { data, error } = await admin
        .from("career_positions")
        .select("id,title,department,location")
        .eq("id", application.position_id)
        .maybeSingle();
      if (error) throw error;
      position = data as Row | null;
    }

    if (!profile) {
      const email = clean(application?.email).toLowerCase();
      const fullName = clean(application?.name);
      const studio = studioFromDepartment(position?.department);
      if (!email || !fullName || !studio) {
        return NextResponse.json({ error: "The application is missing the candidate email, name or Studio." }, { status: 400 });
      }

      const profilePayload = {
        application_id: application?.id || null,
        email,
        full_name: fullName,
        studio,
        role_title: clean(position?.title) || "Heyy Studio Expert",
        location: clean(application?.location) || null,
        timezone: clean(application?.timezone) || null,
        years_experience: Number.isFinite(Number(application?.years_experience)) ? Number(application?.years_experience) : null,
        specialties: Array.isArray(application?.specialties) ? application.specialties : [],
        software_tools: Array.isArray(application?.software_tools) ? application.software_tools : [],
        languages: Array.isArray(application?.languages) ? application.languages : [],
        availability: ["available", "limited", "unavailable"].includes(clean(application?.availability)) ? clean(application?.availability) : "available",
        portfolio_url: clean(application?.portfolio_url) || null,
        linkedin_url: clean(application?.linkedin_url) || null,
        status: "inactive",
        invited_at: null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await admin
        .from("expert_profiles")
        .upsert(profilePayload, { onConflict: "application_id" })
        .select("*")
        .single();
      if (error) throw error;
      profile = data as Row;
    }

    if (profile.status === "active" && profile.user_id) {
      return NextResponse.json({ success: true, alreadyActive: true, profile });
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error: invitationError } = await admin
      .from("expert_invitations")
      .insert({
        expert_profile_id: profile.id,
        email: clean(profile.email).toLowerCase(),
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_by: access.user?.id || null,
      })
      .select("id")
      .single();
    if (invitationError) throw invitationError;

    const activationPath = `/expert/activate?token=${encodeURIComponent(rawToken)}`;
    const activationUrl = sitePath(activationPath);
    const firstName = clean(profile.full_name).split(/\s+/)[0] || "there";
    const template = {
      eyebrow: "Heyy Studio Expert Network",
      title: "Welcome to the Expert Network",
      intro: `Hi ${firstName}, your application has been approved for the Heyy Studio Expert Network. Activate your private Expert Portal to manage your availability and receive future project opportunities.`,
      status: "Approved",
      details: [
        { label: "Studio", value: studioLabel(clean(profile.studio)) },
        { label: "Expert role", value: clean(profile.role_title) || "Heyy Studio Expert" },
        { label: "Work model", value: "Freelance / project-based" },
        { label: "Invitation expires", value: new Date(expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) },
      ],
      note: "Use the same email address you applied with. After activation, you can open your Expert Portal anytime from your Heyy Studio account menu; this invitation link is only for first-time activation. Joining the Expert Network does not guarantee a minimum number of projects; every assignment is offered and agreed separately.",
      ctaLabel: "Activate Expert Portal",
      ctaUrl: activationUrl,
    };

    let emailDelivery: Awaited<ReturnType<typeof sendTrackedEmail>> | null = null;
    let emailError: unknown = null;
    try {
      emailDelivery = await sendTrackedEmail({
        eventKey: `expert.invitation:${invitation.id}`,
        to: clean(profile.email),
        templateKey: "expert.network.invitation",
        subject: "You’re approved for the Heyy Studio Expert Network",
        html: buildEmail(template),
        text: buildPlainTextEmail(template),
        relatedType: "expert_profile",
        relatedId: String(profile.id),
        metadata: { expert_profile_id: profile.id, application_id: application?.id || null },
      });
    } catch (error) {
      emailError = error;
      console.error("Expert invitation email failed:", error);
    }

    // Email and in-app delivery are independent. Existing Heyy accounts get an
    // activation notification even if the email provider has a temporary issue.
    const inAppDelivered = await notifyExistingHeyyAccount(admin, {
      email: clean(profile.email),
      invitationId: String(invitation.id),
      activationPath,
      roleTitle: clean(profile.role_title),
    });

    const emailAccepted = Boolean(emailDelivery?.sent || emailDelivery?.duplicate);
    if (!emailAccepted && !inAppDelivered) {
      throw emailError instanceof Error
        ? emailError
        : new Error("The Expert invitation could not be delivered by email or in-app notification.");
    }

    const now = new Date().toISOString();
    const { error: profileUpdateError } = await admin
      .from("expert_profiles")
      .update({ status: "invited", invited_at: now, updated_at: now })
      .eq("id", profile.id);
    if (profileUpdateError) throw profileUpdateError;

    if (application?.id) {
      const { error: applicationUpdateError } = await admin
        .from("career_applications")
        .update({ status: "approved" })
        .eq("id", application.id);
      if (applicationUpdateError) throw applicationUpdateError;
    }

    await recordAdminAudit({
      actorUserId: access.user?.id || null,
      action: "expert.invitation.sent",
      entityType: "expert_profile",
      entityId: String(profile.id),
      summary: `Invited ${clean(profile.full_name)} to the Expert Network`,
      metadata: { applicationId: application?.id || null, invitationId: invitation.id },
    });

    return NextResponse.json({
      success: true,
      profile: { ...profile, status: "invited", invited_at: now },
      emailDelivery: {
        accepted: emailAccepted,
        duplicate: Boolean(emailDelivery?.duplicate),
        providerMessageId: emailDelivery?.id || null,
        error: emailAccepted ? null : (emailError instanceof Error ? emailError.message : String(emailError || "Email was not accepted for delivery.")),
      },
      inAppDelivered,
      activationUrl,
    });
  } catch (error) {
    console.error("Expert invitation failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Expert invitation could not be sent." }, { status: 500 });
  }
}
