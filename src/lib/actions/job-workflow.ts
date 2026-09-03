"use server";

import { revalidatePath } from "next/cache";
import {
  buildInteracEmailBlock,
  buildInvoiceEmailSubject,
  toClientInvoiceLineItems,
} from "@/lib/email/invoice-email-template";
import { sendInvoiceEmail } from "@/lib/email/send-invoice";
import { getJobBillingSheet, recalculateBillingSheetTotals } from "@/lib/data/billing-data";
import { getScheduledJobById, mapScheduleRow } from "@/lib/data/tenant-data";
import {
  canApproveBilling,
  canApproveJobStatus,
  canRestoreArchivedJob,
  canSendInvoiceToClient,
  canSubmitJobForReview,
  canSubmitJobStatus,
  resolveRestoredJobStatus,
} from "@/lib/job-workflow";
import { isArchivedJob } from "@/lib/job-utils";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { requireTenantContext } from "@/lib/session";
import type { ScheduleEvent } from "@/types";
import { adresseDeReponse } from "@/lib/email/expediteur";
import { photosDuCallPourFacture } from "@/lib/email/photos-pour-facture";

export type WorkflowActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

function fail(error: string): WorkflowActionResult<never> {
  return { success: false, error };
}

function revalidateWorkflowPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/reviews");
  revalidatePath("/schedule");
  revalidatePath("/archives");
  revalidatePath("/invoices");
}

export async function submitJobForReviewAction(input: {
  jobId: string;
  workDescription: string;
  closureNotes?: string;
}): Promise<WorkflowActionResult<ScheduleEvent>> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return fail("Utilisez le mode démo côté client.");
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");
  if (!canSubmitJobForReview(ctx.membershipRole)) {
    return fail("Accès refusé.");
  }

  const workDescription = input.workDescription.trim();
  if (!workDescription) return fail("La description des travaux est requise.");

  const job = await getScheduledJobById(ctx.company.id, input.jobId, false);
  if (!job) return fail("Travail introuvable.");
  if (!canSubmitJobStatus(job.status)) {
    return fail("Ce travail ne peut pas être soumis pour vérification.");
  }

  const sheet = await getJobBillingSheet(ctx.company.id, input.jobId);
  if (!sheet || sheet.lines.length === 0) {
    return fail("Ajoutez au moins une ligne de main-d'œuvre ou de matériel avant de fermer le travail.");
  }
  if (sheet.status === "invoiced") {
    return fail("Ce travail est déjà facturé.");
  }

  const now = new Date().toISOString();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scheduled_jobs")
    .update({
      status: "completed",
      work_description: workDescription,
      closure_notes: input.closureNotes?.trim() || null,
      submitted_for_review_at: now,
      work_completed_at: now,
    })
    .eq("id", input.jobId)
    .eq("company_id", ctx.company.id)
    .select("*")
    .single();

  if (error || !data) return fail("Impossible de soumettre le travail pour vérification.");

  revalidateWorkflowPaths();
  return { success: true, data: mapScheduleRow(data) };
}

export async function approveJobForBillingAction(
  jobId: string
): Promise<WorkflowActionResult<ScheduleEvent>> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");
  if (!canApproveBilling(ctx.membershipRole)) {
    return fail("Accès refusé — seuls les gestionnaires peuvent approuver.");
  }

  const job = await getScheduledJobById(ctx.company.id, jobId, false);
  if (!job) return fail("Travail introuvable.");
  if (!canApproveJobStatus(job)) {
    return fail("Ce travail n'est pas en attente de vérification.");
  }

  const sheet = await getJobBillingSheet(ctx.company.id, jobId);
  if (!sheet || sheet.lines.length === 0) {
    return fail("La feuille de facturation est vide.");
  }
  if (sheet.status === "invoiced") return fail("Ce travail est déjà facturé.");

  await recalculateBillingSheetTotals(ctx.company.id, sheet.id, ctx.company);

  const now = new Date().toISOString();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scheduled_jobs")
    .update({
      status: "ready-to-invoice",
      approved_by: ctx.user.id,
      approved_at: now,
    })
    .eq("id", jobId)
    .eq("company_id", ctx.company.id)
    .select("*")
    .single();

  if (error || !data) return fail("Impossible d'approuver le travail.");

  revalidateWorkflowPaths();
  return { success: true, data: mapScheduleRow(data) };
}

