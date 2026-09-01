import { describe, expect, it } from "vitest";
import {
  libelleDeSoumission,
  prefillDepuisSoumission,
  soumissionsProposables,
} from "./prefill-travail-depuis-soumission";
import type { Customer, Quote } from "@/types";

const CLIENT = {
  id: "c1",
  companyId: "co",
  name: "Marie Gagnon",
  email: "marie@videotron.ca",
  phone: "418-555-0101",
  address: "118, rue Saint-Joseph, Lévis",
  company: "",
  status: "active",
  totalProjects: 0,
  createdAt: "2026-01-01",
} as unknown as Customer;

const soumission = (over: Partial<Quote> = {}) =>
  ({
    id: "q1",
    companyId: "co",
    quoteNumber: "SO-2026-0141",
    customerId: "c1",
    customerName: "Marie Gagnon",
    customerEmail: "marie@videotron.ca",
    title: "Réfection plomberie — 2 salles de bain",
    description: "Chauffe-eau, PEX, robinetterie",
    amount: 7567,
    status: "accepted",
    createdAt: "2026-09-01",
    costEstimation: {
      labor: [
        { id: "l1", category: "compagnon", hours: 24, hourlyRate: 125, workerCount: 1, total: 3000 },
        { id: "l2", category: "apprenti", hours: 24, hourlyRate: 85, workerCount: 1, total: 2040 },
      ],
      materials: [],
      fees: [],
    },
    ...over,
  }) as unknown as Quote;

describe("soumissionsProposables", () => {
  it("écarte les refusées et les expirées", () => {
    // Proposer une soumission refusée n'a aucun sens : le client a dit non.
    const l = soumissionsProposables([
      soumission({ id: "a", status: "accepted" as Quote["status"] }),
      soumission({ id: "b", status: "rejected" as Quote["status"] }),
      soumission({ id: "c", status: "expired" as Quote["status"] }),
      soumission({ id: "d", status: "draft" as Quote["status"] }),
    ]);
    expect(l.map((q) => q.id)).toEqual(["a", "d"]);
  });

  it("garde les brouillons — on planifie parfois avant l'acceptation", () => {
    const l = soumissionsProposables([soumission({ status: "draft" as Quote["status"] })]);
    expect(l).toHaveLength(1);
  });

  it("montre la plus récente en premier", () => {
    const l = soumissionsProposables([
      soumission({ id: "vieille", createdAt: "2026-01-01" }),
      soumission({ id: "neuve", createdAt: "2026-09-01" }),
    ]);
    expect(l[0].id).toBe("neuve");
  });

  it("ne lève pas sur une liste vide", () => {
    expect(soumissionsProposables([])).toEqual([]);
  });
});

describe("libelleDeSoumission", () => {
  it("met le numéro en premier — c'est par lui qu'on cherche", () => {
    expect(libelleDeSoumission(soumission())).toMatch(/^SO-2026-0141 —/);
  });

  it("affiche le montant à la québécoise", () => {
    const l = libelleDeSoumission(soumission()).replace(/[  ]/g, " ");
    expect(l).toContain("7 567,00 $");
  });

  it("préfère le prix proposé au montant brut", () => {
    const l = libelleDeSoumission(soumission({ proposedAmount: 8000 })).replace(/[  ]/g, " ");
    expect(l).toContain("8 000,00 $");
  });
});

describe("prefillDepuisSoumission", () => {
  it("reprend le titre et la description", () => {
    const p = prefillDepuisSoumission(soumission(), [CLIENT]);
    expect(p.title).toBe("Réfection plomberie — 2 salles de bain");
    expect(p.description).toBe("Chauffe-eau, PEX, robinetterie");
  });

  it("va chercher l'adresse chez le CLIENT, que la soumission ne porte pas", () => {
    const p = prefillDepuisSoumission(soumission(), [CLIENT]);
    expect(p.jobSiteAddress).toBe("118, rue Saint-Joseph, Lévis");
    expect(p.customerPhone).toBe("418-555-0101");
  });

  it("totalise les heures chiffrées", () => {
    expect(prefillDepuisSoumission(soumission(), [CLIENT]).estimatedHours).toBe(48);
  });

  it("garde le courriel de la soumission plutôt que celui de la fiche", () => {
    // C'est à cette adresse que la soumission est partie ; la fiche a pu
    // changer depuis.
    const p = prefillDepuisSoumission(
      soumission({ customerEmail: "envoye-a@test.ca" }),
      [{ ...CLIENT, email: "fiche@test.ca" } as Customer],
    );
    expect(p.customerEmail).toBe("envoye-a@test.ca");
  });

  it("retombe sur la fiche quand la soumission n'a pas de courriel", () => {
    const p = prefillDepuisSoumission(soumission({ customerEmail: "" }), [CLIENT]);
    expect(p.customerEmail).toBe("marie@videotron.ca");
  });

  it("retrouve le client par son nom quand l'identifiant manque", () => {
    // Les soumissions anciennes portent parfois un nom sans lien vers la fiche.
    const p = prefillDepuisSoumission(
      soumission({ customerId: "" as Quote["customerId"] }),
      [CLIENT],
    );
    expect(p.jobSiteAddress).toBe("118, rue Saint-Joseph, Lévis");
    expect(p.customerId).toBe("c1");
  });

  it("ne laisse aucun champ à undefined quand le client est introuvable", () => {
    const p = prefillDepuisSoumission(soumission(), []);
    expect(p.jobSiteAddress).toBe("");
    expect(p.customerPhone).toBe("");
    expect(p.customerName).toBe("Marie Gagnon");
  });

  it("porte l'instantané qui relie le travail à la soumission", () => {
    const p = prefillDepuisSoumission(soumission(), [CLIENT]);
    expect(p.snapshot.quoteId).toBe("q1");
    expect(p.snapshot.quoteNumber).toBe("SO-2026-0141");
  });
});
