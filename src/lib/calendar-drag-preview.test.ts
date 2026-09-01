import { describe, expect, it } from "vitest";
import {
  apercuDeplacement,
  apercuRedimensionnement,
  apercuRedimensionnementDebut,
  gaucheEnPixels,
  largeurEnPixels,
  pixelsEnMinutes,
} from "./calendar-drag-preview";
import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  HOUR_WIDTH,
  MIN_JOB_MINUTES,
  resizeEventEnd,
  resizeEventStart,
} from "@/lib/calendar-utils";
import { isoToZonedMinutes } from "@/lib/schedule-timezone";
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
    expect(apercuRedimensionnement(DEBUT, FIN, 50 * HOUR_WIDTH).endMinutes).toBe(
      CALENDAR_END_HOUR * 60,
    );
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
        // isoToZonedMinutes lit l'heure DU QUÉBEC, comme toute l'application.
        // `new Date(...).getHours()` lisait celle de la machine : les tests
        // passaient chez moi et échouaient en intégration continue, qui tourne
        // en UTC — 1320 minutes attendues, 1080 reçues.
        expect(apercu.endMinutes).toBe(isoToZonedMinutes(enregistre.end));
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
    expect(apercuDeplacement(DEBUT, FIN, 2 * 60).startMinutes).toBe(CALENDAR_START_HOUR * 60);
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

  it("place la première heure affichée à l'origine", () => {
    expect(gaucheEnPixels(CALENDAR_START_HOUR * 60)).toBe(0);
    expect(gaucheEnPixels((CALENDAR_START_HOUR + 1) * 60)).toBe(HOUR_WIDTH);
  });
});

describe("apercuRedimensionnementDebut", () => {
  it("recule le début vers la gauche", () => {
    expect(apercuRedimensionnementDebut(DEBUT, FIN, -2 * HOUR_WIDTH)).toEqual({
      startMinutes: 7 * 60,
      endMinutes: FIN,
    });
  });

  it("avance le début vers la droite", () => {
    expect(apercuRedimensionnementDebut(DEBUT, FIN, 2 * HOUR_WIDTH).startMinutes).toBe(11 * 60);
  });

  it("laisse la fin immobile", () => {
    // C'est ce qui distingue le bord gauche du déplacement : la fin est le
    // point fixe.
    for (const delta of [-3 * HOUR_WIDTH, HOUR_WIDTH, 5 * HOUR_WIDTH]) {
      expect(apercuRedimensionnementDebut(DEBUT, FIN, delta).endMinutes).toBe(FIN);
    }
  });

  it("ne franchit jamais la fin", () => {
    // Sans cette borne, tirer loin vers la droite dessinerait un bloc inversé.
    const r = apercuRedimensionnementDebut(DEBUT, FIN, 30 * HOUR_WIDTH);
    expect(r.startMinutes).toBe(FIN - MIN_JOB_MINUTES);
  });

  it("reste dans la journée affichée", () => {
    expect(apercuRedimensionnementDebut(DEBUT, FIN, -30 * HOUR_WIDTH).startMinutes).toBe(
      CALENDAR_START_HOUR * 60,
    );
  });

  it("donne le MÊME résultat que l'enregistrement", () => {
    const jour = new Date(2026, 7, 31);
    const event = {
      start: "2026-08-31T13:00:00.000Z",
      end: "2026-08-31T21:00:00.000Z",
    } as ScheduleEvent;

    for (const delta of [-HOUR_WIDTH, -3 * HOUR_WIDTH, HOUR_WIDTH, 30 * HOUR_WIDTH]) {
      const apercu = apercuRedimensionnementDebut(DEBUT, FIN, delta);
      const enregistre = resizeEventStart(event, DEBUT + pixelsEnMinutes(delta), jour);
        expect(apercu.startMinutes).toBe(isoToZonedMinutes(enregistre.start));
    }
  });
});

describe("apercuDeplacement — l'endroit de la prise", () => {
  const DEB = 9 * 60;   // 09:00
  const FIN = 13 * 60;  // 13:00, donc un bloc de 4 h

  it("laisse le call sur place quand on le relâche sans bouger", () => {
    // Le cœur du défaut : saisi au centre (2 h après son début) et relâché au
    // même endroit, le call sautait à 11:00. Il doit rester à 09:00.
    const curseur = DEB + 120;
    expect(apercuDeplacement(DEB, FIN, curseur, 120)).toEqual({
      startMinutes: DEB,
      endMinutes: FIN,
    });
  });

  it("décale d'exactement ce que la main a parcouru", () => {
    // Prise au centre, curseur avancé d'une heure : le call avance d'une heure.
    const curseur = DEB + 120 + 60;
    expect(apercuDeplacement(DEB, FIN, curseur, 120).startMinutes).toBe(DEB + 60);
  });

  it("donne le même résultat quel que soit le point de prise", () => {
    // Trois mains différentes sur le même bloc, un même déplacement d'une
    // heure : trois fois le même résultat. C'est ce qui manquait.
    const uneHeurePlusLoin = (ecart: number) =>
      apercuDeplacement(DEB, FIN, DEB + ecart + 60, ecart).startMinutes;
    expect(uneHeurePlusLoin(0)).toBe(DEB + 60);
    expect(uneHeurePlusLoin(36)).toBe(DEB + 60);
    expect(uneHeurePlusLoin(120)).toBe(DEB + 60);
    expect(uneHeurePlusLoin(240)).toBe(DEB + 60);
  });

  it("conserve la durée", () => {
    const p = apercuDeplacement(DEB, FIN, DEB + 300, 120);
    expect(p.endMinutes - p.startMinutes).toBe(FIN - DEB);
  });

  it("reste dans la journée même si la prise pousse avant l'ouverture", () => {
    // Bloc pris par la fin et tiré tout à gauche : on borne, on ne sort pas.
    const p = apercuDeplacement(DEB, FIN, 0, 240);
    expect(p.startMinutes).toBeGreaterThanOrEqual(CALENDAR_START_HOUR * 60);
    expect(p.endMinutes - p.startMinutes).toBe(FIN - DEB);
  });

  it("sans écart fourni, se comporte comme avant", () => {
    expect(apercuDeplacement(DEB, FIN, 11 * 60).startMinutes).toBe(11 * 60);
  });
});