/**
 * Envoie la facture au client, POUR DE VRAI, puis pose les marques d'envoi.
 *
 * `jobId` est facultatif : une facture rapide n'a pas de call, et elle doit
 * pouvoir partir quand même. Sans ça, la page Factures ne pouvait rien envoyer.
 *
 * Le statut du travail n'est PLUS une condition d'envoi. Il l'était, et la
 * condition se contredisait : le seul bouton d'envoi vivait dans une fenêtre
 * qui exigeait un call non encore approuvé, alors que l'envoi exigeait un call
 * déjà approuvé. Les deux ne pouvaient pas être vrais ensemble, et FA-2026-007
 * est restée en brouillon pendant qu'on la croyait partie. Ce qui compte est
 * qu'une facture existe et appartienne à l'entreprise.
 */
export async function sendInvoiceEmailAction(input: {
  jobId?: string | null;
  invoiceId: string;
  recipientEmail: string;
  subject?: string;
  message?: string;
}): Promise<WorkflowActionResult<{ sentTo: string }>> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");
  if (!canSendInvoiceToClient(ctx.membershipRole)) {
    return fail("Accès refusé — vous ne pouvez pas envoyer de facture au client.");
  }

  const recipient = input.recipientEmail.trim();
  if (!recipient) return fail("Le courriel du destinataire est requis.");

  const job = input.jobId
    ? await getScheduledJobById(ctx.company.id, input.jobId, false)
    : null;
  if (input.jobId && !job) return fail("Travail introuvable.");

  const supabase = await createClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", input.invoiceId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  if (invoiceError || !invoice) return fail("Facture introuvable.");

  const lineItemsRaw = invoice.line_items;
  const parsedItems = Array.isArray(lineItemsRaw)
    ? lineItemsRaw.map((item) => {
        const i = item as Record<string, unknown>;
        return {
          description: String(i.description ?? ""),
          quantity: Number(i.quantity ?? 1),
          unitSellPrice: Number(i.unit_sell_price ?? i.unitSellPrice ?? 0),
          lineTotal: Number(i.line_total ?? i.lineTotal ?? 0),
        };
      })
    : [];

  const interac = ctx.company.interac;
  const interacBlock =
    interac?.enabled && interac.email
      ? buildInteracEmailBlock({
          email: interac.email,
          recipientName: interac.recipientName,
          securityQuestion: interac.securityQuestion,
          securityAnswer: interac.securityAnswer,
          instructions: interac.instructions,
          invoiceNumber: String(invoice.invoice_number),
        })
      : // Même sans Interac, le client doit savoir quoi inscrire en référence :
        // c'est ce qui permet de rapprocher un paiement d'une facture.
        buildInteracEmailBlock({ invoiceNumber: String(invoice.invoice_number) });

  const depositApplied =
    invoice.deposit_applied != null ? Number(invoice.deposit_applied) : 0;
  const paidAmount = Number(invoice.paid_amount ?? 0);
  const invoiceTotal = Number(invoice.amount);
  const balanceDue = Math.max(0, invoiceTotal - paidAmount);

  // Les photos du chantier partent AVEC la facture, en images liées. Une
  // facture accompagnée du travail accompli ne se conteste pas.
  const photos = await photosDuCallPourFacture(
    ctx.company.id,
    job?.id ?? (invoice.scheduled_job_id ? String(invoice.scheduled_job_id) : null),
  );

  const emailResult = await sendInvoiceEmail({
    to: recipient,
    photos: photos.pourLeGabarit,
    pieces: photos.pieces,
    // Le client répond à L'ENTREPRISE. Le domaine d'envoi ne sait qu'envoyer :
    // une réponse à l'expéditeur rebondirait, et l'entrepreneur ne le saurait
    // jamais — c'est ainsi qu'on perd un contrat sans l'apprendre.
    replyTo: adresseDeReponse(ctx.company.email),
    subject:
      input.subject?.trim() ||
      buildInvoiceEmailSubject({
        invoiceNumber: String(invoice.invoice_number),
        companyName: ctx.company.name,
      }),
    companyName: ctx.company.name,
    companyLogoUrl: ctx.company.logoUrl,
    primaryColor: ctx.company.primaryColor,
    customerName: job?.customerName ?? String(invoice.customer_name ?? ""),
    invoiceNumber: String(invoice.invoice_number),
    quoteNumber: invoice.quote_number ? String(invoice.quote_number) : null,
    jobNumber: job?.jobNumber ?? (invoice.job_number ? String(invoice.job_number) : null),
    clientPoNumber:
      job?.clientPoNumber ?? (invoice.client_po_number ? String(invoice.client_po_number) : null),
    workDescription:
      job?.workDescription ??
      (invoice.work_description ? String(invoice.work_description) : null),
    lineItems: toClientInvoiceLineItems(parsedItems),
    materialSubtotal:
      invoice.material_subtotal != null ? Number(invoice.material_subtotal) : undefined,
    laborSubtotal: invoice.labor_subtotal != null ? Number(invoice.labor_subtotal) : undefined,
    gstAmount: invoice.gst_amount != null ? Number(invoice.gst_amount) : undefined,
    qstAmount: invoice.qst_amount != null ? Number(invoice.qst_amount) : undefined,
    total: invoiceTotal,
    depositApplied: depositApplied > 0 ? depositApplied : undefined,
    balanceDue,
    dueDate: invoice.due_date ? String(invoice.due_date) : null,
    customMessage: input.message?.trim() || null,
    interacBlock,
  });

  if (!emailResult.sent) {
    return fail(emailResult.error ?? "Échec de l'envoi du courriel.");
  }

  const now = new Date().toISOString();

  const { error: updateInvoiceError } = await supabase
    .from("invoices")
    .update({
      status: "sent",
      sent_at: now,
      sent_to: recipient,
      sent_by: ctx.user.id,
    })
    .eq("id", input.invoiceId)
    .eq("company_id", ctx.company.id);

  if (updateInvoiceError) return fail("Courriel envoyé mais impossible de mettre à jour la facture.");

  // Une facture rapide n'a pas de call à faire avancer.
  if (input.jobId) {
    const { error: updateJobError } = await supabase
      .from("scheduled_jobs")
      .update({
        status: "invoice-sent",
        sent_at: now,
        sent_to: recipient,
        sent_by: ctx.user.id,
      })
      .eq("id", input.jobId)
      .eq("company_id", ctx.company.id);

    if (updateJobError) return fail("Courriel envoyé mais impossible de mettre à jour le travail.");
  }

  revalidateWorkflowPaths();
  return { success: true, data: { sentTo: recipient } };
}

