import { describe, expect, it } from "vitest";
import {
  DUREE_EMPRUNT_PAR_DEFAUT_JOURS,
  estUnePriseSimultanee,
  noteApresRetour,
  peutPrendreLOutil,
  reservationQuiBloque,
  retourProposeParDefaut,
  retourSignaleUnProbleme,
  saReservation,
} from "@/lib/outils-terrain";
import type { ToolAssignment } from "@/types";

const MOI = "employe-1";
const COLLEGUE = "employe-2";

function outil(p: Partial<Parameters<typeof peutPrendreLOutil>[0]> = {}) {
  return {
    name: "Perceuse",
    baseStatus: "available" as const,
    effectiveStatus: "available" as const,
    currentEmployeeId: undefined,
    ...p,
  };
}

function assignation(p: Partial<ToolAssignment> = {}): ToolAssignment {
  return {
    id: "a1",
    companyId: "c1",
    toolId: "t1",
    employeeId: COLLEGUE,
    startDate: "2026-09-20",
    expectedReturnDate: "2026-09-25",
    status: "reserved",
    actualReturnDate: undefined,
    ...p,
  } as ToolAssignment;
}

describe("ce que le terrain a le droit de prendre", () => {
  it("laisse prendre un outil libre et en bon état", () => {
    expect(peutPrendreLOutil(outil(), MOI)).toEqual({ possible: true });
  });

  it("refuse un outil hors service, et le dit", () => {
    const r = peutPrendreLOutil(outil({ baseStatus: "out_of_service" }), MOI);
    expect(r.possible).toBe(false);
    expect(r.possible === false && r.motif).toContain("hors service");
  });

  it("refuse un outil en réparation", () => {
    const r = peutPrendreLOutil(outil({ baseStatus: "in_repair" }), MOI);
    expect(r.possible === false && r.motif).toContain("réparation");
  });

  it("distingue « un collègue l'a » de « vous l'avez déjà »", () => {
    // Le même refus pour les deux enverrait quelqu'un chercher un outil qui
    // est dans son propre camion.
    const collegue = peutPrendreLOutil(outil({ currentEmployeeId: COLLEGUE }), MOI);
    expect(collegue.possible === false && collegue.motif).toContain("collègue");

    const soi = peutPrendreLOutil(outil({ currentEmployeeId: MOI }), MOI);
    expect(soi.possible === false && soi.motif).toContain("déjà");
  });

  it("annonce d'abord la cause définitive", () => {
    // Hors service ET détenu : c'est « hors service » qu'il faut entendre,
    // parce que revenir demain n'y changera rien.
    const r = peutPrendreLOutil(
      outil({ baseStatus: "out_of_service", currentEmployeeId: COLLEGUE }),
      MOI,
    );
    expect(r.possible === false && r.motif).toContain("hors service");
  });
});

describe("les réservations", () => {
  const debut = "2026-09-21";
  const fin = "2026-09-23";

  it("la réservation d'un collègue bloque la prise", () => {
    const bloque = reservationQuiBloque([assignation()], MOI, debut, fin);
    expect(bloque?.employeeId).toBe(COLLEGUE);
  });

  it("SA PROPRE réservation ne bloque pas — il vient la chercher", () => {
    const sienne = [assignation({ employeeId: MOI })];
    expect(reservationQuiBloque(sienne, MOI, debut, fin)).toBeNull();
    expect(saReservation(sienne, MOI, debut, fin)?.employeeId).toBe(MOI);
  });

  it("une période qui ne chevauche rien passe", () => {
    expect(reservationQuiBloque([assignation()], MOI, "2026-10-01", "2026-10-02")).toBeNull();
    expect(saReservation([assignation()], MOI, "2026-10-01", "2026-10-02")).toBeNull();
  });
});

describe("la date de retour proposée", () => {
  it("s'aligne sur la durée du bureau", () => {
    expect(DUREE_EMPRUNT_PAR_DEFAUT_JOURS).toBe(7);
    expect(retourProposeParDefaut("2026-09-18")).toBe("2026-09-25");
  });

  it("accepte une autre durée", () => {
    expect(retourProposeParDefaut("2026-09-18", 1)).toBe("2026-09-19");
  });
});

describe("le retour", () => {
  it("ne signale un problème que si l'état n'est pas bon", () => {
    expect(retourSignaleUnProbleme("good")).toBe(false);
    expect(retourSignaleUnProbleme("damaged")).toBe(true);
    expect(retourSignaleUnProbleme("needs_repair")).toBe(true);
    expect(retourSignaleUnProbleme("missing_part")).toBe(true);
  });

  it("EMPILE les notes au lieu d'écraser celle de la prise", () => {
    // Le retour effaçait « Pour le chantier Tremblay » : plus rien ne disait
    // pourquoi l'outil était sorti.
    expect(noteApresRetour("Pour le chantier Tremblay", "Mandrin coincé")).toBe(
      "Pour le chantier Tremblay\nRetour : Mandrin coincé",
    );
    expect(noteApresRetour("Pour le chantier Tremblay", "")).toBe("Pour le chantier Tremblay");
    expect(noteApresRetour(null, "Mandrin coincé")).toBe("Retour : Mandrin coincé");
    expect(noteApresRetour(null, null)).toBeNull();
  });
});

describe("la prise simultanée", () => {
  it("reconnaît la violation d'unicité de Postgres", () => {
    expect(estUnePriseSimultanee("23505")).toBe(true);
    expect(estUnePriseSimultanee("23503")).toBe(false);
    expect(estUnePriseSimultanee(undefined)).toBe(false);
  });
});
