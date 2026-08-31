/**
 * Écriture d'une facture Stripe dans `platform_invoices`.
 *
 * Le webhook et le rattrapage d'historique passent tous deux par ici, pour
 * qu'une facture produise la même ligne quelle que soit la voie — sinon la
 * réconciliation signalerait des écarts qui ne seraient que des différences
 * d'écriture.
 */
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import {
  taxRateIdsOf,
  toInvoiceRecord,
  type TaxTypeLookup,
} from "@/lib/billing/invoice-record";

/**
 * `txr_…` → `gst` | `qst` | … Les taux sont peu nombreux et ne changent pas :
 * un cache pour la durée du processus évite de les redemander à chaque facture
 * lors d'un rattrapage de plusieurs centaines de lignes.
 */
const cacheTypes = new Map<string, string | undefined>();

export async function resolveTaxTypes(
  ids: string[],
  stripe: Stripe = getStripe(),
): Promise<TaxTypeLookup> {
  const lookup: TaxTypeLookup = {};

  for (const id of ids) {
    if (!cacheTypes.has(id)) {
      try {
        const taux = await stripe.taxRates.retrieve(id);
        cacheTypes.set(id, taux.tax_type ?? undefined);
      } catch {
        // Un taux illisible ne doit pas empêcher d'enregistrer la facture :
        // le montant tombera dans `other_tax_cents`, visible et rattrapable.
        cacheTypes.set(id, undefined);
      }
    }
    lookup[id] = cacheTypes.get(id);
  }

  return lookup;
}

export interface RecordInvoiceResult {
  recorded: boolean;
  id?: string;
  error?: string;
}

/**
 * Enregistre ou met à jour une facture.
 *
 * L'écriture est un upsert sur l'id Stripe : une facture passe par plusieurs
 * états — brouillon, finalisée, payée — et chaque évènement doit réécrire la
 * même ligne plutôt qu'en créer une nouvelle.
 */
export async function recordPlatformInvoice(
  invoice: unknown,
  stripe?: Stripe,
): Promise<RecordInvoiceResult> {
  const types = await resolveTaxTypes(taxRateIdsOf(invoice), stripe);
  const record = toInvoiceRecord(invoice, types);
  if (!record) return { recorded: false, error: "Facture sans identifiant." };

  const admin = createAdminClient();

  // La clé étrangère rejetterait la ligne entière si l'entreprise citée
  // n'existe plus — une entreprise supprimée, ou des métadonnées pointant
  // ailleurs. Ce serait perdre le revenu pour préserver un lien, exactement
  // l'inverse de ce que cette table doit garantir. On détache donc plutôt
  // que d'échouer : la facture est conservée, orpheline et visible comme telle.
  if (record.company_id) {
    const { data: entreprise } = await admin
      .from("companies")
      .select("id")
      .eq("id", record.company_id)
      .maybeSingle();
    if (!entreprise) record.company_id = null;
  }

  const { error } = await admin
    .from("platform_invoices")
    .upsert(record, { onConflict: "id" });

  if (error) {
    return { recorded: false, id: record.id, error: error.message };
  }

  return { recorded: true, id: record.id };
}
