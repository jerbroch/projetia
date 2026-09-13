import { describe, expect, it } from "vitest";
import { messageDuChoix, raisonDuChoix } from "@/lib/billing/raison-du-choix";

describe("raisonDuChoix", () => {
  it("un essai terminé n'est pas une première visite", () => {
    expect(raisonDuChoix({ subscriptionStatus: "cancelled", aDejaPaye: false })).toBe("essai-termine");
  });

  it("un abonnement arrêté se distingue d'un essai terminé", () => {
    // Ce n'est pas la même nouvelle à annoncer.
    expect(raisonDuChoix({ subscriptionStatus: "cancelled", aDejaPaye: true })).toBe("abonnement-fini");
  });

  it("quelqu'un qui a encore accès vient changer de forfait", () => {
    expect(raisonDuChoix({ subscriptionStatus: "active" })).toBe("changement");
    expect(raisonDuChoix({ subscriptionStatus: "trial" })).toBe("changement");
  });

  it("un nouveau venu est une première visite", () => {
    expect(raisonDuChoix({ subscriptionStatus: null, accessType: "pending" })).toBe("premiere-visite");
  });
});

describe("messageDuChoix", () => {
  it("dit ce qui s'est passé, pas « bienvenue »", () => {
    const m = messageDuChoix("essai-termine", "Plomberie Goutte d'Eau");
    expect(m.titre).toBe("Votre essai est terminé");
    expect(m.explication).toContain("30 jours");
    expect(m.explication).not.toContain("Bienvenue");
  });

  it("rassure sur ce qui est conservé", () => {
    // C'est ce qu'on craint devant un mur de paiement : avoir tout perdu.
    for (const r of ["essai-termine", "abonnement-fini"] as const) {
      expect(messageDuChoix(r, "X").rassurance).toContain("Rien n'est effacé");
    }
  });

  it("annonce l'essai gratuit à un nouveau venu", () => {
    expect(messageDuChoix("premiere-visite", "X").rassurance).toContain("30 premiers jours");
  });

  it("ne rassure pas inutilement celui qui change de forfait", () => {
    expect(messageDuChoix("changement", "X").rassurance).toBeNull();
  });
});
