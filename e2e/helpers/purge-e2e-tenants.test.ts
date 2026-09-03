import { describe, expect, it } from "vitest";
import { AGE_MINIMAL_MS, purgeableParAge } from "./purge-e2e-tenants";

const MAINTENANT = Date.parse("2026-09-03T12:30:00Z");

describe("purgeableParAge", () => {
  // Le cas réel : le passage de `main` a fini pendant que celui d'une branche
  // tournait, et sa purge a emporté l'entreprise du second.
  it("épargne une entreprise créée pendant un passage en cours", () => {
    const creeeIlYA18Minutes = "2026-09-03T12:12:00Z";
    expect(purgeableParAge(creeeIlYA18Minutes, MAINTENANT)).toBe(false);
  });

  it("supprime un résidu d'hier", () => {
    expect(purgeableParAge("2026-09-02T12:30:00Z", MAINTENANT)).toBe(true);
  });

  it("s'abstient quand la date manque ou ne se lit pas", () => {
    expect(purgeableParAge(null, MAINTENANT)).toBe(false);
    expect(purgeableParAge(undefined, MAINTENANT)).toBe(false);
    expect(purgeableParAge("pas une date", MAINTENANT)).toBe(false);
  });

  it("tranche exactement au seuil", () => {
    const pile = new Date(MAINTENANT - AGE_MINIMAL_MS).toISOString();
    const uneSecondeAvant = new Date(MAINTENANT - AGE_MINIMAL_MS + 1000).toISOString();
    expect(purgeableParAge(pile, MAINTENANT)).toBe(true);
    expect(purgeableParAge(uneSecondeAvant, MAINTENANT)).toBe(false);
  });

  // Une suite dure une trentaine de minutes ; le seuil doit lui laisser de la
  // marge, sinon la purge redeviendrait dangereuse pour un passage lent.
  it("laisse de la marge à une suite qui traîne", () => {
    expect(AGE_MINIMAL_MS).toBeGreaterThanOrEqual(60 * 60 * 1000);
  });
});
