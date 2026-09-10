import { describe, expect, it } from "vitest";
import { lignesVoulues, planifier } from "@/lib/quotes/versionnage";
import type { QuoteCostEstimation } from "@/types";

/**
 * L'IDENTITÉ D'UNE LIGNE SURVIT AUX RÉVISIONS.
 *
 * C'est la raison d'être du versionnage : le terrain pointe vers un
 * quote_line_item, et si cet identifiant changeait à chaque sauvegarde, les
 * heures d'un chantier se détacheraient de l'ouvrage qu'elles paient.
 */

function estimation(
  labor: Array<{ id: string; heures: number; taux: number; travailleurs?: number }>,
  materials: Array<{ id: string; nom: string; catalogItemId?: string }> = []
): QuoteCostEstimation {
  return {
    labor: labor.map((l) => ({
      id: l.id,
      category: "compagnon" as const,
      hours: l.heures,
      hourlyRate: l.taux,
      workerCount: l.travailleurs ?? 1,
      total: l.heures * l.taux * (l.travailleurs ?? 1),
    })),
    materials: materials.map((m) => ({
      id: m.id,
      catalogItemId: m.catalogItemId,
      name: m.nom,
      quantity: 1,
      unit: "unité",
      costPrice: 10,
      marginPct: 0.4,
      salePrice: 14,
      total: 14,
    })),
    fees: [],
  };
}

describe("lignesVoulues", () => {
  it("compte les heures de TOUS les travailleurs, pas d'un seul", () => {
    const [ligne] = lignesVoulues(estimation([{ id: "ql-1", heures: 8, taux: 50, travailleurs: 3 }]));
    // 8 h × 3 hommes : c'est ce que le terrain saisira en face.
    expect(ligne.laborHours).toBe(24);
    expect(ligne.unitPrice).toBe(50);
  });

  it("marque « catalog » une ligne venue du catalogue, « manual » sinon", () => {
    const lignes = lignesVoulues(
      estimation([], [
        { id: "qm-1", nom: "Tuyau ABS", catalogItemId: "11111111-1111-1111-1111-111111111111" },
        { id: "qm-2", nom: "Bricolage maison" },
      ])
    );
    expect(lignes.map((l) => l.source)).toEqual(["catalog", "manual"]);
  });

  it("rend une liste vide plutôt qu'une ligne inventée", () => {
    expect(lignesVoulues(undefined)).toEqual([]);
    expect(lignesVoulues(null)).toEqual([]);
  });

  it("refuse une ligne sans identifiant au lieu d'en fabriquer une orpheline", () => {
    const sansId = estimation([{ id: "", heures: 1, taux: 1 }]);
    expect(() => lignesVoulues(sansId)).toThrow(/sans identifiant/);
  });

  it("refuse deux lignes qui partageraient la même identité", () => {
    const double = estimation([
      { id: "ql-1", heures: 1, taux: 1 },
      { id: "ql-1", heures: 2, taux: 2 },
    ]);
    expect(() => lignesVoulues(double)).toThrow(/en double/);
  });
});

describe("planifier — une ligne conservée garde son identité", () => {
  it("reprend, crée et retire selon ce que l'éditeur a fait", () => {
    // Trois lignes sauvegardées une première fois.
    const premiere = lignesVoulues(
      estimation([
        { id: "ql-a", heures: 8, taux: 50 },
        { id: "ql-b", heures: 4, taux: 60 },
        { id: "ql-c", heures: 2, taux: 70 },
      ])
    );
    const enBase = premiere.map((l, i) => ({ id: `item-${i}`, clientLineId: l.clientLineId }));

    // L'entrepreneur modifie A, supprime C, ajoute D.
    const seconde = lignesVoulues(
      estimation([
        { id: "ql-a", heures: 12, taux: 55 },
        { id: "ql-b", heures: 4, taux: 60 },
        { id: "ql-d", heures: 6, taux: 65 },
      ])
    );
    const plan = planifier(seconde, enBase);

    // A et B gardent l'identité qu'ils avaient déjà — le point critique.
    expect(plan.aReprendre.map((r) => [r.ligne.clientLineId, r.quoteLineItemId])).toEqual([
      ["ql-a", "item-0"],
      ["ql-b", "item-1"],
    ]);
    // D est neuf.
    expect(plan.aCreer.map((l) => l.clientLineId)).toEqual(["ql-d"]);
    // C sort de la version courante.
    expect(plan.aRetirer).toEqual(["item-2"]);
  });

  it("une ligne modifiée reste une reprise, jamais une création", () => {
    const enBase = [{ id: "item-0", clientLineId: "ql-a" }];
    const modifiee = lignesVoulues(estimation([{ id: "ql-a", heures: 99, taux: 999 }]));
    const plan = planifier(modifiee, enBase);
    expect(plan.aCreer).toHaveLength(0);
    expect(plan.aReprendre[0].quoteLineItemId).toBe("item-0");
  });
});
