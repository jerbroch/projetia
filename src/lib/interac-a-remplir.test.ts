import { describe, expect, it } from "vitest";
import {
  interacARemplir,
  LIEN_REGLAGES_INTERAC,
  messageInteracARemplir,
} from "@/lib/interac-a-remplir";

const vide = {} as const;

describe("interacARemplir", () => {
  it("signale un entrepreneur qui n'a rien configuré", () => {
    expect(interacARemplir(vide)).toBe(true);
    expect(interacARemplir({ interac: undefined })).toBe(true);
  });

  // Le cas sournois : les coordonnées existent, mais la case est décochée.
  // La facture part sans instructions et personne ne s'en aperçoit.
  it("signale des coordonnées enregistrées mais désactivées", () => {
    expect(interacARemplir({ interac: { enabled: false, email: "moi@exemple.com" } })).toBe(true);
  });

  it("signale une case cochée sans adresse", () => {
    expect(interacARemplir({ interac: { enabled: true, email: "" } })).toBe(true);
    expect(interacARemplir({ interac: { enabled: true, email: "   " } })).toBe(true);
  });

  it("se tait quand tout est en place", () => {
    expect(interacARemplir({ interac: { enabled: true, email: "moi@exemple.com" } })).toBe(false);
  });
});

describe("messageInteracARemplir", () => {
  it("dit la conséquence POUR LE CLIENT, pas la règle technique", () => {
    const m = messageInteracARemplir(vide);
    expect(m).toContain("Votre client");
    expect(m).toContain("sans savoir où envoyer l'argent");
  });

  it("distingue « jamais configuré » de « configuré puis désactivé »", () => {
    const jamais = messageInteracARemplir(vide);
    const desactive = messageInteracARemplir({
      interac: { enabled: false, email: "moi@exemple.com" },
    });
    expect(jamais).not.toBe(desactive);
    expect(desactive).toContain("désactivées");
  });

  it("ne dit rien quand il n'y a rien à dire", () => {
    expect(messageInteracARemplir({ interac: { enabled: true, email: "moi@exemple.com" } })).toBeNull();
  });

  // Un lien qui promet une destination doit y mener : `?section=…` n'était lu
  // par personne et laissait l'entrepreneur en haut d'une longue page.
  it("pointe une ancre réelle et non un paramètre décoratif", () => {
    expect(LIEN_REGLAGES_INTERAC).toContain("#");
    expect(LIEN_REGLAGES_INTERAC).not.toContain("?section=");
  });
});
