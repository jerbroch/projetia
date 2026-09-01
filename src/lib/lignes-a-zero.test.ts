import { describe, expect, it } from "vitest";
import { lignesAZero, messageLignesAZero } from "./lignes-a-zero";

const l = (description: string, quantity: number, unitSellPrice: number) => ({
  description,
  quantity,
  unitSellPrice,
  lineTotal: Math.round(quantity * unitSellPrice * 100) / 100,
});

describe("lignesAZero", () => {
  it("relève ce qui part à zéro", () => {
    expect(lignesAZero([l("Bardeau", 12, 0), l("Main-d'œuvre", 8, 125)]).map((x) => x.description))
      .toEqual(["Bardeau"]);
  });

  it("ne se laisse pas tromper par un prix nul et un total non nul", () => {
    // Une ligne dont le total a été fixé à la main garde sa valeur : elle ne
    // part pas à zéro, même si le prix unitaire l'est.
    const forcee = { description: "Forfait", quantity: 1, unitSellPrice: 0, lineTotal: 500 };
    expect(lignesAZero([forcee])).toEqual([]);
  });

  it("rend une liste vide quand tout est chiffré", () => {
    expect(lignesAZero([l("A", 1, 10)])).toEqual([]);
  });
});

describe("messageLignesAZero", () => {
  it("se tait quand rien ne part à zéro", () => {
    expect(messageLignesAZero([l("A", 1, 10)], 11.5)).toBeNull();
  });

  it("NOMME ce qui part à zéro, avec la quantité", () => {
    // « Des lignes sont à 0 $ » n'apprend rien ; « douze paquets de bardeau »
    // se reconnaît d'un coup d'œil.
    const m = messageLignesAZero([l("Bardeau IKO Cambridge", 12, 0), l("MO", 8, 125)], 1149.75)!;
    expect(m).toContain("Bardeau IKO Cambridge");
    expect(m).toContain("(12)");
    expect(m).toContain("Une ligne partira");
  });

  it("situe le manque par rapport au total", () => {
    const m = messageLignesAZero([l("Bardeau", 12, 0)], 3952.27)!.replace(/[\u00a0\u202f\u2009]/g, " ");
    expect(m).toContain("3 952,27 $");
  });

  it("accorde le pluriel", () => {
    const m = messageLignesAZero([l("A", 1, 0), l("B", 2, 0)], 100)!;
    expect(m).toContain("2 lignes partiront");
  });

  it("dit dans quels cas le zéro est légitime", () => {
    // Sans ça, l'entrepreneur croit à une erreur et cherche ce qui ne va pas.
    const m = messageLignesAZero([l("Reprise", 1, 0)], 100)!;
    expect(m).toMatch(/fourni par le client|garantie|offert/);
  });

  it("ne dresse pas un mur : quatre lignes nommées, le reste compté", () => {
    const six = ["A", "B", "C", "D", "E", "F"].map((n) => l(n, 1, 0));
    const m = messageLignesAZero(six, 100)!;
    expect(m).toContain("« D »");
    expect(m).not.toContain("« E »");
    expect(m).toContain("et 2 autres");
  });

  it("écrit les quantités sans décimales inutiles", () => {
    expect(messageLignesAZero([l("Bardeau", 12, 0)], 100)!).toContain("(12)");
    expect(messageLignesAZero([l("Heures", 7.5, 0)], 100)!).toContain("(7,5)");
  });
});
