/**
 * Audit des prix : compare ce que la config ANNONCE à ce que Stripe FACTURE.
 *
 * Les montants de tiers.ts ne servent qu'à l'affichage ; c'est le Stripe Price
 * ID qui détermine le débit réel. Rien ne garantit que les deux concordent —
 * ce module est ce garde-fou. Pur : aucun appel réseau, testable hors ligne.
 */
import {
  BILLING_CURRENCY,
  SUBSCRIPTION_TIERS,
  priceCentsForTier,
  priceIdForTier,
  type BillingCycle,
  type SubscriptionTier,
} from "@/lib/billing/tiers";

export type StripeInterval = "month" | "year";

export interface ExpectedPrice {
  tier: SubscriptionTier;
  tierName: string;
  cycle: BillingCycle;
  envKey: string;
  /** null quand la variable d'environnement n'est pas posée */
  priceId: string | null;
  expectedCents: number;
  expectedInterval: StripeInterval;
  expectedCurrency: string;
}

/** Ce que l'audit a besoin de savoir d'un Stripe Price. */
export interface StripePriceFacts {
  id: string;
  active: boolean;
  currency: string;
  unitAmount: number | null;
  type: string;
  interval: string | null;
  intervalCount: number | null;
  livemode: boolean;
}

export type PriceIssueCode =
  | "missing_env"
  | "not_found"
  | "livemode_mismatch"
  | "inactive"
  | "wrong_amount"
  | "wrong_currency"
  | "not_recurring"
  | "wrong_interval"
  | "wrong_interval_count";

export interface PriceIssue {
  code: PriceIssueCode;
  message: string;
}

export function intervalForCycle(cycle: BillingCycle): StripeInterval {
  return cycle === "annual" ? "year" : "month";
}

function formatCents(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

/** Les 8 attentes, dérivées de la config et de l'environnement courant. */
export function expectedPricesFromConfig(): ExpectedPrice[] {
  const expectations: ExpectedPrice[] = [];

  for (const tier of SUBSCRIPTION_TIERS) {
    for (const cycle of ["monthly", "annual"] as const) {
      expectations.push({
        tier: tier.id,
        tierName: tier.name,
        cycle,
        envKey: tier.priceIdEnv[cycle],
        priceId: priceIdForTier(tier.id, cycle),
        expectedCents: priceCentsForTier(tier, cycle),
        expectedInterval: intervalForCycle(cycle),
        expectedCurrency: BILLING_CURRENCY,
      });
    }
  }

  return expectations;
}

/**
 * Compare une attente au Price réellement présent chez Stripe.
 * `keyLivemode` : le mode de la clé API utilisée, pour détecter le mélange
 * test/live — la panne la plus fréquente et la plus déroutante.
 */
export function auditPrice(
  expected: ExpectedPrice,
  actual: StripePriceFacts | null,
  options: { keyLivemode: boolean },
): PriceIssue[] {
  const issues: PriceIssue[] = [];

  if (!expected.priceId) {
    return [
      {
        code: "missing_env",
        message: `${expected.envKey} n'est pas défini — ce palier ne peut pas être vendu.`,
      },
    ];
  }

  if (!actual) {
    return [
      {
        code: "not_found",
        message: `${expected.priceId} introuvable chez Stripe (${
          options.keyLivemode ? "mode Live" : "mode Test"
        }).`,
      },
    ];
  }

  if (actual.livemode !== options.keyLivemode) {
    issues.push({
      code: "livemode_mismatch",
      message: `${expected.priceId} est un prix ${
        actual.livemode ? "Live" : "Test"
      } alors que la clé API est ${options.keyLivemode ? "Live" : "Test"}.`,
    });
  }

  if (!actual.active) {
    issues.push({
      code: "inactive",
      message: `${expected.priceId} est archivé chez Stripe — le Checkout échouera.`,
    });
  }

  if (actual.unitAmount !== expected.expectedCents) {
    issues.push({
      code: "wrong_amount",
      message: `La page annonce ${formatCents(
        expected.expectedCents,
        expected.expectedCurrency,
      )} mais Stripe facture ${
        actual.unitAmount == null
          ? "un montant variable"
          : formatCents(actual.unitAmount, actual.currency)
      }.`,
    });
  }

  if (actual.currency.toLowerCase() !== expected.expectedCurrency.toLowerCase()) {
    issues.push({
      code: "wrong_currency",
      message: `Devise attendue ${expected.expectedCurrency.toUpperCase()}, Stripe facture en ${actual.currency.toUpperCase()}.`,
    });
  }

  if (actual.type !== "recurring") {
    issues.push({
      code: "not_recurring",
      message: `${expected.priceId} est un paiement unique, pas un abonnement.`,
    });
    return issues;
  }

  if (actual.interval !== expected.expectedInterval) {
    issues.push({
      code: "wrong_interval",
      message: `Cycle attendu « ${expected.expectedInterval} », Stripe facture par « ${actual.interval} ».`,
    });
  }

  if (actual.intervalCount != null && actual.intervalCount !== 1) {
    issues.push({
      code: "wrong_interval_count",
      message: `Stripe facture tous les ${actual.intervalCount} ${actual.interval}s, attendu : 1.`,
    });
  }

  return issues;
}

export interface AuditRow {
  expected: ExpectedPrice;
  issues: PriceIssue[];
}

export function summarizeAudit(rows: AuditRow[]): {
  ok: boolean;
  failed: number;
  total: number;
} {
  const failed = rows.filter((r) => r.issues.length > 0).length;
  return { ok: failed === 0, failed, total: rows.length };
}
