import { describe, expect, it } from "vitest";
import { findStripeEnvProblems, formatStripeEnvProblems } from "./env-check";

/** Un environnement complet et cohérent, en mode test. */
function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    STRIPE_SECRET_KEY: "sk_test_51U8abc",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_51U8abc",
    STRIPE_WEBHOOK_SECRET: "whsec_abc",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    STRIPE_PRICE_SOLO_MONTHLY: "price_solo_m",
    STRIPE_PRICE_SOLO_ANNUAL: "price_solo_a",
    STRIPE_PRICE_ENTREPRISE_MONTHLY: "price_ent_m",
    STRIPE_PRICE_ENTREPRISE_ANNUAL: "price_ent_a",
    STRIPE_PRICE_ENTREPRENEUR_MONTHLY: "price_epr_m",
    STRIPE_PRICE_ENTREPRENEUR_ANNUAL: "price_epr_a",
    STRIPE_PRICE_CROISSANCE_MONTHLY: "price_cro_m",
    STRIPE_PRICE_CROISSANCE_ANNUAL: "price_cro_a",
    ...overrides,
  };
}

const names = (env: Record<string, string | undefined>) =>
  findStripeEnvProblems(env).map((p) => p.variable);

describe("findStripeEnvProblems", () => {
  it("ne signale rien sur une configuration complète", () => {
    expect(findStripeEnvProblems(validEnv())).toEqual([]);
  });

  it("laisse démarrer quand Stripe est volontairement absent", () => {
    // Sans clé secrète, l'application tourne en mode dégradé : c'est un choix,
    // pas une erreur. Ce sont les configurations PARTIELLES qui sont piégeuses.
    expect(findStripeEnvProblems({})).toEqual([]);
    expect(findStripeEnvProblems({ NEXT_PUBLIC_APP_URL: "" })).toEqual([]);
  });

  it("nomme chaque variable manquante", () => {
    const problems = findStripeEnvProblems(
      validEnv({ STRIPE_WEBHOOK_SECRET: undefined, STRIPE_PRICE_CROISSANCE_ANNUAL: "" }),
    );
    expect(problems.map((p) => p.variable)).toEqual([
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_CROISSANCE_ANNUAL",
    ]);
    expect(problems[0].reason).toContain("aucun paiement n'est enregistré");
  });

  it("signale les 8 Price IDs quand aucun n'est configuré", () => {
    const bare = {
      STRIPE_SECRET_KEY: "sk_test_1",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_1",
      STRIPE_WEBHOOK_SECRET: "whsec_1",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    };
    expect(findStripeEnvProblems(bare)).toHaveLength(8);
  });

  it("refuse un identifiant qui n'est pas un Price ID", () => {
    // Coller un id de produit à la place d'un prix est une erreur courante,
    // et Stripe ne la révèle qu'au moment du paiement.
    const problems = findStripeEnvProblems(
      validEnv({ STRIPE_PRICE_SOLO_MONTHLY: "prod_V8fnmLwlJqYzCt" }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].variable).toBe("STRIPE_PRICE_SOLO_MONTHLY");
    expect(problems[0].reason).toContain("price_");
  });

  it("détecte un mélange de clés test et live", () => {
    expect(names(validEnv({ STRIPE_SECRET_KEY: "sk_live_1" }))).toContain(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    );
    expect(names(validEnv({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_1" }))).toContain(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    );
  });

  it("accepte une paire live cohérente sur une vraie URL", () => {
    expect(
      findStripeEnvProblems(
        validEnv({
          STRIPE_SECRET_KEY: "sk_live_1",
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_1",
          NEXT_PUBLIC_APP_URL: "https://app.exemple.ca",
        }),
      ),
    ).toEqual([]);
  });

  it("refuse une URL localhost avec des clés live", () => {
    const problems = findStripeEnvProblems(
      validEnv({
        STRIPE_SECRET_KEY: "sk_live_1",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_1",
      }),
    );
    expect(problems.map((p) => p.variable)).toEqual(["NEXT_PUBLIC_APP_URL"]);
    expect(problems[0].reason).toContain("dans le vide");
  });

  it("accepte les clés restreintes rk_live_ comme du mode live", () => {
    const problems = findStripeEnvProblems(
      validEnv({ STRIPE_SECRET_KEY: "rk_live_1", NEXT_PUBLIC_APP_URL: "https://app.exemple.ca" }),
    );
    expect(problems.map((p) => p.variable)).toEqual([
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    ]);
  });
});

describe("formatStripeEnvProblems", () => {
  it("nomme chaque variable et dit comment s'en sortir", () => {
    const message = formatStripeEnvProblems(
      findStripeEnvProblems(validEnv({ STRIPE_WEBHOOK_SECRET: undefined })),
    );
    expect(message).toContain("STRIPE_WEBHOOK_SECRET");
    expect(message).toContain("1 problème :");
    expect(message).toContain("retirez STRIPE_SECRET_KEY");
  });

  it("accorde le pluriel", () => {
    const message = formatStripeEnvProblems(
      findStripeEnvProblems(
        validEnv({ STRIPE_WEBHOOK_SECRET: undefined, STRIPE_PRICE_SOLO_ANNUAL: undefined }),
      ),
    );
    expect(message).toContain("2 problèmes :");
  });
});
