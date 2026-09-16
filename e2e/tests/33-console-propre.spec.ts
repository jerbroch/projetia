import { test, expect } from "../fixtures/base";
import { connexionLocataire } from "../helpers/auth";

/**
 * AUCUNE ERREUR DE CONSOLE SUR LES PAGES REFONDUES.
 *
 * Une erreur d'hydratation ne casse rien de visible : React reconstruit
 * silencieusement et l'écran a l'air correct. Elle se paie plus tard, en
 * incohérences d'état qu'on ne sait plus rattacher à leur cause. Un bouton
 * imbriqué dans un bouton en avait produit une dans la vue semaine, et seule
 * la console la signalait.
 *
 * Le bruit connu et sans conséquence est filtré nommément — jamais par un
 * seuil de tolérance, qui laisserait passer la prochaine vraie erreur.
 */
const BRUIT = [
  /favicon/i,
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
];

async function erreursDe(page: import("@playwright/test").Page): Promise<string[]> {
  const vues: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") vues.push(m.text());
  });
  page.on("pageerror", (e) => vues.push(e.message));
  return vues;
}

test.describe("33. Console propre", () => {
  test("les pages publiques", async ({ page }) => {
    const erreurs = await erreursDe(page);
    for (const route of ["/", "/login", "/register", "/forgot-password"]) {
      await page.goto(route);
      await page.waitForTimeout(2600);
    }
    const reelles = erreurs.filter((e) => !BRUIT.some((b) => b.test(e)));
    console.log("CONSOLE >>> public :", JSON.stringify(reelles.slice(0, 3)));
    expect(reelles, reelles[0]?.slice(0, 300) ?? "").toHaveLength(0);
  });

  test("le calendrier, en jour et en semaine", async ({ page }) => {
    const erreurs = await erreursDe(page);
    await connexionLocataire(page);
    await page.goto("/schedule");
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Semaine", exact: true }).click();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Jour", exact: true }).click();
    await page.waitForTimeout(1500);

    const reelles = erreurs.filter((e) => !BRUIT.some((b) => b.test(e)));
    console.log("CONSOLE >>> calendrier :", JSON.stringify(reelles.slice(0, 3)));
    expect(reelles, reelles[0]?.slice(0, 300) ?? "").toHaveLength(0);
  });
});
