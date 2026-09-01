import { describe, expect, it } from "vitest";
import { calculateQuoteTotals } from "./quote-cost-utils";
import { calculateBillingTotals } from "./billing-utils";

const QUEBEC = { gstRate: 0.05, qstRate: 0.09975 };

describe("TPS et TVQ du Québec", () => {
  it("applique la TVQ au prix HORS TAXES, pas au prix TPS incluse", () => {
    // Depuis le 1er janvier 2013 la TVQ porte sur le prix de vente hors TPS.
    // La cascade facturait 1 047,90 $ au lieu de 997,50 $ : 50,40 $ de trop.
    const t = calculateQuoteTotals(10000, QUEBEC);
    expect(t.gst).toBe(500);
    expect(t.qst).toBe(997.5);
    expect(t.total).toBe(11497.5);
  });

  it("donne le même résultat sur une facture que sur la soumission", () => {
    // Une facture qui ne dit pas la même chose que la soumission acceptée est
    // une chicane avec le client.
    const devis = calculateQuoteTotals(10000, QUEBEC);
    const facture = calculateBillingTotals(
      [{ lineType: "labor", description: "MO", quantity: 100, unitCost: 50, unitSellPrice: 100 }],
      QUEBEC,
      0,
    );
    expect(facture.subtotal).toBe(10000);
    expect(facture.gst).toBe(devis.gst);
    expect(facture.qst).toBe(devis.qst);
    expect(facture.total).toBe(devis.total);
  });

  it("tient sur les montants du chantier de la démo", () => {
    const t = calculateQuoteTotals(6970.5, QUEBEC);
    expect(t.gst).toBe(348.53);
    expect(t.qst).toBe(695.31);
    expect(t.total).toBe(8014.34);
  });

  it("rend zéro sur un sous-total nul", () => {
    const t = calculateQuoteTotals(0, QUEBEC);
    expect(t).toEqual({ subtotal: 0, gst: 0, qst: 0, total: 0 });
  });

  it("retombe sur les taux du Québec quand l'entreprise n'en a pas", () => {
    const t = calculateQuoteTotals(1000, {});
    expect(t.gst).toBe(50);
    expect(t.qst).toBe(99.75);
  });

  it("respecte un taux d'entreprise différent, sans jamais cascader", () => {
    // Une entreprise hors Québec peut n'avoir que la TPS.
    const t = calculateQuoteTotals(1000, { gstRate: 0.05, qstRate: 0 });
    expect(t.qst).toBe(0);
    expect(t.total).toBe(1050);
  });

  it("arrondit au cent, pas en dessous", () => {
    const t = calculateQuoteTotals(33.33, QUEBEC);
    expect(t.gst).toBe(1.67);
    expect(t.qst).toBe(3.32);
    expect(t.total).toBe(38.32);
  });
});
