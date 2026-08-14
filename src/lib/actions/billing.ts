"use server";

import { revalidatePath } from "next/cache";
import {
  calculateLineTotal,
  calculateMarginFromPrices,
  buildInvoiceLineSnapshots,
} from "@/lib/billing-utils";
import {
  getCatalogItemEffectivePrice,
  getCompanyDefaultMaterialMargin,
  getJobBillingSheet,
  getLaborRateTemplates,
  getMaterialCategories,
  getNextInvoiceNumber,
  getOrCreateJobBillingSheet,
  importCatalogReferencePrices,
  importMaterialCatalogCsv,
  parseCatalogPricesCsv,
  parseMaterialCsv,
  recalculateBillingSheetTotals,
  resolveQuoteInvoiceContext,
  searchMaterialCatalog,
  syncInvoiceFromBillingSheet,
  upsertCompanyCatalogCustomPrice,
  upsertLaborRateTemplate,
  updateSheetMaterialMargin,
} from "@/lib/data/billing-data";
import { getScheduledJobById } from "@/lib/data/tenant-data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { requireTenantContext } from "@/lib/session";
import {
  canEditArchivedInvoice,
  canGenerateInvoiceStatus,
  canSendInvoiceToClient,
} from "@/lib/job-workflow";
import { isArchivedJob } from "@/lib/job-utils";
import type { JobBillingLine, JobBillingSheet, LaborRateTemplate, MaterialCatalogItem, ProfileRole, ScheduleEvent } from "@/types";

export type BillingActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

function fail(error: string): BillingActionResult<never> {
  return { success: false, error };
}

function saveFail(error: string): BillingActionResult<never> {
  return fail(`Erreur lors de l'enregistrement : ${error}`);
}

type BillingEditContext =
  | { ok: false; error: string }
  | { ok: true; job: ScheduleEvent; sheet: JobBillingSheet; syncInvoice: boolean };

async function resolveBillingEditContext(
  companyId: string,
  jobId: string,
  membershipRole: ProfileRole,
  company: Awaited<ReturnType<typeof requireTenantContext>>["company"]
): Promise<BillingEditContext> {
  const job = await getScheduledJobById(companyId, jobId, false);
  if (!job) return { ok: false, error: "Travail introuvable." };

  let sheet = await getJobBillingSheet(companyId, jobId);
  if (!sheet) {
    if (isArchivedJob(job)) {
      return { ok: false, error: "Feuille introuvable." };
    }
    sheet = await getOrCreateJobBillingSheet(companyId, jobId, company);
  }

  const archivedInvoiceEdit =
    isArchivedJob(job) && sheet.status === "invoiced" && canEditArchivedInvoice(membershipRole);

  if (sheet.status === "invoiced" && !archivedInvoiceEdit) {
    return { ok: false, error: "Cette feuille est déjà facturée." };
  }

  return { ok: true, job, sheet, syncInvoice: archivedInvoiceEdit && Boolean(sheet.invoiceId) };
}

async function finalizeBillingSheetUpdate(
  companyId: string,
  jobId: string,
  sheetId: string,
  company: Awaited<ReturnType<typeof requireTenantContext>>["company"],
  edit: Extract<BillingEditContext, { ok: true }>
): Promise<JobBillingSheet | null> {
  await recalculateBillingSheetTotals(companyId, sheetId, company);
  const updated = await getJobBillingSheet(companyId, jobId);
  if (edit.syncInvoice && updated?.invoiceId) {
    await syncInvoiceFromBillingSheet(companyId, updated, edit.job);
  }
  revalidateBillingPaths();
  return updated;
}

function revalidateBillingPaths() {
  revalidatePath("/schedule");
  revalidatePath("/archives");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/reviews");
}

export async function loadBillingSheetAction(jobId: string): Promise<
  BillingActionResult<{
    sheet: JobBillingSheet;
    laborTemplates: LaborRateTemplate[];
    defaultMargin: number;
    quoteNumber?: string;
    depositApplied?: number;
  }>
> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) {
    return fail("Utilisez le mode démo côté client.");
  }
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  try {
    const job = await getScheduledJobById(ctx.company.id, jobId, false);
    const [sheet, laborTemplates, defaultMargin] = await Promise.all([
      getOrCreateJobBillingSheet(ctx.company.id, jobId, ctx.company),
      getLaborRateTemplates(ctx.company.id),
      getCompanyDefaultMaterialMargin(ctx.company.id),
    ]);

    let quoteNumber: string | undefined;
    let depositApplied: number | undefined;
    if (job?.quoteId) {
      const quoteCtx = await resolveQuoteInvoiceContext(ctx.company.id, job.quoteId);
      quoteNumber = quoteCtx.quoteNumber;
      depositApplied = quoteCtx.depositApplied;
    }

    return {
      success: true,
      data: { sheet, laborTemplates, defaultMargin, quoteNumber, depositApplied },
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur de chargement.");
  }
}

export async function searchMaterialsAction(input: {
  query: string;
  categoryId?: string;
  diameter?: string;
  supplierId?: string;
  page?: number;
}): Promise<BillingActionResult<{ items: MaterialCatalogItem[]; total: number }>> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  const result = await searchMaterialCatalog(ctx.company.id, input);
  return { success: true, data: { items: result.items, total: result.total } };
}

export async function addLaborLineAction(input: {
  jobId: string;
  templateId: string;
  hours: number;
}): Promise<BillingActionResult<JobBillingSheet>> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  try {
    const edit = await resolveBillingEditContext(ctx.company.id, input.jobId, ctx.membershipRole, ctx.company);
    if (!edit.ok) return fail(edit.error);
    const sheet = edit.sheet;

    const templates = await getLaborRateTemplates(ctx.company.id);
    const template = templates.find((t) => t.id === input.templateId);
    if (!template) return fail("Modèle de main-d'œuvre introuvable.");

    const supabase = await createClient();
    const lineTotal = calculateLineTotal(input.hours, template.billRate);
    const sortOrder = sheet.lines.length;

    const { error: insertError } = await supabase.from("job_billing_lines").insert({
      billing_sheet_id: sheet.id,
      company_id: ctx.company.id,
      line_type: "labor",
      description: `${template.name} (${template.workerCount} compagnon${template.workerCount > 1 ? "s" : ""} × ${input.hours} h)`,
      quantity: input.hours,
      unit_cost: template.costPerHr,
      unit_sell_price: template.billRate,
      margin_pct: template.marginPct ?? calculateMarginFromPrices(template.costPerHr, template.billRate),
      line_total: lineTotal,
      labor_template_id: template.id,
      sort_order: sortOrder,
    });
    if (insertError) return saveFail(insertError.message);

    const updated = await finalizeBillingSheetUpdate(
      ctx.company.id,
      input.jobId,
      sheet.id,
      ctx.company,
      edit
    );
    return updated ? { success: true, data: updated } : saveFail("Feuille introuvable après enregistrement.");
  } catch (e) {
    return saveFail(e instanceof Error ? e.message : "Erreur inconnue.");
  }
}

export async function addCustomLaborLineAction(input: {
  jobId: string;
  description: string;
  hours: number;
  workerCount: number;
  hourlyRate: number;
}): Promise<BillingActionResult<JobBillingSheet>> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  try {
    const edit = await resolveBillingEditContext(ctx.company.id, input.jobId, ctx.membershipRole, ctx.company);
    if (!edit.ok) return fail(edit.error);
    const sheet = edit.sheet;

    const description = input.description.trim();
    if (!description) return fail("La description est requise.");

    const hours = input.hours;
    const workerCount = Math.max(1, input.workerCount);
    const hourlyRate = input.hourlyRate;
    if (!hours || hours <= 0) return fail("Heures invalides.");
    if (!hourlyRate || hourlyRate <= 0) return fail("Taux horaire invalide.");

    const effectiveRate = Math.round(hourlyRate * workerCount * 100) / 100;
    const lineTotal = calculateLineTotal(hours, effectiveRate);
    const supabase = await createClient();

    const { error: insertError } = await supabase.from("job_billing_lines").insert({
      billing_sheet_id: sheet.id,
      company_id: ctx.company.id,
      line_type: "labor",
      description: `${description} (${workerCount} travailleur${workerCount > 1 ? "s" : ""} × ${hours} h)`,
      quantity: hours,
      unit_cost: 0,
      unit_sell_price: effectiveRate,
      margin_pct: 0,
      line_total: lineTotal,
      sort_order: sheet.lines.length,
    });
    if (insertError) return saveFail(insertError.message);

    const updated = await finalizeBillingSheetUpdate(
      ctx.company.id,
      input.jobId,
      sheet.id,
      ctx.company,
      edit
    );
    return updated ? { success: true, data: updated } : saveFail("Feuille introuvable après enregistrement.");
  } catch (e) {
    return saveFail(e instanceof Error ? e.message : "Erreur inconnue.");
  }
}

