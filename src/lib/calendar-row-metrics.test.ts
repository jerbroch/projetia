import { describe, expect, it } from "vitest";
import {
  LIGNE_PADDING,
  ROW_HEIGHT,
  VOIE_MIN,
  metriquesDeLigne,
} from "@/lib/calendar-utils";

describe("metriquesDeLigne", () => {
  it("garde une ligne compacte quand rien ne se chevauche", () => {
    expect(metriquesDeLigne(1).rowHeight).toBe(ROW_HEIGHT);
  });

  it("UN BLOC NE DÉPASSE JAMAIS SA LIGNE", () => {
    // C'est l'invariant que les deux anciennes formules violaient : à trois
    // calls superposés, le dernier bloc sortait de sa ligne.
    for (let voies = 1; voies <= 12; voies++) {
      const m = metriquesDeLigne(voies);
      const basDuDernier = m.top(voies - 1) + m.laneHeight;
      expect(basDuDernier).toBeLessThanOrEqual(m.rowHeight - LIGNE_PADDING);
    }
  });

  it("les blocs ne se chevauchent pas entre eux", () => {
    const m = metriquesDeLigne(4);
    for (let voie = 0; voie < 3; voie++) {
      expect(m.top(voie) + m.laneHeight).toBeLessThanOrEqual(m.top(voie + 1));
    }
  });

  it("ne descend jamais sous la hauteur visable à la souris", () => {
    // Un bloc plus court serait impossible à attraper et son texte
    // disparaîtrait entièrement.
    for (let voies = 1; voies <= 20; voies++) {
      expect(metriquesDeLigne(voies).laneHeight).toBeGreaterThanOrEqual(VOIE_MIN);
    }
  });

  it("agrandit la ligne plutôt que d'écraser les blocs", () => {
    const compacte = metriquesDeLigne(1).rowHeight;
    const chargee = metriquesDeLigne(5).rowHeight;
    expect(chargee).toBeGreaterThan(compacte);
  });

  it("supporte un décompte absurde", () => {
    expect(metriquesDeLigne(0).laneHeight).toBeGreaterThan(0);
    expect(metriquesDeLigne(-3).rowHeight).toBe(ROW_HEIGHT);
  });
});
