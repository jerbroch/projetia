import { test } from "@playwright/test";
import { readFileSync } from "fs";

/**
 * OÙ PART LE TEMPS : le plancher du serveur, l'authentification, les données.
 *
 * On compare une page publique — aucune authentification, aucune requête de
 * données — à une page authentifiée. La différence dit ce que coûte tout ce
 * que la première ne fait pas.
 */
const CREDS = JSON.parse(readFileSync("mesures/compte.json", "utf-8"));
const mediane = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

async function ttfb(page: import("@playwright/test").Page, url: string, n = 7) {
  const v: number[] = [];
  for (let i = 0; i < n; i++) {
    await page.goto(url, { waitUntil: "commit" });
    v.push(
      await page.evaluate(
        () =>
          Math.round(
            (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming)
              .responseStart,
          ),
      ),
    );
  }
  return mediane(v);
}

test("plancher", async ({ page }) => {
  test.setTimeout(300_000);

  console.log(`PLANCHER >>> /login (public, sans auth) ......... ${await ttfb(page, "http://localhost:3000/login")} ms`);

  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Courriel").fill(CREDS.courriel);
  await page.getByLabel("Mot de passe", { exact: true }).fill(CREDS.motDePasse);
  await page.getByRole("button", { name: /Se connecter/ }).click();
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  } catch {
    await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  }

  console.log(`PLANCHER >>> /login (connecté, redirige) ........ ${await ttfb(page, "http://localhost:3000/login")} ms`);
  console.log(`PLANCHER >>> /heures (auth + peu de données) .... ${await ttfb(page, "http://localhost:3000/heures")} ms`);
  console.log(`PLANCHER >>> /dashboard (auth + données) ........ ${await ttfb(page, "http://localhost:3000/dashboard")} ms`);
});
