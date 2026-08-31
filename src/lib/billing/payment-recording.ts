/**
 * Règles d'enregistrement d'un paiement reçu.
 *
 * Aucun paiement n'arrive par une notification : l'entrepreneur constate un
 * virement Interac, un chèque déposé ou de l'argent comptant, puis le saisit.
 * Ce module porte les règles de cette saisie ; le module est pur pour qu'elles
 * soient vérifiables sans base ni réseau.
 */

/** Modes réellement utilisés — l'énumération Postgres `payment_method`. */
export const PAYMENT_METHODS = [
  "interac",
  "check",
  "cash",
  "transfer",
  "other",
  "card",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  interac: "Virement Interac",
  check: "Chèque",
  cash: "Comptant",
  transfer: "Virement bancaire",
  other: "Autre",
  card: "Carte",
};

export function paymentMethodLabel(method: string): string {
  return isPaymentMethod(method) ? METHOD_LABELS[method] : "Autre";
}

/** Les montants circulent en dollars ; on compare en cents pour éviter les
 *  écarts de virgule flottante (0.1 + 0.2 ≠ 0.3). */
const cents = (montant: number) => Math.round(montant * 100);

export interface InvoiceBalance {
  amount: number;
  paidAmount: number;
}

/** Reste à payer, jamais négatif. */
export function invoiceBalance(invoice: InvoiceBalance): number {
  return Math.max(0, (cents(invoice.amount) - cents(invoice.paidAmount)) / 100);
}

export type PaymentRefusal =
  | { code: "invalid_amount"; message: string }
  | { code: "already_settled"; message: string }
  | { code: "exceeds_balance"; message: string };

const money = (montant: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(montant);

/**
 * Vérifie qu'un montant peut être enregistré sur cette facture.
 *
 * Le dépassement est refusé plutôt qu'absorbé : un paiement supérieur au solde
 * signale une erreur de saisie ou un trop-perçu, et les deux appellent une
 * décision — pas un `paid_amount` supérieur au total, qui rendrait tous les
 * rapports faux en silence. Le message nomme le solde pour que la correction
 * soit immédiate.
 */
export function refusePayment(
  invoice: InvoiceBalance,
  montant: number,
): PaymentRefusal | null {
  if (!Number.isFinite(montant) || cents(montant) <= 0) {
    return {
      code: "invalid_amount",
      message: "Le montant du paiement doit être supérieur à zéro.",
    };
  }

  const solde = invoiceBalance(invoice);
  if (cents(solde) === 0) {
    return {
      code: "already_settled",
      message: "Cette facture est déjà entièrement payée.",
    };
  }

  if (cents(montant) > cents(solde)) {
    return {
      code: "exceeds_balance",
      message:
        `Le montant saisi (${money(montant)}) dépasse le solde de la facture ` +
        `(${money(solde)}). Corrigez le montant, ou enregistrez ${money(solde)} ` +
        "pour solder la facture.",
    };
  }

  return null;
}

export interface PaymentOutcome {
  /** Nouveau cumul encaissé sur la facture. */
  paidAmount: number;
  /** Reste à payer après ce paiement. */
  remaining: number;
  /** Vrai quand ce paiement solde la facture. */
  settlesInvoice: boolean;
  /** Statut à écrire sur la facture — inchangé tant qu'elle n'est pas soldée. */
  invoiceStatus: "paid" | null;
}

/** État de la facture après un paiement dont on a déjà vérifié la validité. */
export function applyPayment(invoice: InvoiceBalance, montant: number): PaymentOutcome {
  const paidAmount = (cents(invoice.paidAmount) + cents(montant)) / 100;
  const remaining = Math.max(0, (cents(invoice.amount) - cents(paidAmount)) / 100);
  const settlesInvoice = cents(remaining) === 0;

  return {
    paidAmount,
    remaining,
    settlesInvoice,
    invoiceStatus: settlesInvoice ? "paid" : null,
  };
}
