import type { SupabaseClient } from "@supabase/supabase-js";

export const E2E_SEED_MARKER = "E2E Seed";

export interface E2ESeedData {
  customerId: string;
  customerName: string;
  customerAddress: string;
  employeeId: string;
  employeeName: string;
  quoteId: string;
  quoteNumber: string;
  scheduledJobId: string;
  scheduledJobTitle: string;
}

const SEED_CUSTOMER_NAME = `${E2E_SEED_MARKER} Client`;
const SEED_CUSTOMER_ADDRESS = "456 Rue Laval, Montréal, QC";
const SEED_EMPLOYEE_FIRST = E2E_SEED_MARKER;
const SEED_EMPLOYEE_LAST = "Employé";
const SEED_QUOTE_TITLE = `${E2E_SEED_MARKER} Soumission $1000`;

function buildScheduleWindow() {
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(11, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function deleteExistingSeedData(admin: SupabaseClient, companyId: string) {
  const { data: seedQuotes } = await admin
    .from("quotes")
    .select("id")
    .eq("company_id", companyId)
    .like("title", `${E2E_SEED_MARKER}%`);

  const quoteIds = (seedQuotes ?? []).map((row) => row.id as string);
  if (quoteIds.length > 0) {
    const { data: seedJobs } = await admin
      .from("scheduled_jobs")
      .select("id")
      .eq("company_id", companyId)
      .in("quote_id", quoteIds);
    const jobIds = (seedJobs ?? []).map((row) => row.id as string);
    if (jobIds.length > 0) {
      const { data: sheets } = await admin
        .from("job_billing_sheets")
        .select("id")
        .eq("company_id", companyId)
        .in("scheduled_job_id", jobIds);
      const sheetIds = (sheets ?? []).map((row) => row.id as string);
      if (sheetIds.length > 0) {
        await admin.from("job_billing_lines").delete().eq("company_id", companyId).in("billing_sheet_id", sheetIds);
        await admin.from("job_billing_sheets").delete().eq("company_id", companyId).in("id", sheetIds);
      }
    }
    await admin.from("scheduled_jobs").delete().eq("company_id", companyId).in("quote_id", quoteIds);
    await admin.from("invoices").delete().eq("company_id", companyId).in("quote_id", quoteIds);
    await admin.from("quotes").delete().eq("company_id", companyId).in("id", quoteIds);
  }

  await admin
    .from("scheduled_jobs")
    .delete()
    .eq("company_id", companyId)
    .like("title", `${E2E_SEED_MARKER}%`);

  await admin.from("customers").delete().eq("company_id", companyId).like("name", `${E2E_SEED_MARKER}%`);
  await admin
    .from("employees")
    .delete()
    .eq("company_id", companyId)
    .eq("first_name", SEED_EMPLOYEE_FIRST);
}

export async function seedE2EBusinessData(
  admin: SupabaseClient,
  companyId: string
): Promise<E2ESeedData> {
  await deleteExistingSeedData(admin, companyId);

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({
      company_id: companyId,
      name: SEED_CUSTOMER_NAME,
      email: "e2e-seed-client@test.local",
      phone: "5145550100",
      address: SEED_CUSTOMER_ADDRESS,
      company: SEED_CUSTOMER_NAME,
      status: "active",
    })
    .select("id, name, address")
    .single();

  if (customerError || !customer) {
    throw new Error(`E2E seed customer failed: ${customerError?.message}`);
  }

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .insert({
      company_id: companyId,
      first_name: SEED_EMPLOYEE_FIRST,
      last_name: SEED_EMPLOYEE_LAST,
      email: "e2e-seed-employee@test.local",
      phone: "5145550101",
      trade: "Plombier",
      truck_number: "E2E-01",
      status: "active",
    })
    .select("id, first_name, last_name")
    .single();

  if (employeeError || !employee) {
    throw new Error(`E2E seed employee failed: ${employeeError?.message}`);
  }

  const employeeName = `${employee.first_name} ${employee.last_name}`;
  const quoteNumber = `E2E-SO-${Date.now()}`;
  const year = new Date().getFullYear();
  const validUntil = `${year}-12-31`;

  const { data: quote, error: quoteError } = await admin
    .from("quotes")
    .insert({
      company_id: companyId,
      quote_number: quoteNumber,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_email: "e2e-seed-client@test.local",
      title: SEED_QUOTE_TITLE,
      description: "Données de test E2E — parcours complet",
      amount: 1000,
      status: "accepted",
      valid_until: validUntil,
      accepted_at: new Date().toISOString(),
      deposit_required: true,
      deposit_percentage: 20,
      deposit_amount: 200,
      deposit_status: "paid",
      line_items: [
        {
          description: "Travaux E2E",
          quantity: 1,
          unit_price: 1000,
          total: 1000,
        },
      ],
      terms: "Conditions E2E",
      public_token: `e2e-${Date.now()}`,
    })
    .select("id, quote_number, title")
    .single();

  if (quoteError || !quote) {
    throw new Error(`E2E seed quote failed: ${quoteError?.message}`);
  }

  const { start, end } = buildScheduleWindow();
  const jobTitle = `${SEED_QUOTE_TITLE} — ${quote.quote_number}`;

  const { data: job, error: jobError } = await admin
    .from("scheduled_jobs")
    .insert({
      company_id: companyId,
      title: jobTitle,
      description: "Appel planifié E2E",
      start_at: start,
      end_at: end,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_email: "e2e-seed-client@test.local",
      customer_phone: "5145550100",
      billing_address: customer.address,
      job_site_address: customer.address,
      employee_ids: [employee.id],
      employee_names: [employeeName],
      location: customer.address,
      status: "scheduled",
      type: "job",
      quote_id: quote.id,
      job_origin: "quote",
      job_number_type: "contract",
    })
    .select("id, title")
    .single();

  if (jobError || !job) {
    throw new Error(`E2E seed scheduled job failed: ${jobError?.message}`);
  }

  const { data: companyRow } = await admin
    .from("companies")
    .select("gst_rate, qst_rate")
    .eq("id", companyId)
    .single();

  const gstRate = Number(companyRow?.gst_rate ?? 0.05);
  const qstRate = Number(companyRow?.qst_rate ?? 0.09975);
  const subtotal = 869.57;
  const gstAmount = Math.round(subtotal * gstRate * 100) / 100;
  const qstAmount = Math.round(subtotal * qstRate * 100) / 100;
  const total = Math.round((subtotal + gstAmount + qstAmount) * 100) / 100;

  const { data: billingSheet, error: sheetError } = await admin
    .from("job_billing_sheets")
    .insert({
      company_id: companyId,
      scheduled_job_id: job.id,
      status: "draft",
      material_subtotal: subtotal,
      labor_subtotal: 0,
      subtotal,
      gst_amount: gstAmount,
      qst_amount: qstAmount,
      total,
    })
    .select("id")
    .single();

  if (sheetError || !billingSheet) {
    throw new Error(`E2E seed billing sheet failed: ${sheetError?.message}`);
  }

  const { error: lineError } = await admin.from("job_billing_lines").insert({
    billing_sheet_id: billingSheet.id,
    company_id: companyId,
    line_type: "material",
    description: "Travaux E2E seed",
    quantity: 1,
    unit_cost: subtotal,
    unit_sell_price: subtotal,
    line_total: subtotal,
    sort_order: 0,
    is_divers: true,
  });

  if (lineError) {
    throw new Error(`E2E seed billing line failed: ${lineError.message}`);
  }

  return {
    customerId: customer.id as string,
    customerName: customer.name as string,
    customerAddress: (customer.address as string) ?? SEED_CUSTOMER_ADDRESS,
    employeeId: employee.id as string,
    employeeName,
    quoteId: quote.id as string,
    quoteNumber: quote.quote_number as string,
    scheduledJobId: job.id as string,
    scheduledJobTitle: job.title as string,
  };
}

export async function cleanupE2ESeedData(admin: SupabaseClient, companyId: string): Promise<void> {
  await deleteExistingSeedData(admin, companyId);
}

/** Re-seed when globalTeardown or a prior test removed seed rows but credentials remain. */
export async function ensureE2ESeedData(
  admin: SupabaseClient,
  companyId: string,
  current?: E2ESeedData | null
): Promise<E2ESeedData> {
  if (current?.scheduledJobId) {
    const { data: job } = await admin
      .from("scheduled_jobs")
      .select("id")
      .eq("id", current.scheduledJobId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (job) return current;
  }

  return seedE2EBusinessData(admin, companyId);
}

/** Reset seed job to scheduled — prior tests may have changed status. */
export async function resetSeedJobForJourney(
  admin: SupabaseClient,
  companyId: string,
  jobId: string
): Promise<void> {
  await admin.from("invoices").delete().eq("company_id", companyId).eq("scheduled_job_id", jobId);

  const { data: sheet } = await admin
    .from("job_billing_sheets")
    .select("id")
    .eq("company_id", companyId)
    .eq("scheduled_job_id", jobId)
    .maybeSingle();

  if (sheet?.id) {
    await admin
      .from("job_billing_sheets")
      .update({ status: "draft", invoice_id: null })
      .eq("id", sheet.id)
      .eq("company_id", companyId);
  }

  await admin
    .from("scheduled_jobs")
    .update({
      status: "scheduled",
      work_description: null,
      closure_notes: null,
      submitted_for_review_at: null,
      work_completed_at: null,
      approved_at: null,
      approved_by: null,
      sent_at: null,
      sent_to: null,
      sent_by: null,
    })
    .eq("id", jobId)
    .eq("company_id", companyId);
}
