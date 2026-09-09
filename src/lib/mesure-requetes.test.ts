import { describe, expect, it } from "vitest";
import { avecMesure, mesureActive, noterAppel, resume } from "@/lib/mesure-requetes";
import { enTeteServerTiming } from "@/lib/server-timing";

describe("registre de mesure", () => {
  it("ne coûte rien quand personne n'écoute", () => {
    expect(mesureActive()).toBe(false);
    expect(resume()).toBeNull();
    // Ne doit pas lever : c'est appelé sur le chemin normal des requêtes.
    expect(() => noterAppel("companies", 5)).not.toThrow();
  });

  it("compte et chronomètre les appels d'une requête", async () => {
    const r = await avecMesure(async () => {
      noterAppel("companies", 12);
      noterAppel("profiles", 8);
      noterAppel("companies", 20);
      return resume();
    });
    expect(r!.total).toBe(3);
    expect(r!.msTotal).toBe(40);
    expect(r!.msLePlusLong).toBe(20);
    expect(r!.parCible[0]).toEqual({ cible: "companies", appels: 2, ms: 32 });
  });

  // Deux requêtes concurrentes ne doivent pas se mélanger : sinon le chiffre
  // d'une page inclurait celui d'une autre, et on corrigerait à l'aveugle.
  it("garde les requêtes concurrentes séparées", async () => {
    const [a, b] = await Promise.all([
      avecMesure(async () => {
        noterAppel("quotes", 10);
        await new Promise((r) => setTimeout(r, 5));
        noterAppel("quotes", 10);
        return resume();
      }),
      avecMesure(async () => {
        noterAppel("invoices", 3);
        return resume();
      }),
    ]);
    expect(a!.total).toBe(2);
    expect(b!.total).toBe(1);
    expect(b!.parCible[0].cible).toBe("invoices");
  });

  it("ne retient aucune donnée, seulement des noms et des durées", async () => {
    const r = await avecMesure(async () => {
      noterAppel("customers", 7);
      return resume();
    });
    expect(Object.keys(r!.parCible[0])).toEqual(["cible", "appels", "ms"]);
  });
});

describe("enTeteServerTiming", () => {
  it("écrit un en-tête lisible par le navigateur", () => {
    expect(enTeteServerTiming({ ctx: 12.4, data: 88.7 })).toBe("ctx;dur=12, data;dur=89");
  });

  it("reste vide quand il n'y a rien à dire", () => {
    expect(enTeteServerTiming({})).toBe("");
  });
});
