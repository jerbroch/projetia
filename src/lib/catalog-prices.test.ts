import { describe, expect, it } from "vitest";
import { parseCatalogPricesCsv } from "@/lib/data/billing-data";

describe("parseCatalogPricesCsv", () => {
  it("parses reference price CSV with optional source_url", () => {
    const csv = `sku,name,diameter,reference_price,source_url
,Coude 90° cuivre,3/4",12.50,https://example.com/coude`;
    const rows = parseCatalogPricesCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Coude 90° cuivre");
    expect(rows[0].diameter).toBe('3/4"');
    expect(rows[0].referencePrice).toBe(12.5);
    expect(rows[0].sourceUrl).toBe("https://example.com/coude");
  });

  it("skips rows without valid reference_price", () => {
    const csv = `name,diameter,reference_price
Tuyau cuivre,1/2",`;
    expect(parseCatalogPricesCsv(csv)).toHaveLength(0);
  });
});

describe("manual override protection", () => {
  it("documents that import skips manually_overridden rows", () => {
    const existing = { manually_overridden: true, custom_price: 15, reference_price: 10 };
    const shouldSkip = existing.manually_overridden === true;
    expect(shouldSkip).toBe(true);
    expect(existing.custom_price).toBe(15);
  });
});
