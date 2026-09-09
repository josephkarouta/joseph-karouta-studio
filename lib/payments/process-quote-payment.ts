import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Notifications } from "../notifications";
import { productionServiceMatches, resolveProductionService } from "@/lib/production/service-registry";
import {
  notifyAdminOperationalEvent,
  notifyExpertOperationalEvent,
} from "@/lib/expert-network/operational-notifications";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type QuotePaymentResult = {
  handled: boolean;
  quoteId?: string;
  productionJobId?: string;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "Unknown error");
  }
  return String(error || "Unknown error");
}

async function runNonCritical(label: string, action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    console.error(`[QUOTE PAYMENT] ${label} failed:`, error);
  }
}


async function loadPreferredExpertOpportunity(
  studioRequestId: string,
  preferredOpportunityId?: string | null,
  expectedExpertCostAmount?: number | null,
) {
  const requestId = String(studioRequestId || "").trim();
  const candidateIds: string[] = [];
  if (preferredOpportunityId) candidateIds.push(String(preferredOpportunityId));

  const { data: studioRequest, error: studioRequestError } = await supabase
    .from("studio_requests")
    .select("id,metadata")
    .eq("id", requestId)
    .limit(1)
    .maybeSingle();
  if (studioRequestError) {
    throw new Error(
      `Could not load the production request for Expert assignment: ${errorMessage(studioRequestError)}`,
    );
  }

  const metadataPreferredId = String(
    studioRequest?.metadata?.preferred_expert_opportunity_id || "",
  ).trim();
  if (metadataPreferredId && !candidateIds.includes(metadataPreferredId)) {
    candidateIds.push(metadataPreferredId);
  }

  for (const candidateId of candidateIds) {
    const { data, error } = await supabase
      .from("expert_opportunities")
      .select("*")
      .eq("id", candidateId)
      .eq("studio_request_id", requestId)
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`Could not load the preferred Expert: ${errorMessage(error)}`);
    }
    if (data) return data;
  }

  const { data: selected, error: selectedError } = await supabase
    .from("expert_opportunities")
    .select("*")
    .eq("studio_request_id", requestId)
    .eq("status", "selected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (selectedError) {
    throw new Error(`Could not load the selected Expert: ${errorMessage(selectedError)}`);
  }
  if (selected) return selected;

  const expectedCost = Number(expectedExpertCostAmount || 0);
  if (Number.isFinite(expectedCost) && expectedCost > 0) {
    const expectedFeeCents = Math.round(expectedCost * 100);
    const { data: matchingFee, error: matchingFeeError } = await supabase
      .from("expert_opportunities")
      .select("*")
      .eq("studio_request_id", requestId)
      .eq("quoted_fee_cents", expectedFeeCents)
      .in("status", ["selected", "quoted", "closed"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (matchingFeeError) {
      throw new Error(
        `Could not reconcile the paid Expert quote: ${errorMessage(matchingFeeError)}`,
      );
    }
    if (matchingFee) return matchingFee;
  }

  return null;
}

async function notifyPreferredExpertAssignment(
  assignment: any,
  opportunity: any,
  productionJob: any,
) {
  const { data: job, error: jobError } = await supabase
    .from("production_jobs")
    .select("id,project_name,service,studio,assigned_studio")
    .eq("id", productionJob.id)
    .limit(1)
    .maybeSingle();
  if (jobError) throw jobError;

  const { data: expert, error: expertError } = await supabase
    .from("expert_profiles")
    .select("id,user_id,email,full_name")
    .eq("id", opportunity.expert_profile_id)
    .limit(1)
    .maybeSingle();
  if (expertError) throw expertError;

  const projectName = job?.project_name || "Assigned project";
  const service = job?.service || opportunity.shared_scope?.service || "Production";
  const studio = job?.studio || job?.assigned_studio || opportunity.shared_scope?.studio || null;
  const assignmentHref = `/expert?section=projects&assignment=${encodeURIComponent(assignment.id)}&panel=overview`;

  if (expert) {
    await notifyExpertOperationalEvent(supabase, {
      key: `expert-assigned-after-payment:${assignment.id}`,
      type: "expert.project.assigned",
      expertUserId: expert.user_id,
      expertEmail: expert.email,
      expertName: expert.full_name,
      projectName,
      service,
      studio,
      title: "Client payment confirmed — project assigned",
      message:
        "The client payment is confirmed. This project is now formally assigned to you and work can begin from the agreed scope.",
      status: "Assigned",
      details: [
        {
          label: "Agreed fee",
          value: `${assignment.currency || "USD"} ${(Number(assignment.agreed_fee_cents || 0) / 100).toFixed(2)}`,
        },
        {
          label: "Turnaround",
          value: assignment.turnaround_days ? `${assignment.turnaround_days} days` : null,
        },
        {
          label: "Included revisions",
          value:
            assignment.included_revisions === null || assignment.included_revisions === undefined
              ? null
              : String(assignment.included_revisions),
        },
      ],
      href: assignmentHref,
    });
  }

  await notifyAdminOperationalEvent(supabase, {
    key: `expert-assignment-confirmed-admin:${assignment.id}`,
    type: "expert.assignment.confirmed",
    projectName,
    service,
    studio,
    title: "Preferred Expert assigned after payment",
    message: `${expert?.full_name || "The preferred Expert"} is now assigned to the paid production job.`,
    status: "Assigned",
    details: [
      { label: "Expert", value: expert?.full_name || null },
      {
        label: "Agreed fee",
        value: `${assignment.currency || "USD"} ${(Number(assignment.agreed_fee_cents || 0) / 100).toFixed(2)}`,
      },
    ],
    href: `/admin/production/${encodeURIComponent(productionJob.id)}?tab=Expert`,
    sendEmail: false,
  });
}

async function activatePreferredExpert(
  studioRequestId: string,
  productionJob: any,
  paidAt: string,
  preferredOpportunityId?: string | null,
  requirePreferredExpert = false,
  expectedExpertCostAmount?: number | null,
) {
  const selectedOpportunity = await loadPreferredExpertOpportunity(
    studioRequestId,
    preferredOpportunityId,
    expectedExpertCostAmount,
  );

  if (!selectedOpportunity) {
    if (requirePreferredExpert) {
      throw new Error(
        "This paid quote includes Expert production cost, but the preferred Expert link could not be resolved. The production job was preserved; re-open the paid quote to retry the Expert assignment.",
      );
    }
    return null;
  }

  if (
    selectedOpportunity.quoted_fee_cents === null ||
    selectedOpportunity.quoted_fee_cents === undefined
  ) {
    throw new Error("The preferred Expert quote is missing its agreed fee.");
  }

  const { error: linkError } = await supabase
    .from("expert_opportunities")
    .update({
      production_job_id: String(productionJob.id),
      updated_at: paidAt,
    })
    .eq("id", selectedOpportunity.id);

  if (linkError) {
    throw new Error(
      `Could not link the Expert opportunity to production: ${errorMessage(linkError)}`,
    );
  }

  const { data: existingAssignment, error: existingAssignmentError } =
    await supabase
      .from("expert_assignments")
      .select("*")
      .eq("production_job_id", String(productionJob.id))
      .limit(1)
      .maybeSingle();

  if (existingAssignmentError) {
    throw new Error(
      `Could not check the Expert assignment: ${errorMessage(existingAssignmentError)}`,
    );
  }

  if (existingAssignment) {
    if (
      String(existingAssignment.expert_profile_id) !==
      String(selectedOpportunity.expert_profile_id)
    ) {
      throw new Error(
        "This production job already has a different Expert assignment. Admin review is required before changing the Expert.",
      );
    }
    let reconciledAssignment = existingAssignment;
    if ((existingAssignment.extra_revision_fee_cents === null || existingAssignment.extra_revision_fee_cents === undefined) && selectedOpportunity.extra_revision_fee_cents !== null && selectedOpportunity.extra_revision_fee_cents !== undefined) {
      const { data: updatedAssignment } = await supabase
        .from("expert_assignments")
        .update({ extra_revision_fee_cents: selectedOpportunity.extra_revision_fee_cents, updated_at: paidAt })
        .eq("id", existingAssignment.id)
        .select("*")
        .maybeSingle();
      if (updatedAssignment) reconciledAssignment = updatedAssignment;
    }
    await runNonCritical("Expert assignment notification", () =>
      notifyPreferredExpertAssignment(reconciledAssignment, selectedOpportunity, productionJob),
    );
    return reconciledAssignment;
  }

  const turnaroundDays = Number(selectedOpportunity.turnaround_days || 0);
  const dueAt = turnaroundDays > 0
    ? new Date(
        new Date(paidAt).getTime() + turnaroundDays * 24 * 60 * 60 * 1000,
      ).toISOString()
    : null;

  const { data: assignment, error: assignmentError } = await supabase
    .from("expert_assignments")
    .insert({
      production_job_id: String(productionJob.id),
      opportunity_id: selectedOpportunity.id,
      expert_profile_id: selectedOpportunity.expert_profile_id,
      status: "assigned",
      shared_scope: selectedOpportunity.shared_scope || {},
      agreed_fee_cents: selectedOpportunity.quoted_fee_cents,
      currency: selectedOpportunity.currency || "USD",
      turnaround_days: selectedOpportunity.turnaround_days,
      included_revisions: selectedOpportunity.included_revisions,
      extra_revision_fee_cents: selectedOpportunity.extra_revision_fee_cents ?? null,
      assigned_by: selectedOpportunity.requested_by || null,
      assigned_at: paidAt,
      due_at: dueAt,
      payout_status: "pending",
      updated_at: paidAt,
    })
    .select()
    .single();

  if (assignmentError?.code === "23505") {
    const { data: racedAssignment, error: racedError } = await supabase
      .from("expert_assignments")
      .select("*")
      .eq("production_job_id", String(productionJob.id))
      .limit(1)
      .maybeSingle();
    if (racedError || !racedAssignment) {
      throw new Error(
        `Expert assignment already existed but could not be reloaded: ${errorMessage(
          racedError || assignmentError,
        )}`,
      );
    }
    await runNonCritical("Expert assignment notification", () =>
      notifyPreferredExpertAssignment(racedAssignment, selectedOpportunity, productionJob),
    );
    return racedAssignment;
  }

  if (assignmentError || !assignment) {
    throw new Error(
      `Could not activate the preferred Expert: ${errorMessage(assignmentError)}`,
    );
  }

  await runNonCritical("Expert assignment timeline", async () => {
    const { error } = await supabase.from("production_timeline").insert({
      production_job_id: productionJob.id,
      title: "Expert Assigned",
      description:
        "The preferred Expert was activated automatically after client payment.",
      status: "Assigned",
      created_by: "System",
      event_key: "expert_assignment_activated",
    });
    if (error && error.code !== "23505") throw error;
  });

  await runNonCritical("Expert assignment notification", () =>
    notifyPreferredExpertAssignment(assignment, selectedOpportunity, productionJob),
  );

  return assignment;
}

export async function ensurePreferredExpertAssignmentForPaidQuote(
  quoteId: string,
) {
  const { data: quote, error: quoteError } = await supabase
    .from("workspace_quotes")
    .select("*")
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) {
    throw new Error(
      `Quote ${quoteId} could not be loaded: ${errorMessage(quoteError)}`,
    );
  }

  if (
    String(quote.status || "").toLowerCase() !== "paid" ||
    !quote.production_job_id ||
    !quote.studio_request_id
  ) {
    return null;
  }

  return activatePreferredExpert(
    quote.studio_request_id,
    { id: quote.production_job_id },
    quote.paid_at || new Date().toISOString(),
    quote.expert_opportunity_id || null,
    Boolean(
      quote.expert_opportunity_id ||
        Number(quote.expert_cost_amount || 0) > 0
    ),
    Number(quote.expert_cost_amount || 0) || null,
  );
}

