import { describe, expect, it } from "vitest";
import {
  dateCourte,
  libelleRetour,
  lienItineraire,
  outilsARetourner,
  pluriel,
  prenomDe,
  salutation,
} from "@/lib/terrain-aujourdhui";
import type { ToolListItem } from "@/types";

function outil(p: Partial<ToolListItem> = {}): ToolListItem {
  return {
    id: "t1",
    companyId: "c1",
    name: "Perceuse",
    category: "Perçage",
    condition: "good",
    baseStatus: "available",
    effectiveStatus: "assigned",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...p,
  } as ToolListItem;
}

describe("saluer quelqu'un par son nom", () => {
  it("prend le prénom seul", () => {
    expect(prenomDe("Marc Tremblay")).toBe("Marc");
    expect(salutation("Marc Tremblay")).toBe("Bonjour, Marc");
  });

  it("supporte un nom manquant sans écrire « Bonjour, undefined »", () => {
    expect(salutation(null)).toBe("Bonjour");
    expect(salutation("   ")).toBe("Bonjour");
    expect(prenomDe(undefined)).toBe("");
  });

  it("tolère les espaces multiples", () => {
    expect(prenomDe("  Jean-Luc   Picard ")).toBe("Jean-Luc");
  });
});

describe("l'itinéraire", () => {
  it("encode l'adresse pour l'application de cartes du téléphone", () => {
    expect(lienItineraire("125, rue des Érables, Montréal, QC")).toBe(
      "https://maps.google.com/?q=125%2C%20rue%20des%20%C3%89rables%2C%20Montr%C3%A9al%2C%20QC",
    );
  });

  it("ne propose rien sans adresse — un bouton mort vaut moins que pas de bouton", () => {
    expect(lienItineraire(null)).toBeNull();
    expect(lienItineraire("  ")).toBeNull();
  });
});

describe("les outils à rapporter", () => {
  const today = "2026-09-18";

  it("compte ceux dont l'échéance est atteinte", () => {
    const liste = [
      outil({ id: "a", expectedReturnDate: "2026-09-18" }),
      outil({ id: "b", expectedReturnDate: "2026-09-25" }),
    ];
    expect(outilsARetourner(liste, today).map((o) => o.id)).toEqual(["a"]);
  });

  it("compte AUSSI les retards — c'est celui-là qu'on oublie", () => {
    const liste = [outil({ id: "a", expectedReturnDate: "2026-09-15", daysOverdue: 3 })];
    expect(outilsARetourner(liste, today)).toHaveLength(1);
  });

  it("ignore un outil sans date de retour", () => {
    expect(outilsARetourner([outil({ expectedReturnDate: undefined })], today)).toHaveLength(0);
  });
});

describe("ce que dit la date de retour", () => {
  const today = "2026-09-18";

  it("nomme aujourd'hui plutôt que de donner une date à décoder", () => {
    expect(libelleRetour({ expectedReturnDate: today }, today)).toBe("Retour prévu aujourd'hui");
  });

  it("annonce le retard, au singulier comme au pluriel", () => {
    expect(libelleRetour({ expectedReturnDate: "2026-09-17", daysOverdue: 1 }, today)).toBe(
      "En retard de 1 jour",
    );
    expect(libelleRetour({ expectedReturnDate: "2026-09-15", daysOverdue: 3 }, today)).toBe(
      "En retard de 3 jours",
    );
  });

  it("donne la date courte pour plus tard", () => {
    expect(libelleRetour({ expectedReturnDate: "2026-09-21" }, today)).toBe(
      "Retour prévu le 21 sept.",
    );
  });

  it("le dit quand il n'y a pas de date", () => {
    expect(libelleRetour({ expectedReturnDate: undefined }, today)).toBe("Sans date de retour");
  });
});

describe("les détails qui font douter du reste", () => {
  it("accorde les comptes", () => {
    expect(pluriel(1, "intervention")).toBe("intervention");
    expect(pluriel(2, "intervention")).toBe("interventions");
    expect(pluriel(0, "intervention")).toBe("interventions");
    expect(pluriel(1, "outil")).toBe("outil");
  });

  it("écrit les mois en abrégé français", () => {
    expect(dateCourte("2026-09-21")).toBe("21 sept.");
    expect(dateCourte("2026-01-03")).toBe("3 janv.");
    expect(dateCourte("2026-12-31")).toBe("31 déc.");
  });
});
