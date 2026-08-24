/**
 * Centralized SaaS pricing — values from env; null means "Prix à configurer" in UI.
 */
export interface PricingConfig {
  monthlyPriceCents: number | null;
  annualPriceCents: number | null;
  /** Percentage discount on annual vs 12× monthly (e.g. 20 = 20 % off) */
  annualDiscountPercent: number | null;
  currency: string;
  /** Stripe Price IDs — required to open Checkout for the plan */
  monthlyPriceId: string | null;
  annualPriceId: string | null;
  /** Free trial offered at checkout (0 = no trial) */
  trialDays: number;
}

export type SubscriptionPlan = "monthly" | "annual";

function parseOptionalCents(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function parseOptionalId(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseTrialDays(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), 730);
}

function parseOptionalPercent(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

export function getPricingConfig(): PricingConfig {
  return {
    monthlyPriceCents: parseOptionalCents(process.env.SUBSCRIPTION_MONTHLY_PRICE_CENTS),
    annualPriceCents: parseOptionalCents(process.env.SUBSCRIPTION_ANNUAL_PRICE_CENTS),
    annualDiscountPercent: parseOptionalPercent(process.env.SUBSCRIPTION_ANNUAL_DISCOUNT_PERCENT),
    currency: (process.env.SUBSCRIPTION_CURRENCY ?? "cad").toLowerCase(),
    monthlyPriceId: parseOptionalId(process.env.STRIPE_PRICE_ID_MONTHLY),
    annualPriceId: parseOptionalId(process.env.STRIPE_PRICE_ID_ANNUAL),
    trialDays: parseTrialDays(process.env.SUBSCRIPTION_TRIAL_DAYS),
  };
}

/** Stripe Price ID for a plan, or null when the plan is not sellable yet. */
export function priceIdForPlan(
  config: PricingConfig,
  plan: SubscriptionPlan,
): string | null {
  return plan === "annual" ? config.annualPriceId : config.monthlyPriceId;
}

/** Plan matching a Stripe Price ID — used when reading subscriptions back. */
export function planForPriceId(
  config: PricingConfig,
  priceId: string | null | undefined,
): SubscriptionPlan | null {
  if (!priceId) return null;
  if (config.annualPriceId && priceId === config.annualPriceId) return "annual";
  if (config.monthlyPriceId && priceId === config.monthlyPriceId) return "monthly";
  return null;
}

export function planLabel(plan: SubscriptionPlan | string | null | undefined): string {
  if (plan === "monthly") return "Mensuel";
  if (plan === "annual") return "Annuel";
  return "—";
}

export function formatPrice(cents: number | null, currency: string): string {
  if (cents == null) return "Prix à configurer";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function annualSavingsLabel(config: PricingConfig): string | null {
  const { monthlyPriceCents, annualPriceCents, annualDiscountPercent, currency } = config;
  if (annualDiscountPercent != null && annualDiscountPercent > 0) {
    return `Économisez ${annualDiscountPercent} %`;
  }
  if (monthlyPriceCents != null && annualPriceCents != null) {
    const fullYear = monthlyPriceCents * 12;
    if (fullYear > annualPriceCents) {
      const saved = fullYear - annualPriceCents;
      return `Économisez ${formatPrice(saved, currency)}`;
    }
  }
  return null;
}