export async function addMaterialLineAction(input: {
  jobId: string;
  catalogItemId: string;
  quantity: number;
  unitPrice?: number;
}): Promise<BillingActionResult<JobBillingSheet>> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  try {
    const edit = await resolveBillingEditContext(ctx.company.id, input.jobId, ctx.membershipRole, ctx.company);
    if (!edit.ok) return fail(edit.error);
    const sheet = edit.sheet;

    const supabase = await createClient();

    const { data: item } = await supabase
      .from("material_catalog_items")
      .select("*, material_categories(name)")
      .eq("id", input.catalogItemId)
      .maybeSingle();

    if (!item) return fail("Article introuvable.");

    const unitPrice =
      input.unitPrice ?? (await getCatalogItemEffectivePrice(ctx.company.id, input.catalogItemId));

    const category = item.material_categories as { name?: string } | null;
    const desc = [item.name, item.diameter, category?.name].filter(Boolean).join(" · ");
    const lineTotal = calculateLineTotal(input.quantity, unitPrice);

    const { error: insertError } = await supabase.from("job_billing_lines").insert({
      billing_sheet_id: sheet.id,
      company_id: ctx.company.id,
      line_type: "material",
      description: desc,
      quantity: input.quantity,
      unit_cost: unitPrice,
      unit_sell_price: unitPrice,
      margin_pct: null,
      line_total: lineTotal,
      catalog_item_id: input.catalogItemId,
      sort_order: sheet.lines.length,
      is_divers: false,
    });
    if (insertError) return saveFail(insertError.message);

    const updated = await finalizeBillingSheetUpdate(
      ctx.company.id,
      input.jobId,
      sheet.id,
      ctx.company,
      edit
    );
    return updated ? { success: true, data: updated } : saveFail("Feuille introuvable après enregistrement.");
  } catch (e) {
    return saveFail(e instanceof Error ? e.message : "Erreur inconnue.");
  }
}

export async function addDiversLineAction(input: {
  jobId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  addToCatalog?: boolean;
}): Promise<BillingActionResult<JobBillingSheet>> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  try {
    const edit = await resolveBillingEditContext(ctx.company.id, input.jobId, ctx.membershipRole, ctx.company);
    if (!edit.ok) return fail(edit.error);
    const sheet = edit.sheet;

    const supabase = await createClient();
    let catalogItemId: string | null = null;

    if (input.addToCatalog) {
      const categories = await getMaterialCategories(ctx.company.id);
      const diversCategory = categories.find((c) => c.slug === "divers");
      if (!diversCategory) return fail("Catégorie Divers introuvable.");

      const { data: newItem, error: itemError } = await supabase
        .from("material_catalog_items")
        .insert({
          company_id: ctx.company.id,
          category_id: diversCategory.id,
          name: input.description,
          is_custom: true,
          unit: "unité",
        })
        .select("*")
        .single();

      if (itemError || !newItem) return saveFail(itemError?.message ?? "Impossible d'ajouter au catalogue.");

      catalogItemId = String(newItem.id);
      await upsertCompanyCatalogCustomPrice(ctx.company.id, catalogItemId, input.unitPrice);
    }

    const lineTotal = calculateLineTotal(input.quantity, input.unitPrice);

    const { error: insertError } = await supabase.from("job_billing_lines").insert({
      billing_sheet_id: sheet.id,
      company_id: ctx.company.id,
      line_type: "material",
      description: input.description,
      quantity: input.quantity,
      unit_cost: input.unitPrice,
      unit_sell_price: input.unitPrice,
      margin_pct: null,
      line_total: lineTotal,
      catalog_item_id: catalogItemId,
      sort_order: sheet.lines.length,
      is_divers: true,
    });
    if (insertError) return saveFail(insertError.message);

    const updated = await finalizeBillingSheetUpdate(
      ctx.company.id,
      input.jobId,
      sheet.id,
      ctx.company,
      edit
    );
    return updated ? { success: true, data: updated } : saveFail("Feuille introuvable après enregistrement.");
  } catch (e) {
    return saveFail(e instanceof Error ? e.message : "Erreur inconnue.");
  }
}

