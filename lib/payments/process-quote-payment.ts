import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Notifications } from "../notifications";
import { productionServiceMatches, resolveProductionService } from "@/lib/production/service-registry";

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
      metadata: {
        serviceId: productionService.id,
        paymentId: session.id,
        quoteId: quote.id,
        productionJobId: productionJob.id,
        amount: quote.amount,
        currency: quote.currency,
      },
    });
  });

  return {
    handled: true,
    quoteId: quote.id,
    productionJobId: productionJob.id,
  };
}
