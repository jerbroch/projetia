import { describe, expect, it } from "vitest";
import {
  apercuDeplacement,
  apercuRedimensionnement,
  gaucheEnPixels,
  largeurEnPixels,
  pixelsEnMinutes,
} from "./calendar-drag-preview";
import { HOUR_WIDTH, MIN_JOB_MINUTES, resizeEventEnd } from "@/lib/calendar-utils";
import type { ScheduleEvent } from "@/types";

const DEBUT = 9 * 60; // 09:00
const FIN = 17 * 60; // 17:00

describe("pixelsEnMinutes", () => {
  it("convertit une heure de large", () => {
    expect(pixelsEnMinutes(HOUR_WIDTH)).toBe(60);
  });

  it("arrondit au quart d'heure", () => {
    // Sans arrondi, l'aperçu afficherait 09:07 puis 09:08 : illisible, et
    // différent de ce qui serait enregistré.
    expect(pixelsEnMinutes(HOUR_WIDTH / 4)).toBe(15);
    expect(pixelsEnMinutes(HOUR_WIDTH / 8)).toBe(15);
    expect(pixelsEnMinutes(1)).toBe(0);
  });

  it("gère le sens inverse", () => {
    expect(pixelsEnMinutes(-HOUR_WIDTH)).toBe(-60);
  });
});

describe("apercuRedimensionnement", () => {
  it("allonge vers la droite", () => {
    expect(apercuRedimensionnement(DEBUT, FIN, HOUR_WIDTH)).toEqual({
      startMinutes: DEBUT,
      endMinutes: 18 * 60,
    });
  });

  it("raccourcit vers la gauche", () => {
    expect(apercuRedimensionnement(DEBUT, FIN, -2 * HOUR_WIDTH).endMinutes).toBe(15 * 60);
  });

  it("ne descend jamais sous la durée minimale", () => {
    // Tirer loin vers la gauche dessinerait sinon un bloc de largeur négative.
    const r = apercuRedimensionnement(DEBUT, FIN, -20 * HOUR_WIDTH);
    expect(r.endMinutes).toBe(DEBUT + MIN_JOB_MINUTES);
  });

  it("reste dans la journée affichée", () => {
    expect(apercuRedimensionnement(DEBUT, FIN, 50 * HOUR_WIDTH).endMinutes).toBe(20 * 60);
  });

  it("donne le MÊME résultat que l'enregistrement", () => {
    // C'est la propriété qui compte : un aperçu qui diffère ferait sauter le
    // bloc au relâchement.
    const jour = new Date(2026, 7, 31);
    const event = {
      start: "2026-08-31T13:00:00.000Z",
      end: "2026-08-31T21:00:00.000Z",
    } as ScheduleEvent;

    for (const delta of [HOUR_WIDTH, -HOUR_WIDTH, 3 * HOUR_WIDTH, -20 * HOUR_WIDTH]) {
      const apercu = apercuRedimensionnement(DEBUT, FIN, delta);
      const enregistre = resizeEventEnd(event, FIN + pixelsEnMinutes(delta), jour);
      const finEnregistree = new Date(enregistre.end);
      const minutes =
        finEnregistree.getHours() * 60 + finEnregistree.getMinutes();
      expect(apercu.endMinutes).toBe(minutes);
    }
  });
});

describe("apercuDeplacement", () => {
  it("cale le début sur le curseur et garde la durée", () => {
    expect(apercuDeplacement(DEBUT, FIN, 11 * 60)).toEqual({
      startMinutes: 11 * 60,
      endMinutes: 19 * 60,
    });
  });

  it("borne le début à la journée affichée", () => {
    expect(apercuDeplacement(DEBUT, FIN, 2 * 60).startMinutes).toBe(6 * 60);
  });

  it("conserve une durée minimale sur un bloc dégénéré", () => {
    expect(apercuDeplacement(DEBUT, DEBUT, 10 * 60).endMinutes).toBe(10 * 60 + MIN_JOB_MINUTES);
  });
});

describe("conversions en pixels", () => {
  it("mesure une plage de deux heures", () => {
    expect(largeurEnPixels({ startMinutes: DEBUT, endMinutes: 11 * 60 })).toBe(2 * HOUR_WIDTH);
  });

  it("garde une largeur visible sur une plage nulle", () => {
    // Un bloc de zéro pixel disparaîtrait sous le curseur pendant le geste.
    expect(largeurEnPixels({ startMinutes: DEBUT, endMinutes: DEBUT })).toBeGreaterThan(0);
  });

  it("place 06:00 à l'origine", () => {
    expect(gaucheEnPixels(6 * 60)).toBe(0);
    expect(gaucheEnPixels(7 * 60)).toBe(HOUR_WIDTH);
  });
});
