import { describe, expect, it } from "vitest";
import {
  coordonneesDeLEmployeur,
  coordonneesDuSoutien,
  lienCourriel,
  lienTelephonique,
} from "./coordonnees";

describe("lienTelephonique", () => {
  it("dépouille le numéro pour qu'il se compose", () => {
    // Un gars avec des gants touche le numéro ; il ne le recopie pas.
    expect(lienTelephonique("438-403-6673")).toBe("tel:4384036673");
    expect(lienTelephonique("(418) 555-0123")).toBe("tel:4185550123");
    expect(lienTelephonique("418 555 0123 poste 4")).toBe("tel:41855501234");
  });

  it("garde le préfixe international", () => {
    expect(lienTelephonique("+1 438 403 6673")).toBe("tel:+14384036673");
  });

  it("ne garde le « + » qu'en tête", () => {
    expect(lienTelephonique("438+403+6673")).toBe("tel:4384036673");
  });

  it("rend null plutôt qu'un lien mort", () => {
    // Un lien qui ne compose rien est pire qu'un texte : il donne l'illusion.
    expect(lienTelephonique("")).toBeNull();
    expect(lienTelephonique("   ")).toBeNull();
    expect(lienTelephonique(null)).toBeNull();
    expect(lienTelephonique("à venir")).toBeNull();
    expect(lienTelephonique("555-01")).toBeNull();
  });
});

describe("lienCourriel", () => {
  it("construit le mailto", () => {
    expect(lienCourriel("jerome_brochu@hotmail.fr")).toBe("mailto:jerome_brochu@hotmail.fr");
  });

  it("refuse ce qui n'est pas une adresse", () => {
    expect(lienCourriel("pas-une-adresse")).toBeNull();
    expect(lienCourriel("@hotmail.fr")).toBeNull();
    expect(lienCourriel("jerome@")).toBeNull();
    expect(lienCourriel("")).toBeNull();
  });

  it("nettoie les espaces de bord", () => {
    expect(lienCourriel("  a@b.ca  ")).toBe("mailto:a@b.ca");
  });
});

describe("coordonneesDuSoutien", () => {
  it("lit l'environnement en priorité", () => {
    const c = coordonneesDuSoutien({
      SUPPORT_EMAIL: "aide@constructionios.com",
      SUPPORT_PHONE: "514-555-0100",
    });
    expect(c.email).toBe("aide@constructionios.com");
    expect(c.telephone).toBe("514-555-0100");
  });

  it("retombe sur des valeurs valides quand l'environnement est muet", () => {
    // Une section « Nous joindre » vide est pire que pas de section : elle
    // laisse croire que personne ne répond.
    const c = coordonneesDuSoutien({});
    expect(lienCourriel(c.email)).not.toBeNull();
    expect(lienTelephonique(c.telephone)).not.toBeNull();
  });

  it("ignore une variable vide ou remplie d'espaces", () => {
    const c = coordonneesDuSoutien({ SUPPORT_EMAIL: "   " });
    expect(lienCourriel(c.email)).not.toBeNull();
  });
});

describe("coordonneesDeLEmployeur", () => {
  it("rend les coordonnées de l'entreprise, pas les nôtres", () => {
    // L'employé joint SON patron. Le renvoyer vers nous casserait la relation
    // et ne l'avancerait à rien : nous ne savons rien de son chantier.
    const c = coordonneesDeLEmployeur({
      name: "Toiture Bélanger inc.",
      email: "info@belanger.ca",
      phone: "418-555-0199",
    });
    expect(c).toEqual({
      nom: "Toiture Bélanger inc.",
      email: "info@belanger.ca",
      telephone: "418-555-0199",
    });
  });

  it("suffit d'un seul moyen de joindre", () => {
    expect(coordonneesDeLEmployeur({ name: "X", phone: "418-555-0199" })?.telephone).toBe(
      "418-555-0199",
    );
    expect(coordonneesDeLEmployeur({ name: "X", email: "a@b.ca" })?.email).toBe("a@b.ca");
  });

  it("rend null quand l'entreprise n'a rien rempli", () => {
    expect(coordonneesDeLEmployeur({ name: "X" })).toBeNull();
    expect(coordonneesDeLEmployeur({ name: "X", email: "  ", phone: "" })).toBeNull();
  });

  it("ne retombe JAMAIS sur nos coordonnées", () => {
    const c = coordonneesDeLEmployeur({ name: "X", email: "", phone: "" });
    expect(c).toBeNull();
  });
});
