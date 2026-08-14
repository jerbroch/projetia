import { describe, expect, it } from "vitest";
import {
  normalizePromoCode,
  promoValidationMessage,
  validatePromoCodeRecord,
} from "@/lib/promo-codes";

describe("promo code validation", () => {
  it("normalizes codes", () => {
    expect(normalizePromoCode("  IOS123  ")).toBe("ios123");
  });

  it("rejects missing code", () => {
    expect(promoValidationMessage("empty")).toContain("entrer");
  });

  it("accepts active free-access code", () => {
    const result = validatePromoCodeRecord({
      code: "ios123",
      freeAccess: true,
      active: true,
      expiresAt: null,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.promo.code).toBe("ios123");
    }
  });

  it("rejects inactive code", () => {
    const result = validatePromoCodeRecord({
      code: "old",
      freeAccess: true,
      active: false,
      expiresAt: null,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("inactive");
    }
  });

  it("rejects expired code", () => {
    const result = validatePromoCodeRecord(
      {
        code: "expired",
        freeAccess: true,
        active: true,
        expiresAt: "2020-01-01T00:00:00Z",
      },
      new Date("2026-08-12"),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("expired");
    }
  });

  it("rejects unknown code", () => {
    const result = validatePromoCodeRecord(null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("not_found");
    }
  });
});
