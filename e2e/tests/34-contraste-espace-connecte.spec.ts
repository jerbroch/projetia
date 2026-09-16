import { test, expect } from "../fixtures/base";
import { connexionLocataire } from "../helpers/auth";

/**
 * AUCUN TEXTE SOUS LE SEUIL, SUR AUCUN ÉCRAN.
 *
 * « Bon contraste » est une intention ; un ratio est un fait. Ce test
 * parcourt chaque écran, mesure chaque texte visible contre le fond
 * RÉELLEMENT peint derrière lui, et refuse tout ce qui passe sous AA.
 *
 * Il a trouvé ce qu'aucune relecture n'avait vu : l'orange #F97316 en encre
 * sur fond clair donne 2,53. Il servait pour « Mot de passe oublié? »,
 * « S'inscrire » et une cinquantaine d'autres libellés.
 *
 * Seuils : 4,5 pour le texte courant, 3,0 pour le grand texte (≥ 24 px, ou
 * ≥ 18,66 px en gras).
 */
const ECRANS = [
  "/dashboard",
  "/customers",
  "/quotes",
  "/invoices",
  "/employees",
  "/settings",
] as const;

test("aucun texte sous le seuil WCAG AA", async ({ page }) => {
  await connexionLocataire(page);
  const fautifs: string[] = [];

  for (const route of ECRANS) {
    await page.goto(route);
    await page.waitForTimeout(900);

    const trouves = await page.evaluate(() => {
      const lire = (c: string) => {
        const m = c.match(/[\d.]+/g);
        if (!m) return null;
        const [r, g, b, a] = m.map(Number);
        return { r, g, b, a: a === undefined ? 1 : a };
      };
      const lum = (c: { r: number; g: number; b: number }) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
      };

      const sortie: string[] = [];
      document.querySelectorAll("a, button, p, h1, h2, h3, span, td, th, label, li").forEach((el) => {
        const e = el as HTMLElement;
        // Seulement les feuilles visibles qui portent vraiment du texte.
        if (e.children.length > 0) return;
        const texte = (e.textContent ?? "").trim();
        if (!texte) return;
        const st = getComputedStyle(e);
        if (st.visibility === "hidden" || st.display === "none" || st.opacity === "0") return;
        const b = e.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) return;

        let fond = { r: 255, g: 255, b: 255 };
        let n: Element | null = e;
        while (n) {
          const c = lire(getComputedStyle(n).backgroundColor);
          if (c && c.a >= 0.95) {
            fond = { r: c.r, g: c.g, b: c.b };
            break;
          }
          n = n.parentElement;
        }
        const t = lire(st.color) ?? { r: 0, g: 0, b: 0, a: 1 };
        const l1 = lum(t);
        const l2 = lum(fond);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

        const px = parseFloat(st.fontSize);
        const gras = parseInt(st.fontWeight, 10) >= 700;
        const seuil = px >= 24 || (gras && px >= 18.66) ? 3 : 4.5;
        if (ratio < seuil - 0.01) {
          sortie.push(`« ${texte.slice(0, 28)} » ${ratio.toFixed(2)} < ${seuil}`);
        }
      });
      return [...new Set(sortie)];
    });

    for (const t of trouves) fautifs.push(`${route} ${t}`);
  }

  console.log("CONTRASTE >>>", fautifs.length, "texte(s) sous le seuil");
  for (const f of fautifs.slice(0, 10)) console.log("   ", f);
  expect(fautifs, fautifs.slice(0, 5).join(" | ")).toHaveLength(0);
});
