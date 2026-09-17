import { test } from "@playwright/test";
import { readFileSync } from "fs";

/**
 * D'OÙ VIENT LA CONSTANTE DE ~820 ms ?
 *
 * Le contenu apparaît à 822 ms avec une dispersion de ±8 ms, alors que le
 * premier octet varie de ±300 ms. Quelque chose d'indépendant du serveur
 * fixe ce délai. On compare donc plusieurs jalons sur la même navigation :
 * si le titre arrive tôt et la table tard, c'est le rendu ; s'ils arrivent
 * ensemble à 820 ms, c'est que la page entière attend quelque chose.
 */
const CREDS = JSON.parse(readFileSync("mesures/compte.json", "utf-8"));
const mediane = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

test("où est la constante", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Courriel").fill(CREDS.courriel);
  await page.getByLabel("Mot de passe", { exact: true }).fill(CREDS.motDePasse);
  await page.getByRole("button", { name: /Se connecter/ }).click();
  try { await page.waitForURL(/\/dashboard/, { timeout: 60000 }); }
  catch { await page.waitForURL(/\/dashboard/, { timeout: 60000 }); }

  const urls: number[] = [];
  const titres: number[] = [];
  const tables: number[] = [];

  for (let i = 0; i < 10; i++) {
    await page.goto("http://localhost:3000/settings", { waitUntil: "load" });
    await page.locator("h1").first().waitFor({ state: "visible" });

    const t0 = Date.now();
    await page.getByRole("navigation").getByRole("link", { name: "Clients", exact: true }).click();

    // 1. L'URL change — le routeur a commis la navigation.
    await page.waitForURL(/\/customers/, { timeout: 60000 });
    urls.push(Date.now() - t0);

    // 2. Le titre de l'écran est là.
    await page.getByRole("heading", { level: 1, name: "Clients" }).waitFor({ state: "visible" });
    titres.push(Date.now() - t0);

    // 3. Les données.
    await page.locator("table tbody tr").first().waitFor({ state: "visible" });
    tables.push(Date.now() - t0);
  }

  console.log(
    `CONSTANTE >>> url ${String(mediane(urls)).padStart(4)} ms · ` +
      `titre ${String(mediane(titres)).padStart(4)} ms · ` +
      `table ${String(mediane(tables)).padStart(4)} ms`,
  );
});
