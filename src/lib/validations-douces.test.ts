import { describe, expect, it } from "vitest";
import {
  avertissementDateEloignee,
  avertissementDoublonClient,
  avertissementSoumissionAZero,
  clientDuMemeNom,
  libelleClient,
  refusDeValiditePassee,
} from "./validations-douces";
import type { Customer } from "@/types";

const c = (over: Partial<Customer>) => over as Customer;

describe("libelleClient", () => {
  it("évite le tiret orphelin quand il n'y a pas d'entreprise", () => {
    // Le menu affichait « — Alpha Construction ».
    expect(libelleClient(c({ name: "Alpha Construction", company: "" }))).toBe("Alpha Construction");
    expect(libelleClient(c({ name: "Alpha Construction" }))).toBe("Alpha Construction");
  });

  it("joint les deux quand ils diffèrent", () => {
    expect(libelleClient(c({ company: "Toiture Bélanger inc.", name: "Marie" })))
      .toBe("Toiture Bélanger inc. — Marie");
  });

  it("ne répète pas un nom identique à l'entreprise", () => {
    expect(libelleClient(c({ company: "ACGM", name: "ACGM" }))).toBe("ACGM");
  });

  it("tient sans nom", () => {
    expect(libelleClient(c({ company: "ACGM", name: "" }))).toBe("ACGM");
  });
});

describe("clientDuMemeNom", () => {
  const liste = [
    { id: "1", name: "Construction Tremblay", email: "info@tremblay.ca", phone: "418-555-0101" },
    { id: "2", name: "Marie Gagnon" },
  ];

  it("trouve le doublon, insensible à la casse", () => {
    expect(clientDuMemeNom(liste, "construction tremblay")?.id).toBe("1");
  });

  it("ne se signale pas lui-même en modification", () => {
    expect(clientDuMemeNom(liste, "Construction Tremblay", "1")).toBeNull();
  });

  it("rend null sur un nom neuf ou vide", () => {
    expect(clientDuMemeNom(liste, "Toiture Roy")).toBeNull();
    expect(clientDuMemeNom(liste, "   ")).toBeNull();
  });
});

describe("avertissementDoublonClient", () => {
  it("NOMME l'existant et donne de quoi les distinguer", () => {
    // Sans le courriel ou le téléphone, l'avertissement ne sert à rien : on ne
    // sait pas si c'est le même bonhomme.
    const m = avertissementDoublonClient({ name: "Construction Tremblay", email: "info@tremblay.ca", phone: "418-555-0101" });
    expect(m).toContain("Construction Tremblay");
    expect(m).toContain("info@tremblay.ca");
    expect(m).toContain("418-555-0101");
  });

  it("dit qu'on peut passer outre", () => {
    expect(avertissementDoublonClient({ name: "X" })).toContain("quand même");
  });

  it("reste lisible sans coordonnées", () => {
    expect(avertissementDoublonClient({ name: "X" })).not.toContain("()");
  });
});

describe("avertissementSoumissionAZero", () => {
  it("se tait sur un montant réel", () => {
    expect(avertissementSoumissionAZero(1500)).toBeNull();
  });

  it("avertit à zéro, sans interdire", () => {
    const m = avertissementSoumissionAZero(0)!;
    expect(m).toContain("0 $");
    expect(m).toMatch(/gratuit|reprise/);
  });

  it("avertit aussi sur un négatif", () => {
    expect(avertissementSoumissionAZero(-10)).not.toBeNull();
  });
});

describe("refusDeValiditePassee", () => {
  const MAINTENANT = new Date("2026-09-01T12:00:00");

  it("refuse une date passée", () => {
    expect(refusDeValiditePassee("2026-08-30", MAINTENANT)).toContain("déjà passée");
  });

  it("accepte aujourd'hui — la journée entière compte", () => {
    // Une soumission valide « jusqu'au 1er septembre » l'est tout le 1er.
    expect(refusDeValiditePassee("2026-09-01", MAINTENANT)).toBeNull();
  });

  it("accepte une date future", () => {
    expect(refusDeValiditePassee("2026-10-01", MAINTENANT)).toBeNull();
  });

  it("laisse passer l'absence de date", () => {
    expect(refusDeValiditePassee("", MAINTENANT)).toBeNull();
    expect(refusDeValiditePassee(null, MAINTENANT)).toBeNull();
  });

  it("ignore une date illisible plutôt que de bloquer à tort", () => {
    expect(refusDeValiditePassee("pas une date", MAINTENANT)).toBeNull();
  });
});

describe("avertissementDateEloignee", () => {
  const MAINTENANT = new Date("2026-09-01T12:00:00");

  it("se tait sur une date proche, passée ou future", () => {
    expect(avertissementDateEloignee("2026-08-01", MAINTENANT)).toBeNull();
    expect(avertissementDateEloignee("2027-06-01", MAINTENANT)).toBeNull();
  });

  it("avertit sur un call en 1999", () => {
    const m = avertissementDateEloignee("1999-01-05", MAINTENANT)!;
    expect(m).toContain("passé");
    expect(m).toContain("Vérifiez l'année");
  });

  it("avertit aussi trop loin dans le futur", () => {
    const m = avertissementDateEloignee("2030-01-05", MAINTENANT)!;
    expect(m).toContain("dans plus de");
  });

  it("accorde le singulier à un an", () => {
    expect(avertissementDateEloignee("2025-01-01", MAINTENANT)).toContain("un an");
  });

  it("laisse passer un contrat planifié à onze mois", () => {
    // Un chantier planifié l'an prochain existe ; bloquer serait pénible.
    expect(avertissementDateEloignee("2027-07-15", MAINTENANT)).toBeNull();
  });
});
