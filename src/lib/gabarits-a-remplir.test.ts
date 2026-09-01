import { describe, expect, it } from "vitest";
import {
  aucunTauxFacturable,
  gabaritsSansTaux,
  messageGabaritsARemplir,
} from "./gabarits-a-remplir";
import type { LaborRateTemplate } from "@/types";

const g = (name: string, billRate: number, isActive = true) =>
  ({ id: name, name, billRate, costPerHr: 0, workerCount: 1, isActive } as LaborRateTemplate);

describe("gabaritsSansTaux", () => {
  it("relève ceux à zéro", () => {
    expect(gabaritsSansTaux([g("Employé", 0), g("Transport", 75)]).map((t) => t.name)).toEqual([
      "Employé",
    ]);
  });

  it("ignore les gabarits désactivés — ils ne servent plus", () => {
    expect(gabaritsSansTaux([g("Vieux", 0, false), g("Employé", 95)])).toEqual([]);
  });

  it("compte un taux négatif comme non rempli", () => {
    expect(gabaritsSansTaux([g("Erreur", -5)])).toHaveLength(1);
  });
});

describe("aucunTauxFacturable", () => {
  it("vrai quand tout est à zéro", () => {
    expect(aucunTauxFacturable([g("Employé senior", 0), g("Apprenti", 0)])).toBe(true);
  });

  it("vrai quand il n'y a aucun gabarit du tout", () => {
    // Un entrepreneur qui a supprimé les siens est dans le même embarras.
    expect(aucunTauxFacturable([])).toBe(true);
  });

  it("faux dès qu'un seul est rempli", () => {
    expect(aucunTauxFacturable([g("Employé", 0), g("Transport", 75)])).toBe(false);
  });
});

describe("messageGabaritsARemplir", () => {
  it("se tait quand tout est rempli", () => {
    expect(messageGabaritsARemplir([g("Employé", 95), g("Transport", 75)])).toBeNull();
  });

  it("dit la conséquence, pas seulement l'état", () => {
    // « Vos taux sont à 0 » n'apprend rien ; « vos heures seront chiffrées à
    // 0 $ » dit ce qui va arriver à la soumission.
    const m = messageGabaritsARemplir([g("Employé senior", 0), g("Employé", 0)]);
    expect(m).toContain("chiffrées à 0 $");
    expect(m).toContain("2");
  });

  it("nomme les gabarits fautifs quand ils sont minoritaires", () => {
    const m = messageGabaritsARemplir([g("Employé", 95), g("Apprenti", 0)]);
    expect(m).toContain("« Apprenti »");
    expect(m).not.toContain("Employé »,");
  });

  it("accorde le singulier", () => {
    const m = messageGabaritsARemplir([g("Employé", 95), g("Apprenti", 0)]);
    expect(m).toContain("Un taux n'est pas rempli");
  });

  it("traite l'absence totale de gabarit", () => {
    expect(messageGabaritsARemplir([])).toContain("aucun taux");
  });

  it("ignore les désactivés dans son décompte", () => {
    expect(messageGabaritsARemplir([g("Employé", 95), g("Vieux", 0, false)])).toBeNull();
  });
});
