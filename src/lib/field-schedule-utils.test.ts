import { describe, expect, it } from "vitest";
import {
  grouperParJournee,
  libelleDeJournee,
} from "@/lib/field-schedule-utils";
import type { ScheduleEvent } from "@/types";

describe("les interventions rangées par journée", () => {
  function call(id: string, start: string): ScheduleEvent {
    return {
      id,
      companyId: "c1",
      title: `Call ${id}`,
      start,
      end: start,
      status: "scheduled",
      type: "job",
      employeeIds: [],
      employeeNames: [],
    } as unknown as ScheduleEvent;
  }

  it("regroupe et ordonne les journées", () => {
    // Volontairement dans le désordre : c'est le groupement qui doit trier.
    const groupes = grouperParJournee([
      call("b", "2026-09-21T13:00:00-04:00"),
      call("a", "2026-09-18T08:00:00-04:00"),
      call("c", "2026-09-18T13:00:00-04:00"),
    ]);

    expect(groupes.map((g) => g.cle)).toEqual(["2026-09-18", "2026-09-21"]);
    expect(groupes[0].jobs.map((j) => j.id)).toEqual(["a", "c"]);
    expect(groupes[1].jobs.map((j) => j.id)).toEqual(["b"]);
  });

  it("la journée est celle de l'entreprise, pas celle de l'appareil", () => {
    // 21 h 30 à Montréal le 18 = 01 h 30 UTC le 19. Le call appartient au 18
    // pour l'homme sur le chantier comme pour la personne au bureau.
    const groupes = grouperParJournee([call("soir", "2026-09-19T01:30:00Z")]);
    expect(groupes[0].cle).toBe("2026-09-18");
  });

  it("écrit la journée comme on la dit, majuscule comprise", () => {
    expect(libelleDeJournee("2026-09-18")).toBe("Vendredi 18 septembre");
  });

  it("ne rend rien quand il n'y a rien", () => {
    expect(grouperParJournee([])).toEqual([]);
  });
});
