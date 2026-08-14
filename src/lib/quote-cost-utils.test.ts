import { describe, expect, it } from "vitest";
import {
  buildClientLineItemsFromEstimation,
  buildQuoteEstimationSnapshot,
  calculateCostEstimationSummary,
  calculateFeeLineTotal,
  calculateLaborLineTotal,
  calculateMaterialLineTotal,
  calculateMaterialSalePrice,
  createEmptyCostEstimation,
  hasCostEstimationLines,
  normalizeCostEstimation,
  recalculateCostEstimation,
  resolveDefaultLaborRate,
} from "@/lib/quote-cost-utils";
import type { LaborRateTemplate, Quote, QuoteCostEstimation } from "@/types";

const company = { gstRate: 0.05, qstRate: 0.09975 };

const templates: LaborRateTemplate[] = [
  {
    id: "1",
    companyId: "c1",
    name: "1 compagnon",
    workerCount: 1,
    costPerHr: 125,
    billRate: 125,
    rateType: "regular",
    sortOrder: 1,
    isActive: true,
  },
  {
    id: "2",
    companyId: "c1",
    name: "1 compagnon + 1 apprenti",
    workerCount: 2,
    costPerHr: 235,
    billRate: 235,
    rateType: "regular",
    sortOrder: 3,
    isActive: true,
  },
];

describe("quote-cost-utils calculations", () => {
  it("calculates labor line total", () => {
    expect(calculateLaborLineTotal(8, 125, 1)).toBe(1000);
    expect(calculateLaborLineTotal(4, 235, 2)).toBe(1880);
  });

  it("calculates material sale price and line total with margin", () => {
    expect(calculateMaterialSalePrice(100, 0.4)).toBe(140);
    expect(calculateMaterialLineTotal(3, 140)).toBe(420);
  });

  it("calculates fee line total with optional margin", () => {
    expect(calculateFeeLineTotal(1, 75, 0)).toBe(75);
    expect(calculateFeeLineTotal(2, 50, 0.1)).toBe(110);
  });

  it("resolves default labor rates from templates", () => {
    expect(resolveDefaultLaborRate("compagnon", templates)).toBe(125);
    expect(resolveDefaultLaborRate("equipe", templates)).toBe(235);
  });

  it("summarizes cost estimation with taxes and manual adjustment", () => {
    const estimation = recalculateCostEstimation({
      ...createEmptyCostEstimation(),
      labor: [
        {
          id: "l1",
          category: "compagnon",
          hours: 8,
          hourlyRate: 125,
          workerCount: 1,
          total: 1000,
        },
      ],
      materials: [
        {
          id: "m1",
          name: "Tuyau",
          quantity: 2,
          unit: "pi",
          costPrice: 10,
          marginPct: 0.4,
          salePrice: 14,
          total: 28,
        },
      ],
      fees: [
        {
          id: "f1",
          feeType: "transport",
          description: "Déplacement",
          quantity: 1,
          price: 75,
          total: 75,
        },
      ],
    });

    const summary = calculateCostEstimationSummary(estimation, company);
    expect(summary.calculatedSubtotal).toBe(1103);
    expect(summary.estimatedHours).toBe(8);
    expect(summary.estimatedMaterialsCost).toBe(20);

    const adjusted = calculateCostEstimationSummary(estimation, company, 1200);
    expect(adjusted.proposedSubtotal).toBe(1200);
    expect(adjusted.adjustment).toBe(97);
    expect(adjusted.totalWithTaxes).toBeGreaterThan(1200);
  });

  it("builds client line items without internal costs by default", () => {
    const quote: Pick<Quote, "title" | "description" | "amount" | "costEstimation" | "proposedAmount"> =
      {
        title: "Rénovation",
        description: "Cuisine",
        amount: 1103,
        proposedAmount: 1103,
        costEstimation: recalculateCostEstimation({
          ...createEmptyCostEstimation(),
          labor: [
            {
              id: "l1",
              category: "compagnon",
              hours: 8,
              hourlyRate: 125,
              workerCount: 1,
              total: 1000,
            },
          ],
          materials: [
            {
              id: "m1",
              name: "Tuyau",
              quantity: 2,
              unit: "pi",
              costPrice: 10,
              marginPct: 0.4,
              salePrice: 14,
              total: 28,
            },
          ],
        }),
      };

    const items = buildClientLineItemsFromEstimation(quote);
    expect(items).toHaveLength(1);
    expect(items[0]?.description).toContain("Rénovation");
    expect(items[0]?.total).toBe(1103);
  });

  it("builds schedule estimation snapshot from quote", () => {
    const quote = {
      id: "q1",
      quoteNumber: "SO-2026-001",
      amount: 1103,
      calculatedCost: 1103,
      proposedAmount: 1200,
      costEstimation: recalculateCostEstimation({
        ...createEmptyCostEstimation(),
        labor: [
          {
            id: "l1",
            category: "compagnon",
            hours: 8,
            hourlyRate: 125,
            workerCount: 1,
            total: 1000,
          },
        ],
      }),
    } as Quote;

    const snapshot = buildQuoteEstimationSnapshot(quote);
    expect(snapshot.quoteId).toBe("q1");
    expect(snapshot.quoteNumber).toBe("SO-2026-001");
    expect(snapshot.proposedAmount).toBe(1200);
    expect(snapshot.estimatedHours).toBe(8);
  });

  it("handles null or partial cost estimation without throwing", () => {
    expect(hasCostEstimationLines(null)).toBe(false);
    expect(hasCostEstimationLines(undefined)).toBe(false);
    expect(hasCostEstimationLines({} as Quote["costEstimation"])).toBe(false);

    const partial = {
      showLaborOnClient: true,
      manualPriceOverride: false,
    } as QuoteCostEstimation;

    expect(() => recalculateCostEstimation(partial)).not.toThrow();
    const normalized = recalculateCostEstimation(partial);
    expect(normalized.labor).toEqual([]);
    expect(normalized.materials).toEqual([]);
    expect(normalized.fees).toEqual([]);
    expect(normalized.showLaborOnClient).toBe(true);
  });
});
