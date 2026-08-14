import { describe, expect, it } from "vitest";
import {
  buildBillingLinesFromQuote,
  buildBillingLinesFromQuoteEstimation,
  buildInvoiceBreakdownFromSheet,
  buildQuoteBillingPrefill,
  calculateInvoiceAmountBreakdown,
  convertQuoteLaborToBillingLine,
  resolveInvoicePaidAmountOnSync,
  resolveQuoteDepositPaid,
} from "@/lib/quote-invoice-link";
import { recalculateCostEstimation, createEmptyCostEstimation } from "@/lib/quote-cost-utils";
import type { Quote } from "@/types";

const baseQuote: Quote = {
  id: "q-1",
  companyId: "co-1",
  quoteNumber: "SO-2026-001",
  customerId: "cust-1",
  customerName: "Client Test",
  title: "Rénovation salle de bain",
  description: "Travaux complets",
  amount: 10000,
  status: "accepted",
  validUntil: "2026-12-31",
  createdAt: "2026-01-01",
  depositRequired: false,
  depositStatus: "not_required",
  lineItems: [
    { description: "Main-d'œuvre", quantity: 1, unitPrice: 8000, total: 8000 },
    { description: "Matériaux", quantity: 1, unitPrice: 2000, total: 2000 },
  ],
};

const company = { gstRate: 0.05, qstRate: 0.09975 };

describe("resolveQuoteDepositPaid", () => {
  it("returns 0 when no deposit required", () => {
    expect(resolveQuoteDepositPaid(baseQuote)).toBe(0);
  });

  it("returns 0 when deposit required but not paid", () => {
    expect(
      resolveQuoteDepositPaid({
        ...baseQuote,
        depositRequired: true,
        depositStatus: "pending",
        depositAmount: 2000,
      })
    ).toBe(0);
  });

  it("returns deposit amount when paid", () => {
    expect(
      resolveQuoteDepositPaid({
        ...baseQuote,
        depositRequired: true,
        depositStatus: "paid",
        depositAmount: 2000,
      })
    ).toBe(2000);
  });
});

describe("buildBillingLinesFromQuote", () => {
  it("maps quote line items to material billing lines", () => {
    const lines = buildBillingLinesFromQuote(baseQuote);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      lineType: "material",
      description: "Main-d'œuvre",
      quantity: 1,
      unitCost: 8000,
      unitSellPrice: 8000,
    });
  });
});

describe("buildBillingLinesFromQuoteEstimation", () => {
  it("copies labor lines with custom rates intact", () => {
    const quote: Quote = {
      ...baseQuote,
      costEstimation: recalculateCostEstimation({
        ...createEmptyCostEstimation(),
        labor: [
          {
            id: "l1",
            category: "compagnon",
            hours: 8,
            hourlyRate: 185,
            workerCount: 1,
            total: 1480,
          },
          {
            id: "l2",
            category: "autre",
            employeeCategory: "Équipe de nuit",
            hours: 6,
            hourlyRate: 275,
            workerCount: 2,
            total: 3300,
          },
        ],
      }),
    };

    const lines = buildBillingLinesFromQuoteEstimation(quote);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      lineType: "labor",
      quantity: 8,
      unitSellPrice: 185,
    });
    expect(lines[1]).toMatchObject({
      lineType: "labor",
      quantity: 6,
      unitSellPrice: 550,
    });
    expect(lines[1]?.description).toContain("Équipe de nuit");
  });

  it("convertQuoteLaborToBillingLine preserves total via effective rate", () => {
    const line = convertQuoteLaborToBillingLine({
      id: "l1",
      category: "autre",
      employeeCategory: "Technicien spécialisé",
      hours: 4,
      hourlyRate: 185,
      workerCount: 1,
      total: 740,
    });
    expect(line.quantity * line.unitSellPrice).toBe(740);
  });
});

describe("buildQuoteBillingPrefill", () => {
  it("calculates totals matching quote with taxes", () => {
    const prefill = buildQuoteBillingPrefill(baseQuote, company);
    expect(prefill.subtotal).toBe(10000);
    expect(prefill.total).toBeGreaterThan(10000);
    expect(prefill.lines).toHaveLength(2);
    expect(prefill.materialMarginPct).toBe(0);
  });
});

describe("calculateInvoiceAmountBreakdown", () => {
  it("no deposit — balance equals total", () => {
    const breakdown = calculateInvoiceAmountBreakdown(11500, 0);
    expect(breakdown.total).toBe(11500);
    expect(breakdown.depositApplied).toBe(0);
    expect(breakdown.balanceDue).toBe(11500);
    expect(breakdown.paidAmount).toBe(0);
  });

  it("20% deposit paid — balance is total minus deposit", () => {
    const breakdown = calculateInvoiceAmountBreakdown(11500, 2300);
    expect(breakdown.total).toBe(11500);
    expect(breakdown.depositApplied).toBe(2300);
    expect(breakdown.paidAmount).toBe(2300);
    expect(breakdown.balanceDue).toBe(9200);
  });

  it("does not reduce total by deposit", () => {
    const breakdown = calculateInvoiceAmountBreakdown(10000, 2000);
    expect(breakdown.total).toBe(10000);
  });
});

describe("buildInvoiceBreakdownFromSheet", () => {
  it("combines sheet totals with deposit", () => {
    const breakdown = buildInvoiceBreakdownFromSheet(
      { subtotal: 10000, gstAmount: 500, qstAmount: 997.5, total: 11497.5 },
      2000
    );
    expect(breakdown.total).toBe(11497.5);
    expect(breakdown.depositApplied).toBe(2000);
    expect(breakdown.balanceDue).toBe(9497.5);
  });
});

describe("resolveInvoicePaidAmountOnSync", () => {
  it("preserves deposit and non-deposit payments on edit", () => {
    expect(resolveInvoicePaidAmountOnSync(2300, 2000, 12000)).toBe(2300);
  });

  it("does not double-count deposit", () => {
    const paid = resolveInvoicePaidAmountOnSync(2000, 2000, 11500);
    expect(paid).toBe(2000);
  });

  it("caps paid amount at new total", () => {
    expect(resolveInvoicePaidAmountOnSync(5000, 2000, 3000)).toBe(3000);
  });
});

describe("quote scheduled → invoiced workflow", () => {
  it("prefill totals match quote for accepted quote without deposit", () => {
    const prefill = buildQuoteBillingPrefill(baseQuote, company);
    const invoice = calculateInvoiceAmountBreakdown(prefill.total, 0);
    expect(invoice.balanceDue).toBe(prefill.total);
  });

  it("prefill with 20% deposit paid", () => {
    const quoteWithDeposit: Quote = {
      ...baseQuote,
      depositRequired: true,
      depositStatus: "paid",
      depositAmount: 2000,
      depositPercentage: 20,
      status: "deposit_paid",
    };
    const prefill = buildQuoteBillingPrefill(quoteWithDeposit, company);
    const deposit = resolveQuoteDepositPaid(quoteWithDeposit);
    const invoice = calculateInvoiceAmountBreakdown(prefill.total, deposit);
    expect(deposit).toBe(2000);
    expect(invoice.total).toBe(prefill.total);
    expect(invoice.balanceDue).toBe(round(prefill.total - 2000));
  });
});

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
