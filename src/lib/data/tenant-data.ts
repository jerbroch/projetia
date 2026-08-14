import {
  createAdminClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/admin";
import {
  customers as demoCustomers,
  dashboardStats as demoDashboardStats,
  employees as demoEmployees,
  invoices as demoInvoices,
  payments as demoPayments,
  quotes as demoQuotes,
  scheduleEvents as demoScheduleEvents,
} from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/demo/constants";
import type {
  Company,
  Customer,
  DashboardStats,
  Employee,
  Invoice,
  Payment,
  Quote,
  ScheduleEvent,
} from "@/types";
import { countActiveFieldWorkers } from "@/lib/field-workers";
import { isArchivedJob } from "@/lib/job-utils";
import { calculateDepositAmount } from "@/lib/quote-utils";
import {
  mapCostEstimationFromDb,
  mapEstimationSnapshotFromDb,
  serializeCostEstimationForDb,
  serializeEstimationSnapshotForDb,
} from "@/lib/quote-cost-utils";
import type { QuoteCostEstimation } from "@/types";

function adminClient() {
  if (!isSupabaseAdminConfigured()) return null;
  return createAdminClient();
}

function filterDemo<T extends { companyId: string }>(items: T[], companyId: string): T[] {
  return items.filter((item) => item.companyId === companyId);
}

function emptyStats(): DashboardStats {
  return {
    totalRevenue: 0,
    pendingInvoices: 0,
    activeProjects: 0,
    totalCustomers: 0,
    upcomingJobs: 0,
    employeesOnSite: 0,
  };
}

export async function getCustomers(companyId: string, isDemo: boolean): Promise<Customer[]> {
  if (isDemo) return filterDemo(demoCustomers, companyId);

  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return (data ?? []).map(mapCustomerRow);
}

export async function getQuotes(companyId: string, isDemo: boolean): Promise<Quote[]> {
  if (isDemo) return filterDemo(demoQuotes, companyId);
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const quotes = (data ?? []).map(mapQuoteRow);
  const scheduleLinks = await getScheduleLinksByQuoteIds(
    companyId,
    quotes.map((q) => q.id)
  );

  return quotes.map((quote) => ({
    ...quote,
    scheduledJobId: scheduleLinks.get(quote.id),
  }));
}

export async function getInvoices(companyId: string, isDemo: boolean): Promise<Invoice[]> {
  if (isDemo) {
    const events = filterDemo(demoScheduleEvents, companyId);
    const archivedJobIds = new Set(
      events.filter((event) => isArchivedJob(event)).map((event) => event.id)
    );
    return filterDemo(demoInvoices, companyId).filter(
      (invoice) => !invoice.scheduledJobId || !archivedJobIds.has(invoice.scheduledJobId)
    );
  }
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const invoices = (data ?? []).map(mapInvoiceRow);
  const archivedJobIds = await getArchivedJobIds(companyId);
  return invoices.filter(
    (invoice) => !invoice.scheduledJobId || !archivedJobIds.has(invoice.scheduledJobId)
  );
}

async function getArchivedJobIds(companyId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduled_jobs")
    .select("id")
    .eq("company_id", companyId)
    .in("status", ["completed", "cancelled", "pending-review"]);

  return new Set((data ?? []).map((row) => String(row.id)));
}

export async function getEmployees(companyId: string, isDemo: boolean): Promise<Employee[]> {
  if (isDemo) return filterDemo(demoEmployees, companyId);
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return (data ?? []).map(mapEmployeeRow);
}

export async function getScheduleEvents(companyId: string, isDemo: boolean): Promise<ScheduleEvent[]> {
  if (isDemo) return filterDemo(demoScheduleEvents, companyId);
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduled_jobs")
    .select("*")
    .eq("company_id", companyId)
    .order("start_at", { ascending: true });

  return (data ?? []).map(mapScheduleRow);
}

export async function getPayments(companyId: string, isDemo: boolean): Promise<Payment[]> {
  if (isDemo) return filterDemo(demoPayments, companyId);
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return (data ?? []).map(mapPaymentRow);
}

export async function getDashboardStats(companyId: string, isDemo: boolean): Promise<DashboardStats> {
  const schedule = await getScheduleEvents(companyId, isDemo);
  const employeesOnSite = countActiveFieldWorkers(schedule);

  if (isDemo && companyId === DEMO_COMPANY_ID) {
    return { ...demoDashboardStats, employeesOnSite };
  }

  const [customers, invoices] = await Promise.all([
    getCustomers(companyId, false),
    getInvoices(companyId, false),
  ]);

  if (customers.length === 0 && invoices.length === 0) {
    return { ...emptyStats(), employeesOnSite };
  }

  const totalRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);

  return {
    totalRevenue,
    pendingInvoices: invoices.filter((i) => i.status === "sent" || i.status === "overdue").length,
    activeProjects: schedule.filter((e) => e.status === "scheduled" || e.status === "in-progress").length,
    totalCustomers: customers.length,
    upcomingJobs: schedule.filter((e) => e.status === "scheduled").length,
    employeesOnSite,
  };
}

