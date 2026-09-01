import { describe, expect, it } from "vitest";
import { refusAvecFicheCreee } from "./seat-limit";

const PLACES =
  "Votre abonnement inclut 1 place, toutes occupées. Pour donner accès à une " +
  "personne de plus, passez à un palier supérieur.";

describe("refusAvecFicheCreee", () => {
  it("dit d'abord ce qui a été fait, ensuite pourquoi ça a échoué", () => {
    // L'employeur croyait que rien ne s'était passé et recommençait. L'ordre
    // compte : le fait avant l'explication.
    const m = refusAvecFicheCreee(PLACES, "Luc Gagnon");
    expect(m.indexOf("créée")).toBeLessThan(m.indexOf("place"));
  });

  it("nomme la personne, pour qu'on la retrouve dans la liste", () => {
    expect(refusAvecFicheCreee(PLACES, "Luc Gagnon")).toContain("Luc Gagnon");
  });

  it("dit explicitement « sans accès »", () => {
    expect(refusAvecFicheCreee(PLACES, "Luc")).toContain("sans accès");
  });

  it("conserve le message d'origine en entier", () => {
    expect(refusAvecFicheCreee(PLACES, "Luc")).toContain(PLACES);
  });

  it("reste lisible sans nom", () => {
    const m = refusAvecFicheCreee(PLACES, "   ");
    expect(m).toContain("La fiche employé a été créée");
    expect(m).not.toContain("undefined");
  });
});
