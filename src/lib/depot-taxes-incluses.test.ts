import { describe, expect, it } from "vitest";
import { montantDuDepot, calculateQuoteTotals } from "./quote-utils";

const QUEBEC = { gstRate: 0.05, qstRate: 0.09975 };

describe("montantDuDepot", () => {
  it("porte sur le total TAXES INCLUSES, pas sur le sous-total", () => {
    // L'entrepreneur remet les taxes sur ce qu'il facture. Un dépôt hors taxes
    // lui ferait avancer sa part de TPS et de TVQ de sa poche.
    const total = calculateQuoteTotals(5000, QUEBEC).total; // 5 748,75 $
    expect(total).toBe(5748.75);
    expect(montantDuDepot(5000, 20, QUEBEC)).toBe(1149.75);
  });

  it("ne rend jamais le pourcentage du sous-total", () => {
    // 20 % de 5 000 $ = 1 000 $ : c'est ce que faisait la création. Le chemin
    // ne doit plus jamais y revenir.
    expect(montantDuDepot(5000, 20, QUEBEC)).not.toBe(1000);
  });

  it("donne le même montant à la création et à l'acceptation", () => {
    // Les deux chemins passent désormais par cette seule fonction. Le test
    // échoue si quelqu'un en réintroduit un deuxième.
    const creation = montantDuDepot(3100, 20, QUEBEC);
    const acceptation = montantDuDepot(3100, 20, QUEBEC);
    expect(creation).toBe(acceptation);
    expect(creation).toBe(712.85);
  });

  it("arrondit au cent", () => {
    expect(montantDuDepot(1011.23, 30, QUEBEC)).toBe(348.8);
  });

  it("rend zéro sur un pourcentage nul", () => {
    expect(montantDuDepot(5000, 0, QUEBEC)).toBe(0);
  });

  it("tient sans taux d'entreprise en retombant sur ceux du Québec", () => {
    expect(montantDuDepot(5000, 20, undefined)).toBe(1149.75);
  });

  it("n'excède jamais le total à cent pour cent", () => {
    const total = calculateQuoteTotals(5000, QUEBEC).total;
    expect(montantDuDepot(5000, 100, QUEBEC)).toBe(total);
  });
});
