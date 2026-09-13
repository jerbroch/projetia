import { describe, expect, it } from "vitest";
import { corpsAvis, sujetAvis } from "@/lib/email/avis-abonnement";

const base = {
  nomEntreprise: "Plomberie Goutte d'Eau",
  tier: "entrepreneur",
  cycle: "monthly",
  montantCents: 14999,
  devise: "cad",
  statutStripe: "active",
} as const;

describe("sujetAvis — l'essentiel dans le sujet", () => {
  it("nomme l'événement, l'entreprise et le palier", () => {
    // Beaucoup de courriels ne sont lus que dans la liste.
    expect(sujetAvis({ ...base, evenement: "abonnement" })).toBe(
      "Nouvel abonnement — Plomberie Goutte d'Eau (Entrepreneur)",
    );
    expect(sujetAvis({ ...base, evenement: "annulation" })).toContain("Annulation —");
    expect(sujetAvis({ ...base, evenement: "echec_paiement" })).toContain("Paiement refusé —");
  });
});

describe("corpsAvis", () => {
  it("porte l'entreprise, le palier et le montant", () => {
    const h = corpsAvis({ ...base, evenement: "abonnement" });
    // L'apostrophe n'est pas échappée : elle est sans danger dans un nœud de
    // texte, et l'échapper rendrait le courriel moins lisible en clair.
    expect(h).toContain("Plomberie Goutte d'Eau");
    expect(h).toContain("Entrepreneur");
    expect(h).toContain("mensuel");
    expect(h).toMatch(/149,99/);
  });

  it("omet le montant plutôt que d'afficher zéro", () => {
    for (const montantCents of [0, null, undefined, Number.NaN]) {
      const h = corpsAvis({ ...base, evenement: "annulation", montantCents });
      expect(h).not.toContain("Montant");
    }
  });

  it("dit ce qui se passe ensuite, différemment selon l'événement", () => {
    expect(corpsAvis({ ...base, evenement: "annulation" })).toContain("fin de la période déjà payée");
    expect(corpsAvis({ ...base, evenement: "echec_paiement" })).toContain("relancera");
    expect(corpsAvis({ ...base, evenement: "abonnement" })).toContain("Rien à faire");
  });

  it("échappe le nom de l'entreprise", () => {
    const h = corpsAvis({ ...base, evenement: "abonnement", nomEntreprise: "<script>x</script>" });
    expect(h).not.toContain("<script>");
    expect(h).toContain("&lt;script&gt;");
  });

  it("reste lisible quand le palier est inconnu", () => {
    const h = corpsAvis({ ...base, evenement: "abonnement", tier: null, cycle: null });
    expect(h).toContain("Palier");
    expect(h).not.toContain("null");
  });
});
