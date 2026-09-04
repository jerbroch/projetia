import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  buildInvoiceLineSnapshots,
  calculateBillingTotals,
  calculateMarginFromPrices,
  DEFAULT_MATERIAL_MARGIN,
  resolveEffectiveCatalogPrice,
} from "@/lib/billing-utils";
import { getQuoteById } from "@/lib/data/tenant-data";
import {
  buildQuoteBillingPrefill,
  QUOTE_BILLING_MATERIAL_MARGIN,
  resolveInvoicePaidAmountOnSync,
  resolveQuoteDepositPaid,
} from "@/lib/quote-invoice-link";
import type {
  Company,
  Invoice,
  JobBillingLine,
  JobBillingSheet,
  LaborRateTemplate,
  MaterialCatalogItem,
  MaterialCategory,
  Quote,
  ScheduleEvent,
  Supplier,
} from "@/types";

type SupabaseErrorLike = { message: string } | null | undefined;

/** Throws when Supabase returns an error — prevents silent write failures. */
export function checkSupabaseError(error: SupabaseErrorLike, context?: string): void {
  if (!error) return;
  const message = context ? `${context}: ${error.message}` : error.message;
  throw new Error(message);
}

export async function ensureCompanyBillingDefaults(companyId: string) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.rpc("seed_company_billing_defaults", { p_company_id: companyId });
}

export function mapLaborTemplateRow(row: Record<string, unknown>): LaborRateTemplate {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    name: String(row.name),
    workerCount: Number(row.worker_count ?? 1),
    costPerHr: Number(row.cost_per_hr ?? 0),
    billRate: Number(row.bill_rate ?? 0),
    marginPct: row.margin_pct != null ? Number(row.margin_pct) : undefined,
    rateType: row.rate_type as LaborRateTemplate["rateType"],
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active ?? true),
  };
}

export function mapSupplierRow(row: Record<string, unknown>): Supplier {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    code: String(row.code),
    name: String(row.name),
    isActive: Boolean(row.is_active ?? true),
  };
}

