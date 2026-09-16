import { describe, expect, it } from "vitest";
import { dateLongueFrancais, jourEtMois, prenomDe } from "./dates-francais";

describe("dateLongueFrancais", () => {
  it("écrit la date en français avec une majuscule initiale", () => {
    const texte = dateLongueFrancais(new Date(2026, 8, 16));
    expect(texte).toMatch(/^Mercredi/);
    expect(texte).toContain("16");
    expect(texte).toContain("septembre");
  });
});

describe("jourEtMois", () => {
  it("rend le jour et le mois en capitales, sans point", () => {
    expect(jourEtMois(new Date(2026, 8, 21))).toEqual({ jour: "21", mois: "SEPT" });
  });

  it("ne jette pas sur une date illisible", () => {
    expect(jourEtMois("pas une date")).toEqual({ jour: "—", mois: "" });
  });
});

describe("prenomDe", () => {
  it("garde le premier mot", () => {
    expect(prenomDe("Jérôme Brochu")).toBe("Jérôme");
  });

  it("rend une chaîne vide plutôt que « undefined » à l'écran", () => {
    expect(prenomDe(null)).toBe("");
    expect(prenomDe("   ")).toBe("");
  });
});
