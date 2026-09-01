import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate } from "./utils";

/** Espaces insécables et fines : `fr-CA` en pose, il faut les neutraliser. */
const lisible = (s: string) => s.replace(/[  ]/g, " ");

describe("formatCurrency", () => {
  it("écrit le symbole APRÈS le nombre", () => {
    // « $5,000.00 » sur la soumission d'un entrepreneur québécois fait amateur.
    expect(lisible(formatCurrency(5000))).toBe("5 000,00 $");
  });

  it("sépare les décimales par une virgule", () => {
    expect(lisible(formatCurrency(1234.5))).toBe("1 234,50 $");
    expect(lisible(formatCurrency(0.05))).toBe("0,05 $");
  });

  it("n'annonce jamais des dollars américains", () => {
    // La devise était USD, pas seulement le format. Un client qui lit « US$ »
    // sur sa facture a raison de s'inquiéter.
    const m = lisible(formatCurrency(99));
    expect(m).not.toContain("US");
    expect(m).not.toMatch(/^\$/);
  });

  it("garde le signe des montants négatifs", () => {
    expect(lisible(formatCurrency(-250))).toContain("250,00");
    expect(lisible(formatCurrency(-250))).toContain("-");
  });

  it("tient un montant énorme sans perdre les cents", () => {
    expect(lisible(formatCurrency(1234567.89))).toBe("1 234 567,89 $");
  });

  it("rend zéro lisiblement", () => {
    expect(lisible(formatCurrency(0))).toBe("0,00 $");
  });
});

describe("formatDate", () => {
  it("écrit la date en français", () => {
    const d = lisible(formatDate("2026-08-31T15:00:00.000Z"));
    expect(d).toContain("août");
    expect(d).toContain("2026");
    expect(d).not.toMatch(/Aug|Sep|Mon|Sun/);
  });

  it("rend un tiret sur une date illisible plutôt que « Invalid Date »", () => {
    expect(formatDate("pas une date")).toBe("—");
    expect(formatDate(new Date("x"))).toBe("—");
  });
});
