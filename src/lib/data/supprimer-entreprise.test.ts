import { describe, expect, it, vi } from "vitest";
import { supprimerEntreprise, supprimerEntreprises } from "@/lib/data/supprimer-entreprise";

/**
 * L'ordre compte, et c'est tout ce qu'il y a à vérifier ici : le versionnage
 * est en ON DELETE RESTRICT, donc `companies` doit passer EN DERNIER.
 */
function clientEspion(erreurSur?: string) {
  const appels: string[] = [];
  const db = {
    from(table: string) {
      appels.push(table);
      return {
        delete: () => ({
          in: async () =>
            erreurSur === table ? { error: { message: "refusé" } } : { error: null },
        }),
      };
    },
  };
  return { db, appels };
}

describe("supprimerEntreprises", () => {
  it("efface le versionnage AVANT l'entreprise", async () => {
    const { db, appels } = clientEspion();
    const r = await supprimerEntreprises(db, ["c1"]);
    expect(r.ok).toBe(true);
    expect(appels).toEqual([
      "quote_line_versions",
      "quote_line_items",
      "quote_versions",
      "write_failures",
      "companies",
    ]);
  });

  it("s'arrête et nomme la table qui refuse, sans toucher à l'entreprise", async () => {
    const { db, appels } = clientEspion("quote_versions");
    const r = await supprimerEntreprises(db, ["c1"]);
    expect(r.ok).toBe(false);
    expect(r.erreur).toContain("quote_versions");
    // L'entreprise n'a pas été touchée : on ne laisse pas une suppression
    // partielle derrière soi.
    expect(appels).not.toContain("companies");
  });

  it("ne fait rien quand la liste est vide", async () => {
    const { db, appels } = clientEspion();
    expect((await supprimerEntreprises(db, [])).ok).toBe(true);
    expect(appels).toEqual([]);
  });

  it("le cas courant passe par le même chemin", async () => {
    const { db, appels } = clientEspion();
    await supprimerEntreprise(db, "c1");
    expect(appels[appels.length - 1]).toBe("companies");
  });
});
