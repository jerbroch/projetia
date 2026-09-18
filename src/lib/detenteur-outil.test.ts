import { describe, expect, it } from "vitest";
import {
  debutDeDetention,
  depuisDeLEtat,
  detailDeLEtat,
  etatDeLOutil,
  libelleDepuis,
  titreDeLEtat,
} from "@/lib/detenteur-outil";
import type { ToolListItem } from "@/types";

const MOI = "emp-1";
const COLLEGUE = "emp-2";
const MAINTENANT = new Date("2026-09-18T18:00:00Z");

function outil(p: Partial<ToolListItem> & { depuis?: { iso: string; heureConnue: boolean } } = {}) {
  return {
    baseStatus: "available" as const,
    effectiveStatus: "available" as const,
    currentEmployeeId: undefined,
    currentEmployeeName: undefined,
    ...p,
  };
}

describe("depuis quand l'outil est sorti", () => {
  it("une prise saisie le jour même porte son heure", () => {
    // Le cas du dépôt : la ligne est écrite au moment où l'homme part.
    const m = debutDeDetention({ startDate: "2026-09-18", createdAt: "2026-09-18T11:30:00Z" });
    expect(m).toEqual({ iso: "2026-09-18T11:30:00Z", heureConnue: true });
  });

  it("une attribution préparée à l'avance n'invente pas d'heure", () => {
    // Le bureau a saisi lundi une sortie prévue mercredi : personne ne sait à
    // quelle heure l'outil est réellement parti.
    const m = debutDeDetention({ startDate: "2026-09-18", createdAt: "2026-09-16T14:00:00Z" });
    expect(m).toEqual({ iso: "2026-09-18", heureConnue: false });
  });

  it("une saisie en retard garde son horodatage", () => {
    const m = debutDeDetention({ startDate: "2026-09-15", createdAt: "2026-09-18T09:00:00Z" });
    expect(m.heureConnue).toBe(true);
  });
});

describe("la phrase « depuis »", () => {
  it("écrit l'heure à la québécoise", () => {
    // 11 h 30 UTC = 7 h 30 à Montréal.
    expect(libelleDepuis({ iso: "2026-09-18T11:30:00Z", heureConnue: true }, MAINTENANT)).toBe(
      "Depuis le 18 septembre à 7 h 30",
    );
  });

  it("met les minutes sur deux chiffres", () => {
    expect(libelleDepuis({ iso: "2026-09-18T11:05:00Z", heureConnue: true }, MAINTENANT)).toBe(
      "Depuis le 18 septembre à 7 h 05",
    );
  });

  it("tait l'heure quand elle n'est pas connue", () => {
    expect(libelleDepuis({ iso: "2026-09-18", heureConnue: false }, MAINTENANT)).toBe(
      "Depuis le 18 septembre",
    );
  });

  it("n'écrit l'année que si ce n'est pas celle en cours", () => {
    expect(libelleDepuis({ iso: "2025-12-02", heureConnue: false }, MAINTENANT)).toBe(
      "Depuis le 2 décembre 2025",
    );
  });

  it("l'heure est celle de l'entreprise, pas celle de l'appareil", () => {
    // 01 h 30 UTC le 19 = 21 h 30 le 18 à Montréal.
    expect(libelleDepuis({ iso: "2026-09-19T01:30:00Z", heureConnue: true }, MAINTENANT)).toBe(
      "Depuis le 18 septembre à 21 h 30",
    );
  });
});

describe("ce que chacun doit lire", () => {
  const depuis = { iso: "2026-09-18T11:30:00Z", heureConnue: true };

  it("un outil libre est disponible pour tout le monde", () => {
    expect(etatDeLOutil(outil(), MOI)).toEqual({ genre: "disponible" });
    expect(titreDeLEtat(etatDeLOutil(outil(), MOI))).toBe("Disponible");
  });

  it("celui qui le détient lit « En ma possession »", () => {
    const e = etatDeLOutil(
      outil({ effectiveStatus: "in_use", currentEmployeeId: MOI, currentEmployeeName: "Moi Même", depuis }),
      MOI,
    );
    expect(e.genre).toBe("a-moi");
    expect(titreDeLEtat(e)).toBe("En ma possession");
    expect(detailDeLEtat(e)).toBeNull();
    expect(depuisDeLEtat(e, MAINTENANT)).toBe("Depuis le 18 septembre à 7 h 30");
  });

  it("les autres lisent le nom du détenteur", () => {
    const e = etatDeLOutil(
      outil({
        effectiveStatus: "in_use",
        currentEmployeeId: COLLEGUE,
        currentEmployeeName: "Alexandre Tremblay",
        depuis,
      }),
      MOI,
    );
    expect(titreDeLEtat(e)).toBe("Indisponible");
    expect(detailDeLEtat(e)).toBe("Détenue par : Alexandre Tremblay");
    expect(depuisDeLEtat(e, MAINTENANT)).toBe("Depuis le 18 septembre à 7 h 30");
  });

  it("l'employeur voit un détenteur, jamais « à moi »", () => {
    const e = etatDeLOutil(
      outil({ effectiveStatus: "in_use", currentEmployeeId: MOI, currentEmployeeName: "Marc Roy", depuis }),
      undefined,
    );
    expect(e.genre).toBe("detenu");
    expect(detailDeLEtat(e)).toBe("Détenue par : Marc Roy");
  });

  it("un outil en retard reste détenu, avec son nom", () => {
    const e = etatDeLOutil(
      outil({
        effectiveStatus: "overdue",
        currentEmployeeId: COLLEGUE,
        currentEmployeeName: "Alexandre Tremblay",
        depuis,
      }),
      MOI,
    );
    expect(e.genre).toBe("detenu");
  });

  it("UNE RÉSERVATION N'EST PAS UNE DÉTENTION", () => {
    // Statut effectif « available » : quelqu'un l'a réservé pour plus tard,
    // mais l'outil est encore au dépôt.
    const e = etatDeLOutil(
      outil({ effectiveStatus: "available", currentEmployeeId: undefined }),
      MOI,
    );
    expect(e).toEqual({ genre: "disponible" });
  });

  it("une indisponibilité technique n'INVENTE PAS de détenteur", () => {
    const repare = etatDeLOutil(outil({ baseStatus: "in_repair", effectiveStatus: "in_repair" }), MOI);
    expect(repare).toEqual({ genre: "indisponible", raison: "En réparation" });
    expect(detailDeLEtat(repare)).toBeNull();

    const hs = etatDeLOutil(outil({ baseStatus: "out_of_service", effectiveStatus: "out_of_service" }), MOI);
    expect(titreDeLEtat(hs)).toBe("Hors service");
  });

  it("la réparation l'emporte sur une détention résiduelle", () => {
    // Un outil rentré abîmé : il ne doit pas s'afficher « détenu par ».
    const e = etatDeLOutil(
      outil({
        baseStatus: "in_repair",
        effectiveStatus: "in_repair",
        currentEmployeeId: COLLEGUE,
        currentEmployeeName: "Alexandre Tremblay",
      }),
      MOI,
    );
    expect(e.genre).toBe("indisponible");
  });

  it("nomme un détenteur inconnu sans laisser de vide", () => {
    const e = etatDeLOutil(
      outil({ effectiveStatus: "in_use", currentEmployeeId: COLLEGUE, currentEmployeeName: "  ", depuis }),
      MOI,
    );
    expect(detailDeLEtat(e)).toBe("Détenue par : Un collègue");
  });
});
