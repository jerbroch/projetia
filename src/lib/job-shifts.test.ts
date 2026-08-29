import { describe, expect, it } from "vitest";
import {
  decalageDuCall,
  decalerPlage,
  dureeEnHeures,
  heuresPrevues,
  plageDeLEmploye,
  plagesDuCall,
  refusDePlage,
  type JobShift,
} from "./job-shifts";

const CALL_DEBUT = "2026-08-31T13:00:00.000Z"; // 9 h heure de l'Est
const CALL_FIN = "2026-08-31T21:00:00.000Z"; // 17 h

const shift = (employeeId: string, startAt: string, endAt: string): JobShift => ({
  id: `s-${employeeId}`,
  scheduledJobId: "j1",
  employeeId,
  startAt,
  endAt,
});

describe("dureeEnHeures", () => {
  it("mesure une plage ordinaire", () => {
    expect(dureeEnHeures(CALL_DEBUT, CALL_FIN)).toBe(8);
  });

  it("rend zéro sur une plage inversée ou vide", () => {
    // Une durée négative se propagerait en silence dans tous les cumuls.
    expect(dureeEnHeures(CALL_FIN, CALL_DEBUT)).toBe(0);
    expect(dureeEnHeures(CALL_DEBUT, CALL_DEBUT)).toBe(0);
  });

  it("rend zéro sur une date illisible", () => {
    expect(dureeEnHeures("pas une date", CALL_FIN)).toBe(0);
  });
});

describe("plageDeLEmploye", () => {
  it("rend sa plage propre quand elle existe", () => {
    const s = [shift("e1", "2026-08-31T12:00:00.000Z", "2026-08-31T16:00:00.000Z")];
    const p = plageDeLEmploye("e1", s, CALL_DEBUT, CALL_FIN);
    expect(p.start).toBe("2026-08-31T12:00:00.000Z");
    expect(p.heriteeDuCall).toBe(false);
  });

  it("retombe sur la plage du call sans plage propre", () => {
    // C'est ce repli qui laisse les calls existants se comporter comme avant,
    // sans qu'on ait inventé une planification que personne n'a saisie.
    const p = plageDeLEmploye("e2", [], CALL_DEBUT, CALL_FIN);
    expect(p.start).toBe(CALL_DEBUT);
    expect(p.end).toBe(CALL_FIN);
    expect(p.heriteeDuCall).toBe(true);
  });

  it("ne confond pas deux employés", () => {
    const s = [shift("e1", "2026-08-31T12:00:00.000Z", "2026-08-31T16:00:00.000Z")];
    expect(plageDeLEmploye("e2", s, CALL_DEBUT, CALL_FIN).heriteeDuCall).toBe(true);
  });
});

describe("plagesDuCall", () => {
  it("classe les employés par heure d'arrivée", () => {
    const s = [
      shift("e2", "2026-08-31T17:00:00.000Z", "2026-08-31T21:00:00.000Z"), // après-midi
      shift("e1", "2026-08-31T12:00:00.000Z", "2026-08-31T16:00:00.000Z"), // matin
    ];
    expect(plagesDuCall(["e1", "e2"], s, CALL_DEBUT, CALL_FIN).map((p) => p.employeeId)).toEqual([
      "e1",
      "e2",
    ]);
  });

  it("mêle ceux qui ont une plage et ceux qui héritent", () => {
    const s = [shift("e1", "2026-08-31T12:00:00.000Z", "2026-08-31T16:00:00.000Z")];
    const r = plagesDuCall(["e1", "e2"], s, CALL_DEBUT, CALL_FIN);
    expect(r.map((p) => p.heriteeDuCall)).toEqual([false, true]);
  });
});

describe("heuresPrevues", () => {
  it("compte la plage propre", () => {
    const s = [shift("e1", "2026-08-31T13:00:00.000Z", "2026-08-31T17:00:00.000Z")];
    expect(heuresPrevues("e1", s, CALL_DEBUT, CALL_FIN)).toBe(4);
  });

  it("compte la plage du call à défaut", () => {
    expect(heuresPrevues("e2", [], CALL_DEBUT, CALL_FIN)).toBe(8);
  });
});

describe("décalage quand un call bouge", () => {
  it("garde les écarts relatifs entre employés", () => {
    // Un gars à 8 h et un autre à 13 h doivent rester à cinq heures d'écart.
    const matin = shift("e1", "2026-08-31T12:00:00.000Z", "2026-08-31T16:00:00.000Z");
    const apresMidi = shift("e2", "2026-08-31T17:00:00.000Z", "2026-08-31T21:00:00.000Z");
    const d = decalageDuCall(CALL_DEBUT, "2026-08-31T15:00:00.000Z"); // +2 h
    const m = decalerPlage(matin, d);
    const a = decalerPlage(apresMidi, d);
    expect(m.startAt).toBe("2026-08-31T14:00:00.000Z");
    expect(a.startAt).toBe("2026-08-31T19:00:00.000Z");
    expect(Date.parse(a.startAt) - Date.parse(m.startAt)).toBe(5 * 3_600_000);
  });

  it("préserve la durée de chaque plage", () => {
    const s = shift("e1", "2026-08-31T12:00:00.000Z", "2026-08-31T16:00:00.000Z");
    const d = decalerPlage(s, 3 * 3_600_000);
    expect(dureeEnHeures(d.startAt, d.endAt)).toBe(4);
  });

  it("supporte un déplacement vers l'arrière", () => {
    const s = shift("e1", "2026-08-31T12:00:00.000Z", "2026-08-31T16:00:00.000Z");
    const d = decalerPlage(s, decalageDuCall(CALL_DEBUT, "2026-08-31T11:00:00.000Z"));
    expect(d.startAt).toBe("2026-08-31T10:00:00.000Z");
  });

  it("rend un décalage nul sur une date illisible", () => {
    expect(decalageDuCall("n'importe quoi", CALL_DEBUT)).toBe(0);
  });
});

describe("refusDePlage", () => {
  it("accepte une plage à l'intérieur du call", () => {
    expect(refusDePlage("2026-08-31T14:00:00.000Z", "2026-08-31T18:00:00.000Z", CALL_DEBUT, CALL_FIN)).toBeNull();
  });

  it("accepte une plage égale au call", () => {
    expect(refusDePlage(CALL_DEBUT, CALL_FIN, CALL_DEBUT, CALL_FIN)).toBeNull();
  });

  it("refuse une fin avant le début", () => {
    expect(refusDePlage(CALL_FIN, CALL_DEBUT, CALL_DEBUT, CALL_FIN)).toMatch(/après le début/);
  });

  it("refuse un débordement hors du call", () => {
    // Un rectangle qui dépasse laisserait croire à des heures planifiées hors
    // du travail prévu.
    expect(refusDePlage("2026-08-31T11:00:00.000Z", "2026-08-31T18:00:00.000Z", CALL_DEBUT, CALL_FIN))
      .toMatch(/à l'intérieur/);
    expect(refusDePlage("2026-08-31T14:00:00.000Z", "2026-08-31T23:00:00.000Z", CALL_DEBUT, CALL_FIN))
      .toMatch(/à l'intérieur/);
  });

  it("refuse une date illisible", () => {
    expect(refusDePlage("bof", CALL_FIN, CALL_DEBUT, CALL_FIN)).toMatch(/illisible/);
  });
});
