import { describe, expect, it } from "vitest";
import {
  grouperDoublons,
  normaliserCourriel,
  refusCourrielEnDouble,
} from "./employee-email-uniqueness";

const equipe = [
  { id: "e1", email: "marc@chantier.ca", firstName: "Marc", lastName: "Tremblay" },
  { id: "e2", email: "julie@chantier.ca", firstName: "Julie", lastName: "Gagnon" },
  { id: "e3", email: null, firstName: "Réal", lastName: "Lanthier" },
];

describe("normaliserCourriel", () => {
  it("ignore la casse et les espaces", () => {
    expect(normaliserCourriel("  Marc@Chantier.CA ")).toBe("marc@chantier.ca");
  });

  it("rend une chaîne vide sur l'absence d'adresse", () => {
    expect(normaliserCourriel(null)).toBe("");
    expect(normaliserCourriel(undefined)).toBe("");
  });
});

describe("refusCourrielEnDouble", () => {
  it("refuse une adresse déjà prise", () => {
    expect(refusCourrielEnDouble("marc@chantier.ca", equipe)).toMatch(/déjà utilisé/);
  });

  it("refuse malgré une casse différente", () => {
    // Sans normalisation, « Marc@ » passerait et créerait le doublon qu'on veut
    // empêcher — Supabase, lui, ne distingue pas la casse.
    expect(refusCourrielEnDouble("MARC@Chantier.ca", equipe)).toMatch(/déjà utilisé/);
  });

  it("accepte une adresse libre", () => {
    expect(refusCourrielEnDouble("real@chantier.ca", equipe)).toBeNull();
  });

  it("accepte une adresse vide", () => {
    // Beaucoup d'employés de chantier n'ont pas d'adresse, et rien ne les y
    // oblige tant qu'on ne leur donne pas d'accès.
    expect(refusCourrielEnDouble("", equipe)).toBeNull();
    expect(refusCourrielEnDouble(null, equipe)).toBeNull();
  });

  it("laisse un employé garder sa propre adresse", () => {
    // Sinon toute modification de fiche échouerait sur son propre courriel.
    expect(refusCourrielEnDouble("marc@chantier.ca", equipe, "e1")).toBeNull();
  });

  it("refuse quand même l'adresse d'un collègue lors d'une modification", () => {
    expect(refusCourrielEnDouble("julie@chantier.ca", equipe, "e1")).toMatch(/déjà utilisé/);
  });
});

describe("grouperDoublons", () => {
  it("trouve les adresses partagées", () => {
    const avecDoublons = [
      { id: "a", email: "partage@x.ca" },
      { id: "b", email: "Partage@X.ca" },
      { id: "c", email: "seul@x.ca" },
      { id: "d", email: null },
    ];
    expect(grouperDoublons(avecDoublons)).toEqual([{ email: "partage@x.ca", ids: ["a", "b"] }]);
  });

  it("ne compte pas les fiches sans adresse comme des doublons", () => {
    expect(grouperDoublons([{ id: "a", email: null }, { id: "b", email: "" }])).toEqual([]);
  });
});

describe("le refus nomme le porteur", () => {
  it("dit QUI détient déjà l'adresse", () => {
    // « déjà utilisé » sans dire par qui oblige à ouvrir les fiches une par
    // une pour retrouver le coupable.
    expect(refusCourrielEnDouble("marc@chantier.ca", equipe)).toContain("Marc Tremblay");
  });

  it("laisse un employé ARCHIVÉ libérer son adresse", () => {
    // Une fiche créée par erreur puis archivée ne doit pas empêcher de la
    // refaire. L'index en base applique la même règle : les deux doivent
    // coïncider, sinon on refuse ici ce que la base accepterait.
    const archives = [
      { id: "a1", email: "parti@chantier.ca", firstName: "Yves", lastName: "Roy", archivedAt: "2026-08-01" },
    ];
    expect(refusCourrielEnDouble("parti@chantier.ca", archives)).toBeNull();
  });

  it("reste lisible quand le nom manque", () => {
    const anonyme = [{ id: "x", email: "sansnom@chantier.ca" }];
    const m = refusCourrielEnDouble("sansnom@chantier.ca", anonyme);
    expect(m).toContain("un autre employé");
    expect(m).not.toContain("undefined");
  });
});
