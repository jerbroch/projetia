import { describe, expect, it } from "vitest";
import {
  checkSupabaseError,
  parseCatalogPricesCsv,
  parseMaterialCsv,
} from "@/lib/data/billing-data";

describe("checkSupabaseError", () => {
  it("throws when Supabase returns an error", () => {
    expect(() => checkSupabaseError({ message: "column is_divers does not exist" })).toThrow(
      "column is_divers does not exist"
    );
  });

  it("does nothing when error is null", () => {
    expect(() => checkSupabaseError(null)).not.toThrow();
  });
});

describe("parseCatalogPricesCsv", () => {
  it("parses reference_price rows", () => {
    const csv = `sku,name,diameter,reference_price,source_url
,Coude 90° cuivre,3/4",12.50,https://example.com/coude-34
,Tuyau cuivre type L,1/2",8.75,`;
    const rows = parseCatalogPricesCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Coude 90° cuivre");
    expect(rows[0].referencePrice).toBe(12.5);
    expect(rows[1].referencePrice).toBe(8.75);
  });

  it("skips rows without a valid price", () => {
    const csv = `name,reference_price
Coude 90° cuivre,
Té cuivre,0`;
    expect(parseCatalogPricesCsv(csv)).toHaveLength(0);
  });
});

describe("parseMaterialCsv", () => {
  it("parses CSV with standard headers", () => {
    const csv = `name,category,diameter,supplier,sku,unit_cost
Tuyau cuivre 1/2,tuyau-cuivre,1/2",noble,SKU-001,12.50`;
    const rows = parseMaterialCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Tuyau cuivre 1/2");
    expect(rows[0].categorySlug).toBe("tuyau-cuivre");
    expect(rows[0].unitCost).toBe(12.5);
  });
});
