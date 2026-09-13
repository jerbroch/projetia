import { describe, expect, it } from "vitest";
import { messageDuChoix, raisonDuChoix } from "@/lib/billing/raison-du-choix";

describe("raisonDuChoix", () => {
  it("UN COMPTE NEUF N'A PAS D'ESSAI TERMINÉ", () => {
    // `cancelled` est l'état INITIAL d'une inscription, pas un état de fin —
    // auth.ts le pose avec access_type "pending". Une version antérieure en
    // déduisait « essai terminé », et tout nouveau venu lisait « Les 30 jours
    // d'essai de <entreprise> sont écoulés » à sa première visite.
    expect(
      raisonDuChoix({
        subscriptionStatus: "cancelled",
        accessType: "pending",
        requiresAccessChoice: true,
        tier: null,
        trialEndsAt: null,
      }),
    ).toBe("premiere-visite");
  });

  it("un essai terminé demande une date d'essai passée", () => {
    const hier = new Date(Date.now() - 86400000).toISOString();
    expect(
      raisonDuChoix({ subscriptionStatus: "cancelled", trialEndsAt: hier, tier: "solo" }),
    ).toBe("essai-termine");
  });

  it("un essai encore en cours n'est pas terminé", () => {
    const demain = new Date(Date.now() + 86400000).toISOString();
    expect(
      raisonDuChoix({ subscriptionStatus: "cancelled", trialEndsAt: demain, tier: "solo" }),
    ).toBe("abonnement-fini");
  });

  it("un abonnement arrêté se reconnaît à son palier", () => {
    expect(raisonDuChoix({ subscriptionStatus: "cancelled", tier: "entrepreneur" })).toBe(
      "abonnement-fini",
    );
  });

  it("quelqu'un qui a encore accès vient changer de forfait", () => {
    expect(raisonDuChoix({ subscriptionStatus: "active" })).toBe("changement");
    expect(raisonDuChoix({ subscriptionStatus: "trial" })).toBe("changement");
  });

  it("un nouveau venu est une première visite", () => {
    expect(raisonDuChoix({ subscriptionStatus: null, accessType: "pending" })).toBe("premiere-visite");
  });

  it("rend « première visite » plutôt que d'inventer, faute de signal", () => {
    expect(raisonDuChoix({})).toBe("premiere-visite");
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
