/**
 * Traduction d'une facture Stripe en ligne de `platform_invoices`.
 *
 * Module pur : il reçoit un payload, il rend un enregistrement. C'est ce qui
 * permet de le vérifier sur des formes réelles sans réseau, et de le partager
 * entre le webhook et le rattrapage d'historique — deux chemins qui doivent
 * produire exactement la même ligne, sans quoi la réconciliation signalerait
 * des écarts imaginaires.
 *
 * Les emplacements de champs sont lus avec la même prudence que dans
 * stripe-payload.ts : une facture livrée par un endpoint webhook ancien ne
 * porte pas ses champs au même endroit qu'une facture lue par le SDK courant.
 */
import { invoiceSubscriptionId, stripeIdOf } from "@/lib/billing/stripe-payload";

/** Ventilation par nature de taxe, en cents. */
export interface TaxSplit {
  gst: number;
  qst: number;
  other: number;
}

/**
 * `tax_type` des objets `tax_rate` de Stripe, pour chaque `txr_` rencontré.
 * L'appelant le fournit : le résoudre demande un appel réseau, que ce module
 * pur ne fait pas.
 */
export type TaxTypeLookup = Record<string, string | undefined>;

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : null;

const asCents = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;

/** Secondes Unix → ISO, ou null. Stripe met `0` là où il n'y a pas de date. */
export function secondsToIso(v: unknown): string | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0
    ? new Date(v * 1000).toISOString()
    : null;
}

/** Les `txr_` cités par une facture, pour que l'appelant les résolve. */
export function taxRateIdsOf(invoice: unknown): string[] {
  const taxes = asRecord(invoice)?.total_taxes;
  if (!Array.isArray(taxes)) return [];

  const ids = taxes
    .map((t) => stripeIdOf(asRecord(asRecord(t)?.tax_rate_details)?.tax_rate))
    .filter((id): id is string => Boolean(id));

  return [...new Set(ids)];
}

/**
 * Répartit les taxes par nature.
 *
 * Une nature inconnue tombe dans `other` plutôt que d'être ignorée : mieux
 * vaut un total juste avec une ligne inclassée qu'une taxe silencieusement
 * perdue. Le détail brut est conservé à côté pour trancher après coup.
 */
export function splitTaxes(invoice: unknown, types: TaxTypeLookup = {}): TaxSplit {
  const split: TaxSplit = { gst: 0, qst: 0, other: 0 };
  const taxes = asRecord(invoice)?.total_taxes;
  if (!Array.isArray(taxes)) return split;

  for (const entry of taxes) {
    const ligne = asRecord(entry);
    const montant = asCents(ligne?.amount);
    if (montant === 0) continue;

    const id = stripeIdOf(asRecord(ligne?.tax_rate_details)?.tax_rate);
    const nature = id ? types[id] : undefined;

    // La TPS fédérale et la TVH provinciale se remettent au même endroit.
    if (nature === "gst" || nature === "hst") split.gst += montant;
    else if (nature === "qst" || nature === "pst") split.qst += montant;
    else split.other += montant;
  }

  return split;
}

export interface InvoiceRecord {
  id: string;
  company_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  number: string | null;
  status: string;
  billing_reason: string | null;
  currency: string;
  subtotal_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  amount_due_cents: number;
  gst_cents: number;
  qst_cents: number;
  other_tax_cents: number;
  tax_breakdown: unknown;
  period_start: string | null;
  period_end: string | null;
  issued_at: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
}

/**
 * L'entreprise concernée, lue dans les métadonnées posées au Checkout.
 * Nulle si absente : la facture reste enregistrée, sans rattachement. Une
 * ligne orpheline vaut mieux qu'un revenu perdu.
 */
export function companyIdOf(invoice: unknown): string | null {
  const inv = asRecord(invoice);
  const direct = asRecord(inv?.metadata)?.companyId;
  if (typeof direct === "string" && direct) return direct;

  const details = asRecord(asRecord(inv?.parent)?.subscription_details);
  const viaAbonnement = asRecord(details?.metadata)?.companyId;
  return typeof viaAbonnement === "string" && viaAbonnement ? viaAbonnement : null;
}

export function toInvoiceRecord(
  invoice: unknown,
  types: TaxTypeLookup = {},
): InvoiceRecord | null {
  const inv = asRecord(invoice);
  const id = typeof inv?.id === "string" ? inv.id : null;
  if (!id) return null;

  const taxes = splitTaxes(invoice, types);
  const transitions = asRecord(inv?.status_transitions);

  return {
    id,
    company_id: companyIdOf(invoice),
    stripe_customer_id: stripeIdOf(inv?.customer),
    stripe_subscription_id: invoiceSubscriptionId(invoice),
    number: typeof inv?.number === "string" ? inv.number : null,
    status: typeof inv?.status === "string" ? inv.status : "unknown",
    billing_reason: typeof inv?.billing_reason === "string" ? inv.billing_reason : null,
    currency: typeof inv?.currency === "string" ? inv.currency : "cad",
    subtotal_cents: asCents(inv?.subtotal),
    total_cents: asCents(inv?.total),
    amount_paid_cents: asCents(inv?.amount_paid),
    amount_due_cents: asCents(inv?.amount_due),
    gst_cents: taxes.gst,
    qst_cents: taxes.qst,
    other_tax_cents: taxes.other,
    tax_breakdown: inv?.total_taxes ?? null,
    period_start: secondsToIso(inv?.period_start),
    period_end: secondsToIso(inv?.period_end),
    issued_at: secondsToIso(inv?.created),
    paid_at: secondsToIso(transitions?.paid_at),
    hosted_invoice_url:
      typeof inv?.hosted_invoice_url === "string" ? inv.hosted_invoice_url : null,
    invoice_pdf_url: typeof inv?.invoice_pdf === "string" ? inv.invoice_pdf : null,
  };
}
