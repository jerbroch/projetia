import { describe, expect, it } from "vitest";
import { outilAvecLeMemeNumero, refusDeNumeroInterne } from "./tool-utils";

const outils = [
  { id: "a", name: "Scie ronde Makita", internalNumber: "OUT-001" },
  { id: "b", name: "Perceuse Hilti", internalNumber: "OUT-002" },
  { id: "c", name: "Échelle 24 pi", internalNumber: "" },
  { id: "d", name: "Pompe de puisard", internalNumber: null },
];

describe("outilAvecLeMemeNumero", () => {
  it("trouve l'outil qui porte déjà le numéro", () => {
    expect(outilAvecLeMemeNumero(outils, "OUT-001")?.name).toBe("Scie ronde Makita");
  });

  it("ignore la casse et les espaces de bord", () => {
    // « out-001 » gravé à la main et « OUT-001 » tapé au bureau désignent le
    // même outil sur le plancher. Les distinguer recréerait le doublon.
    expect(outilAvecLeMemeNumero(outils, "  out-001 ")?.id).toBe("a");
    expect(outilAvecLeMemeNumero(outils, "Out-002")?.id).toBe("b");
  });

  it("laisse passer un numéro libre", () => {
    expect(outilAvecLeMemeNumero(outils, "OUT-999")).toBeNull();
  });

  it("ne considère jamais un numéro vide comme un conflit", () => {
    // Le numéro est facultatif : plusieurs outils peuvent ne pas en avoir.
    expect(outilAvecLeMemeNumero(outils, "")).toBeNull();
    expect(outilAvecLeMemeNumero(outils, "   ")).toBeNull();
    expect(outilAvecLeMemeNumero(outils, null)).toBeNull();
    expect(outilAvecLeMemeNumero(outils, undefined)).toBeNull();
  });

  it("ne se bloque pas lui-même lors d'une modification", () => {
    // Sans l'exclusion, rouvrir une fiche et l'enregistrer sans rien changer
    // serait refusé au motif que l'outil porte son propre numéro.
    expect(outilAvecLeMemeNumero(outils, "OUT-001", "a")).toBeNull();
    expect(outilAvecLeMemeNumero(outils, "OUT-001", "b")?.id).toBe("a");
  });

  it("rend le premier conflit sur une liste vide sans lever", () => {
    expect(outilAvecLeMemeNumero([], "OUT-001")).toBeNull();
  });
});

describe("refusDeNumeroInterne", () => {
  it("nomme l'outil qui bloque", () => {
    const m = refusDeNumeroInterne("OUT-001", { name: "Scie ronde Makita" });
    expect(m).toContain("OUT-001");
    expect(m).toContain("Scie ronde Makita");
  });

  it("dit quoi faire, pas seulement ce qui ne va pas", () => {
    const m = refusDeNumeroInterne("OUT-001", { name: "Scie" });
    expect(m).toMatch(/choisissez|corrigez/i);
  });
});
