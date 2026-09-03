import { describe, expect, it } from "vitest";
import { prochaineAction, riensAFaire, statutsDeCorrection } from "@/lib/prochaine-action";
import type { JobWorkflowStatus } from "@/lib/job-workflow";
import type { ProfileRole } from "@/types";

const bureau: ProfileRole = "owner";

function call(
  status: JobWorkflowStatus,
  extra: { submittedForReviewAt?: string; approvedAt?: string } = {},
) {
  return {
    status,
    submittedForReviewAt: extra.submittedForReviewAt,
    approvedAt: extra.approvedAt,
  };
}

const neuf = { factureExiste: false, factureEnvoyee: false };
const avecFacture = { factureExiste: true, factureEnvoyee: false };
const facturePartie = { factureExiste: true, factureEnvoyee: true };

describe("prochaineAction", () => {
  it("propose une seule suite à chaque état du parcours", () => {
    const parcours: [JobWorkflowStatus, string][] = [
      ["scheduled", "demarrer"],
      ["en-route", "demarrer"],
      ["in-progress", "terminer"],
      ["completed", "approuver"],
      ["pending-review", "approuver"],
      ["ready-to-invoice", "generer"],
    ];

    parcours.forEach(([statut, cle]) => {
      expect(prochaineAction(call(statut), { role: bureau, ...neuf })?.cle).toBe(cle);
    });
  });

  // C'est le cul-de-sac trouvé le 2 septembre : un call terminé sans marque de
  // soumission n'avait de bouton d'approbation NULLE PART, pendant que la
  // génération de facture en exigeait une.
  it("approuve un call terminé même sans marque de soumission", () => {
    const sansSoumission = call("completed");
    expect(prochaineAction(sansSoumission, { role: bureau, ...neuf })?.cle).toBe("approuver");
  });

  it("passe de générer à envoyer dès que la facture existe", () => {
    const pret = call("ready-to-invoice", { approvedAt: "2026-09-02T00:00:00Z" });
    expect(prochaineAction(pret, { role: bureau, ...neuf })?.cle).toBe("generer");
    expect(prochaineAction(pret, { role: bureau, ...avecFacture })?.cle).toBe("envoyer");
  });

  // Le cas FA-2026-007 : la facture existait, le statut disait « envoyée », et
  // aucun courriel n'était parti.
  it("offre encore l'envoi sur un call marqué envoyé sans courriel derrière", () => {
    const marqueeAlaMain = call("invoice-sent");
    const action = prochaineAction(marqueeAlaMain, { role: bureau, ...avecFacture });
    expect(action?.cle).toBe("envoyer");
    expect(action?.aide).toContain("Aucun courriel");
  });

  it("passe à payer une fois le courriel réellement parti", () => {
    expect(
      prochaineAction(call("invoice-sent"), { role: bureau, ...facturePartie })?.cle,
    ).toBe("payer");
  });

  it("ne propose plus rien sur un call payé ou annulé", () => {
    expect(prochaineAction(call("paid"), { role: bureau, ...facturePartie })).toBeNull();
    expect(prochaineAction(call("cancelled"), { role: bureau, ...neuf })).toBeNull();
    expect(riensAFaire("paid")).toContain("payé");
    expect(riensAFaire("cancelled")).toContain("annulé");
    expect(riensAFaire("in-progress")).toBeNull();
  });

  it("nomme l'action, jamais le statut", () => {
    const statuts: JobWorkflowStatus[] = [
      "scheduled",
      "in-progress",
      "completed",
      "ready-to-invoice",
      "invoice-sent",
    ];
    statuts.forEach((s) => {
      const a = prochaineAction(call(s), { role: bureau, ...avecFacture });
      if (!a) return;
      // Un libellé qui est un nom d'état force à connaître la machine à états.
      expect(["À vérifier", "Prêt à facturer", "Facture envoyée", "Payé"]).not.toContain(a.libelle);
      expect(a.aide.length).toBeGreaterThan(0);
    });
  });

  it("respecte les rôles", () => {
    // Le comptable ne touche pas au terrain.
    expect(prochaineAction(call("scheduled"), { role: "accountant", ...neuf })).toBeNull();
    // Il peut envoyer une facture.
    expect(
      prochaineAction(call("ready-to-invoice"), { role: "accountant", ...avecFacture })?.cle,
    ).toBe("envoyer");
    // Il n'approuve pas.
    expect(prochaineAction(call("completed"), { role: "accountant", ...neuf })).toBeNull();
  });
});

describe("statutsDeCorrection", () => {
  it("n'offre jamais « facture envoyée » à la main", () => {
    const statuts: JobWorkflowStatus[] = [
      "scheduled",
      "in-progress",
      "completed",
      "ready-to-invoice",
      "invoice-sent",
      "paid",
    ];
    statuts.forEach((s) => {
      expect(statutsDeCorrection(call(s), bureau)).not.toContain("invoice-sent");
    });
  });

  it("n'offre pas l'état où l'on est déjà", () => {
    expect(statutsDeCorrection(call("in-progress"), bureau)).not.toContain("in-progress");
    expect(statutsDeCorrection(call("en-route"), bureau)).not.toContain("en-route");
  });

  it("ne propose rien sur un call annulé", () => {
    expect(statutsDeCorrection(call("cancelled"), bureau)).toEqual([]);
  });

  it("limite le comptable", () => {
    expect(statutsDeCorrection(call("completed"), "accountant")).not.toContain("in-progress");
  });
});
