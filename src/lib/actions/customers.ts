"use server";

import { revalidatePath } from "next/cache";
import {
  countQuotesForCustomer,
  createCustomerForCompany,
  deleteCustomerForCompany,
  mapCustomerRow,
  updateCustomerForCompany,
} from "@/lib/data/tenant-data";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { requireTenantContext } from "@/lib/session";
import { customerFormSchema } from "@/lib/validations/customers";
import type { Customer } from "@/types";

export type CustomerActionResult =
  | { success: true; customer: Customer }
  | { success: false; error: string };

export type CustomerDeleteResult = { success: true } | { success: false; error: string };

function safeError(message: string): CustomerActionResult {
  return { success: false, error: message };
}

function parseCustomerForm(formData: FormData) {
  return customerFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
    company: formData.get("company") || undefined,
    status: formData.get("status") || undefined,
  });
}

export async function createCustomerAction(formData: FormData): Promise<CustomerActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const parsed = parseCustomerForm(formData);
  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const { data, error } = await createCustomerForCompany(ctx.company.id, {
    name: parsed.data.name,
    email: parsed.data.email || undefined,
    phone: parsed.data.phone || undefined,
    address: parsed.data.address || undefined,
    company: parsed.data.company || undefined,
    status: parsed.data.status ?? "active",
  });

  if (error || !data) {
    console.error("[createCustomerAction]", error?.message);
    return safeError("Impossible d'ajouter le client.");
  }

  revalidatePath("/customers");
  revalidatePath("/quotes");
  revalidatePath("/schedule");

  return { success: true, customer: mapCustomerRow(data as Record<string, unknown>) };
}

export async function updateCustomerAction(
  customerId: string,
  formData: FormData
): Promise<CustomerActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");
  if (!customerId) return safeError("Client introuvable.");

  const parsed = parseCustomerForm(formData);
  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const { data, error } = await updateCustomerForCompany(ctx.company.id, customerId, {
    name: parsed.data.name,
    email: parsed.data.email || undefined,
    phone: parsed.data.phone || undefined,
    address: parsed.data.address || undefined,
    company: parsed.data.company || undefined,
    status: parsed.data.status ?? "active",
  });

  if (error || !data) {
    console.error("[updateCustomerAction]", error?.message);
    return safeError("Impossible de mettre à jour le client.");
  }

  revalidatePath("/customers");
  revalidatePath("/quotes");
  revalidatePath("/schedule");

  return { success: true, customer: mapCustomerRow(data as Record<string, unknown>) };
}

export async function deleteCustomerAction(customerId: string): Promise<CustomerDeleteResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return { success: false, error: "Utilisez le mode démo localement." };
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };
  if (!customerId) return { success: false, error: "Client introuvable." };

  const quoteCount = await countQuotesForCustomer(ctx.company.id, customerId);
  if (quoteCount > 0) {
    return {
      success: false,
      error: "Ce client est lié à des soumissions. Supprimez ou réassignez les soumissions d'abord.",
    };
  }

  const { error } = await deleteCustomerForCompany(ctx.company.id, customerId);
  if (error) {
    console.error("[deleteCustomerAction]", error.message);
    return { success: false, error: "Impossible de supprimer le client." };
  }

  revalidatePath("/customers");
  revalidatePath("/quotes");
  revalidatePath("/schedule");

  return { success: true };
}
