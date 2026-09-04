import { test, expect } from "../fixtures/base";
import { loginWithCredentials } from "../helpers/auth";
import {
  cleanupFieldEmployeeTestData, createE2EAdmin, setupFieldEmployeeTestData,
  type FieldEmployeeTestContext,
} from "../helpers/field-employee";
import { readTestCredentials } from "../helpers/test-data";

/**
 * La barre du bas est `fixed` : elle recouvre le contenu si la marge réservée
 * est plus petite qu'elle. Le 2 septembre, un quatrième onglet a été ajouté
 * dans une grille de trois colonnes — la barre est passée à deux rangées et
 * 133 px, pour 96 px réservés. Le bas des cartes est passé dessous.
 *
 * Ces épreuves mesurent, elles ne regardent pas : un recouvrement de 37 px ne
 * se voit pas sur une capture d'écran qu'on parcourt vite.
 */
test.describe("20. Terrain sur téléphone", () => {
  let ctx: FieldEmployeeTestContext;
  let companyId: string;

  test.beforeAll(async () => {
    companyId = readTestCredentials().tenantCompanyId!;
    test.skip(!companyId, "Company ID manquant");
    ctx = await setupFieldEmployeeTestData(createE2EAdmin(), companyId);
  });
  test.afterAll(async () => {
    if (companyId && ctx) await cleanupFieldEmployeeTestData(createE2EAdmin(), companyId, ctx);
  });

  test.use({ viewport: { width: 390, height: 844 } });

  test("la barre du bas ne recouvre rien, sur les quatre écrans", async ({ page }) => {
    await loginWithCredentials(page, ctx.email, ctx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });

    for (const chemin of ["/terrain", "/terrain/horaire", "/terrain/outils", `/terrain/calls/${ctx.jobId}`]) {
      await page.goto(chemin);
      await page.waitForTimeout(900);

      const m = await page.evaluate(() => {
        const nav = document.querySelector("nav");
        const main = document.querySelector("main");
        if (!nav || !main) return null;
        const r = nav.getBoundingClientRect();
        const style = getComputedStyle(main);
        return {
          hauteurBarre: Math.round(r.height),
          rangees: Math.round(r.height) > 90 ? 2 : 1,
          margeReservee: Math.round(parseFloat(style.paddingBottom)),
          debordement: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      expect(m, chemin).not.toBeNull();
      // Une seule rangée : le nombre de colonnes suit le nombre d'onglets.
      expect(m!.rangees, `${chemin} — la barre tient sur une rangée`).toBe(1);
      // La marge doit couvrir la barre, sinon le bas du contenu passe dessous.
      expect(m!.margeReservee, `${chemin} — marge ≥ barre`).toBeGreaterThanOrEqual(m!.hauteurBarre);
      expect(m!.debordement, `${chemin} — aucun débordement horizontal`).toBeLessThanOrEqual(1);

      console.log(`MOBILE >>> ${chemin.padEnd(30)} barre ${m!.hauteurBarre} px · marge ${m!.margeReservee} px`);
    }
  });

  test("le dernier onglet est atteignable, pas caché sous un autre", async ({ page }) => {
    await loginWithCredentials(page, ctx.email, ctx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });

    const onglets = page.locator("nav a");
    await expect(onglets).toHaveCount(4);
    for (const nom of ["Aujourd'hui", "Mon horaire", "Mes outils", "Joindre"]) {
      const onglet = page.locator("nav a", { hasText: nom });
      await expect(onglet, `l'onglet ${nom} est visible`).toBeVisible();
    }
    // Le dernier doit répondre au clic : s'il est recouvert, il ne répond pas.
    await page.locator("nav a", { hasText: "Joindre" }).click();
    await page.waitForURL(/\/terrain\/aide/, { timeout: 20000 });
    console.log("MOBILE >>> les quatre onglets sont visibles et cliquables");
  });
});
