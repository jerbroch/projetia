"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/admin";
import { sendQuoteEmail } from "@/lib/email/send-quote";
import {
  buildDefaultLineItems,
  calculateDepositAmount,
  getPublicQuoteUrl,
  resolveAppOriginFromHeaders,
} from "@/lib/quote-utils";
import {
  deleteQuoteForCompany,
  duplicateQuoteForCompany,
  getNextQuoteNumber,
  insertQuoteForCompany,
  mapQuoteRow,
  sendQuoteForCompany,
  updateQuoteForCompany,
} from "@/lib/data/tenant-data";
import { requireTenantContext } from "@/lib/session";
import { quoteFormSchema, quoteIdSchema, sendQuoteSchema } from "@/lib/validations/quotes";
import type { Quote } from "@/types";

export type QuoteActionResult =
  | { success: true; quote: Quote }
  | { success: false; error: string };

export type SendQuoteResult =
  | { success: true; quote: Quote; publicUrl: string; emailProvider: string }
  | { success: false; error: string };

function safeError(message: string): QuoteActionResult {
  return { success: false, error: message };
}

function parseQuoteForm(formData: FormData) {
  return quoteFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    customerId: formData.get("customerId") || undefined,
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail") || undefined,
    amount: formData.get("amount"),
    status: formData.get("status"),
    validUntil: formData.get("validUntil") || undefined,
    depositRequired: formData.get("depositRequired") === "true",
    depositPercentage: formData.get("depositPercentage") || undefined,
    terms: formData.get("terms") || undefined,
  });
}

function toQuoteInput(parsed: NonNullable<ReturnType<typeof parseQuoteForm>["data"]>) {
  const lineItems = buildDefaultLineItems({
    title: parsed.title,
    description: parsed.description ?? "",
    amount: parsed.amount,
  });
  const depositAmount =
    parsed.depositRequired && parsed.depositPercentage
      ? calculateDepositAmount(parsed.amount, parsed.depositPercentage)
      : undefined;

  return {
    title: parsed.title,
    description: parsed.description,
    customerId: parsed.customerId,
    customerName: parsed.customerName,
    customerEmail: parsed.customerEmail || undefined,
    amount: parsed.amount,
    status: parsed.status,
    validUntil: parsed.validUntil,
    depositRequired: parsed.depositRequired,
    depositPercentage: parsed.depositRequired ? parsed.depositPercentage ?? 20 : undefined,
    depositAmount,
    terms: parsed.terms,
    lineItems,
  };
}

export async function createQuoteAction(formData: FormData): Promise<QuoteActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const parsed = parseQuoteForm(formData);
  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const quoteNumber = await getNextQuoteNumber(ctx.company.id);
  const { data, error } = await insertQuoteForCompany(ctx.company.id, {
    quoteNumber,
    ...toQuoteInput(parsed.data),
  });

  if (error || !data) {
    console.error("[createQuoteAction]", error?.message);
    return safeError("Impossible de créer la soumission.");
  }

  return { success: true, quote: mapQuoteRow(data as Record<string, unknown>) };
}

export async function updateQuoteAction(formData: FormData): Promise<QuoteActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const idParsed = quoteIdSchema.safeParse({ id: formData.get("id") });
  if (!idParsed.success) {
    return safeError(idParsed.error.errors[0]?.message ?? "Identifiant invalide");
  }

  const parsed = parseQuoteForm(formData);
  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const { data, error } = await updateQuoteForCompany(
    ctx.company.id,
    idParsed.data.id,
    toQuoteInput(parsed.data)
  );

  if (error || !data) {
    console.error("[updateQuoteAction]", error?.message);
    return safeError("Impossible de modifier la soumission.");
  }

  return { success: true, quote: mapQuoteRow(data as Record<string, unknown>) };
}

export async function deleteQuoteAction(quoteId: string): Promise<QuoteActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const idParsed = quoteIdSchema.safeParse({ id: quoteId });
  if (!idParsed.success) {
    return safeError(idParsed.error.errors[0]?.message ?? "Identifiant invalide");
  }

  const { data: existing, error: fetchError } = await (await createClient())
    .from("quotes")
    .select("*")
    .eq("id", idParsed.data.id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return safeError("Soumission introuvable.");
  }

  const { error } = await deleteQuoteForCompany(ctx.company.id, idParsed.data.id);
  if (error) {
    console.error("[deleteQuoteAction]", error.message);
    return safeError("Impossible de supprimer la soumission.");
  }

  return { success: true, quote: mapQuoteRow(existing as Record<string, unknown>) };
}

export async function duplicateQuoteAction(quoteId: string): Promise<QuoteActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const idParsed = quoteIdSchema.safeParse({ id: quoteId });
  if (!idParsed.success) {
    return safeError(idParsed.error.errors[0]?.message ?? "Identifiant invalide");
  }

  const { data, error } = await duplicateQuoteForCompany(ctx.company.id, idParsed.data.id);
  if (error || !data) {
    console.error("[duplicateQuoteAction]", error?.message);
    return safeError("Impossible de dupliquer la soumission.");
  }

  return { success: true, quote: mapQuoteRow(data as Record<string, unknown>) };
}

export async function sendQuoteAction(formData: FormData): Promise<SendQuoteResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return { success: false, error: "Utilisez le mode démo localement." };
  if (!isSupabaseAdminConfigured()) {
    return { success: false, error: "Supabase n'est pas configuré." };
  }

  const parsed = sendQuoteSchema.safeParse({
    quoteId: formData.get("quoteId"),
    recipientEmail: formData.get("recipientEmail"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const { quote, token, error } = await sendQuoteForCompany(
    ctx.company.id,
    parsed.data.quoteId,
    parsed.data.recipientEmail
  );

  if (error || !quote || !token) {
    return { success: false, error: error ?? "Impossible d'envoyer la soumission." };
  }

  const origin = resolveAppOriginFromHeaders(await headers());
  const publicUrl = getPublicQuoteUrl(token, origin);
  const emailResult = await sendQuoteEmail({
    to: parsed.data.recipientEmail,
    companyName: ctx.company.name,
    companyLogoUrl: ctx.company.logoUrl,
    primaryColor: ctx.company.primaryColor,
    customerName: quote.customerName,
    quoteNumber: quote.quoteNumber,
    quoteTitle: quote.title,
    publicUrl,
  });

  if (!emailResult.sent) {
    return { success: false, error: emailResult.error ?? "Échec de l'envoi du courriel." };
  }

  return {
    success: true,
    quote,
    publicUrl,
    emailProvider: emailResult.provider,
  };
}
