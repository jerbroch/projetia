import { describe, expect, it } from "vitest";
import {
  applyGlobalMaterialMargin,
  buildInvoiceLineSnapshots,
  buildInvoiceNumber,
  calculateBillingTotals,
  calculateDiversLine,
  calculateLineTotal,
  calculateMarginFromPrices,
  calculateMaterialLineFromCatalog,
  calculateSellPriceFromCost,
  canViewBillingPrices,
  DEFAULT_MATERIAL_MARGIN,
  resolveEffectiveCatalogPrice,
} from "@/lib/billing-utils";

describe("resolveEffectiveCatalogPrice", () => {
  it("prefers custom_price over reference_price", () => {
    expect(resolveEffectiveCatalogPrice(15, 12.5)).toBe(15);
  });

  it("falls back to reference_price when custom is absent", () => {
    expect(resolveEffectiveCatalogPrice(null, 12.5)).toBe(12.5);
  });

  it("returns undefined when no prices set", () => {
    expect(resolveEffectiveCatalogPrice(null, null)).toBeUndefined();
  });
});

describe("canViewBillingPrices", () => {
  it("allows admin roles to see prices", () => {
    expect(canViewBillingPrices("owner")).toBe(true);
    expect(canViewBillingPrices("admin")).toBe(true);
    expect(canViewBillingPrices("estimator")).toBe(true);
  });

  it("hides prices from field workers (employee/plumber)", () => {
    expect(canViewBillingPrices("employee")).toBe(false);
    expect(canViewBillingPrices("dispatcher")).toBe(false);
  });
});

describe("calculateSellPriceFromCost", () => {
  it("applies 40% margin to cost", () => {
    expect(calculateSellPriceFromCost(100, 0.4)).toBe(140);
  });
});

describe("calculateMarginFromPrices", () => {
  it("computes margin from cost and sell", () => {
    expect(calculateMarginFromPrices(100, 140)).toBeCloseTo(0.4, 4);
  });
});

describe("calculateLineTotal", () => {
  it("multiplies qty by unit sell price", () => {
    expect(calculateLineTotal(4, 85)).toBe(340);
  });
});

describe("calculateMaterialLineFromCatalog", () => {
  it("does not apply per-item margin", () => {
    const line = calculateMaterialLineFromCatalog("Coude cuivre 90° 3/4\"", 2, 12.5);
    expect(line.unitCost).toBe(12.5);
    expect(line.unitSellPrice).toBe(12.5);
    expect(line.marginPct).toBeUndefined();
  });
});

describe("calculateDiversLine", () => {
  it("calculates qty × unit price without margin", () => {
    const line = calculateDiversLine("Pièce spéciale", 3, 25);
    expect(line.quantity).toBe(3);
    expect(line.unitCost).toBe(25);
    expect(line.isDivers).toBe(true);
    expect(calculateLineTotal(line.quantity, line.unitCost)).toBe(75);
  });
});

describe("applyGlobalMaterialMargin", () => {
  it("applies margin to material cost subtotal", () => {
    expect(applyGlobalMaterialMargin(1000, 0.4)).toBe(1400);
  });
});

describe("calculateBillingTotals", () => {
  it("applies global material margin at sheet level", () => {
    const totals = calculateBillingTotals(
      [
        { lineType: "material", description: "Mat", quantity: 2, unitCost: 10, unitSellPrice: 10 },
        { lineType: "labor", description: "MO", quantity: 4, unitCost: 50, unitSellPrice: 85 },
      ],
      { gstRate: 0.05, qstRate: 0.09975 },
      0.4
    );
    expect(totals.materialCostSubtotal).toBe(20);
    expect(totals.materialSubtotal).toBe(28);
    expect(totals.laborSubtotal).toBe(340);
    expect(totals.subtotal).toBe(368);
  });
});

describe("buildInvoiceLineSnapshots", () => {
  it("applies global margin to material lines at invoice time", () => {
    const snapshots = buildInvoiceLineSnapshots(
      [{ lineType: "material", description: "Valve", quantity: 1, unitCost: 20, unitSellPrice: 20 }],
      DEFAULT_MATERIAL_MARGIN
    );
    expect(snapshots[0].unitCost).toBe(20);
    expect(snapshots[0].unitSellPrice).toBe(28);
    expect(snapshots[0].lineTotal).toBe(28);
  });
});

describe("buildInvoiceNumber", () => {
  it("increments sequence for current year", () => {
    const year = new Date().getFullYear();
    expect(buildInvoiceNumber([`FA-${year}-001`, `FA-${year}-002`])).toBe(`FA-${year}-003`);
  });
});
