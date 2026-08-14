import { describe, expect, it, vi } from "vitest";

describe("super admin guards", () => {
  it("isSuperAdminUser returns false when admin not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const { isSuperAdminUser } = await import("@/lib/platform/super-admin");
    expect(await isSuperAdminUser("any-user-id")).toBe(false);

    vi.unstubAllEnvs();
  });

  it("SuperAdminError has correct name", async () => {
    const { SuperAdminError } = await import("@/lib/platform/super-admin");
    const err = new SuperAdminError("test");
    expect(err.name).toBe("SuperAdminError");
    expect(err.message).toBe("test");
  });
});

describe("saas metrics", () => {
  it("returns unavailable when no subscriptions", async () => {
    const { computeSaasMetrics } = await import("@/lib/platform/metrics");
    const result = computeSaasMetrics({
      subscriptions: [],
      activeCompanyIds: new Set(),
      periodStart: new Date("2026-08-01"),
      periodEnd: new Date("2026-08-12"),
    });
    expect(result.available).toBe(false);
    expect(result.mrr).toBe(0);
  });

  it("computes MRR from active subscriptions", async () => {
    const { computeSaasMetrics } = await import("@/lib/platform/metrics");
    const result = computeSaasMetrics({
      subscriptions: [
        {
          id: "1",
          companyId: "c1",
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          planName: "Pro",
          planAmountCents: 9900,
          currency: "cad",
          status: "active",
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelledAt: null,
          createdAt: "2026-08-01T00:00:00Z",
        },
      ],
      activeCompanyIds: new Set(["c1"]),
      periodStart: new Date("2026-08-01"),
      periodEnd: new Date("2026-08-12"),
    });
    expect(result.available).toBe(true);
    expect(result.mrr).toBe(99);
    expect(result.arr).toBe(99 * 12);
  });
});
