import { describe, expect, it } from "vitest";
import {
  mustSetPassword,
  PASSWORD_SETUP_PATH,
  shouldForcePasswordSetup,
} from "./password-setup-gate";

describe("mustSetPassword", () => {
  it("ne reconnaît que le booléen vrai", () => {
    expect(mustSetPassword({ must_set_password: true })).toBe(true);
    expect(mustSetPassword({ must_set_password: false })).toBe(false);
    // Une chaîne « true » venue d'un formulaire ne doit pas ouvrir la porte.
    expect(mustSetPassword({ must_set_password: "true" })).toBe(false);
  });

  it("supporte l'absence de métadonnées", () => {
    expect(mustSetPassword(null)).toBe(false);
    expect(mustSetPassword(undefined)).toBe(false);
    expect(mustSetPassword({})).toBe(false);
    expect(mustSetPassword("pas un objet")).toBe(false);
  });
});

describe("shouldForcePasswordSetup", () => {
  const invite = { must_set_password: true };

  it("détourne /terrain tapé directement dans la barre d'adresse", () => {
    // C'est le contournement que la porte existe pour fermer : l'employé a une
    // session valide dès son clic sur l'invitation, donc rien d'autre ne
    // l'arrêterait.
    expect(
      shouldForcePasswordSetup({ pathname: "/terrain", isLoggedIn: true, metadata: invite }),
    ).toBe(true);
  });

  it("détourne aussi les sous-chemins et les autres routes", () => {
    for (const p of ["/terrain/feuille", "/dashboard", "/employees", "/settings"]) {
      expect(
        shouldForcePasswordSetup({ pathname: p, isLoggedIn: true, metadata: invite }),
      ).toBe(true);
    }
  });

  it("laisse passer la page de choix, sinon on boucle", () => {
    expect(
      shouldForcePasswordSetup({
        pathname: PASSWORD_SETUP_PATH,
        isLoggedIn: true,
        metadata: invite,
      }),
    ).toBe(false);
  });

  it("ne gêne pas un utilisateur qui a déjà son mot de passe", () => {
    expect(
      shouldForcePasswordSetup({ pathname: "/terrain", isLoggedIn: true, metadata: {} }),
    ).toBe(false);
    expect(
      shouldForcePasswordSetup({
        pathname: "/terrain",
        isLoggedIn: true,
        metadata: { must_set_password: false },
      }),
    ).toBe(false);
  });

  it("ne s'applique pas à un visiteur non connecté", () => {
    // Celui-là, c'est la redirection vers /login qui s'en occupe.
    expect(
      shouldForcePasswordSetup({ pathname: "/terrain", isLoggedIn: false, metadata: invite }),
    ).toBe(false);
  });
});