export function mapCustomerRow(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    name: String(row.name),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    address: String(row.address ?? ""),
    billingAddress: row.billing_address ? String(row.billing_address) : undefined,
    company: String(row.company ?? ""),
    status: row.status as Customer["status"],
    totalProjects: Number(row.total_projects ?? 0),
    createdAt: String(row.created_at),
  };
}

export function mapQuoteRow(row: Record<string, unknown>): Quote {
  let lineItemsRaw: unknown = row.line_items;
  if (typeof lineItemsRaw === "string") {
    try {
      lineItemsRaw = JSON.parse(lineItemsRaw);
    } catch {
      lineItemsRaw = [];
    }
  }
  let lineItems: Quote["lineItems"] = [];
  if (Array.isArray(lineItemsRaw)) {
    lineItems = lineItemsRaw.map((item) => {
      const i = item as Record<string, unknown>;
      return {
        description: String(i.description ?? ""),
        quantity: Number(i.quantity ?? 1),
        unitPrice: Number(i.unit_price ?? i.unitPrice ?? 0),
        total: Number(i.total ?? 0),
      };
    });
  }

  return {
    id: String(row.id),
    companyId: String(row.company_id),
    quoteNumber: String(row.quote_number),
    customerId: String(row.customer_id ?? ""),
    customerName: String(row.customer_name ?? ""),
    customerEmail: row.customer_email ? String(row.customer_email) : undefined,
    title: String(row.title),
    description: String(row.description ?? ""),
    amount: Number(row.amount),
    status: row.status as Quote["status"],
    validUntil: String(row.valid_until ?? ""),
    createdAt: String(row.created_at),
    publicToken: row.public_token ? String(row.public_token) : undefined,
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    viewedAt: row.viewed_at ? String(row.viewed_at) : undefined,
    acceptedAt: row.accepted_at ? String(row.accepted_at) : undefined,
    rejectedAt: row.rejected_at ? String(row.rejected_at) : undefined,
    depositRequired: Boolean(row.deposit_required ?? false),
    depositPercentage: row.deposit_percentage != null ? Number(row.deposit_percentage) : undefined,
    depositAmount: row.deposit_amount != null ? Number(row.deposit_amount) : undefined,
    depositStatus: (row.deposit_status as Quote["depositStatus"]) ?? "not_required",
    terms: row.terms ? String(row.terms) : undefined,
    lineItems,
    costEstimation: mapCostEstimationFromDb(row.cost_estimation),
    calculatedCost: row.calculated_cost != null ? Number(row.calculated_cost) : undefined,
    proposedAmount: row.proposed_amount != null ? Number(row.proposed_amount) : undefined,
  };
}

export async function getQuoteById(
  companyId: string,
  quoteId: string,
  isDemo: boolean
): Promise<Quote | null> {
  if (isDemo) {
    return filterDemo(demoQuotes, companyId).find((q) => q.id === quoteId) ?? null;
  }
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", quoteId)
    .maybeSingle();

  return data ? mapQuoteRow(data) : null;
}

