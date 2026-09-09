import { createClient } from "@supabase/supabase-js";
import PaymentsManager, { type AdminClientPayment, type AdminExpertPayout } from "@/components/admin/platform/PaymentsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function text(value: unknown) {
  return String(value || "").trim();
}

export default async function AdminPaymentsPage() {
  const [paymentsResult, assignmentsResult, jobsResult, expertsResult] = await Promise.all([
    supabase.from("payment_records").select("*").order("paid_at", { ascending: false }).limit(2000),
    supabase.from("expert_assignments").select("id,production_job_id,expert_profile_id,agreed_fee_cents,currency,payout_status,paid_at,payment_reference,assigned_at,payout_eligible_at").order("assigned_at", { ascending: false }).limit(2000),
    supabase.from("production_jobs").select("id,project_name,service,studio,client_approved_at").limit(2000),
    supabase.from("expert_profiles").select("id,full_name,email").limit(2000),
  ]);

  if (paymentsResult.error) console.error("Admin payments could not load payment records:", paymentsResult.error.message);
  if (assignmentsResult.error) console.error("Admin payments could not load Expert payouts:", assignmentsResult.error.message);
  if (jobsResult.error) console.error("Admin payments could not load production jobs:", jobsResult.error.message);
  if (expertsResult.error) console.error("Admin payments could not load Experts:", expertsResult.error.message);

  const jobById = new Map((jobsResult.data || []).map((row: any) => [text(row.id), row]));
  const expertById = new Map((expertsResult.data || []).map((row: any) => [text(row.id), row]));

  const payments: AdminClientPayment[] = (paymentsResult.data || []).map((row: any) => ({
    id: text(row.id),
    invoiceNumber: text(row.invoice_number),
    description: text(row.description) || "Heyy Studio payment",
    paymentType: text(row.payment_type) || "other",
    amountTotal: Number(row.amount_total || 0),
    taxAmount: Number(row.tax_amount || 0),
    currency: text(row.currency || "usd").toUpperCase(),
    status: text(row.status || "paid"),
    billingName: text(row.billing_company_name || row.billing_name) || null,
    billingEmail: text(row.billing_email) || null,
    paidAt: text(row.paid_at || row.created_at) || null,
    relatedId: text(row.related_id) || null,
  }));

  const payouts: AdminExpertPayout[] = (assignmentsResult.data || []).map((row: any) => {
    const job = jobById.get(text(row.production_job_id));
    const expert = expertById.get(text(row.expert_profile_id));
    return {
      id: text(row.id),
      jobId: text(row.production_job_id),
      projectName: text(job?.project_name || job?.service) || "Production project",
      studio: text(job?.studio) || null,
      expertName: text(expert?.full_name) || "Expert",
      expertEmail: text(expert?.email) || null,
      agreedFeeCents: Number(row.agreed_fee_cents || 0),
      currency: text(row.currency || "USD").toUpperCase(),
      status: text(row.payout_status || "pending"),
      paidAt: text(row.paid_at) || null,
      eligibleAt: text(row.payout_eligible_at) || null,
      paymentReference: text(row.payment_reference) || null,
      clientApproved: Boolean(job?.client_approved_at),
    };
  });

  return <PaymentsManager payments={payments} payouts={payouts} />;
}
