import "server-only";

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Notifications } from "@/lib/notifications";
import { notifyAdminOperationalEvent, notifyExpertOperationalEvent } from "@/lib/expert-network/operational-notifications";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function processProductionAddonPayment(session: Stripe.Checkout.Session) {
  const addonId = String(session.metadata?.production_addon_id || "").trim();
  if (!addonId) return { handled: false as const };
  if (session.payment_status !== "paid") throw new Error("Production add-on payment is not confirmed.");

  const admin = adminClient();
  const { data: addon, error: addonError } = await admin
    .from("production_addons")
    .select("*")
    .eq("id", addonId)
    .maybeSingle();
  if (addonError) throw addonError;
  if (!addon) throw new Error("Production add-on could not be found.");

  if (addon.status !== "paid") {
    const now = new Date().toISOString();
    const { data: paidAddon, error: paidError } = await admin
      .from("production_addons")
      .update({ status: "paid", paid_at: now, stripe_session_id: session.id, updated_at: now })
      .eq("id", addon.id)
      .neq("status", "paid")
      .select("*")
      .maybeSingle();
    if (paidError) throw paidError;

    if (paidAddon && Number(paidAddon.expert_cost_cents || 0) > 0) {
      const { data: assignment, error: assignmentError } = await admin
        .from("expert_assignments")
        .select("id,expert_profile_id,agreed_fee_cents,currency")
        .eq("production_job_id", paidAddon.production_job_id)
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (assignment) {
        const current = Number(assignment.agreed_fee_cents || 0);
        const extra = Number(paidAddon.expert_cost_cents || 0);
        const { error: feeError } = await admin
          .from("expert_assignments")
          .update({ agreed_fee_cents: current + extra, updated_at: now })
          .eq("id", assignment.id);
        if (feeError) throw feeError;

        const { data: expert } = await admin
          .from("expert_profiles")
          .select("user_id,email,full_name")
          .eq("id", assignment.expert_profile_id)
          .maybeSingle();
        const { data: job } = await admin
          .from("production_jobs")
          .select("project_name,service,studio")
          .eq("id", paidAddon.production_job_id)
          .maybeSingle();
        if (expert) {
          await notifyExpertOperationalEvent(admin, {
            key: `production-addon-paid-expert:${paidAddon.id}`,
            type: "expert.project.additional_scope.paid",
            expertUserId: expert.user_id || null,
            expertEmail: expert.email || null,
            expertName: expert.full_name || "Expert",
            projectName: job?.project_name || null,
            service: job?.service || null,
            studio: job?.studio || null,
            title: paidAddon.kind === "extra_revision" ? "Client purchased an additional revision" : "Additional project scope is approved and paid",
            message: paidAddon.kind === "extra_revision"
              ? `The client purchased one additional revision round. Your additional Expert fee of ${new Intl.NumberFormat("en-US", { style: "currency", currency: paidAddon.currency || assignment.currency || "USD" }).format(extra / 100)} has been added to this project's payout total.`
              : `${paidAddon.title} is now active. The agreed additional Expert fee has been added to your project payout total.`,
            status: paidAddon.kind === "extra_revision" ? "Additional revision paid" : "Additional scope active",
            href: `/expert?section=projects&assignment=${encodeURIComponent(assignment.id)}&panel=${paidAddon.kind === "extra_revision" ? "revisions" : "overview"}`,
          });
        }
      }
    }

    const { data: job } = await admin
      .from("production_jobs")
      .select("id,user_id,project_id,project_name,service,studio,client_email,client_name")
      .eq("id", paidAddon.production_job_id)
      .maybeSingle();

    if (job) {
      await Promise.allSettled([
        Notifications.emit({
          event: "production.addon.paid",
          projectId: job.project_id,
          projectName: job.project_name,
          service: job.service,
          studio: job.studio,
          userId: job.user_id,
          clientName: job.client_name || null,
          clientEmail: job.client_email || null,
          metadata: {
            productionJobId: job.id,
            productionView: paidAddon.kind === "extra_revision" ? "revisions" : "review",
            status: "Paid",
            addonId: paidAddon.id,
            addonKind: paidAddon.kind,
            addonTitle: paidAddon.title,
            addonDescription: paidAddon.description,
            amount: Number(paidAddon.client_amount_cents || 0) / 100,
            currency: paidAddon.currency || "USD",
          },
        }),
        notifyAdminOperationalEvent(admin, {
          key: `production-addon-paid-admin:${paidAddon.id}`,
          type: "production.addon.paid.admin",
          projectName: job.project_name || null,
          service: job.service || null,
          studio: job.studio || null,
          title: paidAddon.kind === "extra_revision" ? "Additional revision payment received" : "Additional scope payment received",
          message: `${paidAddon.title} has been paid and is now active.`,
          status: "Paid",
          href: `/admin/production/${encodeURIComponent(job.id)}?tab=Expert&expertView=${paidAddon.kind === "extra_revision" ? "payout" : "packages"}`,
        }),
      ]);
    }
  }

  return {
    handled: true as const,
    addonId: addon.id as string,
    productionJobId: addon.production_job_id as string,
    userId: addon.user_id as string | null,
    kind: addon.kind as string,
    title: addon.title as string,
  };
}