export async function restoreArchivedJobAction(
  jobId: string
): Promise<WorkflowActionResult<ScheduleEvent>> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return fail("Utilisez le mode démo côté client.");
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");
  if (!canRestoreArchivedJob(ctx.membershipRole)) {
    return fail("Accès refusé — droits administrateur requis.");
  }

  const job = await getScheduledJobById(ctx.company.id, jobId, false);
  if (!job) return fail("Travail introuvable.");
  if (!isArchivedJob(job)) {
    return fail("Ce travail n'est pas archivé.");
  }

  const sheet = await getJobBillingSheet(ctx.company.id, jobId);
  if (!sheet?.invoiceId) {
    return fail("Aucune facture à restaurer pour ce travail.");
  }

  const supabase = await createClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("sent_at")
    .eq("id", sheet.invoiceId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  if (invoiceError || !invoice) return fail("Facture introuvable.");

  const nextStatus = resolveRestoredJobStatus(
    invoice.sent_at ? String(invoice.sent_at) : null
  );

  const { data, error } = await supabase
    .from("scheduled_jobs")
    .update({ status: nextStatus })
    .eq("id", jobId)
    .eq("company_id", ctx.company.id)
    .select("*")
    .single();

  if (error || !data) return fail("Impossible de restaurer le travail.");

  revalidateWorkflowPaths();
  return { success: true, data: mapScheduleRow(data) };
}

export async function updateInteracSettingsAction(formData: FormData): Promise<WorkflowActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return fail("Paramètres démo non modifiables.");
  if (!isSupabaseConfigured()) return fail("Supabase n'est pas configuré.");
  if (ctx.membershipRole !== "owner" && ctx.membershipRole !== "admin") {
    return fail("Accès refusé.");
  }

  const enabled = formData.get("interacEnabled") === "true";
  const supabase = await createClient();

  const { error } = await supabase
    .from("companies")
    .update({
      interac_enabled: enabled,
      interac_email: formData.get("interacEmail") || null,
      interac_recipient_name: formData.get("interacRecipientName") || null,
      interac_security_question: formData.get("interacSecurityQuestion") || null,
      interac_security_answer: formData.get("interacSecurityAnswer") || null,
      interac_instructions: formData.get("interacInstructions") || null,
    })
    .eq("id", ctx.company.id);

  if (error) return fail("Impossible de sauvegarder les paramètres Interac.");
  revalidatePath("/settings");
  return { success: true };
}
