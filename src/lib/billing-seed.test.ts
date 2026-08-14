import { describe, expect, it } from "vitest";
import {
  LABOR_TEMPLATE_BASE_NAMES,
  LABOR_TEMPLATE_SEEDS,
  MATERIAL_CATALOG_FAMILY_SLUGS,
  MATERIAL_CATALOG_SEEDS,
  MATERIAL_CATEGORY_SLUGS,
  REQUIRED_LABOR_BILL_RATES,
} from "@/lib/billing-seed";
import {
  getDefaultDemoLaborTemplates,
  getDemoMaterialCatalogCount,
  searchDemoMaterialCatalog,
} from "@/lib/demo/billing";

describe("billing seed definitions", () => {
  it("includes all required labor base options", () => {
    expect(LABOR_TEMPLATE_BASE_NAMES).toEqual([
      "1 compagnon",
      "1 apprenti",
      "1 compagnon + 1 apprenti",
      "2 compagnons",
      "2 apprentis",
      "2 compagnons + 1 apprenti",
      "1 compagnon + 2 apprentis",
      "3 compagnons",
      "3 compagnons + 1 apprenti",
      "Contremaître",
      "Technicien/service",
      "Transport",
    ]);
  });

  it("seeds 30 labor templates (9 crews × 3 rate types + 3 special)", () => {
    expect(LABOR_TEMPLATE_SEEDS).toHaveLength(30);

    const regularCrews = LABOR_TEMPLATE_SEEDS.filter((t) => t.rateType === "regular");
    expect(regularCrews.map((t) => t.name)).toEqual(LABOR_TEMPLATE_BASE_NAMES);

    const overtime = LABOR_TEMPLATE_SEEDS.filter((t) => t.rateType === "overtime");
    expect(overtime).toHaveLength(9);
    expect(overtime[0].name).toBe("1 compagnon (temps et demi)");

    const doubleTime = LABOR_TEMPLATE_SEEDS.filter((t) => t.rateType === "double_time");
    expect(doubleTime).toHaveLength(9);
    expect(doubleTime[0].name).toBe("1 compagnon (temps double)");
  });

  it("seeds hundreds of generic catalog items without prices", () => {
    expect(MATERIAL_CATALOG_SEEDS.length).toBe(715);
    expect(MATERIAL_CATEGORY_SLUGS.length).toBe(33);

    const cuivreElbows = MATERIAL_CATALOG_SEEDS.filter(
      (item) => item.categorySlug === "fittings-cuivre" && item.fittingType === "coude 90"
    );
    expect(cuivreElbows.length).toBe(10);
    expect(cuivreElbows.some((item) => item.name === "Coude 90° cuivre" && item.diameter === '3/4"')).toBe(
      true
    );
  });

  it("covers major plumbing material families", () => {
    for (const slug of MATERIAL_CATALOG_FAMILY_SLUGS) {
      expect(MATERIAL_CATALOG_SEEDS.some((item) => item.categorySlug === slug)).toBe(true);
    }
  });

  it("defines required labor bill rates for migration 013", () => {
    expect(REQUIRED_LABOR_BILL_RATES).toEqual({
      "1 compagnon": 125,
      "1 compagnon + 1 apprenti": 235,
      Transport: 75,
    });
    expect(calculateLineTotal(4, REQUIRED_LABOR_BILL_RATES["1 compagnon"])).toBe(500);
    expect(calculateLineTotal(4, REQUIRED_LABOR_BILL_RATES["1 compagnon + 1 apprenti"])).toBe(940);
    expect(calculateLineTotal(2, REQUIRED_LABOR_BILL_RATES.Transport)).toBe(150);
  });
});

function calculateLineTotal(quantity: number, unitPrice: number) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

describe("demo billing seed", () => {
  it("mirrors labor templates with zero rates", () => {
    const templates = getDefaultDemoLaborTemplates("demo-co");
    expect(templates).toHaveLength(30);
    expect(templates.every((t) => t.costPerHr === 0 && t.billRate === 0)).toBe(true);
    expect(templates[0].name).toBe("1 compagnon");
  });

  it("supports material catalog search in demo mode", () => {
    expect(getDemoMaterialCatalogCount()).toBe(MATERIAL_CATALOG_SEEDS.length);

    const results = searchDemoMaterialCatalog("coude cuivre 3/4");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain("Coude 90° cuivre");
    expect(results[0].diameter).toBe('3/4"');
  });
});
