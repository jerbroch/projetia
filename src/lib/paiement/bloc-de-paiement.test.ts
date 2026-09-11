import { describe, expect, it } from "vitest";
import { blocDePaiement } from "@/lib/paiement/bloc-de-paiement";

const interac = {
  enabled: true,
  email: "paiements@plomberie.ca",
  recipientName: "Plomberie Goutte d'Eau",
  securityQuestion: "Nom de la rue du chantier ?",
  securityAnswer: "Sainte-Catherine",
  instructions: "Merci de payer dans les 30 jours.",
};

describe("blocDePaiement — jamais un bloc vide", () => {
  it("rend null quand rien n'est configuré", () => {
    expect(blocDePaiement({ interac: null, reference: null, afficherLaReponse: false })).toBeNull();
    expect(blocDePaiement({ interac: undefined, reference: "", afficherLaReponse: false })).toBeNull();
  });

  it("rend null quand Interac est désactivé et qu'il n'y a pas de référence", () => {
    expect(
      blocDePaiement({ interac: { ...interac, enabled: false }, reference: null, afficherLaReponse: false })
    ).toBeNull();
  });

  it("rend null quand le courriel est vide, même activé", () => {
    expect(
      blocDePaiement({ interac: { enabled: true, email: "   " }, reference: null, afficherLaReponse: false })
    ).toBeNull();
  });

  it("garde la référence seule quand Interac est éteint", () => {
    // Un entrepreneur peut n'avoir configuré aucun virement et vouloir quand
    // même que son numéro soit inscrit au message.
    const bloc = blocDePaiement({
      interac: { enabled: false },
      reference: "SO-2026-002",
      afficherLaReponse: false,
    });
    expect(bloc?.etapes).toHaveLength(1);
    expect(bloc?.etapes[0].reference).toBe("SO-2026-002");
  });
});

describe("blocDePaiement — la réponse de sécurité", () => {
  it("ne l'écrit JAMAIS sur une soumission", () => {
    const bloc = blocDePaiement({ interac, reference: "SO-2026-002", afficherLaReponse: false });
    const tout = JSON.stringify(bloc);
    expect(tout).toContain("Nom de la rue du chantier ?");
    // Écrire la réponse sous la question, dans le même envoi, annule la question.
    expect(tout).not.toContain("Sainte-Catherine");
  });

  it("l'écrit sur une facture — comportement d'avant, dette notée", () => {
    const bloc = blocDePaiement({ interac, reference: "FA-2026-007", afficherLaReponse: true });
    expect(JSON.stringify(bloc)).toContain("Sainte-Catherine");
  });
});

describe("blocDePaiement — le contenu", () => {
  it("porte les trois étapes et la référence mise en évidence", () => {
    const bloc = blocDePaiement({
      interac,
      reference: "SO-2026-002",
      montant: 1149.75,
      afficherLaReponse: false,
    });
    expect(bloc?.titre).toBe("Comment payer");
    expect(bloc?.etapes).toHaveLength(3);
    expect(bloc?.etapes[1].texte).toContain("paiements@plomberie.ca");
    expect(bloc?.etapes[1].texte).toContain("Plomberie Goutte d'Eau");
    expect(bloc?.etapes[2].reference).toBe("SO-2026-002");
    expect(bloc?.instructions).toBe("Merci de payer dans les 30 jours.");
    expect(bloc?.montant).toBe(1149.75);
  });

  it("ignore un montant absent, nul ou aberrant", () => {
    for (const montant of [undefined, null, 0, -5, Number.NaN]) {
      const bloc = blocDePaiement({ interac, reference: "SO-1", montant, afficherLaReponse: false });
      expect(bloc?.montant).toBeUndefined();
    }
  });

  it("n'invente pas d'instructions quand le champ est vide", () => {
    const bloc = blocDePaiement({
      interac: { ...interac, instructions: "   " },
      reference: "SO-1",
      afficherLaReponse: false,
    });
    expect(bloc?.instructions).toBeUndefined();
  });
});
