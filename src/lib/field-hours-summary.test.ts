import { describe, expect, it } from "vitest";
import {
  comparerPrevuEtReel,
  debutDeSemaine,
  semainesDeLEmploye,
  totalGeneral,
  totalParChantier,
  totalParEmploye,
  totalParSemaine,
  type LigneHeures,
} from "./field-hours-summary";

const l = (
  employeeId: string,
  employeeName: string,
  scheduledJobId: string,
  jobLabel: string,
  workDate: string,
  hours: number,
): LigneHeures => ({ employeeId, employeeName, scheduledJobId, jobLabel, workDate, hours });

const LIGNES = [
  l("e1", "Marc", "j1", "Rénovation Tremblay", "2026-08-24", 8),
  l("e1", "Marc", "j1", "Rénovation Tremblay", "2026-08-25", 7.5),
  l("e1", "Marc", "j2", "Urgence Côté", "2026-08-31", 4),
  l("e2", "Julie", "j1", "Rénovation Tremblay", "2026-08-24", 6),
];

describe("debutDeSemaine", () => {
  it("ramène au lundi", () => {
    expect(debutDeSemaine("2026-08-29")).toBe("2026-08-24"); // samedi → lundi
    expect(debutDeSemaine("2026-08-24")).toBe("2026-08-24"); // lundi → lui-même
  });

  it("range le dimanche dans la semaine qui s'achève", () => {
    // Le piège : new Date("2026-08-30") est interprété en UTC et décale d'un
    // jour à l'ouest de Greenwich, faisant basculer le dimanche soir dans la
    // mauvaise semaine.
    expect(debutDeSemaine("2026-08-30")).toBe("2026-08-24");
  });

  it("traverse un changement de mois", () => {
    expect(debutDeSemaine("2026-09-01")).toBe("2026-08-31");
  });
});

describe("totalGeneral", () => {
  it("additionne tout", () => {
    expect(totalGeneral(LIGNES)).toBe(25.5);
  });

  it("rend zéro sans saisie", () => {
    expect(totalGeneral([])).toBe(0);
  });
});

describe("totalParEmploye", () => {
  it("cumule par personne et compte les jours travaillés", () => {
    const r = totalParEmploye(LIGNES);
    expect(r[0]).toEqual({ employeeId: "e1", employeeName: "Marc", hours: 19.5, jours: 3 });
    expect(r[1]).toEqual({ employeeId: "e2", employeeName: "Julie", hours: 6, jours: 1 });
  });

  it("classe du plus d'heures au moins", () => {
    expect(totalParEmploye(LIGNES).map((r) => r.employeeName)).toEqual(["Marc", "Julie"]);
  });

  it("ne compte pas deux fois un même jour sur deux chantiers", () => {
    const memeJour = [
      l("e1", "Marc", "j1", "A", "2026-08-24", 4),
      l("e1", "Marc", "j2", "B", "2026-08-24", 4),
    ];
    expect(totalParEmploye(memeJour)[0]).toEqual({
      employeeId: "e1",
      employeeName: "Marc",
      hours: 8,
      jours: 1,
    });
  });
});

describe("totalParChantier", () => {
  it("cumule par chantier et compte les employés distincts", () => {
    const r = totalParChantier(LIGNES);
    expect(r[0]).toEqual({
      scheduledJobId: "j1",
      jobLabel: "Rénovation Tremblay",
      hours: 21.5,
      employes: 2,
    });
    expect(r[1].hours).toBe(4);
  });
});

describe("totalParSemaine", () => {
  it("regroupe par lundi, du plus récent au plus ancien", () => {
    expect(totalParSemaine(LIGNES)).toEqual([
      { debut: "2026-08-31", hours: 4 },
      { debut: "2026-08-24", hours: 21.5 },
    ]);
  });
});

describe("semainesDeLEmploye", () => {
  it("isole une personne", () => {
    expect(semainesDeLEmploye(LIGNES, "e2")).toEqual([{ debut: "2026-08-24", hours: 6 }]);
  });
});

describe("arrondi", () => {
  it("évite les traînées de virgule flottante", () => {
    const tiers = [
      l("e1", "Marc", "j1", "A", "2026-08-24", 0.1),
      l("e1", "Marc", "j1", "A", "2026-08-25", 0.2),
    ];
    expect(totalGeneral(tiers)).toBe(0.3);
  });
});

describe("comparerPrevuEtReel", () => {
  it("met le prévu et le réel côte à côte, avec l'écart", () => {
    const r = comparerPrevuEtReel(
      [{ cle: "e1", libelle: "Marc", hours: 8 }],
      [{ cle: "e1", libelle: "Marc", hours: 9.5 }],
    );
    expect(r[0]).toEqual({ cle: "e1", libelle: "Marc", prevu: 8, reel: 9.5, ecart: 1.5 });
  });

  it("garde un chantier planifié sans heures saisies", () => {
    // Le masquer cacherait précisément l'écart qu'on cherche : du travail
    // prévu que personne n'a fait.
    const r = comparerPrevuEtReel([{ cle: "j1", libelle: "Toiture", hours: 16 }], []);
    expect(r[0]).toEqual({ cle: "j1", libelle: "Toiture", prevu: 16, reel: 0, ecart: -16 });
  });

  it("garde des heures saisies sans planification", () => {
    const r = comparerPrevuEtReel([], [{ cle: "j2", libelle: "Urgence", hours: 4 }]);
    expect(r[0]).toEqual({ cle: "j2", libelle: "Urgence", prevu: 0, reel: 4, ecart: 4 });
  });

  it("additionne plusieurs lignes d'une même clé", () => {
    const r = comparerPrevuEtReel(
      [
        { cle: "e1", libelle: "Marc", hours: 4 },
        { cle: "e1", libelle: "Marc", hours: 4 },
      ],
      [{ cle: "e1", libelle: "Marc", hours: 7 }],
    );
    expect(r[0].prevu).toBe(8);
    expect(r[0].ecart).toBe(-1);
  });

  it("rend une liste vide sans données", () => {
    expect(comparerPrevuEtReel([], [])).toEqual([]);
  });
});
