"use server";

import { revalidatePath } from "next/cache";
import { getNextInvoiceNumber } from "@/lib/data/billing-data";
import {
  lignesRetenues,
  refusDeFactureRapide,
  totauxFactureRapide,
  type LigneFactureRapide,
} from "@/lib/facture-rapide";
import { requireTenantContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export interface FactureRapideResult {
  success: boolean;
  error?: string;
  invoiceId?: string;
  invoiceNumber?: string;
}

/**
 * Crée une facture sans soumission, sans travail et sans feuille.
 *
 * Le rattachement à un travail reste possible ensuite — `scheduled_job_id`
 * est nullable — mais il n'est pas exigé ici. C'est tout l'intérêt : un
 * entrepreneur qui veut facturer une réparation d'une heure n'a pas à
 * inventer un travail au calendrier pour y arriver.
 */
export async function creerFactureRapideAction(input: {
  customerId?: string | null;
  customerName: string;
  workDescription?: string;
  dueInDays?: number;
  lignes: LigneFactureRapide[];
}): Promise<FactureRapideResult> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };
  if (ctx.isDemo) return { success: false, error: "Indisponible en mode démo." };

  const refus = refusDeFactureRapide(input.customerName, input.lignes);
  if (refus) return { success: false, error: refus };

  const totaux = totauxFactureRapide(input.lignes, ctx.company);
  const supabase = await createClient();
  const invoiceNumber = await getNextInvoiceNumber(ctx.company.id);

  const echeance = new Date();
  echeance.setDate(echeance.getDate() + (input.dueInDays ?? 30));

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      company_id: ctx.company.id,
      invoice_number: invoiceNumber,
      customer_id: input.customerId || null,
      customer_name: input.customerName.trim(),
      work_description: input.workDescription?.trim() || null,
      amount: totaux.total,
      subtotal: totaux.subtotal,
      // Une facture rapide n'a pas de ventilation matériaux / main-d'œuvre :
      // l'entrepreneur saisit des lignes libres. Tout va au sous-total.
      material_subtotal: 0,
      labor_subtotal: totaux.subtotal,
      gst_amount: totaux.gst,
      qst_amount: totaux.qst,
      deposit_applied: 0,
      paid_amount: 0,
      line_items: lignesRetenues(input.lignes).map((l) => ({
        line_type: "labor",
        description: l.description,
        quantity: l.quantity,
        unit_cost: 0,
        unit_sell_price: l.unitPrice,
        margin_pct: 0,
        line_total: l.lineTotal,
      })),
      status: "draft",
      due_date: echeance.toISOString().slice(0, 10),
    })
    .select("id, invoice_number")
    .single();

  if (error || !data) {
    console.error("[creerFactureRapideAction]", error?.message);
    return { success: false, error: "Impossible de créer la facture." };
  }

  revalidatePath("/invoices");
  revalidatePath("/payments");
  return {
    success: true,
    invoiceId: String(data.id),
    invoiceNumber: String(data.invoice_number),
  };
}

/**
 * Crée un client sans quitter le formulaire en cours.
 *
 * Sert à la fois à la facture rapide et à la soumission : dans les deux cas,
 * devoir sortir vers /customers pour revenir ensuite fait perdre la saisie en
 * cours, et c'est exactement le genre de friction qui fait abandonner.
 */
export async function creerClientRapideAction(input: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<{ success: boolean; error?: string; customer?: { id: string; name: string; email: string; phone: string; address: string } }> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };
  if (ctx.isDemo) return { success: false, error: "Indisponible en mode démo." };

  const name = input.name.trim();
  if (!name) return { success: false, error: "Le nom du client est requis." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: ctx.company.id,
      name,
      email: input.email?.trim().toLowerCase() || "",
      phone: input.phone?.trim() || "",
      address: input.address?.trim() || "",
      status: "active",
    })
    .select("id, name, email, phone, address")
    .single();

  if (error || !data) {
    console.error("[creerClientRapideAction]", error?.message);
    return { success: false, error: "Impossible de créer le client." };
  }

  revalidatePath("/customers");
  revalidatePath("/quotes");
  revalidatePath("/invoices");
  return {
    success: true,
    customer: {
      id: String(data.id),
      name: String(data.name),
      email: String(data.email ?? ""),
      phone: String(data.phone ?? ""),
      address: String(data.address ?? ""),
    },
  };
}
