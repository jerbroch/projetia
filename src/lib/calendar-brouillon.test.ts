import { describe, expect, it } from "vitest";
import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  MIN_JOB_MINUTES,
} from "@/lib/calendar-utils";
import {
  DUREE_BROUILLON_PAR_DEFAUT,
  creerBrouillon,
  dureeLisible,
  libelleBrouillon,
} from "@/lib/calendar-brouillon";
import {
  apercuDeplacement,
  apercuRedimensionnement,
  apercuRedimensionnementDebut,
} from "@/lib/calendar-drag-preview";
import { HOUR_WIDTH } from "@/lib/calendar-utils";

describe("creerBrouillon", () => {
  it("pose deux heures là où on a touché", () => {
    expect(creerBrouillon(9 * 60)).toEqual({ startMinutes: 540, endMinutes: 660 });
  });

  it("aimante au quart d'heure", () => {
    // Le doigt ne vise pas à la minute près.
    expect(creerBrouillon(9 * 60 + 7).startMinutes).toBe(9 * 60);
    expect(creerBrouillon(9 * 60 + 8).startMinutes).toBe(9 * 60 + 15);
  });

  it("recule le début plutôt que d'écraser la durée en fin de journée", () => {
    // Un rectangle de dix minutes ne se saisit pas au doigt.
    const tard = creerBrouillon((CALENDAR_END_HOUR - 1) * 60);
    expect(tard.endMinutes).toBe(CALENDAR_END_HOUR * 60);
    expect(tard.endMinutes - tard.startMinutes).toBe(DUREE_BROUILLON_PAR_DEFAUT);
  });

  it("ne sort jamais de la grille", () => {
    for (const minute of [0, 60, CALENDAR_START_HOUR * 60, CALENDAR_END_HOUR * 60, 24 * 60]) {
      const p = creerBrouillon(minute);
      expect(p.startMinutes).toBeGreaterThanOrEqual(CALENDAR_START_HOUR * 60);
      expect(p.endMinutes).toBeLessThanOrEqual(CALENDAR_END_HOUR * 60);
      expect(p.endMinutes - p.startMinutes).toBeGreaterThanOrEqual(MIN_JOB_MINUTES);
    }
  });
});

describe("le brouillon se manipule comme un vrai call", () => {
  // C'est le point : les MÊMES fonctions d'aperçu servent au brouillon et aux
  // calls existants. Un calcul séparé finirait par diverger, et l'aperçu
  // mentirait sur ce qui va être enregistré.
  const depart = creerBrouillon(9 * 60);

  it("suit le curseur, en gardant sa durée", () => {
    // `apercuDeplacement` est piloté par la position sous le curseur, pas par
    // un delta : en vue semaine, cette position désigne AUSSI le jour visé.
    const apres = apercuDeplacement(depart.startMinutes, depart.endMinutes, 10 * 60);
    expect(apres).toEqual({ startMinutes: 10 * 60, endMinutes: 12 * 60 });
  });

  it("retient l'écart entre le bord du bloc et la main", () => {
    // Sans cet écart, le bloc saute pour se centrer sous le doigt.
    const apres = apercuDeplacement(depart.startMinutes, depart.endMinutes, 10 * 60, 30);
    expect(apres.startMinutes).toBe(9 * 60 + 30);
  });

  it("s'étire par la fin", () => {
    const apres = apercuRedimensionnement(depart.startMinutes, depart.endMinutes, HOUR_WIDTH);
    expect(apres.endMinutes).toBe(12 * 60);
    expect(apres.startMinutes).toBe(9 * 60);
  });

  it("s'étire par le début", () => {
    const apres = apercuRedimensionnementDebut(depart.startMinutes, depart.endMinutes, -HOUR_WIDTH);
    expect(apres.startMinutes).toBe(8 * 60);
    expect(apres.endMinutes).toBe(11 * 60);
  });

  it("ne descend jamais sous la durée minimale", () => {
    const ecrase = apercuRedimensionnement(depart.startMinutes, depart.endMinutes, -20 * HOUR_WIDTH);
    expect(ecrase.endMinutes - ecrase.startMinutes).toBeGreaterThanOrEqual(MIN_JOB_MINUTES);
  });
});

describe("ce que le rectangle annonce", () => {
  it("écrit l'heure de début et de fin", () => {
    expect(libelleBrouillon({ startMinutes: 540, endMinutes: 660 })).toBe("09:00 – 11:00");
  });

  it("dit la durée sans faire compter", () => {
    expect(dureeLisible({ startMinutes: 540, endMinutes: 660 })).toBe("2 h");
    expect(dureeLisible({ startMinutes: 540, endMinutes: 630 })).toBe("1 h 30");
    expect(dureeLisible({ startMinutes: 540, endMinutes: 585 })).toBe("45 min");
  });
});
