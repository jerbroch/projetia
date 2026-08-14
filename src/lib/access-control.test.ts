import { describe, expect, it } from "vitest";
import {
  companyHasAppAccess,
  isGrandfatheredByActivity,
} from "@/lib/access-control";

describe("companyHasAppAccess", () => {
  it("grants demo and platform admin", () => {
    expect(companyHasAppAccess({ accessType: "pending" }, { isDemo: true })).toBe(true);
    expect(companyHasAppAccess({ accessType: "pending" }, { isPlatformAdmin: true })).toBe(
      true,
    );
  });

  it("blocks pending new company", () => {
    expect(
      companyHasAppAccess({
        accessType: "pending",
        requiresAccessChoice: true,
        subscriptionStatus: "cancelled",
      }),
    ).toBe(false);
  });

  it("allows beta / promo access", () => {
    expect(
      companyHasAppAccess({
        accessType: "beta",
        requiresAccessChoice: false,
        isBeta: true,
        subscriptionStatus: "active",
      }),
    ).toBe(true);
  });

  it("allows grandfathered companies", () => {
    expect(
      companyHasAppAccess({
        accessType: "grandfathered",
        requiresAccessChoice: false,
      }),
    ).toBe(true);
  });

  it("requires active subscription for paid plans", () => {
    expect(
      companyHasAppAccess({
        accessType: "monthly",
        subscriptionStatus: "active",
        requiresAccessChoice: false,
      }),
    ).toBe(true);
    expect(
      companyHasAppAccess({
        accessType: "monthly",
        subscriptionStatus: "cancelled",
        requiresAccessChoice: false,
      }),
    ).toBe(false);
  });

  it("grandfathers by last activity", () => {
    expect(
      companyHasAppAccess({
        accessType: "pending",
        requiresAccessChoice: true,
        lastActivityAt: "2026-07-01T00:00:00Z",
      }),
    ).toBe(true);
  });

  it("grandfathers when access columns are absent (pre-migration)", () => {
    expect(
      companyHasAppAccess({
        subscriptionStatus: "trial",
      }),
    ).toBe(true);
  });
});

describe("isGrandfatheredByActivity", () => {
  it("detects pre-feature companies", () => {
    expect(isGrandfatheredByActivity({ createdAt: "2026-01-01T00:00:00Z" })).toBe(true);
    expect(isGrandfatheredByActivity({ createdAt: "2026-09-01T00:00:00Z" })).toBe(false);
  });
});
