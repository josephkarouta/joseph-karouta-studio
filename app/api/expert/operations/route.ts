import "server-only";

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import {
  sendAdminExpertOpportunityDeclinedEmail,
  sendAdminExpertQuoteSubmittedEmail,
} from "@/lib/communications/expert-operations";
import {
  notifyAdminOperationalEvent,
  notifyExpertOperationalEvent,
} from "@/lib/expert-network/operational-notifications";
import { ensurePreferredExpertAssignmentForPaidQuote } from "@/lib/payments/process-quote-payment";

function text(value: unknown, max = 10000) {
  return String(value || "").trim().slice(0, max);
}

async function activeProfile(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("expert_profiles")
    .select("id,full_name,email,studio,role_title,availability,status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function signedSubmissionRows(admin: SupabaseClient, rows: any[]) {
  return Promise.all(
    rows.map(async (row) => {
      let downloadUrl: string | null = null;
      if (row.storage_path) {
        const { data } = await admin.storage
          .from("production-files")
          .createSignedUrl(row.storage_path, 60 * 60);
        downloadUrl = data?.signedUrl || null;
      }
      return {
        id: row.id,
        assignmentId: row.assignment_id,
        filename: row.filename,
        batchId: row.batch_id,
        batchSequence: row.batch_sequence,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        version: row.version,
        notes: row.notes,
        status: row.status,
        adminNotes: row.admin_notes,
        submittedAt: row.submitted_at,
        reviewedAt: row.reviewed_at,
        publishedAt: row.published_at,
        downloadUrl,
      };
    }),
  );
}

async function loadPayload(admin: SupabaseClient, profile: any) {
  const [opportunitiesResult, assignmentsResult] = await Promise.all([
    admin
      .from("expert_opportunities")
      .select("*")
      .eq("expert_profile_id", profile.id)
      .order("created_at", { ascending: false }),
    admin
      .from("expert_assignments")
      .select("*")
      .eq("expert_profile_id", profile.id)
      .order("assigned_at", { ascending: false }),
  ]);
  if (opportunitiesResult.error) throw opportunitiesResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;

  const assignments = assignmentsResult.data || [];
  const assignmentIds = assignments.map((item: any) => item.id);
  let messages: any[] = [];
  let submissions: any[] = [];
  let revisions: any[] = [];
  let addons: any[] = [];

  if (assignmentIds.length > 0) {
    const productionJobIds = assignments.map((item: any) => item.production_job_id).filter(Boolean);
    const [messagesResult, submissionsResult, revisionsResult] = await Promise.all([
      admin
        .from("expert_project_messages")
        .select("*")
        .in("assignment_id", assignmentIds)
        .order("created_at", { ascending: true }),
      admin
        .from("expert_submissions")
        .select("*")
        .in("assignment_id", assignmentIds)
        .eq("expert_profile_id", profile.id)
        .order("submitted_at", { ascending: false }),
      productionJobIds.length
        ? admin
            .from("workspace_revisions")
            .select("id,production_job_id,revision_number,status,message,admin_response,target_files,forwarded_to_expert_at,responded_at,created_at,client_message_id,expert_client_message,expert_show_client_message")
            .in("production_job_id", productionJobIds)
            .not("forwarded_to_expert_at", "is", null)
            .order("revision_number", { ascending: false })
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (messagesResult.error) throw messagesResult.error;
    if (submissionsResult.error) throw submissionsResult.error;
    if (revisionsResult.error) throw revisionsResult.error;
    messages = messagesResult.data || [];
    submissions = await signedSubmissionRows(admin, submissionsResult.data || []);
    const assignmentByJob = new Map(assignments.map((item: any) => [String(item.production_job_id), item.id]));
    const messageAttachmentsById = new Map<string, any[]>();
    const clientMessageIds = Array.from(new Set((revisionsResult.data || []).map((row: any) => String(row.client_message_id || "")).filter(Boolean)));
    if (clientMessageIds.length > 0) {
      try {
        const { data: attachmentRows, error: attachmentError } = await admin
          .from("production_message_attachments")
          .select("id,message_id,production_job_id,filename,mime_type,file_size,storage_path,created_at")
          .in("message_id", clientMessageIds)
          .order("created_at", { ascending: true });
        if (attachmentError) throw attachmentError;
        await Promise.all((attachmentRows || []).map(async (attachment: any) => {
          const { data: signed } = await admin.storage
            .from("production-message-files")
            .createSignedUrl(attachment.storage_path, 60 * 10, { download: attachment.filename || "attachment" });
          const item = { ...attachment, download_url: signed?.signedUrl || null };
          const current = messageAttachmentsById.get(String(attachment.message_id)) || [];
          current.push(item);
          messageAttachmentsById.set(String(attachment.message_id), current);
        }));
      } catch (messageError) {
        console.warn("Could not load revision attachments for Expert Portal:", messageError);
      }
    }
    revisions = (revisionsResult.data || []).map((row: any) => ({
      id: row.id,
      assignmentId: assignmentByJob.get(String(row.production_job_id)) || null,
      productionJobId: row.production_job_id,
      revisionNumber: row.revision_number,
      status: row.status,
      message: row.expert_show_client_message === false ? null : (row.expert_client_message ?? row.message),
      adminResponse: row.admin_response || null,
      targetFiles: Array.isArray(row.target_files) ? row.target_files : [],
      clientAttachments: row.client_message_id ? (messageAttachmentsById.get(String(row.client_message_id)) || []) : [],
      forwardedAt: row.forwarded_to_expert_at,
      respondedAt: row.responded_at,
      createdAt: row.created_at,
    }));

    if (productionJobIds.length) {
      const { data: addonRows, error: addonError } = await admin
        .from("production_addons")
        .select("id,production_job_id,kind,status,title,description,currency,expert_cost_cents,expert_turnaround_days,expert_notes,expert_quoted_at,sent_to_client_at,paid_at,created_at")
        .in("production_job_id", productionJobIds)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (addonError) throw addonError;
      addons = (addonRows || []).map((row: any) => ({
        id: row.id,
        assignmentId: assignmentByJob.get(String(row.production_job_id)) || null,
        productionJobId: row.production_job_id,
        kind: row.kind,
        status: row.status,
        title: row.title,
        description: row.description,
        currency: row.currency,
        expertCostCents: row.expert_cost_cents,
        expertTurnaroundDays: row.expert_turnaround_days,
        expertNotes: row.expert_notes,
        expertQuotedAt: row.expert_quoted_at,
        sentToClientAt: row.sent_to_client_at,
        paidAt: row.paid_at,
        createdAt: row.created_at,
      }));
    }
  }

  return {
    profile: {
      id: profile.id,
      fullName: profile.full_name,
      studio: profile.studio,
      roleTitle: profile.role_title,
      availability: profile.availability,
    },
    opportunities: (opportunitiesResult.data || []).map((row: any) => ({
      id: row.id,
      status: row.status,
      productionJobId: row.production_job_id || null,
      sharedScope: row.shared_scope || {},
      requestedAt: row.requested_at,
      expiresAt: row.expires_at,
      quotedFeeCents: row.quoted_fee_cents,
      currency: row.currency,
      turnaroundDays: row.turnaround_days,
      includedRevisions: row.included_revisions,
      extraRevisionFeeCents: row.extra_revision_fee_cents ?? null,
      expertNotes: row.expert_notes,
      quotedAt: row.quoted_at,
    })),
    assignments: assignments.map((row: any) => ({
      id: row.id,
      productionJobId: row.production_job_id,
      status: row.status,
      sharedScope: row.shared_scope || {},
      agreedFeeCents: row.agreed_fee_cents,
      currency: row.currency,
      turnaroundDays: row.turnaround_days,
      includedRevisions: row.included_revisions,
      extraRevisionFeeCents: row.extra_revision_fee_cents ?? null,
      assignedAt: row.assigned_at,
      dueAt: row.due_at,
      submittedAt: row.submitted_at,
      completedAt: row.completed_at,
      payoutStatus: row.payout_status,
      payoutEligibleAt: row.payout_eligible_at,
      paidAt: row.paid_at,
      paymentReference: row.payment_reference,
    })),
    messages: messages.map((row: any) => ({
      id: row.id,
      assignmentId: row.assignment_id,
      senderType: row.sender_type,
      body: row.body,
      createdAt: row.created_at,
      readByExpertAt: row.read_by_expert_at,
    })),
    submissions,
    revisions,
    addons,
  };
}

async function loadSummaryPayload(admin: SupabaseClient, profile: any) {
  const [opportunitiesResult, assignmentsResult] = await Promise.all([
    admin
      .from("expert_opportunities")
      .select("id,status,production_job_id,shared_scope,requested_at,expires_at,quoted_fee_cents,currency,turnaround_days,included_revisions,extra_revision_fee_cents,expert_notes,quoted_at")
      .eq("expert_profile_id", profile.id)
      .order("created_at", { ascending: false }),
    admin
      .from("expert_assignments")
      .select("id,production_job_id,status,shared_scope,agreed_fee_cents,currency,turnaround_days,included_revisions,extra_revision_fee_cents,assigned_at,due_at,submitted_at,completed_at,payout_status,payout_eligible_at,paid_at,payment_reference")
      .eq("expert_profile_id", profile.id)
      .order("assigned_at", { ascending: false }),
  ]);
  if (opportunitiesResult.error) throw opportunitiesResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;

  return {
    profile: {
      id: profile.id,
      fullName: profile.full_name,
      studio: profile.studio,
      roleTitle: profile.role_title,
      availability: profile.availability,
    },
    opportunities: (opportunitiesResult.data || []).map((row: any) => ({
      id: row.id,
      status: row.status,
      productionJobId: row.production_job_id || null,
      sharedScope: row.shared_scope || {},
      requestedAt: row.requested_at,
      expiresAt: row.expires_at,
      quotedFeeCents: row.quoted_fee_cents,
      currency: row.currency,
      turnaroundDays: row.turnaround_days,
      includedRevisions: row.included_revisions,
      extraRevisionFeeCents: row.extra_revision_fee_cents ?? null,
      expertNotes: row.expert_notes,
      quotedAt: row.quoted_at,
    })),
    assignments: (assignmentsResult.data || []).map((row: any) => ({
      id: row.id,
      productionJobId: row.production_job_id,
      status: row.status,
      sharedScope: row.shared_scope || {},
      agreedFeeCents: row.agreed_fee_cents,
      currency: row.currency,
      turnaroundDays: row.turnaround_days,
      includedRevisions: row.included_revisions,
      extraRevisionFeeCents: row.extra_revision_fee_cents ?? null,
      assignedAt: row.assigned_at,
      dueAt: row.due_at,
      submittedAt: row.submitted_at,
      completedAt: row.completed_at,
      payoutStatus: row.payout_status,
      payoutEligibleAt: row.payout_eligible_at,
      paidAt: row.paid_at,
      paymentReference: row.payment_reference,
    })),
    messages: [],
    submissions: [],
    revisions: [],
    addons: [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const profile = await activeProfile(admin, user.id);
    if (!profile) return NextResponse.json({ error: "Active Expert profile not found." }, { status: 403 });

    if (request.nextUrl.searchParams.get("mode") === "summary") {
      return NextResponse.json({ success: true, ...(await loadSummaryPayload(admin, profile)) });
    }

    // Repair routines are deliberately opt-in. They were useful while the
    // Expert handoff was being built, but running them on every portal open
    // turns a read-only page load into many sequential database reads/writes.
    // The payment/approval paths now perform these updates at the source.
    const runRepairs = request.nextUrl.searchParams.get("repair") === "1";

    if (runRepairs) {
      // Self-heal the payment handoff if a paid quote exists for one of this
      // Expert's preferred opportunities but the assignment row was missed by a
      // previous webhook/reconciliation attempt.
      const { data: preferredRows, error: preferredRowsError } = await admin
        .from("expert_opportunities")
        .select("studio_request_id")
        .eq("expert_profile_id", profile.id)
        .eq("status", "selected")
        .not("studio_request_id", "is", null);
      if (!preferredRowsError) {
        for (const row of preferredRows || []) {
          const studioRequestId = text(row.studio_request_id, 200);
          if (!studioRequestId) continue;
          const { data: paidQuote } = await admin
            .from("workspace_quotes")
            .select("id")
            .eq("studio_request_id", studioRequestId)
            .eq("status", "Paid")
            .not("production_job_id", "is", null)
            .order("paid_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!paidQuote?.id) continue;
          try {
            await ensurePreferredExpertAssignmentForPaidQuote(paidQuote.id);
          } catch (repairError) {
            console.error("Expert Portal paid-assignment self-repair failed:", repairError);
          }
        }
      }

      // Historical jobs approved before payout tracking was added can still show
      // Pending. Repair them on portal load so client approval means Ready for payout.
      const { data: pendingAssignments } = await admin
        .from("expert_assignments")
        .select("id,production_job_id,status,payout_status,payout_eligible_at")
        .eq("expert_profile_id", profile.id)
        .eq("payout_status", "pending");
      const pendingJobIds = (pendingAssignments || []).map((row: any) => row.production_job_id).filter(Boolean);
      if (pendingJobIds.length > 0) {
        const { data: completedJobs } = await admin
          .from("production_jobs")
          .select("id,client_approved_at")
          .in("id", pendingJobIds)
          .not("client_approved_at", "is", null);
        const approvedAtByJob = new Map((completedJobs || []).map((row: any) => [String(row.id), String(row.client_approved_at)]));
        for (const assignment of pendingAssignments || []) {
          const approvedAt = approvedAtByJob.get(String(assignment.production_job_id));
          if (!approvedAt) continue;
          await admin.from("expert_assignments").update({
            status: assignment.status === "cancelled" ? assignment.status : "completed",
            payout_status: "eligible",
            payout_eligible_at: assignment.payout_eligible_at || approvedAt,
            completed_at: approvedAt,
            updated_at: new Date().toISOString(),
          }).eq("id", assignment.id);
        }
      }

    }

    return NextResponse.json({ success: true, ...(await loadPayload(admin, profile)) });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Load Expert operations error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Expert projects could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, admin } = await requireApiUser(request);
    const profile = await activeProfile(admin, user.id);
    if (!profile) return NextResponse.json({ error: "Active Expert profile not found." }, { status: 403 });

    const body = (await request.json()) as Record<string, unknown>;
    const action = text(body.action, 80);

    if (action === "submit_quote") {
      const opportunityId = text(body.opportunityId, 100);
      const feeCents = Number(body.feeCents);
      const turnaroundDays = Number(body.turnaroundDays);
      const includedRevisions = Number(body.includedRevisions);
      const extraRevisionFeeCents = Number(body.extraRevisionFeeCents);
      const notes = text(body.notes, 5000) || null;

      if (!opportunityId) return NextResponse.json({ error: "Opportunity is required." }, { status: 400 });
      if (!Number.isInteger(feeCents) || feeCents < 0 || feeCents > 100_000_000) {
        return NextResponse.json({ error: "Enter a valid Expert fee." }, { status: 400 });
      }
      if (!Number.isInteger(turnaroundDays) || turnaroundDays < 1 || turnaroundDays > 365) {
        return NextResponse.json({ error: "Turnaround must be between 1 and 365 days." }, { status: 400 });
      }
      if (!Number.isInteger(includedRevisions) || includedRevisions < 0 || includedRevisions > 50) {
        return NextResponse.json({ error: "Included revisions must be between 0 and 50." }, { status: 400 });
      }
      if (!Number.isInteger(extraRevisionFeeCents) || extraRevisionFeeCents < 0 || extraRevisionFeeCents > 100_000_000) {
        return NextResponse.json({ error: "Enter a valid Expert fee for one additional revision." }, { status: 400 });
      }
      if (profile.availability === "unavailable") {
        return NextResponse.json({ error: "Set your availability to Available or Limited before submitting a quote." }, { status: 400 });
      }

      const { data: opportunity, error } = await admin
        .from("expert_opportunities")
        .select("id,status,expires_at,studio_request_id,shared_scope,currency")
        .eq("id", opportunityId)
        .eq("expert_profile_id", profile.id)
        .maybeSingle();
      if (error) throw error;
      if (!opportunity || !["requested", "quoted"].includes(opportunity.status)) {
        return NextResponse.json({ error: "This opportunity is no longer open for quoting." }, { status: 409 });
      }
      if (opportunity.expires_at && new Date(opportunity.expires_at).getTime() < Date.now()) {
        await admin.from("expert_opportunities").update({ status: "expired", closed_at: new Date().toISOString() }).eq("id", opportunity.id);
        return NextResponse.json({ error: "This opportunity has expired." }, { status: 409 });
      }

      const now = new Date().toISOString();
      const { error: updateError } = await admin
        .from("expert_opportunities")
        .update({
          status: "quoted",
          quoted_fee_cents: feeCents,
          turnaround_days: turnaroundDays,
          included_revisions: includedRevisions,
          extra_revision_fee_cents: extraRevisionFeeCents,
          expert_notes: notes,
          quoted_at: now,
          responded_at: now,
          updated_at: now,
        })
        .eq("id", opportunity.id)
        .eq("expert_profile_id", profile.id);
      if (updateError) throw updateError;

      const quoteProjectName =
        text(opportunity.shared_scope?.projectName, 300) || "Untitled project";
      const quoteService = text(opportunity.shared_scope?.service, 300) || "Production";
      const quoteStudio =
        text(opportunity.shared_scope?.studio, 100) || profile.studio || null;

      try {
        await sendAdminExpertQuoteSubmittedEmail({
          requestId: text(opportunity.studio_request_id, 100),
          opportunityId: opportunity.id,
          expertName: profile.full_name || "Expert",
          expertEmail: profile.email || null,
          projectName: quoteProjectName,
          service: quoteService,
          studio: quoteStudio,
          feeCents,
          currency: opportunity.currency || "USD",
          turnaroundDays,
          includedRevisions,
          extraRevisionFeeCents,
          notes,
          isUpdate: opportunity.status === "quoted",
          submittedAt: now,
        });
      } catch (emailError) {
        console.error("Expert quote Admin email failed:", emailError);
      }

      await notifyAdminOperationalEvent(admin, {
        key: `expert-quote-submitted-admin:${opportunity.id}:${now}`,
        type: "expert.quote.submitted.admin",
        projectName: quoteProjectName,
        service: quoteService,
        studio: quoteStudio,
        title: `${profile.full_name || "Expert"} submitted an Expert quote`,
        message: `A private Expert quote is ready to review and compare before preparing the client quote.`,
        status: opportunity.status === "quoted" ? "Quote updated" : "Quote received",
        details: [
          { label: "Expert", value: profile.full_name || "Expert" },
          { label: "Turnaround", value: `${turnaroundDays} day${turnaroundDays === 1 ? "" : "s"}` },
          { label: "Included revisions", value: String(includedRevisions) },
          { label: "Expert fee per extra revision", value: new Intl.NumberFormat("en-US", { style: "currency", currency: opportunity.currency || "USD" }).format(extraRevisionFeeCents / 100) },
        ],
        href: `/admin/studio-requests/${encodeURIComponent(text(opportunity.studio_request_id, 100))}`,
        sendEmail: false,
      });
    } else if (action === "decline_opportunity") {
      const opportunityId = text(body.opportunityId, 100);
      if (!opportunityId) return NextResponse.json({ error: "Opportunity is required." }, { status: 400 });

      const { data: opportunity, error: opportunityError } = await admin
        .from("expert_opportunities")
        .select("id,status,studio_request_id,shared_scope")
        .eq("id", opportunityId)
        .eq("expert_profile_id", profile.id)
        .maybeSingle();
      if (opportunityError) throw opportunityError;
      if (!opportunity || !["requested", "quoted"].includes(opportunity.status)) {
        return NextResponse.json({ error: "This opportunity is no longer open." }, { status: 409 });
      }

      const now = new Date().toISOString();
      const { error } = await admin
        .from("expert_opportunities")
        .update({ status: "declined", responded_at: now, closed_at: now, updated_at: now })
        .eq("id", opportunityId)
        .eq("expert_profile_id", profile.id)
        .in("status", ["requested", "quoted"]);
      if (error) throw error;

      try {
        await sendAdminExpertOpportunityDeclinedEmail({
          requestId: text(opportunity.studio_request_id, 100),
          opportunityId: opportunity.id,
          expertName: profile.full_name || "Expert",
          projectName:
            text(opportunity.shared_scope?.projectName, 300) || "Untitled project",
          service: text(opportunity.shared_scope?.service, 300) || "Production",
          studio: text(opportunity.shared_scope?.studio, 100) || profile.studio || null,
        });
      } catch (emailError) {
        console.error("Expert decline Admin notification failed:", emailError);
      }
    } else if (action === "submit_additional_scope_quote") {
      const addonId = text(body.addonId, 100);
      const expertCostCents = Number(body.expertCostCents);
      const turnaroundDays = Number(body.turnaroundDays);
      const notes = text(body.notes, 5000);
      if (!addonId) return NextResponse.json({ error: "Additional scope request is required." }, { status: 400 });
      if (!Number.isInteger(expertCostCents) || expertCostCents < 0 || expertCostCents > 100_000_000) {
        return NextResponse.json({ error: "Enter a valid Expert fee for the added scope." }, { status: 400 });
      }
      if (!Number.isInteger(turnaroundDays) || turnaroundDays < 1 || turnaroundDays > 365) {
        return NextResponse.json({ error: "Enter a valid turnaround in days." }, { status: 400 });
      }
      if (!notes) return NextResponse.json({ error: "Add a short note explaining what your additional quote covers." }, { status: 400 });

      const { data: addon, error: addonError } = await admin
        .from("production_addons")
        .select("id,production_job_id,status,title,description,currency")
        .eq("id", addonId)
        .eq("kind", "additional_scope")
        .maybeSingle();
      if (addonError) throw addonError;
      if (!addon) return NextResponse.json({ error: "Additional scope request not found." }, { status: 404 });
      if (!["awaiting_expert_quote", "expert_quoted"].includes(addon.status)) {
        return NextResponse.json({ error: "This additional scope is no longer open for an Expert quote." }, { status: 409 });
      }

      const { data: assignment, error: assignmentError } = await admin
        .from("expert_assignments")
        .select("id")
        .eq("production_job_id", addon.production_job_id)
        .eq("expert_profile_id", profile.id)
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return NextResponse.json({ error: "This additional scope is not assigned to your Expert profile." }, { status: 403 });

      const now = new Date().toISOString();
      const { error: updateError } = await admin
        .from("production_addons")
        .update({
          status: "expert_quoted",
          expert_cost_cents: expertCostCents,
          expert_turnaround_days: turnaroundDays,
          expert_notes: notes,
          expert_quoted_at: now,
          updated_at: now,
        })
        .eq("id", addon.id);
      if (updateError) throw updateError;

      const { data: addonJob } = await admin
        .from("production_jobs")
        .select("project_name,service,studio")
        .eq("id", addon.production_job_id)
        .maybeSingle();

      await notifyAdminOperationalEvent(admin, {
        key: `additional-scope-expert-quote:${addon.id}:${expertCostCents}:${turnaroundDays}`,
        type: "expert.project.additional_scope.quoted.admin",
        projectName: addonJob?.project_name || null,
        service: addonJob?.service || null,
        studio: addonJob?.studio || profile.studio || null,
        title: `${profile.full_name || "Expert"} quoted the additional scope`,
        message: notes,
        status: "Expert quote received",
        details: [
          { label: "Expert fee", value: `${String(addon.currency || "USD").toUpperCase()} ${(expertCostCents / 100).toFixed(2)}` },
          { label: "Turnaround", value: `${turnaroundDays} day${turnaroundDays === 1 ? "" : "s"}` },
        ],
        href: `/admin/production/${encodeURIComponent(addon.production_job_id)}?tab=Expert&expertView=packages`,
      });

      await admin.from("expert_project_messages").insert({
        assignment_id: assignment.id,
        sender_type: "expert",
        sender_user_id: user.id,
        body: `Additional scope quote submitted\n\nFee: ${String(addon.currency || "USD").toUpperCase()} ${(expertCostCents / 100).toFixed(2)}\nTurnaround: ${turnaroundDays} day${turnaroundDays === 1 ? "" : "s"}\n\n${notes}`,
        read_by_expert_at: now,
      });
    } else if (action === "send_message") {
      const assignmentId = text(body.assignmentId, 100);
      const message = text(body.message, 10000);
      if (!assignmentId || !message) return NextResponse.json({ error: "Project and message are required." }, { status: 400 });

      const { data: assignment, error } = await admin
        .from("expert_assignments")
        .select("id,status,production_job_id")
        .eq("id", assignmentId)
        .eq("expert_profile_id", profile.id)
        .maybeSingle();
      if (error) throw error;
      if (!assignment || assignment.status === "cancelled") {
        return NextResponse.json({ error: "Assigned project not found." }, { status: 404 });
      }

      const { error: insertError } = await admin.from("expert_project_messages").insert({
        assignment_id: assignment.id,
        sender_type: "expert",
        sender_user_id: user.id,
        body: message,
        read_by_expert_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      const { data: job } = await admin
        .from("production_jobs")
        .select("id,project_name,service,studio")
        .eq("id", assignment.production_job_id)
        .maybeSingle();
      await notifyAdminOperationalEvent(admin, {
        key: `expert-message-admin:${assignment.id}:${Date.now()}`,
        type: "expert.project.message.admin",
        projectName: job?.project_name || null,
        service: job?.service || null,
        studio: job?.studio || profile.studio || null,
        title: `New Expert message from ${profile.full_name || "Expert"}`,
        message,
        status: "Reply needed",
        details: [{ label: "Expert", value: profile.full_name || "Expert" }],
        href: `/admin/production/${encodeURIComponent(assignment.production_job_id)}?tab=Expert`,
      });
    } else if (action === "complete_submission_batch") {
      const assignmentId = text(body.assignmentId, 100);
      const batchId = text(body.batchId, 100);
      const note = text(body.note, 5000);
      if (!assignmentId || !batchId) return NextResponse.json({ error: "Assigned project and review package are required." }, { status: 400 });
      if (!note) return NextResponse.json({ error: "Add a submission note before sending this package to Heyy Studio." }, { status: 400 });

      const { data: assignment, error: assignmentError } = await admin
        .from("expert_assignments")
        .select("id,production_job_id,status")
        .eq("id", assignmentId)
        .eq("expert_profile_id", profile.id)
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment || assignment.status === "cancelled") return NextResponse.json({ error: "Assigned project not found." }, { status: 404 });

      const { data: packageRows, error: packageError } = await admin
        .from("expert_submissions")
        .select("id,filename,batch_sequence,status")
        .eq("assignment_id", assignment.id)
        .eq("batch_id", batchId)
        .eq("expert_profile_id", profile.id);
      if (packageError) throw packageError;
      if (!packageRows?.length) return NextResponse.json({ error: "No uploaded files were found for this review package." }, { status: 404 });

      const now = new Date().toISOString();
      const { error: noteError } = await admin
        .from("expert_submissions")
        .update({ notes: note, status: "submitted", submitted_at: now, updated_at: now })
        .eq("assignment_id", assignment.id)
        .eq("batch_id", batchId);
      if (noteError) throw noteError;

      const { error: assignmentUpdateError } = await admin
        .from("expert_assignments")
        .update({ status: "submitted", submitted_at: now, updated_at: now })
        .eq("id", assignment.id);
      if (assignmentUpdateError) throw assignmentUpdateError;

      const sequence = Number(packageRows[0]?.batch_sequence || 1);
      const packageMessage = `Review Package #${sequence} submitted (${packageRows.length} file${packageRows.length === 1 ? "" : "s"})${note ? `\n\n${note}` : ""}`;
      const { data: existingPackageMessage } = await admin
        .from("expert_project_messages")
        .select("id")
        .eq("assignment_id", assignment.id)
        .eq("body", packageMessage)
        .limit(1)
        .maybeSingle();
      if (!existingPackageMessage) {
        const { error: messageError } = await admin.from("expert_project_messages").insert({
          assignment_id: assignment.id,
          sender_type: "expert",
          sender_user_id: user.id,
          body: packageMessage,
          read_by_expert_at: now,
        });
        if (messageError) throw messageError;
      }

      const { data: job } = await admin
        .from("production_jobs")
        .select("id,project_name,service,studio")
        .eq("id", assignment.production_job_id)
        .maybeSingle();
      await notifyAdminOperationalEvent(admin, {
        key: `expert-package-submitted:${batchId}`,
        type: "expert.package.submitted.admin",
        projectName: job?.project_name || null,
        service: job?.service || null,
        studio: job?.studio || profile.studio || null,
        title: `${profile.full_name || "Expert"} submitted Review Package #${sequence}`,
        message: note || `${packageRows.length} file${packageRows.length === 1 ? "" : "s"} are ready for Heyy Studio review.`,
        status: "Admin review needed",
        details: [
          { label: "Files", value: packageRows.map((item: any) => item.filename).join(", ") },
          { label: "Expert", value: profile.full_name || "Expert" },
        ],
        href: `/admin/production/${encodeURIComponent(assignment.production_job_id)}?tab=Expert`,
      });

      await notifyExpertOperationalEvent(admin, {
        key: `expert-package-submission-confirmed:${batchId}`,
        type: "expert.package.submitted",
        expertUserId: user.id,
        expertEmail: profile.email || null,
        expertName: profile.full_name || "Expert",
        projectName: job?.project_name || null,
        service: job?.service || null,
        studio: job?.studio || profile.studio || null,
        title: `Review Package #${sequence} submitted`,
        message: `${packageRows.length} file${packageRows.length === 1 ? "" : "s"} were submitted to Heyy Studio for Admin review.`,
        status: "Submitted to Heyy Studio",
        href: `/expert?section=projects&assignment=${encodeURIComponent(assignment.id)}&panel=files`,
      });
    } else if (action === "mark_messages_read") {
      const assignmentId = text(body.assignmentId, 100);
      if (!assignmentId) return NextResponse.json({ error: "Assigned project is required." }, { status: 400 });

      const { data: assignment, error } = await admin
        .from("expert_assignments")
        .select("id")
        .eq("id", assignmentId)
        .eq("expert_profile_id", profile.id)
        .maybeSingle();
      if (error) throw error;
      if (!assignment) return NextResponse.json({ error: "Assigned project not found." }, { status: 404 });

      const { error: readError } = await admin
        .from("expert_project_messages")
        .update({ read_by_expert_at: new Date().toISOString() })
        .eq("assignment_id", assignment.id)
        .eq("sender_type", "admin")
        .is("read_by_expert_at", null);
      if (readError) throw readError;
    } else if (action === "start_assignment") {
      const assignmentId = text(body.assignmentId, 100);
      if (!assignmentId) return NextResponse.json({ error: "Assigned project is required." }, { status: 400 });
      const now = new Date().toISOString();
      const { data: startedAssignment, error } = await admin
        .from("expert_assignments")
        .update({ status: "in_progress", started_at: now, updated_at: now })
        .eq("id", assignmentId)
        .eq("expert_profile_id", profile.id)
        .eq("status", "assigned")
        .select("id,production_job_id")
        .maybeSingle();
      if (error) throw error;
      if (!startedAssignment) {
        return NextResponse.json({ error: "This project has already been started or is no longer available to start." }, { status: 409 });
      }

      await admin
        .from("production_jobs")
        .update({ status: "In Progress", delivery_status: "In Production", updated_at: now })
        .eq("id", startedAssignment.production_job_id);

      await admin.from("production_timeline").insert({
        production_job_id: startedAssignment.production_job_id,
        title: "Expert Production Started",
        description: "The assigned Expert started work on this production project.",
        status: "In Progress",
        created_by: "Expert",
      });

      const { data: startedJob } = await admin
        .from("production_jobs")
        .select("project_name,service,studio")
        .eq("id", startedAssignment.production_job_id)
        .maybeSingle();
      await notifyAdminOperationalEvent(admin, {
        key: `expert-project-started:${assignmentId}`,
        type: "expert.project.started.admin",
        projectName: startedJob?.project_name || null,
        service: startedJob?.service || null,
        studio: startedJob?.studio || profile.studio || null,
        title: `${profile.full_name || "Expert"} started production`,
        message: "The assigned Expert marked the project as in progress.",
        status: "In progress",
        href: `/admin/production/${encodeURIComponent(startedAssignment.production_job_id)}?tab=Expert&expertView=packages`,
      });
    } else {
      return NextResponse.json({ error: "Unknown Expert action." }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...(await loadPayload(admin, profile)) });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Expert operations action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Expert action failed." },
      { status: 500 },
    );
  }
}
