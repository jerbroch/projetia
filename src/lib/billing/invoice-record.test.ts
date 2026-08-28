import { describe, expect, it } from "vitest";
import {
  companyIdOf,
  secondsToIso,
  splitTaxes,
  taxRateIdsOf,
  toInvoiceRecord,
} from "./invoice-record";

const TXR_GST = "txr_1U8SmU061aVmyk8tsgLIqMot";
const TXR_QST = "txr_1U8SmU061aVmyk8tT1bY4phn";
const TYPES = { [TXR_GST]: "gst", [TXR_QST]: "qst" };

const ligneTaxe = (txr: string, amount: number, raison = "standard_rated") => ({
  amount,
  tax_behavior: "exclusive",
  tax_rate_details: { tax_rate: txr },
  taxability_reason: raison,
  taxable_amount: amount ? 14999 : 0,
  type: "tax_rate_details",
});

/** Facture telle que livrée aujourd'hui : abonnement sous `parent`. */
function facture(overrides: Record<string, unknown> = {}) {
  return {
    id: "in_1U95d5061aVmyk8tn7PhIUPh",
    object: "invoice",
    number: "JDIZZDVQ-0002",
    status: "paid",
    currency: "cad",
    billing_reason: "subscription_update",
    customer: "cus_V8itkmKTaA5EaZ",
    subtotal: 14999,
    total: 14999,
    amount_paid: 14999,
    amount_due: 0,
    created: 1787846139,
    period_start: 1787846139,
    period_end: 1790438139,
    status_transitions: { finalized_at: 1787846139, paid_at: 1787846200, voided_at: null },
    hosted_invoice_url: "https://invoice.stripe.com/i/acct_x/test_y",
    invoice_pdf: "https://pay.stripe.com/invoice/acct_x/test_y/pdf",
    total_taxes: [ligneTaxe(TXR_GST, 0, "not_collecting"), ligneTaxe(TXR_QST, 0, "not_collecting")],
    parent: {
      quote_details: null,
      subscription_details: {
        metadata: { companyId: "38fcd3b6-1baf-4b7a-80f7-5e927824c4db", tier: "entrepreneur" },
        subscription: "sub_1U8Sn5061aVmyk8tyDz6UnZN",
      },
    },
    ...overrides,
  };
}

describe("secondsToIso", () => {
  it("convertit un horodatage Stripe", () => {
    expect(secondsToIso(1787846139)).toBe("2026-08-27T15:55:39.000Z");
  });

  it("traite 0 et l'absence comme « pas de date »", () => {
    // Stripe met 0 là où il n'y a pas de date : le prendre pour 1970 daterait
    // des factures d'il y a cinquante ans dans les relevés.
    expect(secondsToIso(0)).toBeNull();
    expect(secondsToIso(null)).toBeNull();
    expect(secondsToIso(undefined)).toBeNull();
    expect(secondsToIso("1787846139")).toBeNull();
  });
});

describe("taxRateIdsOf", () => {
  it("relève les taux cités, sans doublon", () => {
    expect(taxRateIdsOf(facture())).toEqual([TXR_GST, TXR_QST]);
    expect(
      taxRateIdsOf(facture({ total_taxes: [ligneTaxe(TXR_GST, 750), ligneTaxe(TXR_GST, 100)] })),
    ).toEqual([TXR_GST]);
  });

  it("ne bronche pas sur une facture sans taxes", () => {
    expect(taxRateIdsOf(facture({ total_taxes: undefined }))).toEqual([]);
    expect(taxRateIdsOf(null)).toEqual([]);
  });
});

describe("splitTaxes", () => {
  it("sépare la TPS de la TVQ", () => {
    const f = facture({ total_taxes: [ligneTaxe(TXR_GST, 750), ligneTaxe(TXR_QST, 1496)] });
    expect(splitTaxes(f, TYPES)).toEqual({ gst: 750, qst: 1496, other: 0 });
  });

  it("rend zéro partout avant l'inscription aux taxes", () => {
    // Tant que l'inscription n'est pas faite, Stripe marque `not_collecting`
    // et met des montants nuls : c'est une information exacte, pas un trou.
    expect(splitTaxes(facture(), TYPES)).toEqual({ gst: 0, qst: 0, other: 0 });
  });

  it("range la TVH avec la TPS et la TVP avec la TVQ", () => {
    // Elles se remettent au même endroit, un client hors Québec ne doit pas
    // créer une catégorie parallèle.
    const types = { a: "hst", b: "pst" };
    const f = facture({ total_taxes: [ligneTaxe("a", 1300), ligneTaxe("b", 700)] });
    expect(splitTaxes(f, types)).toEqual({ gst: 1300, qst: 700, other: 0 });
  });

  it("classe en « autre » une nature inconnue plutôt que de la perdre", () => {
    // Un total juste avec une ligne inclassée vaut mieux qu'une taxe disparue.
    const f = facture({ total_taxes: [ligneTaxe("txr_inconnu", 999)] });
    expect(splitTaxes(f, {})).toEqual({ gst: 0, qst: 0, other: 999 });
  });
});

