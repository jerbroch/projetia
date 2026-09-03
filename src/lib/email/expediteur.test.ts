import { afterEach, describe, expect, it } from "vitest";
import {
  adresseDeReponse,
  adresseExpediteur,
  corpsResend,
  EXPEDITEUR_DE_REPLI,
} from "@/lib/email/expediteur";

const original = process.env.RESEND_FROM_EMAIL;
afterEach(() => {
  if (original === undefined) delete process.env.RESEND_FROM_EMAIL;
  else process.env.RESEND_FROM_EMAIL = original;
});

describe("adresseExpediteur", () => {
  it("prend la variable d'environnement quand elle est posée", () => {
    process.env.RESEND_FROM_EMAIL = "Construction iOS <info@constructionios.com>";
    expect(adresseExpediteur()).toBe("Construction iOS <info@constructionios.com>");
  });

  it("retombe sur le domaine de Resend plutôt que d'échouer", () => {
    delete process.env.RESEND_FROM_EMAIL;
    expect(adresseExpediteur()).toBe(EXPEDITEUR_DE_REPLI);
  });
});

describe("adresseDeReponse", () => {
  it("dirige la réponse vers le courriel de l'entreprise", () => {
    expect(adresseDeReponse("jerome@exemple.com")).toBe("jerome@exemple.com");
  });

  // Mieux vaut aucun Reply-To qu'un Reply-To vide : le client répondrait alors
  // à l'expéditeur, dont le domaine n'a pas de MX, et sa réponse rebondirait.
  it("n'invente rien quand l'entreprise n'a pas de courriel", () => {
    expect(adresseDeReponse(undefined)).toBeUndefined();
    expect(adresseDeReponse(null)).toBeUndefined();
    expect(adresseDeReponse("   ")).toBeUndefined();
  });

  it("nettoie les espaces autour de l'adresse", () => {
    expect(adresseDeReponse("  jerome@exemple.com  ")).toBe("jerome@exemple.com");
  });
});

describe("corpsResend", () => {
  it("assemble un envoi complet", () => {
    process.env.RESEND_FROM_EMAIL = "Construction iOS <info@constructionios.com>";
    const corps = corpsResend({
      to: "client@exemple.com",
      subject: "Facture FA-2026-007",
      html: "<p>Bonjour</p>",
      replyTo: "jerome@exemple.com",
    });
    expect(corps).toEqual({
      from: "Construction iOS <info@constructionios.com>",
      to: ["client@exemple.com"],
      subject: "Facture FA-2026-007",
      html: "<p>Bonjour</p>",
      reply_to: ["jerome@exemple.com"],
    });
  });

  it("omet reply_to plutôt que de l'envoyer vide", () => {
    const corps = corpsResend({ to: "a@b.com", subject: "S", html: "<p>x</p>" });
    expect(corps).not.toHaveProperty("reply_to");
  });
});
