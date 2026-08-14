import { describe, expect, it } from "vitest";
import { canScheduleQuote } from "@/lib/quote-utils";
import type { Quote } from "@/types";

const baseQuote: Quote = {
  id: "quote-1",
  companyId: "company-1",
  quoteNumber: "SO-2025-001",
  customerId: "cust-1",
  customerName: "Client Test",
  title: "Rénovation",
  description: "Travaux divers",
  amount: 1000,
  status: "accepted",
  validUntil: "2025-12-31",
  createdAt: "2025-01-01",
  depositRequired: false,
  depositStatus: "not_required",
  lineItems: [],
};

describe("canScheduleQuote", () => {
  it("allows scheduling when accepted without deposit", () => {
    expect(canScheduleQuote(baseQuote)).toBe(true);
  });

  it("blocks scheduling when not accepted", () => {
    expect(canScheduleQuote({ ...baseQuote, status: "sent" })).toBe(false);
  });

  it("blocks scheduling when deposit required but not paid", () => {
    expect(
      canScheduleQuote({
        ...baseQuote,
        status: "deposit_pending",
        depositRequired: true,
        depositStatus: "pending",
      })
    ).toBe(false);
  });

  it("allows scheduling when deposit is paid", () => {
    expect(
      canScheduleQuote({
        ...baseQuote,
        status: "deposit_paid",
        depositRequired: true,
        depositStatus: "paid",
      })
    ).toBe(true);
  });

  it("allows scheduling when accepted with deposit paid status", () => {
    expect(
      canScheduleQuote({
        ...baseQuote,
        status: "accepted",
        depositRequired: true,
        depositStatus: "paid",
      })
    ).toBe(true);
  });
});
