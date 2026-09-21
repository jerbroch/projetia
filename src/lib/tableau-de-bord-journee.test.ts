import { describe, expect, it } from "vitest";
import {
  aFacturer,
  aPlanifier,
  dateDuJourEnLettres,
  equipesActives,
  heureCourte,
  initialesDe,
  outilsEnRetard,
  travauxDuJour,
} from "@/lib/tableau-de-bord-journee";
import type { Quote, ScheduleEvent, ToolListItem } from "@/types";

function call(p: Partial<ScheduleEvent> & { id: string; start: string }): ScheduleEvent {
  return {
    companyId: "c1",
    title: `Call ${p.id}`,
    end: p.start,
    status: "scheduled",
    type: "job",
    employeeIds: [],
    employeeNames: [],
    ...p,
  } as unknown as ScheduleEvent;
}

describe("les travaux du jour", () => {
  it("ne garde que la journée demandée", () => {
    const events = [
      call({ id: "a", start: "2026-09-21T11:30:00Z" }),
      call({ id: "b", start: "2026-09-22T11:30:00Z" }),
    ];
    expect(travauxDuJour(events, "2026-09-21").map((e) => e.id)).toEqual(["a"]);
  });

  it("les classe par heure", () => {
    const events = [
      call({ id: "tard", start: "2026-09-21T17:00:00Z" }),
      call({ id: "tot", start: "2026-09-21T11:30:00Z" }),
    ];
    expect(travauxDuJour(events, "2026-09-21").map((e) => e.id)).toEqual(["tot", "tard"]);
  });

  it("écarte les travaux annulés", () => {
    const events = [call({ id: "x", start: "2026-09-21T11:30:00Z", status: "cancelled" })];
    expect(travauxDuJour(events, "2026-09-21")).toHaveLength(0);
  });

  it("la journée est celle de l'entreprise, pas celle du serveur", () => {
    // 01 h 30 UTC le 22 = 21 h 30 le 21 à Montréal.
    const events = [call({ id: "soir", start: "2026-09-22T01:30:00Z" })];
    expect(travauxDuJour(events, "2026-09-21").map((e) => e.id)).toEqual(["soir"]);
  });
});

describe("les équipes actives", () => {
  it("compte les CHANTIERS en cours, pas les têtes", () => {
    // Deux hommes sur le même chantier font une équipe, pas deux.
    const maintenant = new Date("2026-09-21T14:00:00Z");
    const events = [
      call({
        id: "un",
        start: "2026-09-21T12:00:00Z",
        end: "2026-09-21T20:00:00Z",
        status: "in-progress",
        employeeIds: ["e1", "e2"],
        employeeNames: ["Marc A", "Alex B"],
      }),
    ];
    expect(equipesActives(events, maintenant)).toBe(1);
  });

  it("ne compte rien quand personne n'est dehors", () => {
    expect(equipesActives([], new Date("2026-09-21T14:00:00Z"))).toBe(0);
  });
});

describe("ce qui attend une décision", () => {
  const devis = (id: string, status: Quote["status"]) => ({ id, status }) as Quote;

  it("une soumission acceptée sans travail au calendrier est à planifier", () => {
    const quotes = [devis("q1", "accepted"), devis("q2", "draft")];
    expect(aPlanifier(quotes, []).map((q) => q.id)).toEqual(["q1"]);
  });

  it("un dépôt payé compte aussi — le client a dit oui deux fois", () => {
    expect(aPlanifier([devis("q1", "deposit_paid")], []).map((q) => q.id)).toEqual(["q1"]);
  });

  it("une soumission DÉJÀ planifiée n'attend plus personne", () => {
    const events = [call({ id: "j", start: "2026-09-21T11:00:00Z", quoteId: "q1" })];
    expect(aPlanifier([devis("q1", "accepted")], events)).toHaveLength(0);
  });

  it("un travail annulé ne compte pas comme planifié", () => {
    const events = [
      call({ id: "j", start: "2026-09-21T11:00:00Z", quoteId: "q1", status: "cancelled" }),
    ];
    expect(aPlanifier([devis("q1", "accepted")], events)).toHaveLength(1);
  });

  it("à facturer : on lit le statut, on ne le devine pas", () => {
    const events = [
      call({ id: "a", start: "2026-09-21T11:00:00Z", status: "ready-to-invoice" }),
      call({ id: "b", start: "2026-09-21T11:00:00Z", status: "completed" }),
    ];
    expect(aFacturer(events).map((e) => e.id)).toEqual(["a"]);
  });

  it("outils en retard : seulement ceux qui le sont vraiment", () => {
    const outils = [
      { id: "t1", daysOverdue: 2 },
      { id: "t2", daysOverdue: 0 },
      { id: "t3" },
    ] as ToolListItem[];
    expect(outilsEnRetard(outils).map((o) => o.id)).toEqual(["t1"]);
  });
});

describe("les détails d'affichage", () => {
  it("prend deux initiales au plus", () => {
    expect(initialesDe("Marc Antoine")).toBe("MA");
    expect(initialesDe("Samuel Lavoie Tremblay")).toBe("SL");
    expect(initialesDe("Alex")).toBe("A");
    expect(initialesDe("  ")).toBe("?");
  });

  it("écrit la date comme on la dit", () => {
    expect(dateDuJourEnLettres(new Date("2026-09-21T16:00:00Z"))).toBe("Lundi 21 septembre");
  });

  it("donne l'heure dans le fuseau de l'entreprise", () => {
    // 11 h 30 UTC = 7 h 30 à Montréal.
    expect(heureCourte("2026-09-21T11:30:00Z")).toBe("07:30");
  });
});
