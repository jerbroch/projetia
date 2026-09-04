import { describe, expect, it } from "vitest";
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailSubject,
  buildInvoiceEmailText,
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

describe("buildInvoiceEmailText", () => {
  const base = {
    companyName: "Plomberie Essai",
    customerName: "Jean Latreille",
    invoiceNumber: "FA-2026-008",
    lineItems: [{ description: "Chauffe-eau", quantity: 1, unitPrice: 1180, lineTotal: 1180 }],
    total: 1356.6,
    gstAmount: 59, qstAmount: 117.7,
    dueDate: "2026-10-03",
  };

  // Un courriel qui n'a qu'une partie HTML est un signal de pourriel connu.
  it("porte le montant, l'échéance et la référence à citer", () => {
    const t = buildInvoiceEmailText(base);
    expect(t).toContain("FA-2026-008");
    expect(t).toContain("Jean Latreille");
    expect(t).toContain("Chauffe-eau");
    expect(t).toContain("COMMENT PAYER");
    expect(t).toContain("dans le message de votre paiement");
  });

  it("ne contient aucune balise", () => {
    expect(buildInvoiceEmailText(base)).not.toMatch(/<[a-z]/i);
  });

  it("annonce les photos jointes", () => {
    const avec = buildInvoiceEmailText({
      ...base,
      photos: [
        { contentId: "photo-1", alt: "a", urlPleineTaille: null },
        { contentId: "photo-2", alt: "b", urlPleineTaille: null },
      ],
    });
    expect(avec).toContain("2 photos du chantier sont jointes");
    expect(buildInvoiceEmailText(base)).not.toContain("photo");
  });
});
