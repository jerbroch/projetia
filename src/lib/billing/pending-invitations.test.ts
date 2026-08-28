import { describe, expect, it } from "vitest";
import {
  activationRefusedMessage,
  countPendingInvitations,
  invitationHoldsSeat,
  INVITATION_SEAT_HOLD_DAYS,
} from "./pending-invitations";

const MAINTENANT = new Date("2026-08-28T12:00:00.000Z");
const ilYA = (jours: number) =>
  new Date(MAINTENANT.getTime() - jours * 24 * 60 * 60 * 1000).toISOString();

describe("invitationHoldsSeat", () => {
  it("retient une place tant que l'invitation est fraîche", () => {
    expect(invitationHoldsSeat({ invitedAt: ilYA(0) }, MAINTENANT)).toBe(true);
    expect(invitationHoldsSeat({ invitedAt: ilYA(7) }, MAINTENANT)).toBe(true);
    expect(invitationHoldsSeat({ invitedAt: ilYA(13.9) }, MAINTENANT)).toBe(true);
  });

  it("cesse de retenir au-delà du délai", () => {
    // Sans ça, une invitation jamais acceptée bloquerait une place à jamais :
    // rien ne fait changer son statut si la personne ne clique pas.
    expect(invitationHoldsSeat({ invitedAt: ilYA(14.1) }, MAINTENANT)).toBe(false);
    expect(invitationHoldsSeat({ invitedAt: ilYA(60) }, MAINTENANT)).toBe(false);
  });

  it("utilise bien quatorze jours", () => {
    expect(INVITATION_SEAT_HOLD_DAYS).toBe(14);
  });

  it("ne compte pas une invitation déjà acceptée", () => {
    // La personne a un profil actif : elle est comptée à ce titre. La compter
    // deux fois retirerait une place à chaque employé qui accepte.
    expect(invitationHoldsSeat({ invitedAt: ilYA(1), enabled: true }, MAINTENANT)).toBe(false);
  });

  it("ne compte pas un employé jamais invité", () => {
    expect(invitationHoldsSeat({ invitedAt: null }, MAINTENANT)).toBe(false);
    expect(invitationHoldsSeat({}, MAINTENANT)).toBe(false);
  });

  it("retient la place sur une date future plutôt que d'ouvrir une brèche", () => {
    // Horloge décalée ou saisie manuelle : on préfère réserver à tort que
    // laisser dépasser la limite.
    const futur = new Date(MAINTENANT.getTime() + 86400000).toISOString();
    expect(invitationHoldsSeat({ invitedAt: futur }, MAINTENANT)).toBe(true);
  });

  it("ignore une date illisible", () => {
    expect(invitationHoldsSeat({ invitedAt: "pas une date" }, MAINTENANT)).toBe(false);
    expect(invitationHoldsSeat({ invitedAt: "" }, MAINTENANT)).toBe(false);
  });

  it("accepte un délai différent, pour les tests et un réglage futur", () => {
    expect(invitationHoldsSeat({ invitedAt: ilYA(5) }, MAINTENANT, 3)).toBe(false);
    expect(invitationHoldsSeat({ invitedAt: ilYA(5) }, MAINTENANT, 30)).toBe(true);
  });
});

describe("countPendingInvitations", () => {
  it("ne compte que les invitations qui retiennent encore", () => {
    const lignes = [
      { invitedAt: ilYA(1) },                    // compte
      { invitedAt: ilYA(10) },                   // compte
      { invitedAt: ilYA(20) },                   // périmée
      { invitedAt: ilYA(2), enabled: true },     // acceptée
      { invitedAt: null },                       // jamais invitée
    ];
    expect(countPendingInvitations(lignes, MAINTENANT)).toBe(2);
  });

  it("rend zéro sur une liste vide", () => {
    expect(countPendingInvitations([], MAINTENANT)).toBe(0);
  });
});

describe("activationRefusedMessage", () => {
  it("dit à l'employé que ce n'est pas de sa faute", () => {
    const m = activationRefusedMessage("Plomberie Goutte d'eau");
    expect(m).toContain("rien à corriger de votre côté");
  });

  it("le renvoie vers son employeur, nommé", () => {
    const m = activationRefusedMessage("Plomberie Goutte d'eau");
    expect(m).toContain("Plomberie Goutte d'eau");
    expect(m).toContain("contactez");
  });

  it("ne lui suggère jamais de réessayer", () => {
    // Réessayer, redemander un lien ou recréer un compte ne changeraient rien :
    // seul l'employeur peut débloquer la situation.
    const m = activationRefusedMessage("Une entreprise").toLowerCase();
    expect(m).not.toContain("réessay");
    expect(m).not.toContain("nouveau lien");
  });

  it("rassure sur la validité de l'invitation", () => {
    expect(activationRefusedMessage("X")).toContain("reste valide");
  });

  it("reste lisible sans nom d'entreprise", () => {
    const m = activationRefusedMessage(null);
    expect(m).toContain("votre employeur");
    expect(m).not.toContain("null");
  });
});
