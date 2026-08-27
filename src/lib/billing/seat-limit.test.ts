import { describe, expect, it } from "vitest";
import { seatLimitMessage, seatUsage, seatWarningMessage } from "./seat-limit";

const usageFor = (activeProfiles: number, tier: string | null, pending = 0) =>
  seatUsage({ activeProfiles, pendingInvitations: pending }, tier);

describe("seatUsage — les limites de chaque palier", () => {
  it.each([
    ["solo", 1],
    ["entreprise", 5],
    ["entrepreneur", 15],
  ])("%s inclut %i places", (tier, limit) => {
    expect(usageFor(1, tier).limit).toBe(limit);
  });

  it("croissance est illimité", () => {
    const usage = usageFor(200, "croissance");
    expect(usage.isUnlimited).toBe(true);
    expect(usage.limit).toBeNull();
    expect(usage.remaining).toBeNull();
    expect(usage.isFull).toBe(false);
    expect(usage.isOverLimit).toBe(false);
  });

  it("un palier absent retombe sur une seule place", () => {
    // Une entreprise sans abonnement ne doit pas hériter d'un accès illimité.
    expect(usageFor(1, null).limit).toBe(1);
    expect(usageFor(1, null).isFull).toBe(true);
    expect(usageFor(1, "palier_inexistant").limit).toBe(1);
  });
});

describe("seatUsage — le propriétaire occupe une place", () => {
  it("un compte Solo tout neuf est déjà plein", () => {
    // Le propriétaire est le seul profil actif : la place unique est prise.
    const usage = usageFor(1, "solo");
    expect(usage.used).toBe(1);
    expect(usage.remaining).toBe(0);
    expect(usage.isFull).toBe(true);
    expect(usage.isOverLimit).toBe(false);
  });

  it("Entreprise avec le propriétaire seul laisse 4 places", () => {
    const usage = usageFor(1, "entreprise");
    expect(usage.remaining).toBe(4);
    expect(usage.isFull).toBe(false);
    expect(usage.isLastSeat).toBe(false);
  });
});

describe("seatUsage — l'avertissement arrive avant le blocage", () => {
  it("signale la dernière place, une avant le refus", () => {
    const avant = usageFor(3, "entreprise");
    const derniere = usageFor(4, "entreprise");
    const plein = usageFor(5, "entreprise");

    expect(avant.isLastSeat).toBe(false);
    expect(derniere.isLastSeat).toBe(true);
    expect(derniere.isFull).toBe(false); // on peut encore inviter
    expect(plein.isLastSeat).toBe(false);
    expect(plein.isFull).toBe(true);
  });
});

describe("seatUsage — surnombre après une descente de palier", () => {
  it("distingue « plein » de « au-delà »", () => {
    const plein = usageFor(5, "entreprise");
    const surnombre = usageFor(8, "entreprise");

    expect(plein.isFull).toBe(true);
    expect(plein.isOverLimit).toBe(false);

    expect(surnombre.isFull).toBe(true);
    expect(surnombre.isOverLimit).toBe(true);
    expect(surnombre.used).toBe(8);
  });

  it("ne rend jamais un reste négatif", () => {
    expect(usageFor(8, "entreprise").remaining).toBe(0);
  });
});

describe("seatUsage — les invitations en attente réservent une place", () => {
  it("comptent comme des places occupées", () => {
    // Sinon un compte Solo enverrait cinquante invitations et se retrouverait
    // à cinquante personnes le jour où elles sont acceptées.
    const usage = usageFor(3, "entreprise", 2);
    expect(usage.used).toBe(5);
    expect(usage.isFull).toBe(true);
  });

  it("valent zéro tant que la migration des invitations n'est pas là", () => {
    expect(seatUsage({ activeProfiles: 3 }, "entreprise").used).toBe(3);
  });

  it("ignore des décomptes négatifs", () => {
    expect(seatUsage({ activeProfiles: -5, pendingInvitations: -2 }, "solo").used).toBe(0);
  });
});

describe("seatLimitMessage — le refus", () => {
  it("nomme le palier, les places et la sortie", () => {
    const message = seatLimitMessage(usageFor(5, "entreprise"), "entreprise");
    expect(message).toContain("Entreprise");
    expect(message).toContain("5 places");
    expect(message).toContain("/choose-plan?upgrade=1");
    expect(message).toContain("retirez l'accès");
  });

  it("rassure sur ce qui est conservé quand on retire un accès", () => {
    // Un entrepreneur doit savoir qu'il ne perd pas le dossier de l'employé.
    const message = seatLimitMessage(usageFor(1, "solo"), "solo");
    expect(message).toContain("fiche employé");
    expect(message).toContain("1 place");
  });

  it("dit le surnombre plutôt que « toutes occupées »", () => {
    const message = seatLimitMessage(usageFor(8, "entreprise"), "entreprise");
    expect(message).toContain("8 sont occupées");
  });

  it("reste lisible sans palier connu", () => {
    const message = seatLimitMessage(usageFor(1, null), null);
    expect(message).toContain("Votre abonnement");
    expect(message).toContain("/choose-plan?upgrade=1");
  });
});

describe("seatWarningMessage — l'avertissement en amont", () => {
  it("ne dit rien quand il reste de la marge", () => {
    expect(seatWarningMessage(usageFor(2, "entreprise"), "entreprise")).toBeNull();
    expect(seatWarningMessage(usageFor(1, "entrepreneur"), "entrepreneur")).toBeNull();
  });

  it("ne dit jamais rien en illimité", () => {
    expect(seatWarningMessage(usageFor(500, "croissance"), "croissance")).toBeNull();
  });

  it("prévient à la dernière place, avant tout blocage", () => {
    const message = seatWarningMessage(usageFor(4, "entreprise"), "entreprise");
    expect(message).toContain("reste 1 place sur 5");
    expect(message).toContain("/choose-plan?upgrade=1");
  });

  it("signale la limite atteinte", () => {
    const message = seatWarningMessage(usageFor(5, "entreprise"), "entreprise");
    expect(message).toContain("Vous occupez les 5 places");
  });

  it("explique le surnombre sans annoncer de coupure", () => {
    // Point important : après une descente, personne ne perd son accès.
    const message = seatWarningMessage(usageFor(8, "entreprise"), "entreprise") ?? "";
    expect(message).toContain("8 utilisateurs");
    expect(message).toContain("gardent leur accès");
    expect(message).toContain("retirer 3");
  });

  it("accorde le singulier quand une seule personne est en trop", () => {
    const message = seatWarningMessage(usageFor(6, "entreprise"), "entreprise") ?? "";
    expect(message).toContain("retirer un");
  });
});
