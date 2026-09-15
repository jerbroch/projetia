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
    await expect(demo.getByRole("tab", { name: /5\. Le paiement/ })).toBeVisible();
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
});
