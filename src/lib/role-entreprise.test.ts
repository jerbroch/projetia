import { describe, expect, it } from "vitest";
import { roleDansLEntreprise } from "./session";

/**
 * LE RÔLE SUIT L'ENTREPRISE, jamais la personne seule.
 *
 * Depuis que les appartenances sont lues par utilisateur — pour partir en
 * même temps que le profil plutôt qu'après lui — c'est le code qui choisit la
 * bonne ligne. Ce choix est un contrôle de permission : se tromper
 * d'entreprise, c'est accorder à quelqu'un des droits qu'il n'a pas là où il
 * se trouve.
 */
describe("roleDansLEntreprise", () => {
  const appartenances = [
    { role: "employee" as const, companyId: "entreprise-A" },
    { role: "owner" as const, companyId: "entreprise-B" },
  ];

  it("rend le rôle de l'entreprise demandée", () => {
    expect(roleDansLEntreprise(appartenances, "entreprise-A")).toBe("employee");
    expect(roleDansLEntreprise(appartenances, "entreprise-B")).toBe("owner");
  });

  it("ne donne JAMAIS le rôle d'une autre entreprise", () => {
    // Propriétaire ailleurs ne veut pas dire propriétaire ici.
    expect(roleDansLEntreprise(appartenances, "entreprise-C")).toBeNull();
  });

  it("rend null plutôt que de deviner quand l'entreprise est absente", () => {
    expect(roleDansLEntreprise(appartenances, "")).toBeNull();
    expect(roleDansLEntreprise([], "entreprise-A")).toBeNull();
  });
});
