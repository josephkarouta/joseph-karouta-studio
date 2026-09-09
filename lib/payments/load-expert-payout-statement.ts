import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpertPayoutStatementData } from "@/lib/payments/expert-payout-statement";

function additionLabel(addon: Record<string, any>) {
  if (addon.kind === "extra_revision") return "Additional revision";
  return String(addon.title || "Additional project scope").trim() || "Additional project scope";
}

export async function loadExpertPayoutStatementData(
  admin: SupabaseClient,
  assignmentId: string,
): Promise<{ data: ExpertPayoutStatementData; assignment: any; expert: any; job: any }> {
  const { data: assignment, error: assignmentError } = await admin
    .from("expert_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Error("Expert assignment not found.");

  const [{ data: job, error: jobError }, { data: expert, error: expertError }, { data: addons, error: addonsError }] = await Promise.all([
    admin.from("production_jobs").select("id,project_name,service,studio,assigned_studio").eq("id", assignment.production_job_id).maybeSingle(),
    admin.from("expert_profiles").select("id,user_id,full_name,email,payout_method,payout_details").eq("id", assignment.expert_profile_id).maybeSingle(),
    admin.from("production_addons").select("id,kind,title,status,expert_cost_cents,currency,paid_at").eq("production_job_id", assignment.production_job_id).eq("status", "paid").order("paid_at", { ascending: true }),
  ]);
  if (jobError) throw jobError;
  if (expertError) throw expertError;
  if (addonsError) throw addonsError;
  if (!job) throw new Error("Production job not found.");
  if (!expert) throw new Error("Expert profile not found.");

  const paidAt = String(assignment.paid_at || "").trim();
  if (!paidAt || String(assignment.payout_status || "").toLowerCase() !== "paid") {
    throw new Error("The Expert payout has not been marked as paid yet.");
  }

  return {
    assignment,
    expert,
    job,
    data: {
      assignmentId: assignment.id,
      expertName: expert.full_name || "Heyy Studio Expert",
      expertEmail: expert.email || null,
      projectName: job.project_name || "Expert project",
      service: job.service || "Production",
      studio: job.assigned_studio || job.studio || null,
      currency: assignment.currency || "USD",
      totalExpertFeeCents: Number(assignment.agreed_fee_cents || 0),
      additions: (addons || [])
        .filter((addon: any) => Number(addon.expert_cost_cents || 0) > 0)
        .map((addon: any) => ({
          label: additionLabel(addon),
          amountCents: Number(addon.expert_cost_cents || 0),
        })),
      paidAt,
      paymentMethod: expert.payout_method || null,
      paymentReference: assignment.payment_reference || null,
    },
  };
}
