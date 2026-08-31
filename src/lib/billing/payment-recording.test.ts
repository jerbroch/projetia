import { describe, expect, it } from "vitest";
import {
  applyPayment,
  invoiceBalance,
  isPaymentMethod,
  paymentMethodLabel,
  refusePayment,
} from "./payment-recording";

const facture = (amount: number, paidAmount = 0) => ({ amount, paidAmount });

describe("modes de paiement", () => {
  it("accepte les modes réellement utilisés par un entrepreneur", () => {
    for (const mode of ["interac", "check", "cash", "transfer", "other"]) {
      expect(isPaymentMethod(mode)).toBe(true);
    }
  });

  it("rejette ce qui n'est pas un mode connu", () => {
    // « ach » a été renommé en « transfer » par la migration 026 : il ne doit
    // plus être accepté, sinon l'insertion échouerait au niveau de l'enum.
    expect(isPaymentMethod("ach")).toBe(false);
    expect(isPaymentMethod("")).toBe(false);
    expect(isPaymentMethod(null)).toBe(false);
    expect(isPaymentMethod("virement")).toBe(false);
  });

  it("nomme chaque mode en français", () => {
    expect(paymentMethodLabel("interac")).toBe("Virement Interac");
    expect(paymentMethodLabel("check")).toBe("Chèque");
    expect(paymentMethodLabel("cash")).toBe("Comptant");
    expect(paymentMethodLabel("transfer")).toBe("Virement bancaire");
    expect(paymentMethodLabel("other")).toBe("Autre");
  });

  it("retombe sur « Autre » plutôt que d'afficher un code brut", () => {
    expect(paymentMethodLabel("ach")).toBe("Autre");
  });
});

describe("invoiceBalance", () => {
  it("calcule le reste à payer", () => {
    expect(invoiceBalance(facture(1000, 250))).toBe(750);
    expect(invoiceBalance(facture(1000, 1000))).toBe(0);
  });

  it("ne rend jamais un solde négatif", () => {
    expect(invoiceBalance(facture(1000, 1200))).toBe(0);
  });

  it("résiste aux montants à virgule", () => {
    // 1149.90 - 383.30 en flottant donne 766.5999999999999.
    expect(invoiceBalance(facture(1149.9, 383.3))).toBe(766.6);
  });
});

describe("refusePayment — le dépassement du solde", () => {
  it("laisse passer un paiement partiel", () => {
    expect(refusePayment(facture(1000), 250)).toBeNull();
  });

  it("laisse passer un paiement qui solde exactement", () => {
    expect(refusePayment(facture(1000, 750), 250)).toBeNull();
  });

  it("refuse un montant supérieur au solde, en nommant le solde", () => {
    const refus = refusePayment(facture(1000, 750), 400);
    expect(refus?.code).toBe("exceeds_balance");
    expect(refus?.message).toContain("250,00");
    expect(refus?.message).toContain("400,00");
  });

  it("refuse zéro et les montants négatifs", () => {
    expect(refusePayment(facture(1000), 0)?.code).toBe("invalid_amount");
    expect(refusePayment(facture(1000), -50)?.code).toBe("invalid_amount");
    expect(refusePayment(facture(1000), Number.NaN)?.code).toBe("invalid_amount");
  });

  it("refuse un paiement sur une facture déjà soldée", () => {
    const refus = refusePayment(facture(1000, 1000), 50);
    expect(refus?.code).toBe("already_settled");
  });

  it("accepte un cent près sans se faire piéger par les flottants", () => {
    // Le solde vaut exactement 766.60 : il doit être encaissable en entier.
    expect(refusePayment(facture(1149.9, 383.3), 766.6)).toBeNull();
    expect(refusePayment(facture(1149.9, 383.3), 766.61)?.code).toBe("exceeds_balance");
  });
});

describe("applyPayment — l'état de la facture après encaissement", () => {
  it("cumule un paiement partiel sans solder", () => {
    const outcome = applyPayment(facture(1000), 250);
    expect(outcome.paidAmount).toBe(250);
    expect(outcome.remaining).toBe(750);
    expect(outcome.settlesInvoice).toBe(false);
    expect(outcome.invoiceStatus).toBeNull();
  });

  it("solde la facture au dernier versement", () => {
    const outcome = applyPayment(facture(1000, 750), 250);
    expect(outcome.paidAmount).toBe(1000);
    expect(outcome.remaining).toBe(0);
    expect(outcome.settlesInvoice).toBe(true);
    expect(outcome.invoiceStatus).toBe("paid");
  });

  it("ne touche pas au statut tant qu'il reste un solde", () => {
    // Le statut n'est écrit que pour solder : une facture « sent » qui reçoit
    // un acompte doit rester « sent », pas devenir autre chose.
    expect(applyPayment(facture(1000), 1).invoiceStatus).toBeNull();
  });

  it("enchaîne trois versements jusqu'au solde", () => {
    let etat = facture(900);
    for (const versement of [300, 300]) {
      const outcome = applyPayment(etat, versement);
      expect(outcome.settlesInvoice).toBe(false);
      etat = { amount: 900, paidAmount: outcome.paidAmount };
    }
    const dernier = applyPayment(etat, 300);
    expect(dernier.paidAmount).toBe(900);
    expect(dernier.settlesInvoice).toBe(true);
  });

  it("reste juste au cent sur des montants à virgule", () => {
    const outcome = applyPayment(facture(1149.9, 383.3), 766.6);
    expect(outcome.paidAmount).toBe(1149.9);
    expect(outcome.remaining).toBe(0);
    expect(outcome.settlesInvoice).toBe(true);
  });
});
