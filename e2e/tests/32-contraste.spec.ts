import { test, expect } from "../fixtures/base";
import type { Page } from "@playwright/test";

/**
 * LE CONTRASTE, MESURÉ.
 *
 * « Bon contraste » est une intention ; un ratio est un fait. Ce test calcule
 * le rapport de luminance entre chaque texte important et le fond RÉELLEMENT
 * peint derrière lui — en remontant les ancêtres jusqu'à trouver une couleur
 * opaque, parce qu'un fond transparent ne dit rien de ce qu'on voit.
 *
 * Seuils WCAG AA : 4,5 pour le texte courant, 3,0 pour le grand texte
 * (≥ 24 px, ou ≥ 18,66 px en gras).
 */

interface Mesure {
  ratio: number;
  px: number;
  grand: boolean;
  seuil: number;
}

async function mesurer(page: Page, selecteur: string): Promise<Mesure | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const st = getComputedStyle(el);

    const lire = (c: string) => {
      const m = c.match(/[\d.]+/g);
      if (!m) return null;
      const [r, g, b, a] = m.map(Number);
      return { r, g, b, a: a === undefined ? 1 : a };
    };

    // Le fond réel : le premier ancêtre qui peint quelque chose d'opaque.
    let fond = { r: 255, g: 255, b: 255 };
    let n: Element | null = el;
    while (n) {
      const c = lire(getComputedStyle(n).backgroundColor);
      if (c && c.a >= 0.95) {
        fond = { r: c.r, g: c.g, b: c.b };
        break;
      }
      n = n.parentElement;
    }
    const t = lire(st.color) ?? { r: 0, g: 0, b: 0, a: 1 };

    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const l1 = lum(t);
    const l2 = lum(fond);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    const px = parseFloat(st.fontSize);
    const gras = parseInt(st.fontWeight, 10) >= 700;
    const grand = px >= 24 || (gras && px >= 18.66);
    return { ratio: Math.round(ratio * 100) / 100, px, grand, seuil: grand ? 3 : 4.5 };
  }, selecteur);
}

test.describe("32. Contraste WCAG AA", () => {
  test("la page d'accueil", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2600);
    for (const [nom, sel] of [
      ["titre du héros", "h1"],
      ["sous-titre du héros", "h1 ~ p"],
      ["le chiffre", "p.tabular-nums"],
    ] as const) {
      const r = await mesurer(page, sel);
      expect(r, `${nom} introuvable (${sel})`).not.toBeNull();
      console.log(
        `CONTRASTE >>> accueil · ${nom} : ${r!.ratio} (seuil ${r!.seuil}, ${r!.px}px)`,
      );
      expect(r!.ratio, `${nom} — ${r!.ratio} < ${r!.seuil}`).toBeGreaterThanOrEqual(r!.seuil);
    }
  });

  test("la page de connexion", async ({ page }) => {
    await page.goto("/login");
    await page.waitForTimeout(1200);
    for (const [nom, sel] of [
      ["titre", "h1"],
      ["texte d'introduction", "h1 ~ p"],
      ["étiquette du courriel", 'label[for="email"]'],
    ] as const) {
      const r = await mesurer(page, sel);
      expect(r, `${nom} introuvable (${sel})`).not.toBeNull();
      console.log(
        `CONTRASTE >>> connexion · ${nom} : ${r!.ratio} (seuil ${r!.seuil}, ${r!.px}px)`,
      );
      expect(r!.ratio, `${nom} — ${r!.ratio} < ${r!.seuil}`).toBeGreaterThanOrEqual(r!.seuil);
    }
  });
});