export async function updateBillingLineAction(input: {
  jobId: string;
  lineId: string;
  quantity?: number;
  unitPrice?: number;
}): Promise<BillingActionResult<JobBillingSheet>> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  try {
    const edit = await resolveBillingEditContext(ctx.company.id, input.jobId, ctx.membershipRole, ctx.company);
    if (!edit.ok) return fail(edit.error);
    const sheet = edit.sheet;

    const line = sheet.lines.find((l) => l.id === input.lineId);
    if (!line) return fail("Ligne introuvable.");

    const quantity = input.quantity ?? line.quantity;
    const unitCost = input.unitPrice ?? line.unitCost;
    const unitSellPrice =
      input.unitPrice != null
        ? input.unitPrice
        : line.lineType === "material"
          ? unitCost
          : line.unitSellPrice;
    const lineTotal = calculateLineTotal(quantity, unitSellPrice);
    const supabase = await createClient();

    const { error: updateError } = await supabase
      .from("job_billing_lines")
      .update({
        quantity,
        unit_cost: unitCost,
        unit_sell_price: unitSellPrice,
        line_total: lineTotal,
      })
      .eq("id", input.lineId)
      .eq("company_id", ctx.company.id);
    if (updateError) return saveFail(updateError.message);

    if (line.lineType === "material" && line.catalogItemId && input.unitPrice != null) {
      await upsertCompanyCatalogCustomPrice(ctx.company.id, line.catalogItemId, input.unitPrice);
    }

    const updated = await finalizeBillingSheetUpdate(
      ctx.company.id,
      input.jobId,
      sheet.id,
      ctx.company,
      edit
    );
    return updated ? { success: true, data: updated } : saveFail("Feuille introuvable après enregistrement.");
  } catch (e) {
    return saveFail(e instanceof Error ? e.message : "Erreur inconnue.");
  }
}

export async function removeBillingLineAction(input: {
  jobId: string;
  lineId: string;
}): Promise<BillingActionResult<JobBillingSheet>> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  try {
    const edit = await resolveBillingEditContext(ctx.company.id, input.jobId, ctx.membershipRole, ctx.company);
    if (!edit.ok) return fail(edit.error);
    const sheet = edit.sheet;

    const supabase = await createClient();
    const { error: deleteError } = await supabase
      .from("job_billing_lines")
      .delete()
      .eq("id", input.lineId)
      .eq("company_id", ctx.company.id);
    if (deleteError) return saveFail(deleteError.message);

    const updated = await finalizeBillingSheetUpdate(
      ctx.company.id,
      input.jobId,
      sheet.id,
      ctx.company,
      edit
    );
    return updated ? { success: true, data: updated } : saveFail("Feuille introuvable après enregistrement.");
  } catch (e) {
    return saveFail(e instanceof Error ? e.message : "Erreur inconnue.");
  }
}

