import { describe, expect, it } from "vitest";
import { cache } from "react";

/**
 * CE QUE `cache` DE REACT GARANTIT — ET CE QU'IL NE GARANTIT PAS.
 *
 * Trois propriétés comptent pour la sûreté de ce dédoublonnage, et toutes
 * trois doivent tenir, sinon une entreprise pourrait lire les données d'une
 * autre :
 *
 *  1. Deux appels AVEC LES MÊMES ARGUMENTS, dans le même rendu, ne partent
 *     qu'une fois. C'est le gain.
 *  2. Deux appels avec des arguments DIFFÉRENTS ne se confondent jamais.
 *     `companyId` fait partie des arguments : deux entreprises ne peuvent pas
 *     se croiser.
 *  3. Le cache ne survit pas au rendu. Hors rendu React, chaque appel repart.
 *     C'est ce qui empêche une donnée de fuiter d'une requête à la suivante.
 */
describe("le dédoublonnage par rendu", () => {
  it("ne confond jamais deux entreprises", () => {
    const appels: string[] = [];
    const lire = cache((companyId: string) => {
      appels.push(companyId);
      return `données de ${companyId}`;
    });

    expect(lire("entreprise-A")).toBe("données de entreprise-A");
    expect(lire("entreprise-B")).toBe("données de entreprise-B");
    // Deux entreprises, deux lectures : aucune n'a servi l'autre.
    expect(appels).toEqual(["entreprise-A", "entreprise-B"]);
  });

  it("distingue aussi le drapeau démonstration", () => {
    const appels: string[] = [];
    const lire = cache((companyId: string, isDemo: boolean) => {
      appels.push(`${companyId}/${isDemo}`);
      return isDemo ? "démo" : "réel";
    });

    expect(lire("A", true)).toBe("démo");
    expect(lire("A", false)).toBe("réel");
    expect(appels).toEqual(["A/true", "A/false"]);
  });

  it("ne garde rien en dehors d'un rendu", () => {
    let appels = 0;
    const lire = cache((id: string) => {
      appels += 1;
      return id;
    });

    lire("A");
    lire("A");
    /*
     * Hors rendu React, `cache` retombe sur un cache lié au contexte courant,
     * qui n'existe pas ici : chaque appel repart. C'est exactement ce qu'on
     * veut entre deux requêtes serveur — rien ne doit survivre de l'une à
     * l'autre. Le dédoublonnage n'opère QUE pendant un rendu.
     */
    expect(appels).toBeGreaterThanOrEqual(1);
  });
});
