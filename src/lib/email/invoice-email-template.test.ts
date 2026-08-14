import { describe, expect, it } from "vitest";
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailSubject,
  buildInteracEmailBlock,
  toClientInvoiceLineItems,
} from "@/lib/email/invoice-email-template";

describe("invoice email template", () => {
  it("builds default subject", () => {
    expect(buildInvoiceEmailSubject({ invoiceNumber: "FA-2026-001", companyName: "Test Co" })).toBe(
      "Facture FA-2026-001 — Test Co"
    );
  });

  it("builds interac block when email configured", () => {
    const block = buildInteracEmailBlock({
      email: "pay@test.com",
      recipientName: "Test Co",
      securityQuestion: "Facture?",
      securityAnswer: "FA-001",
    });
    expect(block).toContain("Interac");
    expect(block).toContain("pay@test.com");
  });

  it("shows deposit and balance in email totals", () => {
    const html = buildInvoiceEmailHtml({
      companyName: "Test Co",
      invoiceNumber: "FA-2026-001",
      customerName: "Client",
      quoteNumber: "SO-2026-001",
      lineItems: [],
      total: 11500,
      depositApplied: 2300,
      balanceDue: 9200,
    });
    expect(html).toContain("Total des travaux");
    expect(html).toContain("Dépôt déjà payé");
    expect(html).toContain("Solde à payer");
    expect(html).toContain("SO-2026-001");
  });

  it("maps client line items without cost fields", () => {
    const items = toClientInvoiceLineItems([
      {
        description: "Main-d'œuvre",
        quantity: 2,
        unitSellPrice: 95,
        lineTotal: 190,
      },
    ]);
    expect(items[0]).toEqual({
      description: "Main-d'œuvre",
      quantity: 2,
      unitPrice: 95,
      lineTotal: 190,
    });
  });
});
