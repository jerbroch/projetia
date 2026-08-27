"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { requireAdminContext } from "@/lib/session";
import {
  applyPayment,
  isPaymentMethod,
  paymentMethodLabel,
  refusePayment,
  type PaymentMethod,
} from "@/lib/billing/payment-recording";
import { buildInteracEmailBlock } from "@/lib/email/invoice-email-template";
import { sendReceiptEmail } from "@/lib/email/send-receipt";

export interface RecordPaymentInput {
  invoiceId: string;
  /** Montant en dollars. */
  amount: number;
  method: PaymentMethod;
  /** Date de réception, format ISO `AAAA-MM-JJ`. Défaut : aujourd'hui. */
  receivedAt?: string;
  reference?: string;
  note?: string;
  /** Permet de ne pas envoyer de reçu — paiement saisi rétroactivement. */
  sendReceipt?: boolean;
}

export type RecordPaymentResult =
  | {
      success: true;
      paidAmount: number;
      remaining: number;
      settled: boolean;
      receiptSent: boolean;
      receiptError?: string;
    }
  | { success: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Enregistre un paiement reçu d'un client, et envoie le reçu.
 *
 * Réservée à l'entrepreneur : `requireAdminContext()` exige une session avec
 * un rôle d'administration. Aucun jeton public n'y donne accès, contrairement
 * à l'ancien chemin de dépôt qui se contentait de la possession d'un lien.
 *
 * Le paiement est enregistré AVANT l'envoi du reçu, et un échec d'envoi ne
 * le remet pas en cause : l'argent est reçu, c'est le fait à consigner. Le
 * résultat rapporte l'échec pour que l'interface puisse le signaler.
 */
export async function recordInvoicePaymentAction(
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  const ctx = await requireAdminContext();
  if (ctx.isDemo) {
    return { success: false, error: "Non disponible pour le compte de démonstration." };
  }
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Service indisponible." };
  }
  if (!isPaymentMethod(input.method)) {
    return { success: false, error: "Mode de paiement invalide." };
  }
  if (input.receivedAt && !ISO_DATE.test(input.receivedAt)) {
    return { success: false, error: "Date de réception invalide." };
  }

  const admin = createAdminClient();

  // La facture doit appartenir à l'entreprise de la session : c'est ce qui
  // empêche d'encaisser sur la facture d'une autre entreprise en devinant un id.
  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select("id, invoice_number, customer_name, amount, paid_amount, status")
    .eq("id", input.invoiceId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return { success: false, error: "Facture introuvable." };
  }

  if (invoice.status === "cancelled") {
    return { success: false, error: "Cette facture est annulée." };
  }

  const balance = {
    amount: Number(invoice.amount ?? 0),
    paidAmount: Number(invoice.paid_amount ?? 0),
  };

  const refusal = refusePayment(balance, input.amount);
  if (refusal) return { success: false, error: refusal.message };

  const outcome = applyPayment(balance, input.amount);
  const receivedAt = input.receivedAt ?? new Date().toISOString().slice(0, 10);

  const { error: insertError } = await admin.from("payments").insert({
    company_id: ctx.company.id,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    customer_name: invoice.customer_name,
    amount: input.amount,
    method: input.method,
    status: "completed",
    received_at: receivedAt,
    reference: input.reference?.trim() || null,
    note: input.note?.trim() || null,
    recorded_by: ctx.user.id,
  });

  if (insertError) {
    return {
      success: false,
      error: isSchemaNotReady(insertError.message)
        ? "La migration des paiements (026) n'est pas encore appliquée."
        : "Impossible d'enregistrer le paiement.",
    };
  }

  const invoiceUpdate: Record<string, unknown> = { paid_amount: outcome.paidAmount };
  if (outcome.invoiceStatus) invoiceUpdate.status = outcome.invoiceStatus;

  const { error: updateError } = await admin
    .from("invoices")
    .update(invoiceUpdate)
    .eq("id", invoice.id)
    .eq("company_id", ctx.company.id);

  if (updateError) {
    // Le paiement est enregistré mais la facture n'a pas suivi : le dire
    // plutôt que laisser croire à un succès complet.
    return {
      success: false,
      error:
        "Paiement enregistré, mais la facture n'a pas pu être mise à jour. " +
        "Vérifiez son solde.",
    };
  }

  const receipt = await maybeSendReceipt({
    companyId: ctx.company.id,
    companyName: ctx.company.name,
    companyLogoUrl: ctx.company.logoUrl,
    primaryColor: ctx.company.primaryColor,
    invoiceId: invoice.id,
    invoiceNumber: String(invoice.invoice_number),
    customerName: invoice.customer_name ? String(invoice.customer_name) : null,
    amountReceived: input.amount,
    method: input.method,
    receivedAt,
    reference: input.reference?.trim() || null,
    remaining: outcome.remaining,
    enabled: input.sendReceipt !== false,
  });

  revalidatePath("/payments");
  revalidatePath("/invoices");

  return {
    success: true,
    paidAmount: outcome.paidAmount,
    remaining: outcome.remaining,
    settled: outcome.settlesInvoice,
    receiptSent: receipt.sent,
    receiptError: receipt.error,
  };
}

function isSchemaNotReady(message: string): boolean {
  return /column .* does not exist|invalid input value for enum/i.test(message);
}

interface ReceiptContext {
  companyId: string;
  companyName: string;
  companyLogoUrl?: string | null;
  primaryColor?: string | null;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string | null;
  amountReceived: number;
  method: PaymentMethod;
  receivedAt: string;
  reference: string | null;
  remaining: number;
  enabled: boolean;
}

