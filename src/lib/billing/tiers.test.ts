import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ANNUAL_MONTHS_BILLED,
  SUBSCRIPTION_TIERS,
  annualSavingsCents,
  formatPrice,
  getTier,
  getTrialDays,
  isBillingCycle,
  isSubscriptionTier,
  isTierPurchasable,
  priceCentsForTier,
  priceIdForTier,
  tierForPriceId,
  userLimitForTier,
  userLimitLabel,
} from "./tiers";

const ENV_KEYS = [
  "STRIPE_PRICE_SOLO_MONTHLY",
  "STRIPE_PRICE_SOLO_ANNUAL",
  "STRIPE_PRICE_ENTREPRISE_MONTHLY",
  "STRIPE_PRICE_ENTREPRISE_ANNUAL",
  "STRIPE_PRICE_ENTREPRENEUR_MONTHLY",
  "STRIPE_PRICE_ENTREPRENEUR_ANNUAL",
  "STRIPE_PRICE_CROISSANCE_MONTHLY",
  "STRIPE_PRICE_CROISSANCE_ANNUAL",
  "SUBSCRIPTION_TRIAL_DAYS",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("définition des paliers", () => {
  it("expose les 4 paliers dans l'ordre croissant de prix", () => {
    expect(SUBSCRIPTION_TIERS.map((t) => t.id)).toEqual([
      "solo",
      "entreprise",
      "entrepreneur",
      "croissance",
    ]);

    const prices = SUBSCRIPTION_TIERS.map((t) => t.monthlyPriceCents);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("porte les montants convenus, en cents", () => {
    expect(SUBSCRIPTION_TIERS.map((t) => t.monthlyPriceCents)).toEqual([
      3999, 8999, 14999, 24999,
    ]);
    expect(SUBSCRIPTION_TIERS.map((t) => t.annualPriceCents)).toEqual([
      39990, 89990, 149990, 249990,
    ]);
  });

  it("facture 10 mois pour 12 mois d'accès sur chaque palier", () => {
    for (const tier of SUBSCRIPTION_TIERS) {
      expect(tier.annualPriceCents, tier.id).toBe(
        tier.monthlyPriceCents * ANNUAL_MONTHS_BILLED,
      );
      expect(annualSavingsCents(tier), tier.id).toBe(tier.monthlyPriceCents * 2);
    }
  });

  it("porte les limites d'utilisateurs convenues", () => {
    expect(userLimitForTier("solo")).toBe(1);
    expect(userLimitForTier("entreprise")).toBe(5);
    expect(userLimitForTier("entrepreneur")).toBe(15);
    expect(userLimitForTier("croissance")).toBeNull();
  });

  it("retombe sur la limite la plus stricte pour un palier inconnu", () => {
    expect(userLimitForTier("palier_inexistant")).toBe(1);
    expect(userLimitForTier(null)).toBe(1);
  });
});

describe("résolution des Price IDs", () => {
  it("lit le Price ID depuis l'environnement au moment de l'appel", () => {
    expect(priceIdForTier("solo", "monthly")).toBeNull();

    process.env.STRIPE_PRICE_SOLO_MONTHLY = "price_solo_m";
    expect(priceIdForTier("solo", "monthly")).toBe("price_solo_m");
    expect(isTierPurchasable("solo", "monthly")).toBe(true);
    expect(isTierPurchasable("solo", "annual")).toBe(false);
  });

  it("retrouve le palier et le cycle depuis un Price ID", () => {
    process.env.STRIPE_PRICE_ENTREPRENEUR_ANNUAL = "price_entr_a";
    expect(tierForPriceId("price_entr_a")).toEqual({
      tier: "entrepreneur",
      cycle: "annual",
    });
  });

  it("ne confond pas deux paliers et ignore les valeurs vides", () => {
    process.env.STRIPE_PRICE_SOLO_MONTHLY = "price_a";
    process.env.STRIPE_PRICE_CROISSANCE_MONTHLY = "price_b";
    expect(tierForPriceId("price_b")?.tier).toBe("croissance");
    expect(tierForPriceId("price_inconnu")).toBeNull();
    expect(tierForPriceId(null)).toBeNull();
    expect(tierForPriceId("  ")).toBeNull();
  });
});

describe("essai gratuit", () => {
  it("vaut zéro tant que la variable n'est pas définie", () => {
    expect(getTrialDays()).toBe(0);
  });

  it("lit la variable et rejette les valeurs invalides", () => {
    process.env.SUBSCRIPTION_TRIAL_DAYS = "14";
    expect(getTrialDays()).toBe(14);
    process.env.SUBSCRIPTION_TRIAL_DAYS = "-3";
    expect(getTrialDays()).toBe(0);
    process.env.SUBSCRIPTION_TRIAL_DAYS = "abc";
    expect(getTrialDays()).toBe(0);
  });
});

describe("affichage", () => {
  it("formate les prix en dollars canadiens", () => {
    const solo = getTier("solo")!;
    expect(formatPrice(priceCentsForTier(solo, "monthly"))).toContain("39,99");
    expect(formatPrice(null)).toBe("Prix à configurer");
  });

  it("décrit la limite d'utilisateurs en clair", () => {
    expect(userLimitLabel("solo")).toBe("1 utilisateur");
    expect(userLimitLabel("entreprise")).toBe("Jusqu'à 5 utilisateurs");
    expect(userLimitLabel("croissance")).toBe("Utilisateurs illimités");
  });

  it("valide les identifiants de palier et de cycle", () => {
    expect(isSubscriptionTier("croissance")).toBe(true);
    expect(isSubscriptionTier("gratuit")).toBe(false);
    expect(isBillingCycle("annual")).toBe(true);
    expect(isBillingCycle("weekly")).toBe(false);
  });
});
