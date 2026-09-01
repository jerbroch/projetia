import { describe, expect, it } from "vitest";
import { lignesRetenues, refusDeFactureRapide, totauxFactureRapide } from "./facture-rapide";

const QUEBEC = { gstRate: 0.05, qstRate: 0.09975 };
const L = (description: string, quantity: number, unitPrice: number) => ({ description, quantity, unitPrice });

describe("lignesRetenues", () => {
  it("calcule le total de chaque ligne", () => {
    expect(lignesRetenues([L("Débouchage", 2, 125)])[0].lineTotal).toBe(250);
  });

  it("écarte les lignes sans description", () => {
    // Le formulaire garde une ligne vide en bas pour la saisie suivante :
    // sans ce filtre, chaque facture porterait une ligne fantôme à 0 $.
    expect(lignesRetenues([L("", 1, 100), L("  ", 2, 50), L("Réel", 1, 10)])).toHaveLength(1);
  });

  it("nettoie les espaces de bord de la description", () => {
    expect(lignesRetenues([L("  Débouchage  ", 1, 1)])[0].description).toBe("Débouchage");
  });

  it("arrondit au cent", () => {
    expect(lignesRetenues([L("Heures", 3.33, 99.99)])[0].lineTotal).toBe(332.97);
  });

  it("traite une quantité illisible comme zéro plutôt que NaN", () => {
    const l = lignesRetenues([{ description: "X", quantity: Number("abc"), unitPrice: 10 }]);
    expect(l[0].lineTotal).toBe(0);
  });
});

describe("totauxFactureRapide", () => {
  it("applique les taxes du Québec", () => {
    const t = totauxFactureRapide([L("Main-d'œuvre", 8, 125)], QUEBEC);
    expect(t.subtotal).toBe(1000);
    expect(t.gst).toBe(50);
    expect(t.qst).toBe(99.75);
    expect(t.total).toBe(1149.75);
  });

  it("dit la même chose qu'une soumission du même montant", () => {
    // Une facture rapide qui ne concorde pas avec une soumission serait une
    // troisième façon de calculer les taxes. Il n'y en a qu'une.
    const rapide = totauxFactureRapide([L("Travaux", 1, 6970.5)], QUEBEC);
    expect(rapide.qst).toBe(695.31);
    expect(rapide.total).toBe(8014.34);
  });

  it("rend zéro sur une liste vide", () => {
    const t = totauxFactureRapide([], QUEBEC);
    expect(t).toMatchObject({ subtotal: 0, gst: 0, qst: 0, total: 0, lignes: [] });
  });

  it("additionne plusieurs lignes", () => {
    const t = totauxFactureRapide([L("A", 2, 100), L("B", 1, 55.5)], QUEBEC);
    expect(t.subtotal).toBe(255.5);
  });
});

describe("refusDeFactureRapide", () => {
  it("exige un client", () => {
    expect(refusDeFactureRapide("  ", [L("A", 1, 10)])).toContain("client");
  });

  it("exige au moins une ligne réelle", () => {
    expect(refusDeFactureRapide("Marie", [])).toContain("une ligne");
    expect(refusDeFactureRapide("Marie", [L("", 1, 100)])).toContain("une ligne");
  });

  it("refuse une facture à 0 $ en disant où regarder", () => {
    const m = refusDeFactureRapide("Marie", [L("Visite", 1, 0)]);
    expect(m).toContain("0 $");
    expect(m).toMatch(/quantités|prix/);
  });

  it("nomme la ligne négative plutôt que de dire « données invalides »", () => {
    const m = refusDeFactureRapide("Marie", [L("Bon", 1, 10), L("Rabais", 1, -50)]);
    expect(m).toContain("Rabais");
  });

  it("laisse passer une facture valide", () => {
    expect(refusDeFactureRapide("Marie Gagnon", [L("Débouchage", 2, 125)])).toBeNull();
  });
});
