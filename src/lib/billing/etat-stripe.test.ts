import { describe, expect, it } from "vitest";
import {
  jugerConfigurationStripe,
  messageAucunAbonne,
  VARIABLES_PRIX,
} from "@/lib/billing/etat-stripe";

const tousLesPrix = Object.fromEntries(VARIABLES_PRIX.map((n) => [n, "price_123"]));

describe("jugerConfigurationStripe", () => {
  it("reconnaît une configuration complète", () => {
    const e = jugerConfigurationStripe({
      secretKey: "sk_live_x", webhookSecret: "whsec_x", prix: tousLesPrix,
    });
    expect(e.configuration).toBe("complete");
    expect(e.pretAEncaisser).toBe(true);
    expect(e.message).toContain("branché");
  });

  // Chaque manque appelle un geste différent : les confondre sous
  // « non connecté » envoie chercher au mauvais endroit.
  it("distingue ce qui manque au lieu de dire « non connecté »", () => {
    expect(jugerConfigurationStripe({ webhookSecret: "whsec_x", prix: tousLesPrix }).configuration)
      .toBe("cle_manquante");
    expect(jugerConfigurationStripe({ secretKey: "sk_x", prix: tousLesPrix }).configuration)
      .toBe("webhook_manquant");
    expect(jugerConfigurationStripe({ secretKey: "sk_x", webhookSecret: "whsec_x", prix: {} }).configuration)
      .toBe("prix_manquants");
  });

  it("nomme les tarifs manquants, il ne les compte pas seulement", () => {
    const e = jugerConfigurationStripe({
      secretKey: "sk_x", webhookSecret: "whsec_x",
      prix: { ...tousLesPrix, STRIPE_PRICE_SOLO_MONTHLY: undefined },
    });
    expect(e.prixManquants).toEqual(["STRIPE_PRICE_SOLO_MONTHLY"]);
    expect(e.message).toContain("STRIPE_PRICE_SOLO_MONTHLY");
  });

  // Le webhook absent est sournois : les paiements passent, et personne ne
  // s'aperçoit que rien n'est enregistré.
  it("explique la conséquence d'un webhook manquant", () => {
    const e = jugerConfigurationStripe({ secretKey: "sk_x", prix: tousLesPrix });
    expect(e.message).toContain("qui a payé");
  });

  it("ne prend pas une chaîne vide pour une clé", () => {
    expect(jugerConfigurationStripe({ secretKey: "  ", webhookSecret: "whsec_x", prix: tousLesPrix }).configuration)
      .toBe("cle_manquante");
  });
});

describe("messageAucunAbonne", () => {
  const branche = jugerConfigurationStripe({
    secretKey: "sk_x", webhookSecret: "whsec_x", prix: tousLesPrix,
  });

  // « Aucun abonné » sur une plateforme en beta n'est pas une panne : c'est le
  // modèle d'affaires. Sans ce chiffre, on cherche un défaut inexistant.
  it("dit combien d'entreprises sont en beta ou en essai", () => {
    const m = messageAucunAbonne(branche, { beta: 5, essai: 1 });
    expect(m).toContain("branché");
    expect(m).toContain("5 en accès beta");
    expect(m).toContain("1 en période d'essai");
  });

  it("reste sobre quand il n'y a personne du tout", () => {
    expect(messageAucunAbonne(branche, { beta: 0, essai: 0 })).toContain("Aucune entreprise");
  });

  // Si Stripe est vraiment débranché, c'est ÇA qu'il faut dire.
  it("dit le vrai problème quand il y en a un", () => {
    const casse = jugerConfigurationStripe({ prix: {} });
    expect(messageAucunAbonne(casse, { beta: 5, essai: 1 })).toContain("clé secrète");
  });
});
