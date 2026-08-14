import { describe, expect, it } from "vitest";
import {
  buildAtRiskCompany,
  evaluateAtRiskReasons,
  isAtRisk,
} from "@/lib/platform/at-risk";

const baseInput = {
  companyId: "c1",
  companyName: "Test Co",
  subscriptionStatus: "active",
  trialEndsAt: null,
  lastLogin: new Date("2026-08-01").toISOString(),
  lastActivityAt: new Date("2026-08-01").toISOString(),
  hasRecentFailedPayment: false,
  now: new Date("2026-08-12"),
};

describe("evaluateAtRiskReasons", () => {
  it("flags no login for 14+ days", () => {
    const reasons = evaluateAtRiskReasons({
      ...baseInput,
      lastLogin: new Date("2026-07-20").toISOString(),
    });
    expect(reasons).toContain("no_login_14d");
  });

  it("flags no activity for 30+ days", () => {
    const reasons = evaluateAtRiskReasons({
      ...baseInput,
      lastActivityAt: new Date("2026-06-01").toISOString(),
    });
    expect(reasons).toContain("no_activity_30d");
  });

  it("flags failed payment", () => {
    const reasons = evaluateAtRiskReasons({
      ...baseInput,
      hasRecentFailedPayment: true,
    });
    expect(reasons).toContain("failed_payment");
  });

  it("flags overdue subscription", () => {
    const reasons = evaluateAtRiskReasons({
      ...baseInput,
      subscriptionStatus: "past_due",
    });
    expect(reasons).toContain("overdue_subscription");
  });

  it("flags trial ending within 7 days", () => {
    const reasons = evaluateAtRiskReasons({
      ...baseInput,
      subscriptionStatus: "trial",
      trialEndsAt: new Date("2026-08-15").toISOString(),
    });
    expect(reasons).toContain("trial_ending_no_conversion");
  });

  it("returns healthy company with no reasons", () => {
    expect(isAtRisk(baseInput)).toBe(false);
    expect(buildAtRiskCompany(baseInput)).toBeNull();
  });
});