export function mapCategoryRow(row: Record<string, unknown>): MaterialCategory {
  return {
    id: String(row.id),
    companyId: row.company_id ? String(row.company_id) : undefined,
    name: String(row.name),
    slug: String(row.slug),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function mapBillingLineRow(row: Record<string, unknown>): JobBillingLine {
  return {
    id: String(row.id),
    billingSheetId: String(row.billing_sheet_id),
    lineType: row.line_type as JobBillingLine["lineType"],
    description: String(row.description),
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost),
    unitSellPrice: Number(row.unit_sell_price),
    marginPct: row.margin_pct != null ? Number(row.margin_pct) : undefined,
    lineTotal: Number(row.line_total),
    laborTemplateId: row.labor_template_id ? String(row.labor_template_id) : undefined,
    catalogItemId: row.catalog_item_id ? String(row.catalog_item_id) : undefined,
    supplierId: row.supplier_id ? String(row.supplier_id) : undefined,
    isDivers: Boolean(row.is_divers ?? false),
    // Origine terrain : d'où vient la ligne, quelles saisies elle représente,
    // et si elle a été retouchée. Sans ça, un réimport écraserait à l'aveugle.
    sourceKind: row.source_kind ? (String(row.source_kind) as JobBillingLine["sourceKind"]) : null,
    sourceIds: Array.isArray(row.source_ids) ? (row.source_ids as string[]) : [],
    manuallyEdited: Boolean(row.manually_edited ?? false),
    signaleParEmploye: Boolean(row.signale_par_employe ?? false),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function mapBillingSheetRow(
  row: Record<string, unknown>,
  lines: JobBillingLine[] = []
): JobBillingSheet {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    scheduledJobId: String(row.scheduled_job_id),
    status: row.status as JobBillingSheet["status"],
    materialCostSubtotal: Number(row.material_cost_subtotal ?? 0),
    materialSubtotal: Number(row.material_subtotal ?? 0),
    materialMarginPct:
      row.material_margin_pct != null ? Number(row.material_margin_pct) : undefined,
    laborSubtotal: Number(row.labor_subtotal ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    gstAmount: Number(row.gst_amount ?? 0),
    qstAmount: Number(row.qst_amount ?? 0),
    total: Number(row.total ?? 0),
    invoiceId: row.invoice_id ? String(row.invoice_id) : undefined,
    lines,
  };
}

export async function getLaborRateTemplates(companyId: string): Promise<LaborRateTemplate[]> {
  if (!isSupabaseConfigured()) return [];
  await ensureCompanyBillingDefaults(companyId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("labor_rate_templates")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return (data ?? []).map(mapLaborTemplateRow);
}

export async function getSuppliers(companyId: string): Promise<Supplier[]> {
  if (!isSupabaseConfigured()) return [];
  await ensureCompanyBillingDefaults(companyId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("suppliers")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");
  return (data ?? []).map(mapSupplierRow);
}

export async function getMaterialCategories(companyId: string): Promise<MaterialCategory[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("material_categories")
    .select("*")
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .order("sort_order");
  return (data ?? []).map(mapCategoryRow);
}

export interface MaterialSearchParams {
  query: string;
  categoryId?: string;
  diameter?: string;
  supplierId?: string;
  page?: number;
  pageSize?: number;
}

export interface MaterialSearchResult {
  items: MaterialCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function searchMaterialCatalog(
  companyId: string,
  params: MaterialSearchParams
): Promise<MaterialSearchResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  if (!isSupabaseConfigured() || params.query.trim().length < 3) {
    return { items: [], total: 0, page, pageSize };
  }

  const supabase = await createClient();
  let query = supabase
    .from("material_catalog_items")
    .select("*, material_categories(name)", { count: "exact" })
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .ilike("search_text", `%${params.query.trim().toLowerCase()}%`);

  if (params.categoryId) query = query.eq("category_id", params.categoryId);
  if (params.diameter) query = query.eq("diameter", params.diameter);

  const { data, count, error } = await query
    .order("name")
    .range(offset, offset + pageSize - 1);

  if (error || !data) {
    return { items: [], total: 0, page, pageSize };
  }

  const itemIds = data.map((r) => String(r.id));
  const prices = await getCompanyCatalogPricesForItems(companyId, itemIds);

  const items: MaterialCatalogItem[] = data.map((row) => {
    const price = prices.get(String(row.id));
    const effective = resolveEffectiveCatalogPrice(price?.customPrice, price?.referencePrice);
    const category = row.material_categories as { name?: string } | null;
    return {
      id: String(row.id),
      companyId: row.company_id ? String(row.company_id) : undefined,
      categoryId: String(row.category_id),
      categoryName: category?.name,
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      diameter: row.diameter ? String(row.diameter) : undefined,
      fittingType: row.fitting_type ? String(row.fitting_type) : undefined,
      unit: String(row.unit ?? "unité"),
      isCustom: Boolean(row.is_custom),
      referencePrice: price?.referencePrice,
      customPrice: price?.customPrice,
      effectivePrice: effective,
      unitCost: effective,
      sku: price?.sku,
    };
  });

  return { items, total: count ?? 0, page, pageSize };
}

async function getCompanyCatalogPricesForItems(
  companyId: string,
  itemIds: string[]
): Promise<
  Map<string, { referencePrice?: number; customPrice?: number; priceSource?: string; sku?: string }>
> {
  const result = new Map<
    string,
    { referencePrice?: number; customPrice?: number; priceSource?: string; sku?: string }
  >();
  if (itemIds.length === 0) return result;

  const supabase = await createClient();
  const { data } = await supabase
    .from("company_catalog_prices")
    .select("*")
    .eq("company_id", companyId)
    .in("catalog_item_id", itemIds);

  for (const row of data ?? []) {
    result.set(String(row.catalog_item_id), {
      referencePrice:
        row.reference_price != null ? Number(row.reference_price) : undefined,
      customPrice: row.custom_price != null ? Number(row.custom_price) : undefined,
      priceSource: row.price_source ? String(row.price_source) : undefined,
    });
  }
  return result;
}

export async function getCatalogItemEffectivePrice(
  companyId: string,
  catalogItemId: string
): Promise<number> {
  const prices = await getCompanyCatalogPricesForItems(companyId, [catalogItemId]);
  const price = prices.get(catalogItemId);
  return resolveEffectiveCatalogPrice(price?.customPrice, price?.referencePrice) ?? 0;
}

export async function upsertCompanyCatalogCustomPrice(
  companyId: string,
  catalogItemId: string,
  customPrice: number
) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("company_catalog_prices")
    .select("*")
    .eq("company_id", companyId)
    .eq("catalog_item_id", catalogItemId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("company_catalog_prices")
      .update({
        custom_price: customPrice,
        manually_overridden: true,
      })
      .eq("id", existing.id);
    checkSupabaseError(error, "company_catalog_prices");
  } else {
    const { error } = await supabase.from("company_catalog_prices").insert({
      company_id: companyId,
      catalog_item_id: catalogItemId,
      custom_price: customPrice,
      manually_overridden: true,
    });
    checkSupabaseError(error, "company_catalog_prices");
  }
}

export async function getJobBillingSheet(
  companyId: string,
  jobId: string
): Promise<JobBillingSheet | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: sheet } = await supabase
    .from("job_billing_sheets")
    .select("*")
    .eq("company_id", companyId)
    .eq("scheduled_job_id", jobId)
    .maybeSingle();

  if (!sheet) return null;

  const { data: lines } = await supabase
    .from("job_billing_lines")
    .select("*")
    .eq("billing_sheet_id", sheet.id)
    .order("sort_order");

  return mapBillingSheetRow(sheet, (lines ?? []).map(mapBillingLineRow));
}

export async function seedBillingSheetFromQuote(
  companyId: string,
  sheetId: string,
  quote: Quote,
  company: Pick<Company, "gstRate" | "qstRate">
): Promise<void> {
  const supabase = await createClient();
  const prefill = buildQuoteBillingPrefill(quote, company);

  for (const [index, line] of prefill.lines.entries()) {
    const lineTotal = Math.round(line.quantity * line.unitSellPrice * 100) / 100;
    const { error } = await supabase.from("job_billing_lines").insert({
      billing_sheet_id: sheetId,
      company_id: companyId,
      line_type: line.lineType,
      description: line.description,
      quantity: line.quantity,
      unit_cost: line.unitCost,
      unit_sell_price: line.unitSellPrice,
      margin_pct: line.marginPct ?? null,
      line_total: lineTotal,
      sort_order: index,
      is_divers: line.lineType === "material" ? (line.isDivers ?? false) : false,
    });
    checkSupabaseError(error, "job_billing_lines");
  }

  const laborSubtotal =
    Math.round(
      prefill.lines
        .filter((l) => l.lineType === "labor")
        .reduce((sum, l) => sum + l.quantity * l.unitSellPrice, 0) * 100
    ) / 100;
  const materialSubtotal =
    Math.round(
      prefill.lines
        .filter((l) => l.lineType === "material")
        .reduce((sum, l) => sum + l.quantity * l.unitSellPrice, 0) * 100
    ) / 100;

  const { error: sheetError } = await supabase
    .from("job_billing_sheets")
    .update({
      material_margin_pct: QUOTE_BILLING_MATERIAL_MARGIN,
      material_cost_subtotal: materialSubtotal,
      material_subtotal: materialSubtotal,
      labor_subtotal: laborSubtotal,
      subtotal: prefill.subtotal,
      gst_amount: prefill.gst,
      qst_amount: prefill.qst,
      total: prefill.total,
    })
    .eq("id", sheetId)
    .eq("company_id", companyId);
  checkSupabaseError(sheetError, "job_billing_sheets");
}

export async function getOrCreateJobBillingSheet(
  companyId: string,
  jobId: string,
  company?: Pick<Company, "gstRate" | "qstRate">
): Promise<JobBillingSheet> {
  const existing = await getJobBillingSheet(companyId, jobId);
  if (existing) return existing;

  const supabase = await createClient();

  const { data: jobRow } = await supabase
    .from("scheduled_jobs")
    .select("quote_id")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("job_billing_sheets")
    .insert({ company_id: companyId, scheduled_job_id: jobId })
    .select("*")
    .single();

  checkSupabaseError(error, "job_billing_sheets");
  if (!data) throw new Error("Impossible de créer la feuille de facturation.");

  const quoteId = jobRow?.quote_id ? String(jobRow.quote_id) : undefined;
  if (quoteId && company) {
    const quote = await getQuoteById(companyId, quoteId, false);
    if (quote) {
      await seedBillingSheetFromQuote(companyId, String(data.id), quote, company);
      const seeded = await getJobBillingSheet(companyId, jobId);
      if (seeded) return seeded;
    }
  }

  return mapBillingSheetRow(data, []);
}

export async function recalculateBillingSheetTotals(
  companyId: string,
  sheetId: string,
  company: Pick<Company, "gstRate" | "qstRate">,
  materialMarginPct?: number
) {
  const supabase = await createClient();

  const { data: sheetRow } = await supabase
    .from("job_billing_sheets")
    .select("material_margin_pct")
    .eq("id", sheetId)
    .eq("company_id", companyId)
    .maybeSingle();

  const margin =
    materialMarginPct ??
    (sheetRow?.material_margin_pct != null
      ? Number(sheetRow.material_margin_pct)
      : await getCompanyDefaultMaterialMargin(companyId));

  const { data: lines } = await supabase
    .from("job_billing_lines")
    .select("*")
    .eq("billing_sheet_id", sheetId)
    .order("sort_order");

  const inputs = (lines ?? []).map((row) => ({
    lineType: row.line_type as "labor" | "material",
    description: String(row.description),
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost),
    unitSellPrice: Number(row.unit_sell_price),
    marginPct: row.margin_pct != null ? Number(row.margin_pct) : undefined,
  }));

  const totals = calculateBillingTotals(inputs, company, margin);

  const { error } = await supabase
    .from("job_billing_sheets")
    .update({
      material_cost_subtotal: totals.materialCostSubtotal,
      material_subtotal: totals.materialSubtotal,
      material_margin_pct: margin,
      labor_subtotal: totals.laborSubtotal,
      subtotal: totals.subtotal,
      gst_amount: totals.gst,
      qst_amount: totals.qst,
      total: totals.total,
    })
    .eq("id", sheetId)
    .eq("company_id", companyId);
  checkSupabaseError(error, "job_billing_sheets");
}

export async function getNextInvoiceNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FA-${year}-`;
  if (!isSupabaseConfigured()) return `${prefix}001`;

  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("company_id", companyId)
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);

  const last = data?.[0]?.invoice_number as string | undefined;
  const seq = last ? parseInt(last.split("-").pop() ?? "0", 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

export async function getInvoiceByJobId(
  companyId: string,
  jobId: string
): Promise<Invoice | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("company_id", companyId)
    .eq("scheduled_job_id", jobId)
    .maybeSingle();

  if (!data) return null;
  return mapInvoiceRowExtended(data);
}

/** Updates the linked invoice snapshot after billing edits in Archives (same invoice id). */
export async function syncInvoiceFromBillingSheet(
  companyId: string,
  sheet: JobBillingSheet,
  job: Pick<
    ScheduleEvent,
    "customerId" | "customerName" | "quoteId" | "jobNumber" | "clientPoNumber" | "workDescription"
  >
): Promise<void> {
  if (!sheet.invoiceId) {
    throw new Error("Aucune facture liée à cette feuille.");
  }

  const materialMarginPct =
    sheet.materialMarginPct ?? DEFAULT_MATERIAL_MARGIN;

  const lineSnapshots = buildInvoiceLineSnapshots(
    sheet.lines.map((l) => ({
      lineType: l.lineType,
      description: l.description,
      quantity: l.quantity,
      unitCost: l.unitCost,
      unitSellPrice: l.unitSellPrice,
      marginPct: l.marginPct,
    })),
    materialMarginPct
  );

  const supabase = await createClient();
  const { data: existingInvoice } = await supabase
    .from("invoices")
    .select("paid_amount, deposit_applied")
    .eq("id", sheet.invoiceId)
    .eq("company_id", companyId)
    .maybeSingle();

  const depositApplied =
    existingInvoice?.deposit_applied != null
      ? Number(existingInvoice.deposit_applied)
      : 0;
  const existingPaid = Number(existingInvoice?.paid_amount ?? 0);
  const paidAmount = resolveInvoicePaidAmountOnSync(existingPaid, depositApplied, sheet.total);

  const { error } = await supabase
    .from("invoices")
    .update({
      customer_id: job.customerId || null,
      customer_name: job.customerName || null,
      quote_id: job.quoteId || null,
      job_number: job.jobNumber || null,
      client_po_number: job.clientPoNumber || null,
      work_description: job.workDescription || null,
      amount: sheet.total,
      subtotal: sheet.subtotal,
      material_subtotal: sheet.materialSubtotal,
      labor_subtotal: sheet.laborSubtotal,
      gst_amount: sheet.gstAmount,
      qst_amount: sheet.qstAmount,
      paid_amount: paidAmount,
      line_items: lineSnapshots.map((l) => ({
        line_type: l.lineType,
        description: l.description,
        quantity: l.quantity,
        unit_cost: l.unitCost,
        unit_sell_price: l.unitSellPrice,
        margin_pct: l.marginPct,
        line_total: l.lineTotal,
      })),
    })
    .eq("id", sheet.invoiceId)
    .eq("company_id", companyId);

  checkSupabaseError(error, "syncInvoiceFromBillingSheet");
}

/** Resolves quote deposit and reference for invoice creation. */
export async function resolveQuoteInvoiceContext(
  companyId: string,
  quoteId: string | undefined
): Promise<{ depositApplied: number; quoteNumber?: string }> {
  if (!quoteId) return { depositApplied: 0 };
  const quote = await getQuoteById(companyId, quoteId, false);
  if (!quote) return { depositApplied: 0 };
  return {
    depositApplied: resolveQuoteDepositPaid(quote),
    quoteNumber: quote.quoteNumber,
  };
}

export function mapInvoiceRowExtended(row: Record<string, unknown>): Invoice {
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
      : [],
    status: row.status as Invoice["status"],
    dueDate: String(row.due_date ?? ""),
    createdAt: String(row.created_at),
  };
}

export async function updateSheetMaterialMargin(
  companyId: string,
  sheetId: string,
  marginPct: number,
  company: Pick<Company, "gstRate" | "qstRate">
) {
  await recalculateBillingSheetTotals(companyId, sheetId, company, marginPct);
}

export async function updateSupplierPrice(
  companyId: string,
  catalogItemId: string,
  supplierId: string,
  newCost: number
) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("material_supplier_prices")
    .select("*")
    .eq("company_id", companyId)
    .eq("catalog_item_id", catalogItemId)
    .eq("supplier_id", supplierId)
    .maybeSingle();

  if (existing && Number(existing.unit_cost) !== newCost) {
    await supabase.from("material_price_history").insert({
      company_id: companyId,
      catalog_item_id: catalogItemId,
      supplier_id: supplierId,
      old_cost: existing.unit_cost,
      new_cost: newCost,
    });
  }

  if (existing) {
    await supabase
      .from("material_supplier_prices")
      .update({ unit_cost: newCost, last_updated: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("material_supplier_prices").insert({
      company_id: companyId,
      catalog_item_id: catalogItemId,
      supplier_id: supplierId,
      unit_cost: newCost,
    });
  }
}

export async function upsertLaborRateTemplate(
  companyId: string,
  input: Omit<LaborRateTemplate, "id" | "companyId"> & { id?: string }
) {
  const supabase = await createClient();
  const marginPct =
    input.marginPct ?? calculateMarginFromPrices(input.costPerHr, input.billRate);

  const payload = {
    company_id: companyId,
    name: input.name,
    worker_count: input.workerCount,
    cost_per_hr: input.costPerHr,
    bill_rate: input.billRate,
    margin_pct: marginPct,
    rate_type: input.rateType,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  };

  if (input.id) {
    return supabase
      .from("labor_rate_templates")
      .update(payload)
      .eq("id", input.id)
      .eq("company_id", companyId)
      .select("*")
      .single();
  }

  return supabase.from("labor_rate_templates").insert(payload).select("*").single();
}

export async function getCompanyDefaultMaterialMargin(companyId: string): Promise<number> {
  if (!isSupabaseConfigured()) return DEFAULT_MATERIAL_MARGIN;
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("default_material_margin")
    .eq("id", companyId)
    .maybeSingle();
  return data?.default_material_margin != null
    ? Number(data.default_material_margin)
    : DEFAULT_MATERIAL_MARGIN;
}

export interface CatalogPriceImportRow {
  name: string;
  diameter?: string;
  sku?: string;
  referencePrice: number;
  sourceUrl?: string;
}

export function parseCatalogPricesCsv(content: string): CatalogPriceImportRow[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);

  const rows: CatalogPriceImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.every((c) => !c)) continue;

    const referencePrice = parseFloat(
      cols[idx("reference_price")] ?? cols[idx("prix_reference")] ?? cols[idx("price")] ?? "0"
    );
    if (!referencePrice || Number.isNaN(referencePrice)) continue;

    rows.push({
      sku: cols[idx("sku")] ?? undefined,
      name: cols[idx("name")] ?? cols[idx("nom")] ?? "",
      diameter: cols[idx("diameter")] ?? cols[idx("diametre")] ?? undefined,
      referencePrice,
      sourceUrl: cols[idx("source_url")] ?? cols[idx("url")] ?? undefined,
    });
  }
  return rows.filter((r) => r.name);
}

export async function importCatalogReferencePrices(
  companyId: string,
  rows: CatalogPriceImportRow[]
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const supabase = await createClient();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    let query = supabase
      .from("material_catalog_items")
      .select("id")
      .eq("name", row.name)
      .or("company_id.is.null");

    if (row.diameter) query = query.eq("diameter", row.diameter);

    const { data: items } = await query.limit(5);
    if (!items?.length) {
      errors.push(`Ligne ${index + 2}: article « ${row.name} » introuvable`);
      continue;
    }
    if (items.length > 1 && !row.diameter) {
      errors.push(`Ligne ${index + 2}: « ${row.name} » — précisez le diamètre`);
      continue;
    }

    const catalogItemId = String(items[0].id);
    const { data: existing } = await supabase
      .from("company_catalog_prices")
      .select("*")
      .eq("company_id", companyId)
      .eq("catalog_item_id", catalogItemId)
      .maybeSingle();

    if (existing?.manually_overridden) {
      skipped++;
      continue;
    }

    if (existing) {
      await supabase
        .from("company_catalog_prices")
        .update({
          reference_price: row.referencePrice,
          price_source: row.sourceUrl ?? existing.price_source,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("company_catalog_prices").insert({
        company_id: companyId,
        catalog_item_id: catalogItemId,
        reference_price: row.referencePrice,
        price_source: row.sourceUrl ?? null,
        manually_overridden: false,
      });
    }
    imported++;
  }

  return { imported, skipped, errors };
}

export interface CsvImportRow {
  name: string;
  categorySlug: string;
  diameter?: string;
  fittingType?: string;
  supplierCode: string;
  sku?: string;
  unitCost: number;
}

export async function importMaterialCatalogCsv(
  companyId: string,
  rows: CsvImportRow[],
  defaultMargin: number
): Promise<{ imported: number; errors: string[] }> {
  await ensureCompanyBillingDefaults(companyId);
  const supabase = await createClient();
  const categories = await getMaterialCategories(companyId);
  const suppliers = await getSuppliers(companyId);
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const supplierByCode = new Map(suppliers.map((s) => [s.code, s.id]));

  let imported = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    const categoryId = categoryBySlug.get(row.categorySlug);
    const supplierId = supplierByCode.get(row.supplierCode);
    if (!categoryId) {
      errors.push(`Ligne ${index + 2}: catégorie « ${row.categorySlug} » introuvable`);
      continue;
    }
    if (!supplierId) {
      errors.push(`Ligne ${index + 2}: fournisseur « ${row.supplierCode} » introuvable`);
      continue;
    }

    const { data: item, error: itemError } = await supabase
      .from("material_catalog_items")
      .insert({
        company_id: companyId,
        category_id: categoryId,
        name: row.name,
        diameter: row.diameter || null,
        fitting_type: row.fittingType || null,
        is_custom: true,
      })
      .select("*")
      .single();

    if (itemError || !item) {
      errors.push(`Ligne ${index + 2}: ${itemError?.message ?? "erreur insertion"}`);
      continue;
    }

    await updateSupplierPrice(companyId, String(item.id), supplierId, row.unitCost);
    imported++;
  }

  return { imported, errors };
}

export function parseMaterialCsv(content: string): CsvImportRow[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);

  const rows: CsvImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.every((c) => !c)) continue;
    rows.push({
      name: cols[idx("name")] ?? cols[idx("nom")] ?? "",
      categorySlug: cols[idx("category")] ?? cols[idx("categorie")] ?? "",
      diameter: cols[idx("diameter")] ?? cols[idx("diametre")] ?? undefined,
      fittingType: cols[idx("fitting_type")] ?? cols[idx("type")] ?? undefined,
      supplierCode: cols[idx("supplier")] ?? cols[idx("fournisseur")] ?? "autre",
      sku: cols[idx("sku")] ?? undefined,
      unitCost: parseFloat(cols[idx("unit_cost")] ?? cols[idx("cout")] ?? "0"),
    });
  }
  return rows.filter((r) => r.name && r.categorySlug);
}