/**
 * Envoie le reçu quand un courriel client est connu. L'absence de courriel
 * n'est pas une erreur : beaucoup de clients d'entrepreneur n'en donnent pas.
 */
async function maybeSendReceipt(
  ctx: ReceiptContext,
): Promise<{ sent: boolean; error?: string }> {
  if (!ctx.enabled) return { sent: false };

  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("customer_id")
    .eq("id", ctx.invoiceId)
    .maybeSingle();

  const customerId = invoice?.customer_id ? String(invoice.customer_id) : null;
  if (!customerId) return { sent: false };

  const { data: customer } = await admin
    .from("customers")
    .select("email")
    .eq("id", customerId)
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  const to = customer?.email ? String(customer.email).trim() : "";
  if (!to) return { sent: false };

  // Les coordonnées Interac ne sont rappelées que s'il reste un solde.
  let interacBlock: string | null = null;
  if (ctx.remaining > 0) {
    const { data: company } = await admin
      .from("companies")
      .select("interac_enabled, interac_email, interac_recipient_name, interac_security_question, interac_instructions")
      .eq("id", ctx.companyId)
      .maybeSingle();

    if (company?.interac_enabled) {
      interacBlock = buildInteracEmailBlock({
        email: company.interac_email ? String(company.interac_email) : null,
        recipientName: company.interac_recipient_name
          ? String(company.interac_recipient_name)
          : null,
        securityQuestion: company.interac_security_question
          ? String(company.interac_security_question)
          : null,
        instructions: company.interac_instructions
          ? String(company.interac_instructions)
          : null,
      });
    }
  }

  const result = await sendReceiptEmail({
    to,
    companyName: ctx.companyName,
    companyLogoUrl: ctx.companyLogoUrl,
    primaryColor: ctx.primaryColor,
    customerName: ctx.customerName,
    invoiceNumber: ctx.invoiceNumber,
    amountReceived: ctx.amountReceived,
    methodLabel: paymentMethodLabel(ctx.method),
    receivedOn: formatDateFr(ctx.receivedAt),
    reference: ctx.reference,
    remainingBalance: ctx.remaining,
    interacBlock,
  });

  return { sent: result.sent, error: result.error };
}

/** `2026-09-08` → `8 septembre 2026`. */
function formatDateFr(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export interface RecordDepositInput {
  quoteId: string;
  method: PaymentMethod;
  /** Date de réception, format ISO `AAAA-MM-JJ`. Défaut : aujourd'hui. */
  receivedAt?: string;
  reference?: string;
}

export type RecordDepositResult =
  | { success: true; depositAmount: number }
  | { success: false; error: string };

/**
 * Constate la réception du dépôt d'une soumission.
 *
 * Remplace l'ancien chemin public, où la possession du lien de soumission
 * suffisait à marquer le dépôt payé sans qu'un sou ait bougé. Seul
 * l'entrepreneur constate désormais un encaissement, comme pour une facture.
 */
export async function recordQuoteDepositAction(
  input: RecordDepositInput,
): Promise<RecordDepositResult> {
  const ctx = await requireAdminContext();
  if (ctx.isDemo) {
    return { success: false, error: "Non disponible pour le compte de démonstration." };
  }
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Service indisponible." };
  }
  if (!isPaymentMethod(input.method)) {
    return { success: false, error: "Mode de paiement invalide." };
  }
  if (input.receivedAt && !ISO_DATE.test(input.receivedAt)) {
    return { success: false, error: "Date de réception invalide." };
  }

  const admin = createAdminClient();

  const { data: quote, error } = await admin
    .from("quotes")
    .select("id, quote_number, status, deposit_amount")
    .eq("id", input.quoteId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  if (error || !quote) {
    return { success: false, error: "Soumission introuvable." };
  }
  if (quote.status !== "deposit_pending") {
    return { success: false, error: "Aucun dépôt en attente pour cette soumission." };
  }

  const depositAmount = Number(quote.deposit_amount ?? 0);
  if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
    return { success: false, error: "Le montant du dépôt n'est pas défini." };
  }

  const { error: updateError } = await admin
    .from("quotes")
    .update({ status: "deposit_paid", deposit_status: "paid" })
    .eq("id", quote.id)
    .eq("company_id", ctx.company.id);

  if (updateError) {
    return { success: false, error: "Impossible de confirmer le dépôt." };
  }

  // Le dépôt est tracé comme un encaissement, sans facture rattachée : il
  // précède la facturation. `invoice_id` reste nul, la table l'autorise.
  const { error: paymentError } = await admin.from("payments").insert({
    company_id: ctx.company.id,
    invoice_number: quote.quote_number ? `Dépôt ${quote.quote_number}` : "Dépôt",
    amount: depositAmount,
    method: input.method,
    status: "completed",
    received_at: input.receivedAt ?? new Date().toISOString().slice(0, 10),
    reference: input.reference?.trim() || null,
    note: `Dépôt sur la soumission ${quote.quote_number ?? quote.id}`,
    recorded_by: ctx.user.id,
  });

  if (paymentError) {
    // Le dépôt est confirmé sur la soumission ; l'écriture comptable a
    // échoué. On le signale plutôt que de laisser un trou silencieux.
    console.error("[recordQuoteDepositAction] écriture du paiement échouée:", paymentError.message);
  }

  revalidatePath("/quotes");
  revalidatePath("/payments");

  return { success: true, depositAmount };
}
