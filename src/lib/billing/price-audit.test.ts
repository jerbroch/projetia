import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  auditPrice,
  expectedPricesFromConfig,
  intervalForCycle,
  summarizeAudit,
  type ExpectedPrice,
  type StripePriceFacts,
} from "./price-audit";

const ENV_KEYS = [
  "STRIPE_PRICE_SOLO_MONTHLY",
  "STRIPE_PRICE_SOLO_ANNUAL",
  "STRIPE_PRICE_ENTREPRISE_MONTHLY",
  "STRIPE_PRICE_ENTREPRISE_ANNUAL",
  "STRIPE_PRICE_ENTREPRENEUR_MONTHLY",
  "STRIPE_PRICE_ENTREPRENEUR_ANNUAL",
  "STRIPE_PRICE_CROISSANCE_MONTHLY",
  "STRIPE_PRICE_CROISSANCE_ANNUAL",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    process.env[k] = `price_${k.toLowerCase()}`;
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const EXPECTED: ExpectedPrice = {
  tier: "entreprise",
  tierName: "Entreprise",
  cycle: "monthly",
  envKey: "STRIPE_PRICE_ENTREPRISE_MONTHLY",
  priceId: "price_x",
  expectedCents: 8999,
  expectedInterval: "month",
  expectedCurrency: "cad",
};

const CONFORME: StripePriceFacts = {
  id: "price_x",
  active: true,
  currency: "cad",
  unitAmount: 8999,
  type: "recurring",
  interval: "month",
  intervalCount: 1,
  livemode: false,
};

const TEST_KEY = { keyLivemode: false };

describe("expectedPricesFromConfig", () => {
  it("dérive les 8 attentes de la config", () => {
    const rows = expectedPricesFromConfig();
    expect(rows).toHaveLength(8);
    expect(new Set(rows.map((r) => r.envKey)).size).toBe(8);
  });

  it("attend les montants et intervalles annoncés", () => {
    const rows = expectedPricesFromConfig();
    const entrepriseAnnual = rows.find(
      (r) => r.tier === "entreprise" && r.cycle === "annual",
    )!;
    expect(entrepriseAnnual.expectedCents).toBe(89990);
    expect(entrepriseAnnual.expectedInterval).toBe("year");
    expect(entrepriseAnnual.expectedCurrency).toBe("cad");
  });

  it("traduit le cycle en intervalle Stripe", () => {
    expect(intervalForCycle("monthly")).toBe("month");
    expect(intervalForCycle("annual")).toBe("year");
  });
});

describe("auditPrice", () => {
  it("ne signale rien quand tout concorde", () => {
    expect(auditPrice(EXPECTED, CONFORME, TEST_KEY)).toEqual([]);
  });

  it("détecte un écart de montant — le cas qui coûte de l'argent", () => {
    const issues = auditPrice(EXPECTED, { ...CONFORME, unitAmount: 1200 }, TEST_KEY);
    expect(issues.map((i) => i.code)).toEqual(["wrong_amount"]);
    expect(issues[0].message).toContain("89.99");
    expect(issues[0].message).toContain("12.00");
  });

  it("détecte le mélange test / live", () => {
    const issues = auditPrice(EXPECTED, { ...CONFORME, livemode: true }, TEST_KEY);
    expect(issues.map((i) => i.code)).toContain("livemode_mismatch");
    expect(issues[0].message).toMatch(/Live.*clé API est Test/);
  });

  it("détecte un prix archivé", () => {
    const issues = auditPrice(EXPECTED, { ...CONFORME, active: false }, TEST_KEY);
    expect(issues.map((i) => i.code)).toEqual(["inactive"]);
  });

  it("détecte une mauvaise devise", () => {
    const issues = auditPrice(
      EXPECTED,
      { ...CONFORME, currency: "usd", unitAmount: 8999 },
      TEST_KEY,
    );
    expect(issues.map((i) => i.code)).toEqual(["wrong_currency"]);
  });

  it("détecte un mensuel vendu comme annuel", () => {
    const issues = auditPrice(EXPECTED, { ...CONFORME, interval: "year" }, TEST_KEY);
    expect(issues.map((i) => i.code)).toEqual(["wrong_interval"]);
  });

  it("détecte une facturation tous les 3 mois", () => {
    const issues = auditPrice(EXPECTED, { ...CONFORME, intervalCount: 3 }, TEST_KEY);
    expect(issues.map((i) => i.code)).toEqual(["wrong_interval_count"]);
  });

  it("détecte un paiement unique déguisé en abonnement", () => {
    const issues = auditPrice(
      EXPECTED,
      { ...CONFORME, type: "one_time", interval: null, intervalCount: null },
      TEST_KEY,
    );
    expect(issues.map((i) => i.code)).toEqual(["not_recurring"]);
  });

  it("signale une variable d'environnement manquante sans rien chercher", () => {
    const issues = auditPrice({ ...EXPECTED, priceId: null }, CONFORME, TEST_KEY);
    expect(issues.map((i) => i.code)).toEqual(["missing_env"]);
    expect(issues[0].message).toContain("STRIPE_PRICE_ENTREPRISE_MONTHLY");
  });

  it("signale un prix absent de Stripe", () => {
    const issues = auditPrice(EXPECTED, null, TEST_KEY);
    expect(issues.map((i) => i.code)).toEqual(["not_found"]);
    expect(issues[0].message).toContain("mode Test");
  });

  it("cumule plusieurs écarts sur un même prix", () => {
    const issues = auditPrice(
      EXPECTED,
      { ...CONFORME, unitAmount: 100, currency: "usd", active: false },
      TEST_KEY,
    );
    expect(issues.map((i) => i.code).sort()).toEqual([
      "inactive",
      "wrong_amount",
      "wrong_currency",
    ]);
  });
});

describe("summarizeAudit", () => {
  it("compte les lignes en défaut", () => {
    const rows = [
      { expected: EXPECTED, issues: [] },
      { expected: EXPECTED, issues: [{ code: "wrong_amount" as const, message: "x" }] },
    ];
    expect(summarizeAudit(rows)).toEqual({ ok: false, failed: 1, total: 2 });
    expect(summarizeAudit([{ expected: EXPECTED, issues: [] }]).ok).toBe(true);
  });
});