export async function generateInvoiceFromBillingAction(
  jobId: string
): Promise<BillingActionResult<{ invoiceId: string; invoiceNumber: string }>> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");
  if (!canSendInvoiceToClient(ctx.membershipRole)) {
    return fail("Accès refusé — vous ne pouvez pas générer de facture.");
  }

  const job = await getScheduledJobById(ctx.company.id, jobId, false);
  if (!job) return fail("Travail introuvable.");
  if (!canGenerateInvoiceStatus(job.status)) {
    return fail("Ce travail doit être approuvé avant la génération de facture.");
  }

  const sheet = await getJobBillingSheet(ctx.company.id, jobId);
  if (!sheet) return fail("Aucune feuille de facturation.");
  if (sheet.status === "invoiced" && sheet.invoiceId) {
    return fail("Une facture existe déjà pour ce travail.");
  }
  if (sheet.lines.length === 0) return fail("Ajoutez au moins une ligne avant de facturer.");

  const supabase = await createClient();
  const invoiceNumber = await getNextInvoiceNumber(ctx.company.id);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const materialMarginPct =
    sheet.materialMarginPct ?? (await getCompanyDefaultMaterialMargin(ctx.company.id));

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

  const quoteContext = await resolveQuoteInvoiceContext(ctx.company.id, job.quoteId);
  const depositApplied = quoteContext.depositApplied;
  const paidAmount = depositApplied;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      company_id: ctx.company.id,
      invoice_number: invoiceNumber,
      customer_id: job.customerId || null,
      customer_name: job.customerName || null,
      quote_id: job.quoteId || null,
      quote_number: quoteContext.quoteNumber || null,
      scheduled_job_id: jobId,
      job_number: job.jobNumber || null,
      client_po_number: job.clientPoNumber || null,
      work_description: job.workDescription || null,
      amount: sheet.total,
      subtotal: sheet.subtotal,
      deposit_applied: depositApplied,
      paid_amount: paidAmount,
      material_subtotal: sheet.materialSubtotal,
      labor_subtotal: sheet.laborSubtotal,
      gst_amount: sheet.gstAmount,
      qst_amount: sheet.qstAmount,
      line_items: lineSnapshots.map((l) => ({
        line_type: l.lineType,
        description: l.description,
        quantity: l.quantity,
        unit_cost: l.unitCost,
        unit_sell_price: l.unitSellPrice,
        margin_pct: l.marginPct,
        line_total: l.lineTotal,
      })),
      status: "draft",
      due_date: dueDate.toISOString().slice(0, 10),
    })
    .select("*")
    .single();

  if (error || !invoice) return fail("Impossible de créer la facture.");

  await supabase
    .from("job_billing_sheets")
    .update({ status: "invoiced", invoice_id: invoice.id })
    .eq("id", sheet.id)
    .eq("company_id", ctx.company.id);

  revalidateBillingPaths();
  return {
    success: true,
    data: { invoiceId: String(invoice.id), invoiceNumber: String(invoice.invoice_number) },
  };
}

export async function saveLaborRateTemplateAction(
  formData: FormData
): Promise<BillingActionResult<LaborRateTemplate>> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return fail("Paramètres démo non modifiables.");
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("Nom requis.");

  const { data, error } = await upsertLaborRateTemplate(ctx.company.id, {
    id,
    name,
    workerCount: Number(formData.get("workerCount") ?? 1),
    costPerHr: Number(formData.get("costPerHr") ?? 0),
    billRate: Number(formData.get("billRate") ?? 0),
    rateType: (formData.get("rateType") as LaborRateTemplate["rateType"]) ?? "regular",
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    isActive: formData.get("isActive") !== "false",
  });

  if (error || !data) return fail("Impossible de sauvegarder le modèle.");
  revalidatePath("/settings");
  return {
    success: true,
    data: {
      id: String(data.id),
      companyId: ctx.company.id,
      name: String(data.name),
      workerCount: Number(data.worker_count),
      costPerHr: Number(data.cost_per_hr),
      billRate: Number(data.bill_rate),
      marginPct: data.margin_pct != null ? Number(data.margin_pct) : undefined,
      rateType: data.rate_type as LaborRateTemplate["rateType"],
      sortOrder: Number(data.sort_order),
      isActive: Boolean(data.is_active),
    },
  };
}

