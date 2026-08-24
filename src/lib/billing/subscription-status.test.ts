import { describe, expect, it } from "vitest";
import {
  buildCompanySubscriptionUpdate,
  normalizeSubscriptionStatus,
  subscriptionGrantsAccess,
} from "./subscription-status";
import { companyHasAppAccess } from "@/lib/access-control";
import { planForPriceId, priceIdForPlan, type PricingConfig } from "@/lib/pricing-config";

const NOW = "2026-08-24T12:00:00.000Z";
// 2026-09-24T12:00:00Z
const PERIOD_END = 1790251200;

const pricing: PricingConfig = {
  monthlyPriceCents: 8900,
  annualPriceCents: 89000,
  annualDiscountPercent: 17,
  currency: "cad",
  monthlyPriceId: "price_monthly",
  annualPriceId: "price_annual",
  trialDays: 14,
};

describe("subscriptionGrantsAccess", () => {
  it("ouvre l'accès pendant l'essai, l'abonnement actif et le délai de grâce", () => {
    expect(subscriptionGrantsAccess("active")).toBe(true);
    expect(subscriptionGrantsAccess("trialing")).toBe(true);
    expect(subscriptionGrantsAccess("past_due")).toBe(true);
  });

  it("ferme l'accès dès que Stripe abandonne le recouvrement", () => {
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      expect(subscriptionGrantsAccess(status)).toBe(false);
    }
    expect(subscriptionGrantsAccess(null)).toBe(false);
  });
});

describe("normalizeSubscriptionStatus", () => {
  it("ne produit que des valeurs de l'ENUM subscription_status", () => {
    expect(normalizeSubscriptionStatus("active")).toBe("active");
    expect(normalizeSubscriptionStatus("trialing")).toBe("trial");
    expect(normalizeSubscriptionStatus("past_due")).toBe("past_due");
    expect(normalizeSubscriptionStatus("canceled")).toBe("cancelled");
    expect(normalizeSubscriptionStatus("unpaid")).toBe("cancelled");
    expect(normalizeSubscriptionStatus("statut_inconnu")).toBe("cancelled");
  });
});

describe("buildCompanySubscriptionUpdate", () => {
  it("active l'accès payant sur un abonnement actif", () => {
    const update = buildCompanySubscriptionUpdate(
      {
        status: "active",
        plan: "monthly",
        priceId: "price_monthly",
        subscriptionId: "sub_123",
        customerId: "cus_123",
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: false,
      },
      NOW,
    );

    expect(update).toMatchObject({
      subscription_status: "active",
      access_type: "monthly",
      requires_access_choice: false,
      pending_plan: null,
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
      subscription_plan: "monthly",
      subscription_cancel_at_period_end: false,
      access_granted_at: NOW,
      subscription_started_at: NOW,
    });
    expect(update.subscription_current_period_end).toBe("2026-09-24T12:00:00.000Z");
  });

  it("conserve les dates du premier accès payant lors des renouvellements", () => {
    const update = buildCompanySubscriptionUpdate(
      {
        status: "active",
        plan: "annual",
        priceId: "price_annual",
        subscriptionId: "sub_123",
        customerId: "cus_123",
        currentPeriodEnd: PERIOD_END,
      },
      NOW,
      { accessGrantedAt: "2026-01-05T00:00:00.000Z", subscriptionStartedAt: "2026-01-05T00:00:00.000Z" },
    );

    expect(update.access_granted_at).toBe("2026-01-05T00:00:00.000Z");
    expect(update.subscription_started_at).toBe("2026-01-05T00:00:00.000Z");
  });

  it("referme le choix d'accès quand l'abonnement est annulé", () => {
    const update = buildCompanySubscriptionUpdate(
      {
        status: "canceled",
        plan: "monthly",
        priceId: "price_monthly",
        subscriptionId: "sub_123",
        customerId: "cus_123",
        currentPeriodEnd: PERIOD_END,
      },
      NOW,
    );

    expect(update.subscription_status).toBe("cancelled");
    expect(update.requires_access_choice).toBe(true);
    expect(update.pending_plan).toBe("monthly");
    expect(update.access_granted_at).toBeUndefined();
  });

  it("reporte l'essai Stripe dans trial_ends_at", () => {
    const update = buildCompanySubscriptionUpdate(
      {
        status: "trialing",
        plan: "monthly",
        priceId: "price_monthly",
        subscriptionId: "sub_123",
        customerId: "cus_123",
        currentPeriodEnd: PERIOD_END,
        trialEnd: PERIOD_END,
      },
      NOW,
    );

    expect(update.subscription_status).toBe("trial");
    expect(update.trial_ends_at).toBe("2026-09-24T12:00:00.000Z");
  });

  it("produit un patch cohérent avec la règle d'accès applicative", () => {
    const cases: Array<[string, boolean]> = [
      ["active", true],
      ["trialing", true],
      ["past_due", true],
      ["unpaid", false],
      ["canceled", false],
    ];

    for (const [stripeStatus, expected] of cases) {
      const update = buildCompanySubscriptionUpdate(
        {
          status: stripeStatus,
          plan: "monthly",
          priceId: "price_monthly",
          subscriptionId: "sub_123",
          customerId: "cus_123",
          currentPeriodEnd: PERIOD_END,
        },
        NOW,
      );

      const hasAccess = companyHasAppAccess({
        accessType: String(update.access_type ?? "monthly"),
        subscriptionStatus: String(update.subscription_status),
        requiresAccessChoice: Boolean(update.requires_access_choice),
        isBeta: false,
        createdAt: "2026-08-20T00:00:00.000Z",
        lastActivityAt: null,
        trialEndsAt: null,
      });

      expect(hasAccess, `statut ${stripeStatus}`).toBe(expected);
    }
  });
});

describe("résolution des Price IDs", () => {
  it("mappe le plan vers le prix Stripe et inversement", () => {
    expect(priceIdForPlan(pricing, "monthly")).toBe("price_monthly");
    expect(priceIdForPlan(pricing, "annual")).toBe("price_annual");
    expect(planForPriceId(pricing, "price_annual")).toBe("annual");
    expect(planForPriceId(pricing, "price_inconnu")).toBeNull();
    expect(planForPriceId(pricing, null)).toBeNull();
  });

  it("retourne null quand le prix n'est pas configuré", () => {
    const notConfigured: PricingConfig = { ...pricing, annualPriceId: null };
    expect(priceIdForPlan(notConfigured, "annual")).toBeNull();
    expect(planForPriceId(notConfigured, "price_annual")).toBeNull();
  });
});
