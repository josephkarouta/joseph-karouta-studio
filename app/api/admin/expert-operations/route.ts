import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { recordAdminAudit } from "@/lib/admin/audit";
import { Notifications } from "@/lib/notifications";
import { createProductionMessage, loadProductionMessages } from "@/lib/production/messages";
import { notifyExpertOperationalEvent } from "@/lib/expert-network/operational-notifications";
import { ensurePreferredExpertAssignmentForPaidQuote } from "@/lib/payments/process-quote-payment";
import { buildExpertPayoutStatementPdf } from "@/lib/payments/expert-payout-statement";
import { loadExpertPayoutStatementData } from "@/lib/payments/load-expert-payout-statement";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function text(value: unknown, max = 10000) {
  return String(value || "").trim().slice(0, max);
}


function prettyStatusForAudit(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function studioForJob(job: Record<string, any>) {
  return text(job.assigned_studio || job.studio, 100);
}

async function resolveClientIdentity(supabase: SupabaseClient, job: Record<string, any>) {
  let email = text(job.client_email, 500) || null;
  let name = text(job.client_name, 300) || null;

  if (job.user_id && (!email || !name)) {
    try {
      const { data, error } = await supabase.auth.admin.getUserById(String(job.user_id));
      if (!error && data.user) {
        email = email || data.user.email || null;
        name = name || text(data.user.user_metadata?.full_name || data.user.user_metadata?.name, 300) || null;
      }
    } catch (error) {
      console.warn("Could not resolve production client identity for notification:", error);
    }
  }

  return { email, name };
}

function buildSharedScope(job: Record<string, any>, sharedBrief?: string) {
  const metadata = asRecord(job.metadata);
  const application = asRecord(metadata.selected_application);
  const brief =
    text(sharedBrief, 12000) ||
    text(application.description, 12000) ||
    text(metadata.description, 12000) ||
    "No additional production brief was attached.";

  return {
    projectName: text(job.project_name, 300) || "Untitled Project",
    service: text(job.service, 300) || "Production",
    studio: studioForJob(job),
    brief,
    previewImage: text(job.preview_image, 3000) || null,
    requestedDeadline:
      text(metadata.deadline, 120) || text(metadata.due_date, 120) || null,
  };
}

async function signedSubmissionRows(supabase: SupabaseClient, rows: any[]) {
  return Promise.all(
    rows.map(async (row) => {
      let downloadUrl: string | null = null;
      if (row.storage_path) {
        const { data } = await supabase.storage
          .from("production-files")
          .createSignedUrl(row.storage_path, 60 * 60);
        downloadUrl = data?.signedUrl || null;
      }
      return { ...row, download_url: downloadUrl };
    }),
  );
}

async function loadPayload(supabase: SupabaseClient, jobId: string) {
  const { data: job, error: jobError } = await supabase
    .from("production_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job) throw new Error("Production job not found.");

  const studio = studioForJob(job);
  let expertQuery = supabase
    .from("expert_profiles")
    .select("id,user_id,full_name,email,studio,role_title,location,timezone,years_experience,specialties,software_tools,languages,availability,status,portfolio_url,linkedin_url,payout_method,payout_details")
    .eq("status", "active")
    .order("full_name", { ascending: true })
    .limit(500);
  if (studio) expertQuery = expertQuery.eq("studio", studio);

  const [expertsResult, opportunitiesResult, assignmentResult] = await Promise.all([
    expertQuery,
    supabase
      .from("expert_opportunities")
      .select("*")
      .eq("production_job_id", jobId)
      .order("created_at", { ascending: false }),
    supabase
      .from("expert_assignments")
      .select("*")
      .eq("production_job_id", jobId)
      .maybeSingle(),
  ]);

  if (expertsResult.error) throw expertsResult.error;
  if (opportunitiesResult.error) throw opportunitiesResult.error;
  if (assignmentResult.error) throw assignmentResult.error;

  const profiles = new Map<string, any>();
  for (const expert of expertsResult.data || []) profiles.set(expert.id, expert);

  const opportunityProfileIds: string[] = Array.from(
    new Set<string>(
      (opportunitiesResult.data || [])
        .map((item: any) => String(item.expert_profile_id || ""))
        .filter(Boolean),
    ),
  );
  const assignmentProfileId = assignmentResult.data?.expert_profile_id;
  if (assignmentProfileId) opportunityProfileIds.push(assignmentProfileId);

  if (opportunityProfileIds.length > 0) {
    const missingIds = Array.from(new Set(opportunityProfileIds)).filter((id) => !profiles.has(id));
    if (missingIds.length > 0) {
      const { data: historicalProfiles, error } = await supabase
        .from("expert_profiles")
        .select("id,user_id,full_name,email,studio,role_title,location,timezone,years_experience,specialties,software_tools,languages,availability,status,portfolio_url,linkedin_url,payout_method,payout_details")
        .in("id", missingIds);
      if (error) throw error;
      for (const expert of historicalProfiles || []) profiles.set(expert.id, expert);
    }
  }

  const opportunities = (opportunitiesResult.data || []).map((item: any) => ({
    ...item,
    expert: profiles.get(item.expert_profile_id) || null,
  }));

  let assignment: any = assignmentResult.data || null;
  let messages: any[] = [];
  let submissions: any[] = [];

  if (assignment) {
    const assignmentExpert = profiles.get(assignment.expert_profile_id) || null;
    let payoutProofUrl: string | null = null;
    if (assignment.payout_proof_path) {
      const { data: proofData } = await supabase.storage
        .from("expert-payout-proofs")
        .createSignedUrl(assignment.payout_proof_path, 60 * 60);
      payoutProofUrl = proofData?.signedUrl || null;
    }
    assignment = {
      ...assignment,
      expert: assignmentExpert,
      client_payment_state: job.delivery_status || null,
      payout_proof_url: payoutProofUrl,
    };

    const [messagesResult, submissionsResult] = await Promise.all([
      supabase
        .from("expert_project_messages")
        .select("*")
        .eq("assignment_id", assignment.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("expert_submissions")
        .select("*")
        .eq("assignment_id", assignment.id)
        .order("submitted_at", { ascending: false }),
    ]);
    if (messagesResult.error) throw messagesResult.error;
    if (submissionsResult.error) throw submissionsResult.error;
    messages = messagesResult.data || [];
    submissions = await signedSubmissionRows(supabase, submissionsResult.data || []);

    await supabase
      .from("expert_project_messages")
      .update({ read_by_admin_at: new Date().toISOString() })
      .eq("assignment_id", assignment.id)
      .eq("sender_type", "expert")
      .is("read_by_admin_at", null);
  }

  const { data: activeRevision, error: activeRevisionError } = await supabase
    .from("workspace_revisions")
    .select("id,revision_number,status,message,expert_client_message,expert_show_client_message,admin_response,target_files,forwarded_to_expert_at,client_message_id")
    .eq("production_job_id", jobId)
    .in("status", ["Requested", "In Progress"])
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeRevisionError) throw activeRevisionError;

  const { data: addons, error: addonsError } = await supabase
    .from("production_addons")
    .select("*")
    .eq("production_job_id", jobId)
    .order("created_at", { ascending: false });
  if (addonsError) throw addonsError;

  // Reconcile paid extra-revision communication for payments that completed
  // before the Expert-fee notification fan-out existed. The operational key
  // is the same as the payment webhook, so this remains idempotent.
  if (assignment?.expert && (addons || []).some((addon: any) => addon.kind === "extra_revision" && addon.status === "paid")) {
    const paidExtraRevisions = (addons || []).filter((addon: any) => addon.kind === "extra_revision" && addon.status === "paid");
    await Promise.allSettled(paidExtraRevisions.map((addon: any) => notifyExpertOperationalEvent(supabase, {
      key: `production-addon-paid-expert:${addon.id}`,
      type: "expert.project.extra_revision.paid",
      expertUserId: assignment.expert.user_id || null,
      expertEmail: assignment.expert.email || null,
      expertName: assignment.expert.full_name || "Expert",
      projectName: job.project_name || null,
      service: job.service || null,
      studio: job.studio || job.assigned_studio || null,
      title: "Client purchased an additional revision",
      message: Number(addon.expert_cost_cents || 0) > 0
        ? `The client purchased one additional revision round. Your additional Expert fee of ${new Intl.NumberFormat("en-US", { style: "currency", currency: addon.currency || assignment.currency || "USD" }).format(Number(addon.expert_cost_cents || 0) / 100)} has been added to this project's payout total.`
        : "The client purchased one additional revision round for this project. Heyy Studio will include the additional work in payout tracking.",
      status: "Additional revision paid",
      href: `/expert?section=projects&assignment=${encodeURIComponent(assignment.id)}&panel=revisions`,
    })));
  }

  let activeRevisionWithMessage: any = activeRevision || null;
  if (activeRevision?.client_message_id) {
    try {
      const productionMessages = await loadProductionMessages(supabase, jobId);
      const clientMessage = productionMessages.find((item: any) => item.id === activeRevision.client_message_id) || null;
      activeRevisionWithMessage = { ...activeRevision, client_message: clientMessage };
    } catch (messageError) {
      console.warn("Could not load client revision attachments for Admin:", messageError);
    }
  }

  return {
    job: {
      id: job.id,
      projectName: job.project_name,
      studio: job.studio,
      assignedStudio: job.assigned_studio,
      service: job.service,
      status: job.status,
      deliveryStatus: job.delivery_status,
      sharedScope: assignment?.shared_scope || opportunities[0]?.shared_scope || buildSharedScope(job),
    },
    experts: expertsResult.data || [],
    opportunities,
    assignment,
    messages,
    submissions,
    activeRevision: activeRevisionWithMessage,
    addons: addons || [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireAdminApiCapability("operations");
    if (access.response) return access.response;

    const jobId = text(request.nextUrl.searchParams.get("jobId"), 200);
    if (!jobId) return NextResponse.json({ error: "Production job is required." }, { status: 400 });

    const supabase = adminClient();
    const { data: job } = await supabase
      .from("production_jobs")
      .select("id,payment_quote_id,metadata")
      .eq("id", jobId)
      .limit(1)
      .maybeSingle();
    const quoteId = text(job?.payment_quote_id || job?.metadata?.quote_id, 200);
    if (quoteId) {
      try {
        await ensurePreferredExpertAssignmentForPaidQuote(quoteId);
      } catch (repairError) {
        console.error("Paid Expert assignment self-repair failed:", repairError);
      }
    }

    return NextResponse.json({ success: true, ...(await loadPayload(supabase, jobId)) });
  } catch (error) {
    console.error("Load Expert Operations error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Expert Operations could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAdminApiCapability("operations");
    if (access.response) return access.response;

    const supabase = adminClient();
    const body = (await request.json()) as Record<string, unknown>;
    const action = text(body.action, 80);
    const jobId = text(body.jobId, 200);
    if (!action || !jobId) return NextResponse.json({ error: "Action and production job are required." }, { status: 400 });

    const { data: job, error: jobError } = await supabase
      .from("production_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return NextResponse.json({ error: "Production job not found." }, { status: 404 });

    if (action === "request_quotes") {
      const expertIds = Array.isArray(body.expertIds)
        ? Array.from(new Set(body.expertIds.map((value) => text(value, 100)).filter(Boolean)))
        : [];
      if (expertIds.length === 0) return NextResponse.json({ error: "Select at least one Expert." }, { status: 400 });
      if (expertIds.length > 20) return NextResponse.json({ error: "Request quotes from no more than 20 Experts at a time." }, { status: 400 });

      const { data: existingAssignment } = await supabase
        .from("expert_assignments")
        .select("id")
        .eq("production_job_id", jobId)
        .maybeSingle();
      if (existingAssignment) return NextResponse.json({ error: "This production job already has an assigned Expert." }, { status: 409 });

      const { data: experts, error: expertError } = await supabase
        .from("expert_profiles")
        .select("id,studio,status,availability")
        .in("id", expertIds);
      if (expertError) throw expertError;

      const studio = studioForJob(job);
      const allowed = (experts || []).filter(
        (expert: any) => expert.status === "active" && expert.availability !== "unavailable" && (!studio || expert.studio === studio),
      );
      if (allowed.length !== expertIds.length) {
        return NextResponse.json({ error: "One or more selected Experts are unavailable, inactive, or do not match this Studio." }, { status: 400 });
      }

      const sharedScope = buildSharedScope(job, text(body.sharedBrief, 12000));
      const now = new Date().toISOString();
      const rows = allowed.map((expert: any) => ({
        production_job_id: jobId,
        expert_profile_id: expert.id,
        status: "requested",
        shared_scope: sharedScope,
        requested_by: access.user?.id || null,
        requested_at: now,
        quoted_fee_cents: null,
        turnaround_days: null,
        included_revisions: null,
        expert_notes: null,
        quoted_at: null,
        responded_at: null,
        closed_at: null,
        updated_at: now,
      }));

      const { error: upsertError } = await supabase
        .from("expert_opportunities")
        .upsert(rows, { onConflict: "production_job_id,expert_profile_id" });
      if (upsertError) throw upsertError;

      await recordAdminAudit({
        actorUserId: access.user?.id || null,
        action: "expert.quotes.requested",
        entityType: "production_job",
        entityId: jobId,
        summary: `Requested Expert quotes for ${job.project_name || job.service || jobId}`,
        metadata: { expertIds },
      });
    } else if (action === "select_quote") {
      const opportunityId = text(body.opportunityId, 100);
      if (!opportunityId) return NextResponse.json({ error: "Expert quote is required." }, { status: 400 });

      const { data: opportunity, error } = await supabase
        .from("expert_opportunities")
        .select("*")
        .eq("id", opportunityId)
        .eq("production_job_id", jobId)
        .maybeSingle();
      if (error) throw error;
      if (!opportunity || opportunity.status !== "quoted" || opportunity.quoted_fee_cents === null) {
        return NextResponse.json({ error: "Choose a submitted Expert quote." }, { status: 400 });
      }

      const { data: existingAssignment, error: existingError } = await supabase
        .from("expert_assignments")
        .select("id")
        .eq("production_job_id", jobId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existingAssignment) return NextResponse.json({ error: "This production job already has an Expert assignment." }, { status: 409 });

      const now = new Date();
      const dueAt = opportunity.turnaround_days
        ? new Date(now.getTime() + Number(opportunity.turnaround_days) * 86_400_000).toISOString()
        : null;

      const { data: assignment, error: assignmentError } = await supabase
        .from("expert_assignments")
        .insert({
          production_job_id: jobId,
          opportunity_id: opportunity.id,
          expert_profile_id: opportunity.expert_profile_id,
          status: "assigned",
          shared_scope: opportunity.shared_scope || buildSharedScope(job),
          agreed_fee_cents: opportunity.quoted_fee_cents,
          currency: opportunity.currency || "USD",
          turnaround_days: opportunity.turnaround_days,
          included_revisions: opportunity.included_revisions,
          assigned_by: access.user?.id || null,
          assigned_at: now.toISOString(),
          due_at: dueAt,
          payout_status: "pending",
          updated_at: now.toISOString(),
        })
        .select("*")
        .single();
      if (assignmentError) throw assignmentError;

      const { error: selectedError } = await supabase
        .from("expert_opportunities")
        .update({ status: "selected", closed_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("id", opportunity.id);
      if (selectedError) throw selectedError;

      const { error: closedError } = await supabase
        .from("expert_opportunities")
        .update({ status: "closed", closed_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("production_job_id", jobId)
        .neq("id", opportunity.id)
        .in("status", ["requested", "quoted"]);
      if (closedError) throw closedError;

      await supabase
        .from("production_jobs")
        .update({ status: "Assigned", updated_at: now.toISOString() })
        .eq("id", jobId);

      await recordAdminAudit({
        actorUserId: access.user?.id || null,
        action: "expert.assignment.created",
        entityType: "expert_assignment",
        entityId: assignment.id,
        summary: `Assigned an Expert to ${job.project_name || job.service || jobId}`,
        metadata: { productionJobId: jobId, expertProfileId: opportunity.expert_profile_id },
      });
    } else if (action === "request_additional_scope_quote") {
      const description = text(body.description, 12000);
      const title = text(body.title, 300) || "Additional project scope";
      if (!description) return NextResponse.json({ error: "Describe the additional work before asking the Expert to quote." }, { status: 400 });
      if (job.client_approved_at) return NextResponse.json({ error: "This production job is already complete. Start a new production request for new work." }, { status: 409 });

      const { data: assignment, error: assignmentError } = await supabase
        .from("expert_assignments")
        .select("id,expert_profile_id,status,currency")
        .eq("production_job_id", jobId)
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment || assignment.status === "cancelled") return NextResponse.json({ error: "An active Expert assignment is required before adding scope." }, { status: 409 });

      const now = new Date().toISOString();
      const { data: addon, error: addonError } = await supabase
        .from("production_addons")
        .insert({
          production_job_id: jobId,
          user_id: job.user_id || null,
          kind: "additional_scope",
          status: "awaiting_expert_quote",
          title,
          description,
          currency: assignment.currency || "USD",
          created_by: access.user?.id || null,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();
      if (addonError || !addon) throw addonError || new Error("Additional scope request could not be created.");

      const { data: expertProfile } = await supabase
        .from("expert_profiles")
        .select("user_id,email,full_name")
        .eq("id", assignment.expert_profile_id)
        .maybeSingle();
      if (expertProfile) {
        await notifyExpertOperationalEvent(supabase, {
          key: `additional-scope-quote-request:${addon.id}`,
          type: "expert.project.additional_scope.quote_requested",
          expertUserId: expertProfile.user_id,
          expertEmail: expertProfile.email,
          expertName: expertProfile.full_name,
          projectName: job.project_name,
          service: job.service,
          studio: job.studio,
          title: "Heyy Studio requested a quote for additional scope",
          message: description,
          status: "Quote requested",
          href: `/expert?section=projects&assignment=${encodeURIComponent(assignment.id)}&panel=overview`,
        });
      }

      await supabase.from("expert_project_messages").insert({
        assignment_id: assignment.id,
        sender_type: "admin",
        sender_user_id: access.user?.id || null,
        body: `Additional scope quote requested\n\n${description}`,
        read_by_admin_at: now,
      });

      await recordAdminAudit({
        actorUserId: access.user?.id || null,
        action: "production.additional_scope.quote_requested",
        entityType: "production_addon",
        entityId: addon.id,
        summary: `Requested an additional-scope quote for ${job.project_name || jobId}`,
        metadata: { productionJobId: jobId },
      });
    } else if (action === "send_additional_scope_to_client") {
      const addonId = text(body.addonId, 100);
      const clientAmountCents = Number(body.clientAmountCents);
      const clientDescription = text(body.clientDescription, 12000);
      if (!addonId) return NextResponse.json({ error: "Additional scope request is required." }, { status: 400 });
      if (!Number.isInteger(clientAmountCents) || clientAmountCents <= 0 || clientAmountCents > 100_000_000) {
        return NextResponse.json({ error: "Enter a valid client price for the additional scope." }, { status: 400 });
      }

      const { data: addon, error: addonError } = await supabase
        .from("production_addons")
        .select("*")
        .eq("id", addonId)
        .eq("production_job_id", jobId)
        .eq("kind", "additional_scope")
        .maybeSingle();
      if (addonError) throw addonError;
      if (!addon) return NextResponse.json({ error: "Additional scope request not found." }, { status: 404 });
      if (addon.status !== "expert_quoted" && addon.status !== "sent") {
        return NextResponse.json({ error: "Wait for the Expert quote before sending the additional scope to the client." }, { status: 409 });
      }

      const now = new Date().toISOString();
      const description = clientDescription || text(addon.description, 12000);
      const { error: updateError } = await supabase
        .from("production_addons")
        .update({
          status: "sent",
          client_amount_cents: clientAmountCents,
          description,
          sent_to_client_at: now,
          updated_at: now,
        })
        .eq("id", addon.id);
      if (updateError) throw updateError;

      const client = await resolveClientIdentity(supabase, job);
      await Notifications.emit({
        event: "production.addon.ready",
        projectId: job.project_id,
        projectName: job.project_name,
        service: job.service,
        studio: job.studio,
        userId: job.user_id,
        clientName: client.name,
        clientEmail: client.email,
        metadata: {
          productionJobId: job.id,
          productionView: "review",
          addonId: addon.id,
          addonKind: "additional_scope",
          addonTitle: addon.title,
          addonDescription: description,
          amount: clientAmountCents / 100,
          currency: addon.currency || "USD",
        },
      });

      await recordAdminAudit({
        actorUserId: access.user?.id || null,
        action: "production.additional_scope.sent_to_client",
        entityType: "production_addon",
        entityId: addon.id,
        summary: `Sent additional scope to the client for ${job.project_name || jobId}`,
        metadata: { productionJobId: jobId, clientAmountCents },
      });
    } else if (action === "cancel_additional_scope") {
      const addonId = text(body.addonId, 100);
      if (!addonId) return NextResponse.json({ error: "Additional scope request is required." }, { status: 400 });
      const { error: cancelError } = await supabase
        .from("production_addons")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", addonId)
        .eq("production_job_id", jobId)
        .eq("kind", "additional_scope")
        .neq("status", "paid");
      if (cancelError) throw cancelError;
    } else if (action === "send_message") {
      const assignmentId = text(body.assignmentId, 100);
      const message = text(body.message, 10000);
      if (!assignmentId || !message) return NextResponse.json({ error: "Assignment and message are required." }, { status: 400 });

      const { data: assignment, error } = await supabase
        .from("expert_assignments")
        .select("id,expert_profile_id")
        .eq("id", assignmentId)
        .eq("production_job_id", jobId)
        .maybeSingle();
      if (error) throw error;
      if (!assignment) return NextResponse.json({ error: "Expert assignment not found." }, { status: 404 });

      const { error: insertError } = await supabase.from("expert_project_messages").insert({
        assignment_id: assignmentId,
        sender_type: "admin",
        sender_user_id: access.user?.id || null,
        body: message,
        read_by_admin_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      const { data: expertProfile } = await supabase
        .from("expert_profiles")
        .select("user_id,email,full_name")
        .eq("id", assignment.expert_profile_id)
        .maybeSingle();
      if (expertProfile) {
        await notifyExpertOperationalEvent(supabase, {
          key: `expert-admin-message:${assignmentId}:${Date.now()}`,
          type: "expert.project.message",
          expertUserId: expertProfile.user_id,
          expertEmail: expertProfile.email,
          expertName: expertProfile.full_name,
          projectName: job.project_name,
          service: job.service,
          studio: job.studio,
          title: "New message from Heyy Studio",
          message,
          status: "New message",
          href: `/expert?section=projects&assignment=${encodeURIComponent(assignmentId)}&panel=messages`,
        });
      }
    } else if (action === "forward_revision") {
      const assignmentId = text(body.assignmentId, 100);
      const revisionId = text(body.revisionId, 100);
      const adminInstructions = text(body.adminInstructions, 5000);
      const shareClientMessage = body.shareClientMessage !== false;
      const clientMessageForExpert = text(body.clientMessageForExpert, 10000);
      if (!assignmentId || !revisionId) return NextResponse.json({ error: "Assignment and revision are required." }, { status: 400 });
      if (!adminInstructions) return NextResponse.json({ error: "Add Heyy Studio instructions before forwarding this revision to the Expert." }, { status: 400 });
      if (shareClientMessage && !clientMessageForExpert) return NextResponse.json({ error: "Edit the client request or switch off sharing before forwarding." }, { status: 400 });

      const { data: assignment, error: assignmentError } = await supabase
        .from("expert_assignments")
        .select("id,expert_profile_id")
        .eq("id", assignmentId)
        .eq("production_job_id", jobId)
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return NextResponse.json({ error: "Expert assignment not found." }, { status: 404 });

      const { data: revision, error: revisionError } = await supabase
        .from("workspace_revisions")
        .select("id,revision_number,message,expert_client_message,expert_show_client_message,target_files,forwarded_to_expert_at,client_message_id")
        .eq("id", revisionId)
        .eq("production_job_id", jobId)
        .maybeSingle();
      if (revisionError) throw revisionError;
      if (!revision) return NextResponse.json({ error: "Client revision not found." }, { status: 404 });

      let revisionAttachmentNames: string[] = [];
      if (revision.client_message_id) {
        const { data: attachmentRows } = await supabase
          .from("production_message_attachments")
          .select("filename")
          .eq("message_id", revision.client_message_id);
        revisionAttachmentNames = (attachmentRows || []).map((item: any) => text(item.filename, 300)).filter(Boolean);
      }

      const targets = Array.isArray(revision.target_files) ? revision.target_files : [];
      const fileLine = targets.length
        ? `\n\nFiles in this revision round:\n${targets.map((item: any) => `• ${text(item?.filename, 300) || "Production file"}`).join("\n")}`
        : "";
      const sharedClientBlock = shareClientMessage
        ? `\n\nClient request shared by Heyy Studio:\n${clientMessageForExpert}`
        : "";
      const revisionMessage = `Client Revision #${revision.revision_number}${sharedClientBlock}\n\nHeyy Studio instructions:\n${adminInstructions}${fileLine}`;
      const now = new Date().toISOString();

      const { data: existingMessage } = await supabase
        .from("expert_project_messages")
        .select("id")
        .eq("assignment_id", assignment.id)
        .eq("body", revisionMessage)
        .limit(1)
        .maybeSingle();
      if (!existingMessage) {
        const { error: messageError } = await supabase.from("expert_project_messages").insert({
          assignment_id: assignment.id,
          sender_type: "admin",
          sender_user_id: access.user?.id || null,
          body: revisionMessage,
          read_by_admin_at: now,
        });
        if (messageError) throw messageError;
      }

      const { error: revisionUpdateError } = await supabase
        .from("workspace_revisions")
        .update({
          admin_response: adminInstructions,
          expert_client_message: shareClientMessage ? clientMessageForExpert : null,
          expert_show_client_message: shareClientMessage,
          forwarded_to_expert_at: now,
          forwarded_to_expert_by: access.user?.id || null,
          status: "In Progress",
          updated_at: now,
        })
        .eq("id", revision.id);
      if (revisionUpdateError) throw revisionUpdateError;

      const { data: expertProfile } = await supabase
        .from("expert_profiles")
        .select("user_id,email,full_name")
        .eq("id", assignment.expert_profile_id)
        .maybeSingle();
      if (expertProfile) {
        await notifyExpertOperationalEvent(supabase, {
          key: `expert-client-revision:${revision.id}`,
          type: "expert.project.revision",
          expertUserId: expertProfile.user_id,
          expertEmail: expertProfile.email,
          expertName: expertProfile.full_name,
          projectName: job.project_name,
          service: job.service,
          studio: job.studio,
          title: `Revision #${revision.revision_number} needs your update`,
          message: adminInstructions,
          status: "Revision in progress",
          details: [
            ...(targets.length ? [{ label: "Files to revise", value: targets.map((item: any) => text(item?.filename, 300)).filter(Boolean).join(", ") }] : []),
            ...(revisionAttachmentNames.length ? [{ label: "Client attachments", value: revisionAttachmentNames.join(", ") }] : []),
          ],
          href: `/expert?section=projects&assignment=${encodeURIComponent(assignment.id)}&panel=revisions`,
        });
      }
    } else if (action === "review_batch") {
      const batchId = text(body.batchId, 100);
      const status = text(body.status, 80);
      const adminNotes = text(body.adminNotes, 5000) || null;
      const requestedSubmissionIds = Array.isArray(body.submissionIds)
        ? Array.from(new Set(body.submissionIds.map((value) => text(value, 100)).filter(Boolean)))
        : [];
      if (!batchId || !["changes_requested", "approved", "rejected"].includes(status)) {
        return NextResponse.json({ error: "Choose a valid review package action." }, { status: 400 });
      }

      const { data: batchRows, error: batchError } = await supabase
        .from("expert_submissions")
        .select("id,assignment_id,status,filename")
        .eq("production_job_id", jobId)
        .eq("batch_id", batchId);
      if (batchError) throw batchError;
      if (!batchRows?.length) return NextResponse.json({ error: "Expert review package not found." }, { status: 404 });

      const selectedRows = requestedSubmissionIds.length
        ? batchRows.filter((row: any) => requestedSubmissionIds.includes(String(row.id)))
        : batchRows.filter((row: any) => row.status !== "published");
      if (!selectedRows.length) {
        return NextResponse.json({ error: "Select at least one Expert file for this review action." }, { status: 400 });
      }
      if (selectedRows.some((row: any) => row.status === "published")) {
        return NextResponse.json({ error: "Files already sent to the client cannot be changed from the Expert review history." }, { status: 409 });
      }

      const now = new Date().toISOString();
      const selectedIds = selectedRows.map((row: any) => row.id);
      const assignmentId = selectedRows[0].assignment_id;

      if (status === "changes_requested") {
        const { error: selectedUpdateError } = await supabase
          .from("expert_submissions")
          .update({ status: "changes_requested", admin_notes: adminNotes, reviewed_at: now, updated_at: now })
          .in("id", selectedIds);
        if (selectedUpdateError) throw selectedUpdateError;

        // Files from the same Expert package that were reviewed but were not
        // selected for changes are approved and remain available for the later
        // client-package builder.
        const approvedIds = batchRows
          .filter((row: any) => !selectedIds.includes(row.id) && ["submitted", "approved"].includes(row.status))
          .map((row: any) => row.id);
        if (approvedIds.length) {
          const { error: approveOthersError } = await supabase
            .from("expert_submissions")
            .update({ status: "approved", reviewed_at: now, updated_at: now })
            .in("id", approvedIds);
          if (approveOthersError) throw approveOthersError;
        }

        await supabase
          .from("expert_assignments")
          .update({ status: "in_progress", updated_at: now })
          .eq("id", assignmentId);

        const filenames = selectedRows.map((row: any) => text(row.filename, 300)).filter(Boolean);
        const messageBody = [
          filenames.length ? `Changes requested for:\n${filenames.map((filename) => `• ${filename}`).join("\n")}` : "Changes requested for selected files.",
          adminNotes || "Please update the selected files and submit a new review package.",
        ].join("\n\n");

        const { error: messageError } = await supabase.from("expert_project_messages").insert({
          assignment_id: assignmentId,
          sender_type: "admin",
          sender_user_id: access.user?.id || null,
          body: messageBody,
          read_by_admin_at: now,
        });
        if (messageError) throw messageError;

        const { data: assignmentRow } = await supabase
          .from("expert_assignments")
          .select("expert_profile_id")
          .eq("id", assignmentId)
          .maybeSingle();
        const { data: expertProfile } = assignmentRow?.expert_profile_id
          ? await supabase.from("expert_profiles").select("user_id,email,full_name").eq("id", assignmentRow.expert_profile_id).maybeSingle()
          : { data: null };
        if (expertProfile) {
          await notifyExpertOperationalEvent(supabase, {
            key: `expert-file-changes:${batchId}:${selectedIds.sort().join("-")}`,
            type: "expert.package.changes_requested",
            expertUserId: expertProfile.user_id,
            expertEmail: expertProfile.email,
            expertName: expertProfile.full_name,
            projectName: job.project_name,
            service: job.service,
            studio: job.studio,
            title: "Heyy Studio requested file changes",
            message: adminNotes || "Heyy Studio requested changes before these files are sent to the client.",
            status: "Changes requested",
            details: filenames.length ? [{ label: "Files to update", value: filenames.join(", ") }] : [],
            href: `/expert?section=projects&assignment=${encodeURIComponent(assignmentId)}&panel=files`,
          });
        }
      } else {
        const { error: updateError } = await supabase
          .from("expert_submissions")
          .update({ status, admin_notes: adminNotes, reviewed_at: now, updated_at: now })
          .in("id", selectedIds);
        if (updateError) throw updateError;
      }

      await recordAdminAudit({
        actorUserId: access.user?.id || null,
        action: `expert.submission_package.${status}`,
        entityType: "expert_submission_batch",
        entityId: batchId,
        summary: `${prettyStatusForAudit(status)} ${selectedRows.length} Expert file${selectedRows.length === 1 ? "" : "s"} for ${job.project_name || jobId}`,
        metadata: { productionJobId: jobId, fileCount: selectedRows.length, submissionIds: selectedIds },
      });
    } else if (action === "publish_selection") {
      const submissionIds = Array.isArray(body.submissionIds)
        ? Array.from(new Set(body.submissionIds.map((value) => text(value, 100)).filter(Boolean)))
        : [];
      const clientMessage = text(body.clientMessage, 5000);
      if (!submissionIds.length) return NextResponse.json({ error: "Choose at least one Expert file for the client package." }, { status: 400 });
      if (!clientMessage) return NextResponse.json({ error: "Write the client message that should accompany these files." }, { status: 400 });
      if (submissionIds.length > 50) return NextResponse.json({ error: "Send up to 50 files in one client review package." }, { status: 400 });

      const { data: selectedRows, error: selectionError } = await supabase
        .from("expert_submissions")
        .select("*")
        .eq("production_job_id", jobId)
        .in("id", submissionIds)
        .order("submitted_at", { ascending: true });
      if (selectionError) throw selectionError;
      if (!selectedRows || selectedRows.length !== submissionIds.length) {
        return NextResponse.json({ error: "One or more selected Expert files are no longer available." }, { status: 404 });
      }
      if (selectedRows.some((row: any) => row.status === "rejected")) {
        return NextResponse.json({ error: "Rejected Expert files cannot be sent to the client." }, { status: 400 });
      }

      const filenames = selectedRows.map((row: any) => text(row.filename, 300));
      if (new Set(filenames.map((filename) => filename.toLowerCase())).size !== filenames.length) {
        return NextResponse.json({ error: "Choose only one version of each filename for a client review package." }, { status: 400 });
      }

      const { data: openRevision, error: revisionError } = await supabase
        .from("workspace_revisions")
        .select("*")
        .eq("production_job_id", jobId)
        .in("status", ["Requested", "In Progress"])
        .order("revision_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (revisionError) throw revisionError;

      const now = new Date().toISOString();
      const deliverables: any[] = [];
      const publishedPairs: Array<{ submission: any; deliverable: any }> = [];

      for (const submission of selectedRows) {
        const originalFilename = text(submission.filename, 300) || "production-file";
        let deliverable: any = null;

        if (submission.deliverable_id) {
          const { data: existingDeliverable, error: existingDeliverableError } = await supabase
            .from("production_deliverables")
            .select("*")
            .eq("id", submission.deliverable_id)
            .eq("production_job_id", jobId)
            .maybeSingle();
          if (existingDeliverableError) throw existingDeliverableError;
          deliverable = existingDeliverable || null;
        }

        if (!deliverable) {
          const { data: previousFiles, error: previousError } = await supabase
            .from("production_deliverables")
            .select("version")
            .eq("production_job_id", jobId)
            .eq("original_filename", originalFilename)
            .order("version", { ascending: false })
            .limit(1);
          if (previousError) throw previousError;
          const nextVersion = previousFiles?.length ? Number(previousFiles[0].version || 0) + 1 : 1;

          const { error: latestError } = await supabase
            .from("production_deliverables")
            .update({ is_latest: false })
            .eq("production_job_id", jobId)
            .eq("original_filename", originalFilename);
          if (latestError) throw latestError;

          const { data: createdDeliverable, error: deliverableError } = await supabase
            .from("production_deliverables")
            .insert({
              production_job_id: jobId,
              filename: originalFilename,
              original_filename: originalFilename,
              version: nextVersion,
              storage_path: submission.storage_path,
              file_size: submission.file_size,
              mime_type: submission.mime_type || "application/octet-stream",
              uploaded_by: "Heyy Studio",
              is_latest: true,
              is_final: false,
              client_visible: true,
              published_at: now,
            })
            .select("*")
            .single();
          if (deliverableError || !createdDeliverable) throw deliverableError || new Error("Could not prepare the selected Expert file for the client.");
          deliverable = createdDeliverable;
        } else {
          const { error: clearLatestError } = await supabase
            .from("production_deliverables")
            .update({ is_latest: false })
            .eq("production_job_id", jobId)
            .eq("original_filename", originalFilename)
            .neq("id", deliverable.id);
          if (clearLatestError) throw clearLatestError;

          const { data: refreshed, error: revealError } = await supabase
            .from("production_deliverables")
            .update({ is_latest: true, client_visible: true, published_at: deliverable.published_at || now })
            .eq("id", deliverable.id)
            .select("*")
            .single();
          if (revealError || !refreshed) throw revealError || new Error("Could not make the selected file visible to the client.");
          deliverable = refreshed;
        }

        deliverables.push(deliverable);
        publishedPairs.push({ submission, deliverable });

        if (openRevision) {
          const { data: existingRevisionLink, error: existingRevisionLinkError } = await supabase
            .from("workspace_revision_files")
            .select("id")
            .eq("revision_id", openRevision.id)
            .eq("deliverable_id", deliverable.id)
            .limit(1)
            .maybeSingle();
          if (existingRevisionLinkError) throw existingRevisionLinkError;
          if (!existingRevisionLink) {
            const { error: linkError } = await supabase.from("workspace_revision_files").insert({
              revision_id: openRevision.id,
              production_job_id: jobId,
              deliverable_id: deliverable.id,
              filename: originalFilename,
              storage_path: submission.storage_path,
              version: deliverable.version,
            });
            if (linkError) throw linkError;
          }
        }
      }

      for (const pair of publishedPairs) {
        const { error: submissionUpdateError } = await supabase
          .from("expert_submissions")
          .update({ deliverable_id: pair.deliverable.id, status: "published", reviewed_at: now, published_at: now, updated_at: now })
          .eq("id", pair.submission.id);
        if (submissionUpdateError) throw submissionUpdateError;
      }

      const clientIdentity = await resolveClientIdentity(supabase, job);
      let deliveryMessageId: string | null = null;
      if (openRevision) {
        const { error: revisionUpdateError } = await supabase
          .from("workspace_revisions")
          .update({
            status: "Waiting Approval",
            admin_response: clientMessage,
            responded_by: access.user?.id || null,
            responded_at: now,
            updated_at: now,
            completed_at: null,
          })
          .eq("id", openRevision.id);
        if (revisionUpdateError) throw revisionUpdateError;

        await supabase
          .from("production_jobs")
          .update({ status: "Review", delivery_status: "Client Reviewing", updated_at: now })
          .eq("id", jobId);

        await supabase.from("production_timeline").insert({
          production_job_id: jobId,
          title: `Revision ${openRevision.revision_number} Ready for Review`,
          description: clientMessage,
          status: "Ready For Review",
          created_by: "Admin",
        });

        await Notifications.emit({
          event: "revision.ready",
          projectId: job.project_id,
          projectName: job.project_name,
          service: job.service,
          studio: job.studio,
          userId: job.user_id,
          clientEmail: clientIdentity.email,
          clientName: clientIdentity.name,
          metadata: {
            serviceId: job.service_id || asRecord(job.metadata).service_id,
            productionJobId: job.id,
            revisionId: openRevision.id,
            revisionNumber: openRevision.revision_number,
            status: "Waiting Approval",
            reviewFileCount: deliverables.length,
            selectedSubmissionIds: submissionIds,
            productionOnly: Boolean(asRecord(job.metadata).production_only),
          },
        });
      } else {
        await supabase
          .from("production_jobs")
          .update({ status: "Ready For Review", delivery_status: "Client Reviewing", updated_at: now })
          .eq("id", jobId);

        const deliveryMessage = await createProductionMessage({
          admin: supabase,
          jobId,
          senderType: "studio",
          senderName: "Heyy Studio",
          message: clientMessage,
        });
        deliveryMessageId = deliveryMessage.id;

        await supabase.from("production_timeline").insert({
          production_job_id: jobId,
          title: "Client Review Package Ready",
          description: clientMessage,
          status: "Ready For Review",
          created_by: "Admin",
        });

        await Notifications.emit({
          event: "production.review",
          projectId: job.project_id,
          projectName: job.project_name,
          service: job.service,
          studio: job.studio,
          userId: job.user_id,
          clientEmail: clientIdentity.email,
          clientName: clientIdentity.name,
          metadata: {
            serviceId: job.service_id || asRecord(job.metadata).service_id,
            productionJobId: job.id,
            messageId: deliveryMessage.id,
            status: "Ready For Review",
            fileCount: deliverables.length,
            selectedSubmissionIds: submissionIds,
            productionOnly: Boolean(asRecord(job.metadata).production_only),
          },
        });
      }

      const assignmentId = selectedRows[0].assignment_id;
      await supabase
        .from("expert_assignments")
        .update({ status: "submitted", submitted_at: now, updated_at: now })
        .eq("id", assignmentId);

      const { data: publishAssignment } = await supabase
        .from("expert_assignments")
        .select("expert_profile_id")
        .eq("id", assignmentId)
        .maybeSingle();
      const { data: publishExpert } = publishAssignment?.expert_profile_id
        ? await supabase.from("expert_profiles").select("user_id,email,full_name").eq("id", publishAssignment.expert_profile_id).maybeSingle()
        : { data: null };
      if (publishExpert) {
        await notifyExpertOperationalEvent(supabase, {
          key: `expert-client-selection:${submissionIds.slice().sort().join("-")}`,
          type: "expert.package.published",
          expertUserId: publishExpert.user_id,
          expertEmail: publishExpert.email,
          expertName: publishExpert.full_name,
          projectName: job.project_name,
          service: job.service,
          studio: job.studio,
          title: "Approved files sent to the client",
          message: `${deliverables.length} selected file${deliverables.length === 1 ? "" : "s"} passed Heyy Studio review and were sent together to the client.`,
          status: "Client reviewing",
          href: `/expert?section=projects&assignment=${encodeURIComponent(assignmentId)}&panel=files`,
        });
      }

      await recordAdminAudit({
        actorUserId: access.user?.id || null,
        action: "expert.client_package.published",
        entityType: "expert_submission_selection",
        entityId: submissionIds[0],
        summary: `Published ${deliverables.length} selected Expert file${deliverables.length === 1 ? "" : "s"} to the client for ${job.project_name || jobId}`,
        metadata: {
          productionJobId: jobId,
          deliverableIds: deliverables.map((item) => item.id),
          submissionIds,
          revisionId: openRevision?.id || null,
          deliveryMessageId,
        },
      });
    } else if (action === "publish_batch") {
      const batchId = text(body.batchId, 100);
      const clientMessage = text(body.clientMessage, 5000) || `A new review package is ready for ${job.project_name || "your project"}.`;
      if (!batchId) return NextResponse.json({ error: "Expert review package is required." }, { status: 400 });

      const { data: batchRows, error: batchError } = await supabase
        .from("expert_submissions")
        .select("*")
        .eq("production_job_id", jobId)
        .eq("batch_id", batchId)
        .order("filename", { ascending: true });
      if (batchError) throw batchError;
      if (!batchRows?.length) return NextResponse.json({ error: "Expert review package not found." }, { status: 404 });
      if (batchRows.some((row: any) => row.status === "published")) {
        return NextResponse.json({ error: "This review package has already been published." }, { status: 409 });
      }
      if (batchRows.some((row: any) => !["submitted", "approved"].includes(row.status))) {
        return NextResponse.json({ error: "Resolve requested changes before publishing this review package." }, { status: 400 });
      }

      const { data: openRevision, error: revisionError } = await supabase
        .from("workspace_revisions")
        .select("*")
        .eq("production_job_id", jobId)
        .in("status", ["Requested", "In Progress"])
        .order("revision_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (revisionError) throw revisionError;

      const now = new Date().toISOString();
      const deliverables: any[] = [];
      const publishedPairs: Array<{ submission: any; deliverable: any }> = [];
      for (const submission of batchRows) {
        const originalFilename = submission.filename;
        const { data: previousFiles, error: previousError } = await supabase
          .from("production_deliverables")
          .select("version")
          .eq("production_job_id", jobId)
          .eq("original_filename", originalFilename)
          .order("version", { ascending: false })
          .limit(1);
        if (previousError) throw previousError;
        const nextVersion = previousFiles?.length ? Number(previousFiles[0].version || 0) + 1 : 1;

        const { error: latestError } = await supabase
          .from("production_deliverables")
          .update({ is_latest: false })
          .eq("production_job_id", jobId)
          .eq("original_filename", originalFilename);
        if (latestError) throw latestError;

        const { data: deliverable, error: deliverableError } = await supabase
          .from("production_deliverables")
          .insert({
            production_job_id: jobId,
            filename: originalFilename,
            original_filename: originalFilename,
            version: nextVersion,
            storage_path: submission.storage_path,
            file_size: submission.file_size,
            mime_type: submission.mime_type || "application/octet-stream",
            uploaded_by: "Heyy Studio",
            is_latest: true,
            is_final: false,
            client_visible: false,
            published_at: null,
          })
          .select("*")
          .single();
        if (deliverableError || !deliverable) throw deliverableError || new Error("Could not publish Expert file.");
        deliverables.push(deliverable);
        publishedPairs.push({ submission, deliverable });

        if (openRevision) {
          const { error: linkError } = await supabase.from("workspace_revision_files").insert({
            revision_id: openRevision.id,
            production_job_id: jobId,
            deliverable_id: deliverable.id,
            filename: originalFilename,
            storage_path: submission.storage_path,
            version: nextVersion,
          });
          if (linkError) throw linkError;
        }

      }

      const deliverableIds = deliverables.map((item) => item.id);
      const { error: revealError } = await supabase
        .from("production_deliverables")
        .update({ client_visible: true, published_at: now })
        .in("id", deliverableIds);
      if (revealError) throw revealError;

      for (const pair of publishedPairs) {
        const { error: submissionUpdateError } = await supabase
          .from("expert_submissions")
          .update({ deliverable_id: pair.deliverable.id, status: "published", reviewed_at: now, published_at: now, updated_at: now })
          .eq("id", pair.submission.id);
        if (submissionUpdateError) throw submissionUpdateError;
      }

      if (openRevision) {
        const { error: revisionUpdateError } = await supabase
          .from("workspace_revisions")
          .update({
            status: "Waiting Approval",
            admin_response: clientMessage,
            responded_by: access.user?.id || null,
            responded_at: now,
            updated_at: now,
            completed_at: null,
          })
          .eq("id", openRevision.id);
        if (revisionUpdateError) throw revisionUpdateError;

        await supabase
          .from("production_jobs")
          .update({ status: "Review", delivery_status: "Client Reviewing", updated_at: now })
          .eq("id", jobId);

        await supabase.from("production_timeline").insert({
          production_job_id: jobId,
          title: `Revision ${openRevision.revision_number} Ready for Review`,
          description: clientMessage,
          status: "Ready For Review",
          created_by: "Admin",
        });

        await Notifications.emit({
          event: "revision.ready",
          projectId: job.project_id,
          projectName: job.project_name,
          service: job.service,
          studio: job.studio,
          userId: job.user_id,
          metadata: {
            serviceId: job.service_id || asRecord(job.metadata).service_id,
            productionJobId: job.id,
            revisionId: openRevision.id,
            revisionNumber: openRevision.revision_number,
            status: "Waiting Approval",
            reviewFileCount: deliverables.length,
            productionOnly: Boolean(asRecord(job.metadata).production_only),
          },
        });
      } else {
        await supabase
          .from("production_jobs")
          .update({ status: "Ready For Review", delivery_status: "Client Reviewing", updated_at: now })
          .eq("id", jobId);

        const legacyDeliveryMessage = await createProductionMessage({
          admin: supabase,
          jobId,
          senderType: "studio",
          senderName: "Heyy Studio",
          message: clientMessage,
        });

        await supabase.from("production_timeline").insert({
          production_job_id: jobId,
          title: "Review Package Ready",
          description: clientMessage,
          status: "Ready For Review",
          created_by: "Admin",
        });

        await Notifications.emit({
          event: "production.review",
          projectId: job.project_id,
          projectName: job.project_name,
          service: job.service,
          studio: job.studio,
          userId: job.user_id,
          metadata: {
            serviceId: job.service_id || asRecord(job.metadata).service_id,
            productionJobId: job.id,
            messageId: legacyDeliveryMessage.id,
            status: "Ready For Review",
            fileCount: deliverables.length,
            productionOnly: Boolean(asRecord(job.metadata).production_only),
          },
        });
      }

      const assignmentId = batchRows[0].assignment_id;
      await supabase
        .from("expert_assignments")
        .update({ status: "submitted", submitted_at: now, updated_at: now })
        .eq("id", assignmentId);

      const { data: publishAssignment } = await supabase
        .from("expert_assignments")
        .select("expert_profile_id")
        .eq("id", assignmentId)
        .maybeSingle();
      const { data: publishExpert } = publishAssignment?.expert_profile_id
        ? await supabase.from("expert_profiles").select("user_id,email,full_name").eq("id", publishAssignment.expert_profile_id).maybeSingle()
        : { data: null };
      if (publishExpert) {
        await notifyExpertOperationalEvent(supabase, {
          key: `expert-package-published:${batchId}`,
          type: "expert.package.published",
          expertUserId: publishExpert.user_id,
          expertEmail: publishExpert.email,
          expertName: publishExpert.full_name,
          projectName: job.project_name,
          service: job.service,
          studio: job.studio,
          title: "Your review package was sent to the client",
          message: `${deliverables.length} file${deliverables.length === 1 ? "" : "s"} passed Heyy Studio review and were published together for client review.`,
          status: "Client reviewing",
          href: `/expert?section=projects&assignment=${encodeURIComponent(assignmentId)}&panel=files`,
        });
      }

      await recordAdminAudit({
        actorUserId: access.user?.id || null,
        action: "expert.submission_package.published",
        entityType: "expert_submission_batch",
        entityId: batchId,
        summary: `Published ${deliverables.length} Expert files to the client for ${job.project_name || jobId}`,
        metadata: { productionJobId: jobId, deliverableIds: deliverables.map((item) => item.id), revisionId: openRevision?.id || null },
      });
    } else if (action === "review_submission") {
      const submissionId = text(body.submissionId, 100);
      const status = text(body.status, 80);
      const adminNotes = text(body.adminNotes, 5000) || null;
      if (!submissionId || !["changes_requested", "approved", "rejected"].includes(status)) {
        return NextResponse.json({ error: "Choose a valid submission review action." }, { status: 400 });
      }

      const { data: submission, error } = await supabase
        .from("expert_submissions")
        .select("id,assignment_id")
        .eq("id", submissionId)
        .eq("production_job_id", jobId)
        .maybeSingle();
      if (error) throw error;
      if (!submission) return NextResponse.json({ error: "Expert submission not found." }, { status: 404 });

      const { error: updateError } = await supabase
        .from("expert_submissions")
        .update({ status, admin_notes: adminNotes, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", submissionId);
      if (updateError) throw updateError;
    } else if (action === "publish_submission") {
      const submissionId = text(body.submissionId, 100);
      if (!submissionId) return NextResponse.json({ error: "Expert submission is required." }, { status: 400 });

      const { data: submission, error } = await supabase
        .from("expert_submissions")
        .select("*")
        .eq("id", submissionId)
        .eq("production_job_id", jobId)
        .maybeSingle();
      if (error) throw error;
      if (!submission) return NextResponse.json({ error: "Expert submission not found." }, { status: 404 });
      if (submission.status === "published") return NextResponse.json({ error: "This file is already published to the client." }, { status: 409 });
      if (!['submitted','approved'].includes(submission.status)) return NextResponse.json({ error: "Only submitted or approved files can be published." }, { status: 400 });

      const originalFilename = submission.filename;
      const { data: previousFiles, error: previousError } = await supabase
        .from("production_deliverables")
        .select("version")
        .eq("production_job_id", jobId)
        .eq("original_filename", originalFilename)
        .order("version", { ascending: false })
        .limit(1);
      if (previousError) throw previousError;
      const nextVersion = previousFiles?.length ? Number(previousFiles[0].version || 0) + 1 : 1;

      const { error: latestError } = await supabase
        .from("production_deliverables")
        .update({ is_latest: false })
        .eq("production_job_id", jobId)
        .eq("original_filename", originalFilename);
      if (latestError) throw latestError;

      const now = new Date().toISOString();
      const { data: deliverable, error: deliverableError } = await supabase
        .from("production_deliverables")
        .insert({
          production_job_id: jobId,
          filename: originalFilename,
          original_filename: originalFilename,
          version: nextVersion,
          storage_path: submission.storage_path,
          file_size: submission.file_size,
          mime_type: submission.mime_type || "application/octet-stream",
          uploaded_by: "Heyy Studio",
          is_latest: true,
          is_final: false,
          client_visible: true,
          published_at: now,
        })
        .select("*")
        .single();
      if (deliverableError) throw deliverableError;

      const { error: submissionUpdateError } = await supabase
        .from("expert_submissions")
        .update({ deliverable_id: deliverable.id, status: "published", reviewed_at: now, published_at: now, updated_at: now })
        .eq("id", submission.id);
      if (submissionUpdateError) throw submissionUpdateError;

      await supabase
        .from("expert_assignments")
        .update({ status: "submitted", submitted_at: now, updated_at: now })
        .eq("id", submission.assignment_id);

      await recordAdminAudit({
        actorUserId: access.user?.id || null,
        action: "expert.submission.published",
        entityType: "expert_submission",
        entityId: submission.id,
        summary: `Published Expert deliverable to the client for ${job.project_name || jobId}`,
        metadata: { productionJobId: jobId, deliverableId: deliverable.id },
      });
    } else if (action === "update_assignment") {
      const assignmentId = text(body.assignmentId, 100);
      if (!assignmentId) return NextResponse.json({ error: "Expert assignment is required." }, { status: 400 });

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.status !== undefined) {
        const status = text(body.status, 80);
        if (!["assigned", "in_progress", "submitted", "completed", "cancelled"].includes(status)) {
          return NextResponse.json({ error: "Invalid assignment status." }, { status: 400 });
        }
        update.status = status;
        if (status === "completed") update.completed_at = new Date().toISOString();
      }
      if (body.payoutStatus !== undefined) {
        const payoutStatus = text(body.payoutStatus, 80);
        if (!["pending", "eligible", "held", "paid"].includes(payoutStatus)) {
          return NextResponse.json({ error: "Invalid payout status." }, { status: 400 });
        }
        update.payout_status = payoutStatus;
        if (payoutStatus === "eligible") update.payout_eligible_at = new Date().toISOString();
        if (payoutStatus === "paid") update.paid_at = new Date().toISOString();
      }
      if (body.paymentReference !== undefined) update.payment_reference = text(body.paymentReference, 500) || null;
      if (body.internalNotes !== undefined) update.internal_notes = text(body.internalNotes, 5000) || null;

      const { data: updatedAssignment, error } = await supabase
        .from("expert_assignments")
        .update(update)
        .eq("id", assignmentId)
        .eq("production_job_id", jobId)
        .select("id,expert_profile_id,payout_status,paid_at,payment_reference,agreed_fee_cents,currency")
        .maybeSingle();
      if (error) throw error;

      if (updatedAssignment?.payout_status === "paid") {
        try {
          const loaded = await loadExpertPayoutStatementData(supabase, updatedAssignment.id);
          let statement: Awaited<ReturnType<typeof buildExpertPayoutStatementPdf>> | null = null;
          try {
            statement = await buildExpertPayoutStatementPdf(loaded.data);
          } catch (statementError) {
            console.error("Expert payout statement could not be prepared:", statementError);
          }
          await notifyExpertOperationalEvent(supabase, {
            key: `expert-payout-paid:${updatedAssignment.id}`,
            type: "expert.payout.paid",
            expertUserId: loaded.expert.user_id || null,
            expertEmail: loaded.expert.email || null,
            expertName: loaded.expert.full_name || "Expert",
            projectName: loaded.job.project_name || null,
            service: loaded.job.service || null,
            studio: loaded.job.assigned_studio || loaded.job.studio || null,
            title: "Your Heyy Studio payout has been recorded",
            message: `Heyy Studio recorded your Expert payout as paid${loaded.assignment.payment_reference ? ` · Reference: ${loaded.assignment.payment_reference}` : ""}.${statement ? " Your Expert Payout Statement is attached for your records." : " The payout record is available in your Expert Portal."}`,
            status: "Paid",
            details: [
              ...(statement ? [{ label: "Payout statement", value: statement.statementNumber }] : []),
              { label: "Total Expert payout", value: new Intl.NumberFormat("en-US", { style: "currency", currency: loaded.data.currency || "USD" }).format(Number(loaded.data.totalExpertFeeCents || 0) / 100) },
            ],
            attachments: statement ? [{ filename: `Heyy-Studio-${statement.statementNumber}.pdf`, content: statement.buffer }] : undefined,
            href: "/expert?section=payments",
          });
        } catch (payoutNotificationError) {
          console.error("Expert payout notification could not be prepared:", payoutNotificationError);
        }
      }
    } else {
      return NextResponse.json({ error: "Unknown Expert Operations action." }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...(await loadPayload(supabase, jobId)) });
  } catch (error) {
    console.error("Expert Operations action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Expert Operations action failed." },
      { status: 500 },
    );
  }
}