export async function updateDefaultMaterialMarginAction(
  marginPct: number
): Promise<BillingActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return fail("Paramètres démo non modifiables.");
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ default_material_margin: marginPct })
    .eq("id", ctx.company.id);

  if (error) return fail("Impossible de sauvegarder.");
  revalidatePath("/settings");
  return { success: true };
}

export async function importCatalogPricesCsvAction(
  csvContent: string
): Promise<BillingActionResult<{ imported: number; skipped: number; errors: string[] }>> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return fail("Import démo non disponible.");
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  const rows = parseCatalogPricesCsv(csvContent);
  if (rows.length === 0) return fail("Fichier CSV vide ou invalide.");

  const result = await importCatalogReferencePrices(ctx.company.id, rows);
  revalidatePath("/settings");
  return { success: true, data: result };
}

export async function updateCatalogCustomPriceAction(input: {
  catalogItemId: string;
  customPrice: number;
}): Promise<BillingActionResult> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  try {
    await upsertCompanyCatalogCustomPrice(ctx.company.id, input.catalogItemId, input.customPrice);
    return { success: true };
  } catch (e) {
    return saveFail(e instanceof Error ? e.message : "Erreur inconnue.");
  }
}

export async function updateSheetMaterialMarginAction(input: {
  jobId: string;
  marginPct: number;
}): Promise<BillingActionResult<JobBillingSheet>> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  try {
    const edit = await resolveBillingEditContext(ctx.company.id, input.jobId, ctx.membershipRole, ctx.company);
    if (!edit.ok) return fail(edit.error);
    const sheet = edit.sheet;

    await updateSheetMaterialMargin(ctx.company.id, sheet.id, input.marginPct, ctx.company);
    const updated = await finalizeBillingSheetUpdate(
      ctx.company.id,
      input.jobId,
      sheet.id,
      ctx.company,
      edit
    );
    return updated ? { success: true, data: updated } : saveFail("Feuille introuvable après enregistrement.");
  } catch (e) {
    return saveFail(e instanceof Error ? e.message : "Erreur inconnue.");
  }
}

export async function importMaterialCsvAction(
  csvContent: string
): Promise<BillingActionResult<{ imported: number; errors: string[] }>> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return fail("Import démo non disponible.");
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  const rows = parseMaterialCsv(csvContent);
  if (rows.length === 0) return fail("Fichier CSV vide ou invalide.");

  const defaultMargin = await getCompanyDefaultMaterialMargin(ctx.company.id);
  const result = await importMaterialCatalogCsv(ctx.company.id, rows, defaultMargin);
  revalidatePath("/settings");
  return { success: true, data: result };
}

export async function updateCatalogItemCostAction(input: {
  catalogItemId: string;
  customPrice: number;
}): Promise<BillingActionResult> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  await upsertCompanyCatalogCustomPrice(ctx.company.id, input.catalogItemId, input.customPrice);
  return { success: true };
}

export async function getBillingSummaryForJobAction(jobId: string): Promise<
  BillingActionResult<{
    sheet: JobBillingSheet | null;
    invoiceNumber?: string;
    invoiceId?: string;
  }>
> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return { success: true, data: { sheet: null } };

  const sheet = await getJobBillingSheet(ctx.company.id, jobId);
  if (!sheet?.invoiceId) return { success: true, data: { sheet } };

  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("id", sheet.invoiceId)
    .maybeSingle();

  return {
    success: true,
    data: {
      sheet,
      invoiceId: data ? String(data.id) : undefined,
      invoiceNumber: data ? String(data.invoice_number) : undefined,
    },
  };
}

export async function loadBillingSettingsAction(): Promise<
  BillingActionResult<{
    laborTemplates: LaborRateTemplate[];
    defaultMargin: number;
    categories: Awaited<ReturnType<typeof getMaterialCategories>>;
  }>
> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");

  const [laborTemplates, defaultMargin, categories] = await Promise.all([
    getLaborRateTemplates(ctx.company.id),
    getCompanyDefaultMaterialMargin(ctx.company.id),
    getMaterialCategories(ctx.company.id),
  ]);

  return { success: true, data: { laborTemplates, defaultMargin, categories } };
}

// Re-export for type usage in components
export type { JobBillingLine };
