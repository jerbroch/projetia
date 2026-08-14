/**
 * Centralized SaaS pricing — values from env; null means "Prix à configurer" in UI.
 */
export interface PricingConfig {
  monthlyPriceCents: number | null;
  annualPriceCents: number | null;
  /** Percentage discount on annual vs 12× monthly (e.g. 20 = 20 % off) */
  annualDiscountPercent: number | null;
  currency: string;
}

function parseOptionalCents(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
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
  };
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