export async function processQuotePayment(
  session: Stripe.Checkout.Session,
): Promise<QuotePaymentResult> {
  const quoteId = session.metadata?.quote_id;

  // This helper is called for checkout.session.completed events in general.
  // Only label/log the event as a quote payment once it actually contains a
  // quote_id; subscription and credit-pack sessions are handled elsewhere.
  if (!quoteId) {
    return { handled: false };
  }

  console.log("[QUOTE PAYMENT] Session:", session.id);
  console.log("[QUOTE PAYMENT] Metadata:", session.metadata);

  const { data: quote, error: quoteError } = await supabase
    .from("workspace_quotes")
    .select("*")
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) {
    throw new Error(
      `Quote ${quoteId} could not be loaded: ${errorMessage(quoteError)}`,
    );
  }

  const paidAt = new Date().toISOString();
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  let { data: existingPayment, error: existingPaymentError } = await supabase
    .from("payments")
    .select("id")
    .eq("idempotency_stripe_session_id", session.id)
    .limit(1)
    .maybeSingle();

  // Compatibility fallback for historic rows created before the V2 idempotency migration.
  if (!existingPayment && !existingPaymentError) {
    const legacyPayment = await supabase
      .from("payments")
      .select("id")
      .eq("stripe_session_id", session.id)
      .limit(1)
      .maybeSingle();

    existingPayment = legacyPayment.data;
    existingPaymentError = legacyPayment.error;
  }

  if (existingPaymentError) {
    throw new Error(
      `Could not check the payment record: ${errorMessage(existingPaymentError)}`,
    );
  }

  if (!existingPayment) {
    const { error: paymentError } = await supabase.from("payments").insert({
      quote_id: quote.id,
      stripe_session_id: session.id,
      idempotency_stripe_session_id: session.id,
      stripe_payment_intent: paymentIntentId,
      provider: "stripe",
      amount: Number(quote.amount),
      currency: quote.currency || "USD",
      status: "Paid",
      paid_at: paidAt,
    });

    if (paymentError && paymentError.code !== "23505") {
      throw new Error(
        `Could not save the payment record: ${errorMessage(paymentError)}`,
      );
    }
  }

  if (quote.production_job_id) {
    const { error: paidQuoteError } = await supabase
      .from("workspace_quotes")
      .update({
        status: "Paid",
        paid_at: quote.paid_at || paidAt,
        updated_at: paidAt,
      })
      .eq("id", quote.id);

    if (paidQuoteError) {
      throw new Error(
        `Could not confirm the paid quote: ${errorMessage(paidQuoteError)}`,
      );
    }

    // A previous webhook attempt may have created/linked the production job
    // before Expert activation finished. Always retry the pre-selected Expert
    // handoff here so payment idempotency cannot leave a paid project without
    // its intended Expert assignment.
    if (quote.studio_request_id) {
      await activatePreferredExpert(
        quote.studio_request_id,
        { id: quote.production_job_id },
        quote.paid_at || paidAt,
        quote.expert_opportunity_id || null,
        Boolean(
          quote.expert_opportunity_id ||
            Number(quote.expert_cost_amount || 0) > 0
        ),
        Number(quote.expert_cost_amount || 0) || null,
      );
    }

    return {
      handled: true,
      quoteId: quote.id,
      productionJobId: quote.production_job_id,
    };
  }

  let studioRequest: any = null;

  if (quote.studio_request_id) {
    const { data, error } = await supabase
      .from("studio_requests")
      .select("*")
      .eq("id", quote.studio_request_id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Could not load the studio request: ${errorMessage(error)}`,
      );
    }

    studioRequest = data;
  }

  const productionService = resolveProductionService({
    serviceId:
      session.metadata?.service_id ||
      quote.service_id ||
      studioRequest?.service_id ||
      studioRequest?.metadata?.service_id,
    service: quote.service || studioRequest?.service || quote.title,
    studio: quote.studio || studioRequest?.studio,
  });
  const service = productionService.label;

  let possibleJobsQuery = supabase
    .from("production_jobs")
    .select("*")
    .eq("project_id", quote.project_id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (studioRequest?.user_id) {
    possibleJobsQuery = possibleJobsQuery.eq("user_id", studioRequest.user_id);
  }

  const { data: possibleJobs, error: possibleJobsError } =
    await possibleJobsQuery;

  if (possibleJobsError) {
    throw new Error(
      `Could not check for an existing production job: ${errorMessage(possibleJobsError)}`,
    );
  }

  let productionJob = (possibleJobs || []).find(
    (job: any) =>
      job?.payment_quote_id === quote.id ||
      job?.metadata?.quote_id === quote.id ||
      (quote.studio_request_id &&
        job?.metadata?.studio_request_id === quote.studio_request_id &&
        productionServiceMatches(job, productionService)),
  );

  // V2 uses a dedicated payment_quote_id column. Historic duplicate jobs can
  // remain untouched; exactly one canonical row carries this unique key.
  if (!productionJob) {
    const { data: canonicalJob, error: canonicalJobError } = await supabase
      .from("production_jobs")
      .select("*")
      .eq("payment_quote_id", quote.id)
      .limit(1)
      .maybeSingle();

    if (canonicalJobError) {
      throw new Error(
        `Could not check the canonical quote production job: ${errorMessage(canonicalJobError)}`,
      );
    }

    productionJob = canonicalJob || null;
  }

  // Legacy metadata fallback keeps old records compatible.
  // This explicit lookup also makes normal retries cheap and keeps older jobs compatible.
  if (!productionJob) {
    const { data: quoteJob, error: quoteJobError } = await supabase
      .from("production_jobs")
      .select("*")
      .contains("metadata", { quote_id: quote.id })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (quoteJobError) {
      throw new Error(
        `Could not check the quote production job: ${errorMessage(quoteJobError)}`,
      );
    }

    productionJob = quoteJob || null;
  }

  if (!productionJob) {
    const metadata = {
      ...(studioRequest?.metadata || {}),
      quote_id: quote.id,
      studio_request_id: quote.studio_request_id || null,
      stripe_session_id: session.id,
      service_id: productionService.id,
      service_label: productionService.label,
    };

    const { data, error: jobError } = await supabase
      .from("production_jobs")
      .insert({
        project_id: quote.project_id,
        project_name: studioRequest?.project_name || quote.title,
        user_id: studioRequest?.user_id || null,
        studio: productionService.studio,
        assigned_studio: productionService.studio,
        service_id: productionService.id,
        service,
        status: "Assigned",
        priority: "Normal",
        delivery_status: "Paid",
        preview_image: studioRequest?.preview_image || null,
        notes: studioRequest?.notes || "",
        payment_quote_id: quote.id,
        metadata,
      })
      .select()
      .single();

    if (jobError?.code === "23505") {
      // Two webhook/reconciliation executions can reach this insert together.
      // The database lets only one win; the loser reuses that exact job.
      let { data: existingJobAfterRace, error: existingJobAfterRaceError } =
        await supabase
          .from("production_jobs")
          .select("*")
          .eq("payment_quote_id", quote.id)
          .limit(1)
          .maybeSingle();

      if (!existingJobAfterRace && !existingJobAfterRaceError) {
        const legacyRaceJob = await supabase
          .from("production_jobs")
          .select("*")
          .contains("metadata", { quote_id: quote.id })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        existingJobAfterRace = legacyRaceJob.data;
        existingJobAfterRaceError = legacyRaceJob.error;
      }

      if (existingJobAfterRaceError || !existingJobAfterRace) {
        throw new Error(
          `Production job already existed but could not be reloaded: ${errorMessage(
            existingJobAfterRaceError || jobError,
          )}`,
        );
      }

      productionJob = existingJobAfterRace;
    } else if (jobError || !data) {
      throw new Error(
        `Production job creation failed: ${errorMessage(jobError)}`,
      );
    } else {
      productionJob = data;
    }
  }

  const { error: quoteUpdateError } = await supabase
    .from("workspace_quotes")
    .update({
      status: "Paid",
      paid_at: paidAt,
      production_job_id: productionJob.id,
      updated_at: paidAt,
    })
    .eq("id", quote.id);

  if (quoteUpdateError) {
    throw new Error(
      `Could not link the production job to the quote: ${errorMessage(quoteUpdateError)}`,
    );
  }

  if (quote.studio_request_id) {
    await activatePreferredExpert(
      quote.studio_request_id,
      productionJob,
      paidAt,
      quote.expert_opportunity_id || null,
      Boolean(
        quote.expert_opportunity_id ||
          Number(quote.expert_cost_amount || 0) > 0
      ),
      Number(quote.expert_cost_amount || 0) || null,
    );
  }

  if (quote.studio_request_id) {
    await runNonCritical("Studio request conversion", async () => {
      const { error } = await supabase
        .from("studio_requests")
        .update({
          status: "Converted",
          updated_at: paidAt,
        })
        .eq("id", quote.studio_request_id);

      if (error) throw error;
    });
  }

  await runNonCritical("Production timeline", async () => {
    const { error } = await supabase.from("production_timeline").insert({
      production_job_id: productionJob.id,
      title: "Payment Received",
      description: "Quote paid and production job created.",
      status: "Assigned",
      created_by: "System",
      event_key: "payment_received",
    });

    if (error && error.code !== "23505") throw error;
  });

  await runNonCritical("Production system message", async () => {
    const { error } = await supabase.from("production_messages").insert({
      production_job_id: productionJob.id,
      sender_type: "system",
      sender_name: "Heyy Studio",
      message: "Payment received. Your production job has started.",
      event_key: "payment_received",
    });

    if (error && error.code !== "23505") throw error;
  });

  await runNonCritical("Payment notification", async () => {
    await Notifications.emit({
      event: "payment.received",
      projectId: quote.project_id,
      projectName: studioRequest?.project_name || quote.title,
      service,
      studio: productionService.studio,
      userId: studioRequest?.user_id,
      clientName:
        studioRequest?.metadata?.client_name ||
        studioRequest?.metadata?.name ||
        null,
      clientEmail:
        studioRequest?.metadata?.client_email ||
        studioRequest?.metadata?.email ||
        null,
      metadata: {
        serviceId: productionService.id,
        paymentId: session.id,
        quoteId: quote.id,
        productionJobId: productionJob.id,
        amount: quote.amount,
        currency: quote.currency,
        productionOnly: Boolean(studioRequest?.metadata?.production_only),
      },
    });

    await notifyAdminOperationalEvent(supabase, {
      key: `production-payment-admin:${quote.id}`,
      type: "production.payment.received",
      projectName: studioRequest?.project_name || quote.title,
      service,
      studio: productionService.studio,
      title: "Client payment received",
      message: "The client paid the production quote and the production job is active.",
      status: "Paid",
      details: [
        { label: "Amount", value: `${quote.currency || "USD"} ${Number(quote.amount || 0).toFixed(2)}` },
      ],
      href: `/admin/production/${encodeURIComponent(productionJob.id)}?tab=Workbench`,
      sendEmail: false,
    });
  });

  return {
    handled: true,
    quoteId: quote.id,
    productionJobId: productionJob.id,
  };
}
