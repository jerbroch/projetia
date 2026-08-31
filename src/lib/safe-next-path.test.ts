import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("accepte un chemin interne, avec sa query", () => {
    expect(safeNextPath("/choose-plan")).toBe("/choose-plan");
    expect(safeNextPath("/choose-plan?upgrade=1")).toBe("/choose-plan?upgrade=1");
    expect(safeNextPath("/quotes/123?tab=couts")).toBe("/quotes/123?tab=couts");
  });

  it("refuse une URL absolue — redirection ouverte", () => {
    expect(safeNextPath("https://exemple.com")).toBeNull();
    expect(safeNextPath("http://exemple.com/x")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
  });

  it("refuse une URL relative au protocole", () => {
    expect(safeNextPath("//exemple.com")).toBeNull();
    expect(safeNextPath("//exemple.com/chemin")).toBeNull();
  });

  it("refuse un contournement par antislash", () => {
    expect(safeNextPath("/\\exemple.com")).toBeNull();
    expect(safeNextPath("\\\\exemple.com")).toBeNull();
  });

  it("refuse les pages d'authentification — sinon on boucle", () => {
    expect(safeNextPath("/login")).toBeNull();
    expect(safeNextPath("/login?next=/dashboard")).toBeNull();
    expect(safeNextPath("/register")).toBeNull();
    expect(safeNextPath("/reset-password")).toBeNull();
  });

  it("ne confond pas un préfixe avec un segment", () => {
    expect(safeNextPath("/logindetails")).toBe("/logindetails");
  });

  it("refuse le vide", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath("   ")).toBeNull();
  });
});
