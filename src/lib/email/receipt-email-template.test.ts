import { describe, expect, it } from "vitest";
import {
  buildInteracEmailBlock,
  buildReceiptEmailHtml,
  buildReceiptEmailSubject,
} from "./invoice-email-template";

const base = {
  companyName: "Plomberie Goutte d'eau",
  customerName: "Marie Tremblay",
  invoiceNumber: "F-2026-014",
  amountReceived: 750,
  methodLabel: "Virement Interac",
  receivedOn: "8 septembre 2026",
  remainingBalance: 0,
};

describe("buildReceiptEmailSubject", () => {
  it("annonce une facture payée quand il ne reste rien", () => {
    expect(buildReceiptEmailSubject({ ...base })).toBe(
      "Facture payée — facture F-2026-014 — Plomberie Goutte d'eau",
    );
  });

  it("annonce un paiement reçu quand un solde subsiste", () => {
    expect(buildReceiptEmailSubject({ ...base, remainingBalance: 250 })).toContain(
      "Paiement reçu",
    );
  });
});

describe("buildReceiptEmailHtml", () => {
  it("confirme le montant, le mode et la date", () => {
    const html = buildReceiptEmailHtml(base);
    expect(html).toContain("750,00");
    expect(html).toContain("Virement Interac");
    expect(html).toContain("8 septembre 2026");
    expect(html).toContain("F-2026-014");
  });

  it("dit clairement que la facture est soldée", () => {
    const html = buildReceiptEmailHtml(base);
    expect(html).toContain("Facture payée en totalité");
  });

  it("annonce le solde restant sur un paiement partiel", () => {
    // Sans cette mention, un acompte laisse croire au client qu'il a tout payé.
    const html = buildReceiptEmailHtml({ ...base, remainingBalance: 399.9 });
    expect(html).toContain("Solde restant à payer");
    expect(html).toContain("399,90");
    expect(html).not.toContain("Facture payée en totalité");
  });

  it("rappelle les coordonnées Interac seulement s'il reste à payer", () => {
    const interac = buildInteracEmailBlock({
      email: "paiements@goutte-deau.ca",
      recipientName: "Plomberie Goutte d'eau",
    });

    const partiel = buildReceiptEmailHtml({
      ...base,
      remainingBalance: 250,
      interacBlock: interac,
    });
    expect(partiel).toContain("paiements@goutte-deau.ca");

    const solde = buildReceiptEmailHtml({ ...base, interacBlock: interac });
    expect(solde).not.toContain("paiements@goutte-deau.ca");
  });

  it("affiche la référence quand elle est fournie", () => {
    const html = buildReceiptEmailHtml({ ...base, reference: "Chèque 1042" });
    expect(html).toContain("Chèque 1042");
    expect(buildReceiptEmailHtml(base)).not.toContain("Référence");
  });

  it("échappe le HTML des champs saisis par l'entrepreneur", () => {
    const html = buildReceiptEmailHtml({
      ...base,
      reference: '<script>alert("x")</script>',
      customerName: "Marie <b>T</b>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Marie &lt;b&gt;T&lt;/b&gt;");
  });
});
