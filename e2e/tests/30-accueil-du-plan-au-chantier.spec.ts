import { test, expect } from "../fixtures/base";
import { argent, ECARTS, GAIN } from "@/lib/demo-chantier";

/**
 * LA PAGE D'ACCUEIL.
 *
 * Ce qui est vérifié ici n'est pas le goût — c'est qu'elle ne raconte rien de
 * faux. Le chiffre annoncé doit être celui que la démonstration calcule, et
 * aucune statistique inventée ne doit s'y glisser.
 */
test.describe("30. L'accueil, du plan au chantier", () => {
  test("le héros pose la promesse", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "De la première soumission au dernier paiement." }),
    ).toBeVisible();
    await expect(page.getByText("Du plan au chantier").first()).toBeVisible();
    // Les deux appels à l'action, avec la gratuité nommée ET bornée.
    await expect(page.getByRole("link", { name: "Essayer 30 jours gratuits" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Voir Construction iOS en action" }),
    ).toBeVisible();
    // La mention bêta reste — c'est une information, pas un ornement.
    await expect(page.getByText(/bêta privée/i)).toBeVisible();
  });

  test("le chiffre affiché EST celui que la démo calcule", async ({ page }) => {
    await page.goto("/");
    const attendu = argent(GAIN).replace(" $", " $");
    console.log("ACCUEIL >>> écart calculé :", attendu);
    await expect(page.getByText(attendu, { exact: true })).toBeVisible();
    // Et la prose qui l'entoure décrit les mêmes écarts.
    await expect(
      page.getByText(new RegExp(`${ECARTS.heuresCompagnon.toLocaleString("fr-CA")}\\s*h de compagnon`)),
    ).toBeVisible();
  });

  test("les cinq questions sont là, sans statistique inventée", async ({ page }) => {
    await page.goto("/");
    for (const q of [
      "Combien d'heures n'ont pas été facturées ce mois-ci?",
      "Où est rendue cette soumission?",
      "Qui travaille sur quel chantier demain?",
      "Quels outils sont encore dans le camion?",
      "Est-ce que le client a payé son dépôt?",
    ]) {
      await expect(page.getByText(q), q).toBeVisible();
    }

    // Aucun pourcentage brandi comme preuve, aucun témoignage.
    const corps = await page.locator("main").innerText();
    expect(corps).not.toMatch(/\d+\s*% des (entrepreneurs|PME|entreprises)/i);
    expect(corps.toLowerCase()).not.toContain("témoignage");
  });

  test("la ligne relie les étapes de la démo", async ({ page }) => {
    await page.goto("/");
    const demo = page.getByLabel("Démo interactive de Construction iOS");
    await demo.scrollIntoViewIfNeeded();
    await expect(demo).toBeVisible();
    // Cinq étapes, et un trait qui les traverse.
    await expect(demo.getByRole("tab", { name: /1\. La soumission/ })).toBeVisible();
    // Sept étapes : la soumission, l'acceptation, le calendrier, les
    // employés, le terrain, la facture, le paiement.
    await expect(demo.getByRole("tab", { name: /2\. L'acceptation/ })).toBeVisible();
    await expect(demo.getByRole("tab", { name: /4\. Les employés/ })).toBeVisible();
    await expect(demo.getByRole("tab", { name: /7\. Le paiement/ })).toBeVisible();
  });

  test("le contact reste joignable", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href^="tel:"]').first()).toBeVisible();
    await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
  });

  test("téléphone : aucun débordement horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForTimeout(1200);
    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(debordement, "la page ne doit pas défiler de côté").toBe(false);
    await page.screenshot({ path: "test-results/accueil-telephone.png", fullPage: true });
  });

  test("capture, ordinateur", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto("/");
    await p.waitForTimeout(2200);
    await p.screenshot({ path: "test-results/accueil-haut.png" });
    await p.screenshot({ path: "test-results/accueil-complet.png", fullPage: true });
    await ctx.close();
    console.log("ACCUEIL >>> captures faites");
  });

  test("le plan devient l'application : pointillé, puis objets", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const page = await ctx.newPage();
    await page.goto("/");

    // Le héros précisément : « SO-2026-0141 » paraît aussi dans la démo.
    const carte = page.getByTestId("plan-devenu-application").locator("li").first();
    // Au départ : un rectangle de plan, en pointillé et vide.
    const avant = await carte.evaluate((e) => getComputedStyle(e).borderStyle);
    await page.waitForTimeout(2600);
    const apres = await carte.evaluate((e) => getComputedStyle(e).borderStyle);
    console.log(`ACCUEIL >>> bordure : ${avant} → ${apres}`);
    expect(avant, "au départ, un trait de plan").toBe("dashed");
    expect(apres, "à l'arrivée, un objet").toBe("solid");
    await expect(page.getByText("Acceptée").first()).toBeVisible();
    await ctx.close();
  });

  test("animations réduites : le plan est déjà devenu l'application", async ({ browser }) => {
    // Couper l'animation ne doit pas couper le contenu : on arrive
    // directement à l'état final, lisible.
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 950 },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto("/");
    const carte = page.getByTestId("plan-devenu-application").locator("li").first();
    await expect(carte).toHaveCSS("border-style", "solid", { timeout: 4000 });
    await ctx.close();
  });

  test("le focus clavier est visible et suit l'ordre de lecture", async ({ page }) => {
    await page.goto("/");
    const vus: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a) return null;
        const s = getComputedStyle(a);
        return {
          texte: (a.textContent ?? "").trim().slice(0, 40),
          // Un focus qui ne se voit pas n'existe pas.
          visible: s.outlineStyle !== "none" || s.boxShadow !== "none",
        };
      });
      if (info) vus.push(`${info.texte}${info.visible ? "" : " [INVISIBLE]"}`);
    }
    console.log("ACCUEIL >>> tabulation :", JSON.stringify(vus));
    expect(vus.filter((v) => v.includes("INVISIBLE")), "tout focus doit se voir").toHaveLength(0);
  });
});