describe("companyIdOf", () => {
  it("lit les métadonnées de l'abonnement", () => {
    expect(companyIdOf(facture())).toBe("38fcd3b6-1baf-4b7a-80f7-5e927824c4db");
  });

  it("préfère les métadonnées de la facture quand elles existent", () => {
    expect(companyIdOf(facture({ metadata: { companyId: "direct" } }))).toBe("direct");
  });

  it("rend null sans métadonnées, sans faire échouer la lecture", () => {
    expect(companyIdOf(facture({ parent: null }))).toBeNull();
    expect(companyIdOf(facture({ parent: { subscription_details: { metadata: {} } } }))).toBeNull();
  });
});

describe("toInvoiceRecord", () => {
  it("traduit une facture complète", () => {
    const r = toInvoiceRecord(facture(), TYPES)!;
    expect(r.id).toBe("in_1U95d5061aVmyk8tn7PhIUPh");
    expect(r.number).toBe("JDIZZDVQ-0002");
    expect(r.status).toBe("paid");
    expect(r.currency).toBe("cad");
    expect(r.subtotal_cents).toBe(14999);
    expect(r.amount_paid_cents).toBe(14999);
    expect(r.stripe_subscription_id).toBe("sub_1U8Sn5061aVmyk8tyDz6UnZN");
    expect(r.stripe_customer_id).toBe("cus_V8itkmKTaA5EaZ");
    expect(r.paid_at).toBe("2026-08-27T15:56:40.000Z");
    expect(r.billing_reason).toBe("subscription_update");
  });

  it("conserve les montants négatifs des notes de crédit", () => {
    // Une proration à la baisse produit une vraie facture négative. La rejeter
    // ou la mettre à zéro gonflerait le revenu déclaré.
    const r = toInvoiceRecord(facture({ subtotal: -14999, total: -14999, amount_paid: 0 }), TYPES)!;
    expect(r.subtotal_cents).toBe(-14999);
    expect(r.total_cents).toBe(-14999);
  });

  it("lit l'abonnement dans les deux formes de payload", () => {
    // Un endpoint webhook ancien livre `subscription` à la racine ; le SDK
    // courant le place sous `parent.subscription_details`.
    const ancienne = toInvoiceRecord(
      facture({ parent: null, subscription: "sub_ancien" }),
      TYPES,
    )!;
    expect(ancienne.stripe_subscription_id).toBe("sub_ancien");
    expect(toInvoiceRecord(facture(), TYPES)!.stripe_subscription_id).toBe(
      "sub_1U8Sn5061aVmyk8tyDz6UnZN",
    );
  });

  it("conserve le détail brut des taxes à côté de la ventilation", () => {
    const r = toInvoiceRecord(facture({ total_taxes: [ligneTaxe(TXR_GST, 750)] }), TYPES)!;
    expect(r.gst_cents).toBe(750);
    expect(Array.isArray(r.tax_breakdown)).toBe(true);
  });

  it("refuse une facture sans identifiant plutôt que d'écrire une ligne bancale", () => {
    expect(toInvoiceRecord({ status: "paid" }, TYPES)).toBeNull();
    expect(toInvoiceRecord(null, TYPES)).toBeNull();
  });

  it("retombe sur des valeurs sûres quand des champs manquent", () => {
    const r = toInvoiceRecord({ id: "in_minimal" }, {})!;
    expect(r.status).toBe("unknown");
    expect(r.currency).toBe("cad");
    expect(r.total_cents).toBe(0);
    expect(r.paid_at).toBeNull();
    expect(r.company_id).toBeNull();
  });
});
