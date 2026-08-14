import { describe, expect, it } from "vitest";
import { getPublicQuoteUrl, getQuoteLineItems, normalizePublicQuote, resolveAppOriginFromHeaders } from "@/lib/quote-utils";
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
  status: "sent",
  validUntil: "2025-12-31",
  createdAt: "2025-01-01",
  depositRequired: false,
  depositStatus: "not_required",
  lineItems: [],
};

describe("getQuoteLineItems", () => {
  it("falls back to a default line item when lineItems is missing", () => {
    const quote = { ...baseQuote, lineItems: undefined as unknown as Quote["lineItems"] };
    const items = getQuoteLineItems(quote);
    expect(items).toHaveLength(1);
    expect(items[0]?.total).toBe(1000);
  });
});

describe("normalizePublicQuote", () => {
  it("fills required defaults for partially serialized quotes", () => {
    const normalized = normalizePublicQuote({
      ...baseQuote,
      lineItems: undefined as unknown as Quote["lineItems"],
      depositRequired: undefined as unknown as boolean,
      depositStatus: undefined as unknown as Quote["depositStatus"],
    });

    expect(normalized.lineItems).toEqual([]);
    expect(normalized.depositRequired).toBe(false);
    expect(normalized.depositStatus).toBe("not_required");
  });
});

describe("resolveAppOriginFromHeaders", () => {
  it("uses forwarded host and proto when present", () => {
    const headers = new Headers({
      "x-forwarded-host": "app.example.com",
      "x-forwarded-proto": "https",
    });

    expect(resolveAppOriginFromHeaders(headers)).toBe("https://app.example.com");
  });

  it("falls back to http for localhost host header", () => {
    const headers = new Headers({ host: "localhost:3001" });
    expect(resolveAppOriginFromHeaders(headers)).toBe("http://localhost:3001");
  });
});

describe("getPublicQuoteUrl", () => {
  it("builds the public soumission route", () => {
    expect(getPublicQuoteUrl("abc123token", "http://localhost:3001")).toBe(
      "http://localhost:3001/soumission/abc123token"
    );
  });

  it("strips trailing slash from origin", () => {
    expect(getPublicQuoteUrl("abc123token", "https://app.example.com/")).toBe(
      "https://app.example.com/soumission/abc123token"
    );
  });
});
