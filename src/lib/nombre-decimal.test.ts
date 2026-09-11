import { describe, expect, it } from "vitest";
import {
  decimalDepuisTexte,
  texteDecimalNettoye,
  texteDepuisDecimal,
  zNombreDecimal,
} from "@/lib/nombre-decimal";

describe("decimalDepuisTexte", () => {
  it("lit la virgule et le point de la même façon", () => {
    expect(decimalDepuisTexte("1,5")).toBe(1.5);
    expect(decimalDepuisTexte("1.5")).toBe(1.5);
  });

  it("arrondit à deux décimales — il ne tronque pas", () => {
    // Le filtre de frappe tronque ; la LECTURE arrondit. Sans quoi la même
    // valeur donnerait deux résultats selon qu'elle arrive en texte ou en
    // nombre, et l'écart passerait inaperçu.
    expect(decimalDepuisTexte("1,255")).toBe(1.26);
    expect(decimalDepuisTexte("0,999")).toBe(1);
    expect(decimalDepuisTexte(1.255)).toBe(1.26);
  });

  it("colle et tape donnent la MÊME valeur", () => {
    // C'est l'invariant : un même texte, un même résultat, quel que soit le
    // geste. Deux règles selon le geste rendraient le résultat imprévisible.
    for (const t of ["1,5", "1.5", "12,75", "0,05"]) {
      expect(decimalDepuisTexte(texteDecimalNettoye(t))).toBe(decimalDepuisTexte(t));
    }
  });

  it("lit un montant collé d'un tableur, dans les deux conventions", () => {
    expect(decimalDepuisTexte("1,500.75")).toBe(1500.75);   // anglaise
    expect(decimalDepuisTexte("1.500,75")).toBe(1500.75);   // européenne
    expect(decimalDepuisTexte("1 500,75")).toBe(1500.75);   // espace insécable
    expect(decimalDepuisTexte("1 234 567,89")).toBe(1234567.89);
    expect(decimalDepuisTexte("2 250,00 $")).toBe(2250);
  });

  it("ne prend pas la virgule pour un séparateur de milliers", () => {
    // C'est là que le lecteur de csv-robuste.ts se tromperait : il rendrait
    // 1500. Pour des heures, personne n'écrit de séparateur de milliers.
    expect(decimalDepuisTexte("1,500")).toBe(1.5);
  });

  it("rend null quand rien n'a été saisi, jamais zéro", () => {
    // « rien » et « zéro heure » sont deux réponses différentes.
    expect(decimalDepuisTexte("")).toBeNull();
    expect(decimalDepuisTexte(null)).toBeNull();
    expect(decimalDepuisTexte("   ")).toBeNull();
    expect(decimalDepuisTexte("abc")).toBeNull();
    expect(decimalDepuisTexte(",")).toBeNull();
    expect(decimalDepuisTexte("0")).toBe(0);
  });

  it("tolère les espaces, y compris l'insécable de fr-CA", () => {
    expect(decimalDepuisTexte(" 7,25 ")).toBe(7.25);
    expect(decimalDepuisTexte("7 25".replace(" ", ""))).toBe(725);
  });

  it("arrondit juste là où la virgule flottante se trompe", () => {
    // Math.round(1.005 * 100) / 100 rend 1 — la valeur binaire est 1.00499…
    expect(decimalDepuisTexte("1,005")).toBe(1.01);
    expect(decimalDepuisTexte(1.005)).toBe(1.01);
  });

  it("laisse passer un nombre déjà propre", () => {
    expect(decimalDepuisTexte(1.5)).toBe(1.5);
    expect(decimalDepuisTexte(8)).toBe(8);
  });
});

describe("texteDecimalNettoye — ce qu'on peut taper", () => {
  it("laisse la frappe en cours vivre", () => {
    // « 1, » doit survivre le temps que le doigt trouve le 5.
    expect(texteDecimalNettoye("1,")).toBe("1,");
    expect(texteDecimalNettoye("1.")).toBe("1,");
  });

  it("avec deux séparateurs, le DERNIER est le décimal", () => {
    // Le premier séparait les milliers. La position tranche.
    expect(texteDecimalNettoye("1,5,3")).toBe("15,3");
    expect(texteDecimalNettoye("1.5.3")).toBe("15,3");
  });

  it("un séparateur posé en fin de frappe ne réinterprète pas le précédent", () => {
    // Taper « 1,5 » puis une deuxième virgule ne doit pas faire sauter
    // l'affichage à « 15, » sous les doigts.
    expect(texteDecimalNettoye("1,5,")).toBe("1,5");
    expect(texteDecimalNettoye("1,5.")).toBe("1,5");
  });

  it("coupe au-delà de deux décimales", () => {
    expect(texteDecimalNettoye("1,5678")).toBe("1,56");
  });

  it("jette les lettres", () => {
    expect(texteDecimalNettoye("1a,5b")).toBe("1,5");
  });
});

describe("texteDepuisDecimal", () => {
  it("écrit avec la virgule, comme ici", () => {
    expect(texteDepuisDecimal(1.5)).toBe("1,5");
    expect(texteDepuisDecimal(8)).toBe("8");
    expect(texteDepuisDecimal(null)).toBe("");
  });
});

describe("zNombreDecimal — la moitié serveur", () => {
  it("accepte « 1,5 » là où z.coerce.number() rendait NaN", () => {
    expect(zNombreDecimal().parse("1,5")).toBe(1.5);
    expect(zNombreDecimal().parse("1.5")).toBe(1.5);
    expect(zNombreDecimal().parse(1.5)).toBe(1.5);
  });

  it("refuse ce qui n'est pas un nombre, au lieu de rendre zéro", () => {
    expect(zNombreDecimal().safeParse("").success).toBe(false);
    expect(zNombreDecimal().safeParse("abc").success).toBe(false);
  });
});
