import type { BillingLineInput } from "@/lib/billing-utils";
import { calculateQuoteTotals, getQuoteLineItems } from "@/lib/quote-utils";
import type { Company, Quote } from "@/types";

/** Margin applied to quote-sourced material lines — quote prices are already final sell prices. */
export const QUOTE_BILLING_MATERIAL_MARGIN = 0;

export interface QuoteBillingPrefill {
  lines: BillingLineInput[];
  materialMarginPct: number;
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
}

export interface InvoiceAmountBreakdown {
  /** Full invoice total (Total des travaux) — never reduced by deposit. */
  total: number;
  subtotal: number;
  gst: number;
  qst: number;
  /** Deposit already received on the linked quote (single source of truth). */
  depositApplied: number;
  /** Amount still owed: total − payments received (deposit + invoice payments). */
  balanceDue: number;
  paidAmount: number;
}

/**
 * Resolves deposit already paid on a quote.
 * Uses quote.deposit_amount when deposit_status is "paid" — does not double-count payments.
 */
export function resolveQuoteDepositPaid(quote: Pick<Quote, "depositRequired" | "depositStatus" | "depositAmount">): number {
  if (!quote.depositRequired) return 0;
  if (quote.depositStatus !== "paid") return 0;
  const amount = quote.depositAmount ?? 0;
  return amount > 0 ? roundCurrency(amount) : 0;
}

/** Converts quote line items to billing sheet lines (material, sell price = quote unit price). */
export function buildBillingLinesFromQuote(quote: Quote): BillingLineInput[] {
  return getQuoteLineItems(quote).map((item) => ({
    lineType: "material" as const,
    description: item.description,
    quantity: item.quantity,
    unitCost: item.unitPrice,
    unitSellPrice: item.unitPrice,
    isDivers: true,
  }));
}

/** Builds billing prefill totals from a quote using company tax rates. */
export function buildQuoteBillingPrefill(quote: Quote, company: Pick<Company, "gstRate" | "qstRate">): QuoteBillingPrefill {
  const lines = buildBillingLinesFromQuote(quote);
  const subtotal = roundCurrency(lines.reduce((sum, line) => sum + line.quantity * line.unitSellPrice, 0));
  const taxes = calculateQuoteTotals(subtotal, company);
  return {
    lines,
    materialMarginPct: QUOTE_BILLING_MATERIAL_MARGIN,
    subtotal: taxes.subtotal,
    gst: taxes.gst,
    qst: taxes.qst,
    total: taxes.total,
  };
}

/**
 * Computes invoice amount breakdown.
 * @param total — full work total (not reduced by deposit)
 * @param depositApplied — deposit snapshot from quote (paid before invoice)
 * @param additionalPaid — payments recorded against the invoice after creation
 */
export function calculateInvoiceAmountBreakdown(
  total: number,
  depositApplied: number,
  additionalPaid = 0
): InvoiceAmountBreakdown {
  const deposit = roundCurrency(Math.max(0, depositApplied));
  const extra = roundCurrency(Math.max(0, additionalPaid));
  const paidAmount = roundCurrency(deposit + extra);
  const balanceDue = roundCurrency(Math.max(0, total - paidAmount));

  return {
    total: roundCurrency(total),
    subtotal: 0,
    gst: 0,
    qst: 0,
    depositApplied: deposit,
    paidAmount,
    balanceDue,
  };
}

/** Merges billing sheet totals with deposit for a complete invoice breakdown. */
export function buildInvoiceBreakdownFromSheet(
  sheet: { subtotal: number; gstAmount: number; qstAmount: number; total: number },
  depositApplied: number,
  existingPaidAmount = 0
): InvoiceAmountBreakdown {
  const deposit = roundCurrency(Math.max(0, depositApplied));
  const priorNonDepositPaid = roundCurrency(Math.max(0, existingPaidAmount - deposit));
  const paidAmount = roundCurrency(deposit + priorNonDepositPaid);
  const balanceDue = roundCurrency(Math.max(0, sheet.total - paidAmount));

  return {
    total: roundCurrency(sheet.total),
    subtotal: roundCurrency(sheet.subtotal),
    gst: roundCurrency(sheet.gstAmount),
    qst: roundCurrency(sheet.qstAmount),
    depositApplied: deposit,
    paidAmount,
    balanceDue,
  };
}

/** Ensures deposit is not deducted twice when syncing an edited invoice. */
export function resolveInvoicePaidAmountOnSync(
  existingPaidAmount: number,
  depositApplied: number,
  newTotal: number
): number {
  const deposit = roundCurrency(Math.max(0, depositApplied));
  const nonDepositPaid = roundCurrency(Math.max(0, existingPaidAmount - deposit));
  return roundCurrency(Math.min(newTotal, deposit + nonDepositPaid));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
