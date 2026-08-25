import { describe, expect, it } from "vitest";
import {
  buildCompanySubscriptionUpdate,
  hasModifiableSubscription,
  normalizeSubscriptionStatus,
  subscriptionGrantsAccess,
} from "./subscription-status";
import { companyHasAppAccess } from "@/lib/access-control";

const NOW = "2026-08-24T12:00:00.000Z";
// 2026-09-24T12:00:00Z
const PERIOD_END = 1790251200;

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
        cycle: "monthly",
        tier: "entreprise",
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
      subscription_tier: "entreprise",
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
        cycle: "annual",
        tier: "croissance",
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
        cycle: "monthly",
        tier: "entreprise",
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
        cycle: "monthly",
        tier: "entreprise",
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
          cycle: "monthly",
        tier: "entreprise",
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

describe("hasModifiableSubscription", () => {
  it("est faux sans abonnement Stripe — le palier s'achète par Checkout", () => {
    expect(hasModifiableSubscription({ stripeSubscriptionId: null, status: "active" })).toBe(
      false,
    );
    expect(hasModifiableSubscription({ status: "active" })).toBe(false);
  });

  it("est vrai tant que l'abonnement Stripe est vivant", () => {
    for (const status of ["active", "trial", "past_due"]) {
      expect(
        hasModifiableSubscription({ stripeSubscriptionId: "sub_123", status }),
        status,
      ).toBe(true);
    }
  });

  it("est faux sur un abonnement annulé — il se rachète par Checkout", () => {
    expect(
      hasModifiableSubscription({ stripeSubscriptionId: "sub_123", status: "cancelled" }),
    ).toBe(false);
    expect(
      hasModifiableSubscription({ stripeSubscriptionId: "sub_123", status: null }),
    ).toBe(false);
  });
});
