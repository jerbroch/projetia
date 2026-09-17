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
/** LES TREIZE ÉCRANS, pas un échantillon. */
const ECRANS = [
  "/dashboard",
  "/customers",
  "/quotes",
  "/reviews",
  "/invoices",
  "/schedule",
  "/archives",
  "/employees",
  "/heures",
  "/outillage",
  "/payments",
  "/settings",
  "/aide",
] as const;

/** Et les pages publiques d'authentification. */
const PUBLIQUES = ["/login", "/register", "/forgot-password"] as const;


/**
 * Les textes dont le contraste tombe sous le seuil, sur la page en cours.
 *
 * ELLE EMPILE LES FONDS SEMI-TRANSPARENTS au lieu de les ignorer. Une
 * première version ne retenait que les fonds opaques : elle sautait
 * par-dessus un bloc de calendrier posé en rgba(…, 0.9) et comparait le
 * texte blanc au blanc de la carte derrière — ratio 1,00, un verdict qui ne
 * décrit rien. Composé correctement, ce même bloc donnait 3,91, ce qui était
 * un vrai défaut.
 */
async function textesSousLeSeuil(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() => {
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
      if (e.children.length > 0) return;
      const texte = (e.textContent ?? "").trim();
      if (!texte) return;
      const st = getComputedStyle(e);
      if (st.visibility === "hidden" || st.display === "none" || st.opacity === "0") return;
      const b = e.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) return;

      const couches: { r: number; g: number; b: number; a: number }[] = [];
      let n: Element | null = e;
      while (n) {
        const c = lire(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0) {
          couches.push(c);
          if (c.a >= 0.999) break;
        }
        n = n.parentElement;
      }
      let fond = { r: 255, g: 255, b: 255 };
      for (let i = couches.length - 1; i >= 0; i--) {
        const c = couches[i];
        fond = {
          r: c.a * c.r + (1 - c.a) * fond.r,
          g: c.a * c.g + (1 - c.a) * fond.g,
          b: c.a * c.b + (1 - c.a) * fond.b,
        };
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
}

test("les pages publiques : aucun texte sous le seuil", async ({ page }) => {
  const fautifs: string[] = [];
  for (const route of PUBLIQUES) {
    await page.goto(route);
    await page.waitForTimeout(1400);
    for (const x of await textesSousLeSeuil(page)) fautifs.push(`${route} ${x}`);
  }
  console.log("CONTRASTE >>> publiques :", fautifs.length, "fautif(s)");
  for (const f of fautifs.slice(0, 8)) console.log("   ", f);
  expect(fautifs, fautifs.slice(0, 4).join(" | ")).toHaveLength(0);
});

test("aucun texte sous le seuil WCAG AA", async ({ page }) => {
  // Treize écrans à visiter et à mesurer : le délai par défaut de 90 s ne
  // suffit pas quand le serveur compile une route au passage.
  test.setTimeout(240_000);
  await connexionLocataire(page);
  const fautifs: string[] = [];

  for (const route of ECRANS) {
    await page.goto(route);
    /*
     * ATTENDRE QUE L'ÉCRAN SOIT STABLE, pas seulement présent.
     *
     * Le titre paraît avant la fin de l'hydratation : mesurer là, c'est
     * parfois mesurer une couleur transitoire. Cette épreuve a été marquée
     * instable en intégration continue pour cette raison — échouée au premier
     * essai, réussie au second, sur un écran qui n'avait pas changé.
     */
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    const trouves = await textesSousLeSeuil(page);
    for (const t of trouves) fautifs.push(`${route} ${t}`);
  }

  console.log("CONTRASTE >>>", fautifs.length, "texte(s) sous le seuil");
  for (const f of fautifs.slice(0, 10)) console.log("   ", f);
  expect(fautifs, fautifs.slice(0, 5).join(" | ")).toHaveLength(0);
});