export async function getNextQuoteNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SO-${year}-`;

  if (!isSupabaseConfigured()) return `${prefix}001`;

  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select("quote_number")
    .eq("company_id", companyId)
    .like("quote_number", `${prefix}%`)
    .order("quote_number", { ascending: false })
    .limit(1);

  const last = data?.[0]?.quote_number as string | undefined;
  const seq = last ? parseInt(last.split("-").pop() ?? "0", 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

export async function insertQuoteForCompany(
  companyId: string,
  input: {
    quoteNumber: string;
    title: string;
    description?: string;
    customerId?: string;
    customerName: string;
    customerEmail?: string;
    amount: number;
    status: Quote["status"];
    validUntil?: string;
    depositRequired?: boolean;
    depositPercentage?: number;
    depositAmount?: number;
    terms?: string;
    lineItems?: Quote["lineItems"];
    costEstimation?: QuoteCostEstimation;
    calculatedCost?: number;
    proposedAmount?: number;
  }
) {
  const supabase = await createClient();
  const lineItems = (input.lineItems ?? []).map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total: item.total,
  }));

  return supabase
    .from("quotes")
    .insert({
      company_id: companyId,
      quote_number: input.quoteNumber,
      title: input.title,
      description: input.description || null,
      customer_id: input.customerId || null,
      customer_name: input.customerName,
      customer_email: input.customerEmail || null,
      amount: input.amount,
      status: input.status,
      valid_until: input.validUntil || null,
      deposit_required: input.depositRequired ?? false,
      deposit_percentage: input.depositPercentage ?? null,
      deposit_amount: input.depositAmount ?? null,
      deposit_status: input.depositRequired ? "pending" : "not_required",
      terms: input.terms || null,
      line_items: lineItems,
      cost_estimation: input.costEstimation
        ? serializeCostEstimationForDb(input.costEstimation)
        : null,
      calculated_cost: input.calculatedCost ?? null,
      proposed_amount: input.proposedAmount ?? null,
    })
    .select("*")
    .single();
}

export async function updateQuoteForCompany(
  companyId: string,
  quoteId: string,
  input: {
    title: string;
    description?: string;
    customerId?: string;
    customerName: string;
    customerEmail?: string;
    amount: number;
    status: Quote["status"];
    validUntil?: string;
    depositRequired?: boolean;
    depositPercentage?: number;
    depositAmount?: number;
    terms?: string;
    lineItems?: Quote["lineItems"];
    costEstimation?: QuoteCostEstimation;
    calculatedCost?: number;
    proposedAmount?: number;
  }
) {
  const supabase = await createClient();
  const lineItems = (input.lineItems ?? []).map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total: item.total,
  }));

  return supabase
    .from("quotes")
    .update({
      title: input.title,
      description: input.description || null,
      customer_id: input.customerId || null,
      customer_name: input.customerName,
      customer_email: input.customerEmail || null,
      amount: input.amount,
      status: input.status,
      valid_until: input.validUntil || null,
      deposit_required: input.depositRequired ?? false,
      deposit_percentage: input.depositPercentage ?? null,
      deposit_amount: input.depositAmount ?? null,
      deposit_status: input.depositRequired ? "pending" : "not_required",
      terms: input.terms || null,
      line_items: lineItems,
      cost_estimation: input.costEstimation
        ? serializeCostEstimationForDb(input.costEstimation)
        : null,
      calculated_cost: input.calculatedCost ?? null,
      proposed_amount: input.proposedAmount ?? null,
    })
    .eq("id", quoteId)
    .eq("company_id", companyId)
    .select("*")
    .single();
}

export async function deleteQuoteForCompany(companyId: string, quoteId: string) {
  const supabase = await createClient();
  return supabase.from("quotes").delete().eq("id", quoteId).eq("company_id", companyId);
}

export async function duplicateQuoteForCompany(companyId: string, quoteId: string) {
  const supabase = await createClient();
  const { data: source, error: fetchError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (fetchError || !source) {
    return { data: null, error: fetchError ?? new Error("Quote not found") };
  }

  const quoteNumber = await getNextQuoteNumber(companyId);
  return supabase
    .from("quotes")
    .insert({
      company_id: companyId,
      quote_number: quoteNumber,
      title: source.title,
      description: source.description,
      customer_id: source.customer_id,
      customer_name: source.customer_name,
      customer_email: source.customer_email,
      amount: source.amount,
      status: "draft",
      valid_until: source.valid_until,
      deposit_required: source.deposit_required ?? false,
      deposit_percentage: source.deposit_percentage,
      deposit_amount: source.deposit_amount,
      deposit_status: source.deposit_required ? "pending" : "not_required",
      terms: source.terms,
      line_items: source.line_items ?? [],
      cost_estimation: source.cost_estimation ?? null,
      calculated_cost: source.calculated_cost ?? null,
      proposed_amount: source.proposed_amount ?? null,
    })
    .select("*")
    .single();
}

function mapCompanyRow(row: Record<string, unknown>): Company {
  return {
    id: String(row.id),
    name: String(row.name),
    legalName: row.legal_name ? String(row.legal_name) : null,
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    address: row.address ? String(row.address) : null,
    city: row.city ? String(row.city) : null,
    province: row.province ? String(row.province) : null,
    postalCode: row.postal_code ? String(row.postal_code) : null,
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    primaryColor: row.primary_color ? String(row.primary_color) : null,
    gstRate: row.gst_rate != null ? Number(row.gst_rate) : undefined,
    qstRate: row.qst_rate != null ? Number(row.qst_rate) : undefined,
    defaultMaterialMargin:
      row.default_material_margin != null ? Number(row.default_material_margin) : undefined,
    subscriptionStatus: row.subscription_status ? String(row.subscription_status) : undefined,
    trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
  };
}

export async function getCompanyById(companyId: string): Promise<Company | null> {
  const admin = adminClient();
  if (!admin) return null;
  const { data } = await admin.from("companies").select("*").eq("id", companyId).maybeSingle();
  return data ? mapCompanyRow(data) : null;
}

export async function getQuoteByPublicToken(token: string): Promise<Quote | null> {
  const admin = adminClient();
  if (!admin) return null;
  const { data } = await admin.from("quotes").select("*").eq("public_token", token).maybeSingle();
  return data ? mapQuoteRow(data) : null;
}

export async function markQuoteViewed(token: string): Promise<Quote | null> {
  const admin = adminClient();
  if (!admin) return null;
  const existing = await getQuoteByPublicToken(token);
  if (!existing) return null;

  const updates: Record<string, unknown> = {};
  if (!existing.viewedAt) {
    updates.viewed_at = new Date().toISOString();
  }
  if (existing.status === "sent") {
    updates.status = "viewed";
  }

  if (Object.keys(updates).length === 0) return existing;

  const { data } = await admin
    .from("quotes")
    .update(updates)
    .eq("public_token", token)
    .select("*")
    .single();

  return data ? mapQuoteRow(data) : existing;
}

export async function issueQuotePublicToken(companyId: string, quoteId: string): Promise<string | null> {
  const admin = adminClient();
  if (!admin) return null;
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

  const { data, error } = await admin
    .from("quotes")
    .update({ public_token: token })
    .eq("id", quoteId)
    .eq("company_id", companyId)
    .select("public_token")
    .single();

  if (error || !data) return null;
  return String(data.public_token);
}

export async function sendQuoteForCompany(
  companyId: string,
  quoteId: string,
  recipientEmail: string
): Promise<{ quote: Quote | null; token: string | null; error?: string }> {
  const admin = adminClient();
  if (!admin) {
    return { quote: null, token: null, error: "Supabase n'est pas configuré." };
  }

  const { data: existing } = await admin
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!existing) {
    return { quote: null, token: null, error: "Soumission introuvable." };
  }

  let token = existing.public_token as string | null;
  if (!token) {
    token = await issueQuotePublicToken(companyId, quoteId);
  }
  if (!token) {
    return { quote: null, token: null, error: "Impossible de générer le lien sécurisé." };
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("quotes")
    .update({
      status: "sent",
      sent_at: now,
      customer_email: recipientEmail,
    })
    .eq("id", quoteId)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error || !data) {
    return { quote: null, token: null, error: "Impossible de mettre à jour la soumission." };
  }

  return { quote: mapQuoteRow(data), token };
}

export async function acceptQuoteByToken(token: string): Promise<{ quote: Quote | null; error?: string }> {
  const quote = await getQuoteByPublicToken(token);
  if (!quote) return { quote: null, error: "Soumission introuvable." };
  if (!["sent", "viewed"].includes(quote.status)) {
    return { quote: null, error: "Cette soumission ne peut plus être acceptée." };
  }

  const admin = adminClient();
  if (!admin) {
    return { quote: null, error: "Supabase n'est pas configuré." };
  }
  const now = new Date().toISOString();

  let depositAmount: number | null = null;
  if (quote.depositRequired && quote.depositPercentage) {
    const company = await getCompanyById(quote.companyId);
    const { getQuoteLineItems, calculateQuoteTotals } = await import("@/lib/quote-utils");
    const lineItems = getQuoteLineItems(quote);
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const totals = calculateQuoteTotals(subtotal, company ?? {});
    depositAmount = calculateDepositAmount(totals.total, quote.depositPercentage);
  }

  const newStatus = quote.depositRequired ? "deposit_pending" : "accepted";

  const { data, error } = await admin
    .from("quotes")
    .update({
      status: newStatus,
      accepted_at: now,
      deposit_amount: depositAmount,
      deposit_status: quote.depositRequired ? "pending" : "not_required",
    })
    .eq("public_token", token)
    .select("*")
    .single();

  if (error || !data) {
    return { quote: null, error: "Impossible d'accepter la soumission." };
  }

  return { quote: mapQuoteRow(data) };
}

export async function rejectQuoteByToken(
  token: string
): Promise<{ quote: Quote | null; error?: string }> {
  const quote = await getQuoteByPublicToken(token);
  if (!quote) return { quote: null, error: "Soumission introuvable." };
  if (!["sent", "viewed"].includes(quote.status)) {
    return { quote: null, error: "Cette soumission ne peut plus être refusée." };
  }

  const admin = adminClient();
  if (!admin) {
    return { quote: null, error: "Supabase n'est pas configuré." };
  }
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("quotes")
    .update({
      status: "rejected",
      rejected_at: now,
    })
    .eq("public_token", token)
    .select("*")
    .single();

  if (error || !data) {
    return { quote: null, error: "Impossible de refuser la soumission." };
  }

  return { quote: mapQuoteRow(data) };
}

export async function markDepositPaidByToken(
  token: string,
  stripePaymentId?: string
): Promise<{ quote: Quote | null; error?: string }> {
  const quote = await getQuoteByPublicToken(token);
  if (!quote) return { quote: null, error: "Soumission introuvable." };
  if (quote.status !== "deposit_pending") {
    return { quote: null, error: "Aucun dépôt en attente pour cette soumission." };
  }

  const admin = adminClient();
  if (!admin) {
    return { quote: null, error: "Supabase n'est pas configuré." };
  }
  const { data, error } = await admin
    .from("quotes")
    .update({
      status: "deposit_paid",
      deposit_status: "paid",
      stripe_deposit_payment_id: stripePaymentId ?? null,
    })
    .eq("public_token", token)
    .select("*")
    .single();

  if (error || !data) {
    return { quote: null, error: "Impossible de confirmer le paiement du dépôt." };
  }

  return { quote: mapQuoteRow(data) };
}

function mapInvoiceRow(row: Record<string, unknown>): Invoice {
  let lineItemsRaw: unknown = row.line_items;
  if (typeof lineItemsRaw === "string") {
    try {
      lineItemsRaw = JSON.parse(lineItemsRaw);
    } catch {
      lineItemsRaw = [];
    }
  }

  return {
    id: String(row.id),
    companyId: String(row.company_id),
    invoiceNumber: String(row.invoice_number),
    customerId: String(row.customer_id ?? ""),
    customerName: String(row.customer_name ?? ""),
    quoteId: row.quote_id ? String(row.quote_id) : undefined,
    quoteNumber: row.quote_number ? String(row.quote_number) : undefined,
    scheduledJobId: row.scheduled_job_id ? String(row.scheduled_job_id) : undefined,
    jobNumber: row.job_number ? String(row.job_number) : undefined,
    clientPoNumber: row.client_po_number ? String(row.client_po_number) : undefined,
    amount: Number(row.amount),
    paidAmount: Number(row.paid_amount ?? 0),
    subtotal: row.subtotal != null ? Number(row.subtotal) : undefined,
    depositApplied: row.deposit_applied != null ? Number(row.deposit_applied) : undefined,
    materialSubtotal: row.material_subtotal != null ? Number(row.material_subtotal) : undefined,
    laborSubtotal: row.labor_subtotal != null ? Number(row.labor_subtotal) : undefined,
    gstAmount: row.gst_amount != null ? Number(row.gst_amount) : undefined,
    qstAmount: row.qst_amount != null ? Number(row.qst_amount) : undefined,
    lineItems: Array.isArray(lineItemsRaw)
      ? lineItemsRaw.map((item) => {
          const i = item as Record<string, unknown>;
          return {
            lineType: (i.line_type ?? i.lineType ?? "material") as "labor" | "material",
            description: String(i.description ?? ""),
            quantity: Number(i.quantity ?? 1),
            unitCost: Number(i.unit_cost ?? i.unitCost ?? 0),
            unitSellPrice: Number(i.unit_sell_price ?? i.unitSellPrice ?? 0),
            marginPct: Number(i.margin_pct ?? i.marginPct ?? 0),
            lineTotal: Number(i.line_total ?? i.lineTotal ?? 0),
          };
        })
      : undefined,
    status: row.status as Invoice["status"],
    dueDate: String(row.due_date ?? ""),
    createdAt: String(row.created_at),
    workDescription: row.work_description ? String(row.work_description) : undefined,
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    sentTo: row.sent_to ? String(row.sent_to) : undefined,
    sentBy: row.sent_by ? String(row.sent_by) : undefined,
  };
}

export function mapEmployeeRow(row: Record<string, unknown>): Employee {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    trade: String(row.trade ?? ""),
    mobilePhone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    truckNumber: String(row.truck_number ?? ""),
    status: row.status as Employee["status"],
    notes: row.notes ? String(row.notes) : undefined,
    department: String(row.department ?? ""),
    hireDate: String(row.hire_date ?? ""),
    hourlyRate: Number(row.hourly_rate ?? 0),
    profilePhoto: row.profile_photo ? String(row.profile_photo) : undefined,
  };
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

export function mapScheduleRow(row: Record<string, unknown>): ScheduleEvent {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    title: String(row.title),
    description: String(row.description ?? ""),
    start: String(row.start_at),
    end: String(row.end_at),
    customerId: row.customer_id ? String(row.customer_id) : undefined,
    customerName: row.customer_name ? String(row.customer_name) : undefined,
    customerPhone: row.customer_phone ? String(row.customer_phone) : undefined,
    customerEmail: row.customer_email ? String(row.customer_email) : undefined,
    billingAddress: row.billing_address ? String(row.billing_address) : undefined,
    jobSiteAddress: row.job_site_address ? String(row.job_site_address) : undefined,
    employeeIds: parseStringArray(row.employee_ids),
    employeeNames: parseStringArray(row.employee_names),
    location: String(row.location ?? ""),
    internalNotes: row.internal_notes ? String(row.internal_notes) : undefined,
    status: row.status as ScheduleEvent["status"],
    type: row.type as ScheduleEvent["type"],
    quoteId: row.quote_id ? String(row.quote_id) : undefined,
    jobNumber: row.job_number ? String(row.job_number) : undefined,
    jobNumberType: row.job_number_type as ScheduleEvent["jobNumberType"],
    jobOrigin: row.job_origin as ScheduleEvent["jobOrigin"],
    clientPoNumber: row.client_po_number ? String(row.client_po_number) : undefined,
    workDescription: row.work_description ? String(row.work_description) : undefined,
    closureNotes: row.closure_notes ? String(row.closure_notes) : undefined,
    submittedForReviewAt: row.submitted_for_review_at
      ? String(row.submitted_for_review_at)
      : undefined,
    workCompletedAt: row.work_completed_at ? String(row.work_completed_at) : undefined,
    approvedBy: row.approved_by ? String(row.approved_by) : undefined,
    approvedAt: row.approved_at ? String(row.approved_at) : undefined,
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    sentTo: row.sent_to ? String(row.sent_to) : undefined,
    sentBy: row.sent_by ? String(row.sent_by) : undefined,
    quoteEstimationSnapshot: mapEstimationSnapshotFromDb(row.quote_estimation_snapshot),
  };
}

export async function getScheduleLinksByQuoteIds(
  companyId: string,
  quoteIds: string[]
): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  if (quoteIds.length === 0 || !isSupabaseConfigured()) return links;

  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduled_jobs")
    .select("id, quote_id")
    .eq("company_id", companyId)
    .in("quote_id", quoteIds);

  for (const row of data ?? []) {
    if (row.quote_id) {
      links.set(String(row.quote_id), String(row.id));
    }
  }

  return links;
}

export async function getScheduledJobByQuoteId(
  companyId: string,
  quoteId: string,
  isDemo: boolean
): Promise<ScheduleEvent | null> {
  if (isDemo) {
    return (
      filterDemo(demoScheduleEvents, companyId).find((event) => event.quoteId === quoteId) ?? null
    );
  }
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduled_jobs")
    .select("*")
    .eq("company_id", companyId)
    .eq("quote_id", quoteId)
    .maybeSingle();

  return data ? mapScheduleRow(data) : null;
}

export async function getScheduledJobById(
  companyId: string,
  jobId: string,
  isDemo: boolean
): Promise<ScheduleEvent | null> {
  if (isDemo) {
    return filterDemo(demoScheduleEvents, companyId).find((event) => event.id === jobId) ?? null;
  }
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduled_jobs")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", jobId)
    .maybeSingle();

  return data ? mapScheduleRow(data) : null;
}

function toScheduleRowInput(event: ScheduleEvent) {
  return {
    company_id: event.companyId,
    title: event.title,
    description: event.description || null,
    start_at: event.start,
    end_at: event.end,
    customer_id: event.customerId || null,
    customer_name: event.customerName || null,
    customer_phone: event.customerPhone || null,
    customer_email: event.customerEmail || null,
    billing_address: event.billingAddress || null,
    job_site_address: event.jobSiteAddress || null,
    employee_ids: event.employeeIds,
    employee_names: event.employeeNames,
    location: event.location || null,
    internal_notes: event.internalNotes || null,
    status: event.status,
    type: event.type,
    quote_id: event.quoteId || null,
    job_number: event.jobNumber || null,
    job_number_type: event.jobNumberType || null,
    job_origin: event.jobOrigin || null,
    client_po_number: event.clientPoNumber || null,
    work_description: event.workDescription || null,
    closure_notes: event.closureNotes || null,
    submitted_for_review_at: event.submittedForReviewAt || null,
    work_completed_at: event.workCompletedAt || null,
    approved_by: event.approvedBy || null,
    approved_at: event.approvedAt || null,
    sent_by: event.sentBy || null,
    sent_at: event.sentAt || null,
    sent_to: event.sentTo || null,
    quote_estimation_snapshot: event.quoteEstimationSnapshot
      ? serializeEstimationSnapshotForDb(event.quoteEstimationSnapshot)
      : null,
  };
}

export async function allocateJobNumber(
  companyId: string,
  numberType: "contract" | "service_call"
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("allocate_job_number", {
    p_company_id: companyId,
    p_number_type: numberType,
  });

  if (error || !data) {
    console.error("[allocateJobNumber]", error?.message);
    return null;
  }

  return String(data);
}

export async function getArchivedScheduleJobs(
  companyId: string,
  isDemo: boolean
): Promise<ScheduleEvent[]> {
  const events = await getScheduleEvents(companyId, isDemo);
  const { getArchivedJobs } = await import("@/lib/job-search");
  return getArchivedJobs(events);
}

export async function insertScheduledJobForCompany(companyId: string, event: ScheduleEvent) {
  const supabase = await createClient();

  let jobNumber = event.jobNumber;
  if (!jobNumber && event.jobNumberType) {
    jobNumber = (await allocateJobNumber(companyId, event.jobNumberType)) ?? undefined;
  }

  return supabase
    .from("scheduled_jobs")
    .insert({
      ...toScheduleRowInput({ ...event, jobNumber }),
      company_id: companyId,
    })
    .select("*")
    .single();
}

export async function updateScheduledJobForCompany(
  companyId: string,
  jobId: string,
  event: ScheduleEvent
) {
  const supabase = await createClient();
  return supabase
    .from("scheduled_jobs")
    .update(toScheduleRowInput(event))
    .eq("id", jobId)
    .eq("company_id", companyId)
    .select("*")
    .single();
}

function mapPaymentRow(row: Record<string, unknown>): Payment {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    invoiceId: String(row.invoice_id ?? ""),
    invoiceNumber: String(row.invoice_number ?? ""),
    customerName: String(row.customer_name ?? ""),
    amount: Number(row.amount),
    method: row.method as Payment["method"],
    status: row.status as Payment["status"],
    stripePaymentId: row.stripe_payment_id ? String(row.stripe_payment_id) : undefined,
    createdAt: String(row.created_at),
  };
}

export async function createEmployeeForCompany(
  companyId: string,
  input: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    trade?: string;
    truckNumber?: string;
    status?: Employee["status"];
    profilePhoto?: string;
    notes?: string;
    department?: string;
    hireDate?: string;
    hourlyRate?: number;
  }
) {
  const supabase = await createClient();
  return supabase
    .from("employees")
    .insert({
      company_id: companyId,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email || null,
      phone: input.phone || null,
      trade: input.trade || null,
      truck_number: input.truckNumber || null,
      status: input.status ?? "active",
      profile_photo: input.profilePhoto || null,
      notes: input.notes || null,
      department: input.department || null,
      hire_date: input.hireDate || null,
      hourly_rate: input.hourlyRate ?? null,
    })
    .select("*")
    .single();
}

export async function updateEmployeeForCompany(
  companyId: string,
  employeeId: string,
  input: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    trade?: string;
    truckNumber?: string;
    status?: Employee["status"];
    profilePhoto?: string;
    notes?: string;
    department?: string;
    hireDate?: string;
    hourlyRate?: number;
  }
) {
  const supabase = await createClient();
  const updates: Record<string, unknown> = {};

  if (input.firstName !== undefined) updates.first_name = input.firstName;
  if (input.lastName !== undefined) updates.last_name = input.lastName;
  if (input.email !== undefined) updates.email = input.email || null;
  if (input.phone !== undefined) updates.phone = input.phone || null;
  if (input.trade !== undefined) updates.trade = input.trade || null;
  if (input.truckNumber !== undefined) updates.truck_number = input.truckNumber || null;
  if (input.status !== undefined) updates.status = input.status;
  if (input.profilePhoto !== undefined) updates.profile_photo = input.profilePhoto || null;
  if (input.notes !== undefined) updates.notes = input.notes || null;
  if (input.department !== undefined) updates.department = input.department || null;
  if (input.hireDate !== undefined) updates.hire_date = input.hireDate || null;
  if (input.hourlyRate !== undefined) updates.hourly_rate = input.hourlyRate ?? null;

  return supabase
    .from("employees")
    .update(updates)
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .select("*")
    .single();
}

/** Server-only insert helpers use admin client during onboarding */
export async function insertEmployeeForCompany(
  companyId: string,
  input: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    trade?: string;
  }
) {
  const admin = createAdminClient();
  return admin.from("employees").insert({
    company_id: companyId,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email || null,
    phone: input.phone || null,
    trade: input.trade || null,
    status: "active",
  });
}

export async function createCustomerForCompany(
  companyId: string,
  input: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    billingAddress?: string;
    company?: string;
    status?: Customer["status"];
  }
) {
  const supabase = await createClient();
  return supabase
    .from("customers")
    .insert({
      company_id: companyId,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      billing_address: input.billingAddress || null,
      company: input.company || null,
      status: input.status ?? "active",
    })
    .select("*")
    .single();
}

/** Server-only insert helper uses admin client during onboarding */
export async function insertCustomerForCompany(
  companyId: string,
  input: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  }
) {
  const admin = createAdminClient();
  return admin.from("customers").insert({
    company_id: companyId,
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    address: input.address || null,
    status: "active",
  });
}

export async function updateCustomerForCompany(
  companyId: string,
  customerId: string,
  input: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    billingAddress?: string;
    company?: string;
    status?: Customer["status"];
  }
) {
  const supabase = await createClient();
  return supabase
    .from("customers")
    .update({
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      billing_address: input.billingAddress || null,
      company: input.company || null,
      status: input.status ?? "active",
    })
    .eq("id", customerId)
    .eq("company_id", companyId)
    .select("*")
    .single();
}

export async function deleteCustomerForCompany(companyId: string, customerId: string) {
  const supabase = await createClient();
  return supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("company_id", companyId);
}

export async function countQuotesForCustomer(companyId: string, customerId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("customer_id", customerId);
  if (error) {
    console.error("[countQuotesForCustomer]", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function updateCompanySettings(
  companyId: string,
  input: Record<string, unknown>
) {
  const admin = createAdminClient();
  return admin.from("companies").update(input).eq("id", companyId);
}
