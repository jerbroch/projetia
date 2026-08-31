/**
 * Parcours complet des 4 paliers × 2 cycles, sur le vrai code de facturation.
 * Stripe et Supabase sont simulés : ce test vérifie le CÂBLAGE — quel prix part
 * chez Stripe, et quel palier revient en base — pas l'API de Stripe elle-même.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PRICE_IDS: Record<string, string> = {
  STRIPE_PRICE_SOLO_MONTHLY: "price_test_solo_m",
  STRIPE_PRICE_SOLO_ANNUAL: "price_test_solo_a",
  STRIPE_PRICE_ENTREPRISE_MONTHLY: "price_test_entreprise_m",
  STRIPE_PRICE_ENTREPRISE_ANNUAL: "price_test_entreprise_a",
  STRIPE_PRICE_ENTREPRENEUR_MONTHLY: "price_test_entrepreneur_m",
  STRIPE_PRICE_ENTREPRENEUR_ANNUAL: "price_test_entrepreneur_a",
  STRIPE_PRICE_CROISSANCE_MONTHLY: "price_test_croissance_m",
  STRIPE_PRICE_CROISSANCE_ANNUAL: "price_test_croissance_a",
};

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";

// --- Simulacres -----------------------------------------------------------

const checkoutCreate = vi.fn();
const customersCreate = vi.fn();
const subscriptionsRetrieve = vi.fn();
const companyUpdates: Array<Record<string, unknown>> = [];
let companyRow: Record<string, unknown> = {};

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: checkoutCreate } },
    customers: { create: customersCreate, retrieve: vi.fn() },
    subscriptions: { retrieve: subscriptionsRetrieve },
  }),
  getAppUrl: () => "https://constructionios.com",
  isStripeConfigured: () => true,
  getStripeWebhookSecret: () => "whsec_test",
}));

vi.mock("@/lib/supabase/admin", () => ({
  isSupabaseConfigured: () => true,
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: companyRow, error: null }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        companyUpdates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

const { createSubscriptionCheckoutSession } = await import("@/lib/billing/checkout");
const { syncSubscriptionToCompany } = await import("@/lib/billing/sync");
const { SUBSCRIPTION_TIERS, priceCentsForTier, userLimitForTier } = await import(
  "@/lib/billing/tiers"
);
const { companyHasAppAccess } = await import("@/lib/access-control");

const IDENTITY = {
  companyId: COMPANY_ID,
  companyName: "Construction Test inc.",
  email: "test@constructionios.com",
};

function fakeSubscription(priceId: string, status = "active") {
  return {
    id: "sub_test",
    status,
    customer: "cus_test",
    cancel_at_period_end: false,
    current_period_end: 1790251200, // 2026-09-24T12:00:00Z
    trial_end: null,
    metadata: { companyId: COMPANY_ID },
    items: { data: [{ price: { id: priceId } }] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  for (const [key, value] of Object.entries(PRICE_IDS)) process.env[key] = value;
  delete process.env.SUBSCRIPTION_TRIAL_DAYS;
  companyRow = { stripe_customer_id: "cus_test", stripe_subscription_id: null };
  companyUpdates.length = 0;
  checkoutCreate.mockReset().mockResolvedValue({
    id: "cs_test",
    url: "https://checkout.stripe.com/c/pay/cs_test",
  });
  customersCreate.mockReset().mockResolvedValue({ id: "cus_test" });
  subscriptionsRetrieve.mockReset();
});

afterEach(() => {
  for (const key of Object.keys(PRICE_IDS)) delete process.env[key];
});

const CYCLES = ["monthly", "annual"] as const;

// --- Le parcours ----------------------------------------------------------

describe.each(SUBSCRIPTION_TIERS)("palier $name", (tier) => {
  describe.each(CYCLES)("cycle %s", (cycle) => {
    const envKey = tier.priceIdEnv[cycle];
    const expectedPriceId = PRICE_IDS[envKey];

    it("envoie le bon Stripe Price ID au Checkout", async () => {
      await createSubscriptionCheckoutSession(IDENTITY, tier.id, cycle);

      expect(checkoutCreate).toHaveBeenCalledTimes(1);
      const params = checkoutCreate.mock.calls[0][0];

      expect(params.line_items).toEqual([{ price: expectedPriceId, quantity: 1 }]);
      expect(params.mode).toBe("subscription");
    });

    it("étiquette la session avec l'entreprise, le palier et le cycle", async () => {
      await createSubscriptionCheckoutSession(IDENTITY, tier.id, cycle);
      const params = checkoutCreate.mock.calls[0][0];

      // Sans ces métadonnées, un prix archivé chez Stripe rendrait
      // l'abonnement impossible à rattacher à un palier.
      expect(params.client_reference_id).toBe(COMPANY_ID);
      expect(params.metadata).toEqual({ companyId: COMPANY_ID, tier: tier.id, cycle });
      expect(params.subscription_data.metadata).toEqual({
        companyId: COMPANY_ID,
        tier: tier.id,
        cycle,
      });
    });

    it("réclame les taxes canadiennes et l'adresse de facturation", async () => {
      await createSubscriptionCheckoutSession(IDENTITY, tier.id, cycle);
      const params = checkoutCreate.mock.calls[0][0];

      expect(params.automatic_tax).toEqual({ enabled: true });
      expect(params.billing_address_collection).toBe("required");
      expect(params.locale).toBe("fr-CA");
    });

    it("n'ouvre aucun essai tant que SUBSCRIPTION_TRIAL_DAYS n'est pas posé", async () => {
      await createSubscriptionCheckoutSession(IDENTITY, tier.id, cycle);
      const params = checkoutCreate.mock.calls[0][0];
      expect(params.subscription_data.trial_period_days).toBeUndefined();
    });

    it("retombe sur le bon palier au retour de Stripe", async () => {
      const result = await syncSubscriptionToCompany(fakeSubscription(expectedPriceId));

      expect(result).toEqual({
        companyId: COMPANY_ID,
        status: "active",
        tier: tier.id,
        cycle,
      });

      const patch = companyUpdates.at(-1)!;
      expect(patch.subscription_tier).toBe(tier.id);
      expect(patch.subscription_plan).toBe(cycle);
      expect(patch.subscription_price_id).toBe(expectedPriceId);
      expect(patch.subscription_status).toBe("active");
      expect(patch.access_type).toBe(cycle);
      expect(patch.requires_access_choice).toBe(false);
      expect(patch.pending_plan).toBeNull();
    });

    it("ouvre l'accès à l'application une fois payé", async () => {
      await syncSubscriptionToCompany(fakeSubscription(expectedPriceId));
      const patch = companyUpdates.at(-1)!;

      expect(
        companyHasAppAccess({
          accessType: String(patch.access_type),
          subscriptionStatus: String(patch.subscription_status),
          requiresAccessChoice: Boolean(patch.requires_access_choice),
          isBeta: false,
          createdAt: "2026-08-20T00:00:00.000Z",
          lastActivityAt: null,
          trialEndsAt: null,
        }),
      ).toBe(true);
    });

    it("ferme l'accès si l'abonnement est annulé", async () => {
      await syncSubscriptionToCompany(fakeSubscription(expectedPriceId, "canceled"));
      const patch = companyUpdates.at(-1)!;

      expect(patch.subscription_status).toBe("cancelled");
      expect(
        companyHasAppAccess({
          accessType: cycle,
          subscriptionStatus: String(patch.subscription_status),
          requiresAccessChoice: true,
          isBeta: false,
          createdAt: "2026-08-20T00:00:00.000Z",
          lastActivityAt: null,
          trialEndsAt: null,
        }),
      ).toBe(false);
    });
  });

  it("porte le prix et la limite d'utilisateurs annoncés", () => {
    expect(priceCentsForTier(tier, "monthly")).toBe(tier.monthlyPriceCents);
    expect(priceCentsForTier(tier, "annual")).toBe(tier.annualPriceCents);
    expect(userLimitForTier(tier.id)).toBe(tier.userLimit);
  });
});

// --- Ce qui doit rester impossible ---------------------------------------

describe("garde-fous entre paliers", () => {
  it("les 8 Price IDs sont distincts — aucun palier n'en écrase un autre", async () => {
    const sent: string[] = [];
    for (const tier of SUBSCRIPTION_TIERS) {
      for (const cycle of CYCLES) {
        checkoutCreate.mockClear();
        await createSubscriptionCheckoutSession(IDENTITY, tier.id, cycle);
        sent.push(checkoutCreate.mock.calls[0][0].line_items[0].price);
      }
    }
    expect(sent).toHaveLength(8);
    expect(new Set(sent).size).toBe(8);
  });

  it("refuse d'ouvrir Checkout quand le prix du palier n'est pas configuré", async () => {
    delete process.env.STRIPE_PRICE_CROISSANCE_ANNUAL;
    await expect(
      createSubscriptionCheckoutSession(IDENTITY, "croissance", "annual"),
    ).rejects.toThrow(/croissance/);
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it("ne devine pas un palier à partir d'un prix inconnu", async () => {
    const result = await syncSubscriptionToCompany({
      ...fakeSubscription("price_dun_autre_compte"),
      metadata: { companyId: COMPANY_ID },
    });
    expect(result?.tier).toBeNull();
    expect(companyUpdates.at(-1)!.subscription_tier).toBeUndefined();
  });
});
