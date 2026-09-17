import { test } from "@playwright/test";
import { readFileSync } from "fs";

/**
 * LES 530 ms QUI SUIVENT LA RÉPONSE : où passent-elles ?
 *
 * La requête de navigation revient en ~300 ms, mais le contenu n'est visible
 * qu'à ~820 ms. Entre les deux, le navigateur travaille. On mesure trois
 * jalons pour savoir ce qu'il fait :
 *
 *  • `reponse`   — la requête de navigation est revenue.
 *  • `dom`       — la table existe dans le document.
 *  • `visible`   — Playwright la considère visible, donc peinte.
 */
const CREDS = JSON.parse(readFileSync("mesures/compte.json", "utf-8"));
const mediane = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

test("après la réponse", async ({ page }) => {
  test.setTimeout(300_000);

  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Courriel").fill(CREDS.courriel);
  await page.getByLabel("Mot de passe", { exact: true }).fill(CREDS.motDePasse);
  await page.getByRole("button", { name: /Se connecter/ }).click();
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  } catch {
    await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  }

  for (const [nom, lien, route, preuve] of [
    ["clients", "Clients", "/customers", "table tbody tr"],
    ["soumissions", "Soumissions", "/quotes", "table tbody tr"],
  ] as const) {
    const reponses: number[] = [];
    const doms: number[] = [];
    const visibles: number[] = [];

    for (let i = 0; i < 5; i++) {
      await page.goto("http://localhost:3000/settings", { waitUntil: "load" });
      await page.locator("h1").first().waitFor({ state: "visible" });

      let tReponse = 0;
      const t0 = Date.now();
      const onRep = (r: import("@playwright/test").Response) => {
        if (new URL(r.url()).pathname === route && !tReponse) tReponse = Date.now() - t0;
      };
      page.on("response", onRep);

      await page.getByRole("navigation").getByRole("link", { name: lien, exact: true }).click();

      // Présent dans le document — pas encore forcément peint.
      await page.locator(preuve).first().waitFor({ state: "attached", timeout: 90000 });
      const tDom = Date.now() - t0;

      await page.locator(preuve).first().waitFor({ state: "visible", timeout: 90000 });
      const tVisible = Date.now() - t0;

      page.off("response", onRep);
      reponses.push(tReponse);
      doms.push(tDom);
      visibles.push(tVisible);
    }

    console.log(
      `RENDU >>> ${nom.padEnd(12)} réponse ${String(mediane(reponses)).padStart(4)} ms · ` +
        `dans le document ${String(mediane(doms)).padStart(4)} ms · ` +
        `visible ${String(mediane(visibles)).padStart(4)} ms`,
    );
  }
});
