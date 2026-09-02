import { describe, expect, it } from "vitest";
import {
  extensionPour,
  MAX_PAR_CALL,
  poidsLisible,
  refusDePieceJointe,
  TAILLE_MAX_OCTETS,
  TYPES_ACCEPTES,
} from "./pieces-jointes";

const f = (name: string, type: string, size: number) => ({ name, type, size });

describe("poidsLisible", () => {
  it("écrit à la québécoise, avec la virgule", () => {
    expect(poidsLisible(4_404_019)).toBe("4,2 Mo");
  });

  it("choisit l'unité qui se lit", () => {
    expect(poidsLisible(512)).toBe("512 o");
    expect(poidsLisible(204_800)).toBe("200 Ko");
  });
});

describe("refusDePieceJointe", () => {
  it("accepte une photo compressée", () => {
    expect(refusDePieceJointe(f("toit.webp", "image/webp", 204_800), 0)).toBeNull();
  });

  it("accepte un plan PDF de 10 Mo", () => {
    // Le plafond a été choisi pour ça : un plan scanné passe avec de la marge.
    expect(refusDePieceJointe(f("plan.pdf", "application/pdf", 10 * 1024 * 1024), 0)).toBeNull();
  });

  it("accepte le HEIC — c'est le format par défaut de tout iPhone", () => {
    expect(refusDePieceJointe(f("IMG_0042.heic", "image/heic", 2_000_000), 0)).toBeNull();
  });

  it("REFUSE le SVG, qui peut porter du JavaScript", () => {
    const m = refusDePieceJointe(f("piege.svg", "image/svg+xml", 1000), 0);
    expect(m).not.toBeNull();
    expect(m).toContain("piege.svg");
  });

  it("refuse les archives et les exécutables", () => {
    expect(refusDePieceJointe(f("tout.zip", "application/zip", 1000), 0)).not.toBeNull();
    expect(refusDePieceJointe(f("x.exe", "application/x-msdownload", 1000), 0)).not.toBeNull();
  });

  it("NOMME le fichier et donne son poids", () => {
    // « fichier trop volumineux » oblige à deviner lequel, quand on en a
    // sélectionné huit d'un coup.
    const m = refusDePieceJointe(f("plan-geant.pdf", "application/pdf", 22 * 1024 * 1024), 0)!;
    expect(m).toContain("plan-geant.pdf");
    expect(m).toContain("22,0 Mo");
    expect(m).toContain("15,0 Mo");
  });

  it("refuse au-delà de vingt pièces, en disant quoi faire", () => {
    const m = refusDePieceJointe(f("photo.webp", "image/webp", 1000), MAX_PAR_CALL)!;
    expect(m).toContain("20");
    expect(m).toMatch(/Retirez/);
  });

  it("laisse passer la vingtième", () => {
    expect(refusDePieceJointe(f("photo.webp", "image/webp", 1000), MAX_PAR_CALL - 1)).toBeNull();
  });

  it("refuse un fichier vide", () => {
    expect(refusDePieceJointe(f("vide.pdf", "application/pdf", 0), 0)).toContain("vide");
  });

  it("accepte exactement le plafond, refuse un octet de plus", () => {
    expect(refusDePieceJointe(f("a.pdf", "application/pdf", TAILLE_MAX_OCTETS), 0)).toBeNull();
    expect(refusDePieceJointe(f("a.pdf", "application/pdf", TAILLE_MAX_OCTETS + 1), 0)).not.toBeNull();
  });
});

describe("extensionPour", () => {
  it("donne l'extension de chaque type accepté", () => {
    TYPES_ACCEPTES.forEach((t) => {
      expect(extensionPour(t)).not.toBe("bin");
    });
  });

  it("retombe sur bin plutôt que de deviner", () => {
    expect(extensionPour("application/inconnu")).toBe("bin");
  });
});
