import { describe, expect, it } from "vitest";
import { formatCompanyName } from "./company-display-name";

describe("formatCompanyName", () => {
  it("redresse un nom entièrement en minuscules", () => {
    expect(formatCompanyName("plomberie goutte d'eau")).toBe("Plomberie Goutte d'eau");
  });

  it("laisse les particules en minuscules en cours de nom", () => {
    expect(formatCompanyName("toitures de la vallée")).toBe("Toitures de la Vallée");
  });

  it("capitalise une élision placée en tête", () => {
    expect(formatCompanyName("l'atelier du bois")).toBe("L'atelier du Bois");
  });

  it("ne touche à rien dès qu'une majuscule existe", () => {
    // Se tromper en corrigeant est pire que ne rien faire.
    expect(formatCompanyName("ABC INC.")).toBe("ABC INC.");
    expect(formatCompanyName("McDonald Construction")).toBe("McDonald Construction");
    expect(formatCompanyName("Plomberie Goutte d'eau")).toBe("Plomberie Goutte d'eau");
  });

  it("supporte l'absence de nom", () => {
    expect(formatCompanyName(null)).toBe("");
    expect(formatCompanyName(undefined)).toBe("");
    expect(formatCompanyName("   ")).toBe("");
  });

  it("conserve l'espacement interne", () => {
    expect(formatCompanyName("béton  express")).toBe("Béton  Express");
  });
});
