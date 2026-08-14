import { describe, expect, it } from "vitest";
import { quoteFormSchema } from "@/lib/validations/quotes";
import {
  buildDemoQuoteNumber,
  buildQuoteFromForm,
  duplicateQuote,
  getDefaultQuoteFormValues,
} from "@/lib/quote-utils";
import type { Quote } from "@/types";

describe("quoteFormSchema", () => {
  it("accepts valid quote data", () => {
    const result = quoteFormSchema.safeParse({
      title: "Rénovation cuisine",
      description: "Travaux complets",
      customerId: "00000000-0000-0000-0000-000000000001",
      customerName: "Jean Tremblay",
      amount: 12500,
      status: "draft",
      validUntil: "2026-12-31",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = quoteFormSchema.safeParse({
      title: "",
      customerName: "Jean Tremblay",
      amount: 100,
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = quoteFormSchema.safeParse({
      title: "Test",
      customerName: "Client",
      amount: -1,
      status: "draft",
    });
    expect(result.success).toBe(false);
  });
});

describe("quote-utils", () => {
  const sampleQuotes: Quote[] = [
    {
      id: "1",
      companyId: "c1",
      quoteNumber: "SO-2026-001",
      customerId: "",
      customerName: "A",
      title: "T1",
      description: "",
      amount: 100,
      status: "draft",
      validUntil: "2026-12-31",
      createdAt: "2026-01-01",
      depositRequired: false,
      depositStatus: "not_required",
      lineItems: [],
    },
    {
      id: "2",
      companyId: "c1",
      quoteNumber: "SO-2026-002",
      customerId: "",
      customerName: "B",
      title: "T2",
      description: "",
      amount: 200,
      status: "sent",
      validUntil: "2026-12-31",
      createdAt: "2026-01-02",
      depositRequired: false,
      depositStatus: "not_required",
      lineItems: [],
    },
  ];

  it("generates next demo quote number", () => {
    const year = new Date().getFullYear();
    expect(buildDemoQuoteNumber(sampleQuotes)).toBe(`SO-${year}-003`);
  });

  it("builds quote from form values", () => {
    const values = getDefaultQuoteFormValues();
    const quote = buildQuoteFromForm(values, "company-1", "SO-2026-010");
    expect(quote.companyId).toBe("company-1");
    expect(quote.quoteNumber).toBe("SO-2026-010");
    expect(quote.status).toBe("draft");
  });

  it("duplicates quote as draft with new number", () => {
    const copy = duplicateQuote(sampleQuotes[0], "SO-2026-099");
    expect(copy.id).not.toBe(sampleQuotes[0].id);
    expect(copy.quoteNumber).toBe("SO-2026-099");
    expect(copy.status).toBe("draft");
    expect(copy.title).toBe(sampleQuotes[0].title);
  });
});
