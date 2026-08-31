import { describe, expect, it } from "vitest";
import { CHEMINS_DE_PORTE, porteDeProfil } from "./profile-access-gate";

describe("porteDeProfil", () => {
  it("laisse passer un profil actif", () => {
    expect(porteDeProfil("active")).toBe("ouverte");
  });

  it("ferme sur un profil désactivé", () => {
    // Le cœur du correctif : ce statut était posé par la révocation et lu par
    // personne. Si ce test tombe, la porte s'est rouverte.
    expect(porteDeProfil("inactive")).toBe("acces-retire");
  });

  it("distingue une invitation en attente d'un accès retiré", () => {
    // Dire « accès retiré » à quelqu'un dont l'invitation n'a jamais été
    // activée serait faux : rien ne lui a été retiré.
    expect(porteDeProfil("invited")).toBe("invitation-en-attente");
  });

  it("ferme sur un statut inconnu", () => {
    // Un statut ajouté plus tard ne doit pas ouvrir la porte par défaut.
    expect(porteDeProfil("suspendu")).toBe("acces-retire");
    expect(porteDeProfil("archive")).toBe("acces-retire");
  });

  it("laisse passer quand il n'y a pas de profil", () => {
    // Un nouvel inscrit n'en a pas encore ; le bloquer ici casserait
    // l'inscription.
    expect(porteDeProfil(null)).toBe("ouverte");
    expect(porteDeProfil(undefined)).toBe("ouverte");
    expect(porteDeProfil("")).toBe("ouverte");
  });

  it("connaît une destination pour chaque porte fermée", () => {
    expect(CHEMINS_DE_PORTE["acces-retire"]).toBe("/acces-retire");
    expect(CHEMINS_DE_PORTE["invitation-en-attente"]).toBe("/invitation-en-attente");
  });
});
