import { test } from "@playwright/test";
import { readFileSync } from "fs";

/**
 * OÙ PASSENT VRAIMENT LES 600 ms — sans rien déduire.
 *
 * Une version précédente notait l'arrivée des EN-TÊTES de la réponse et
 * appelait « travail du navigateur » tout ce qui suivait. C'était une
 * déduction, pas une mesure : les en-têtes arrivent au premier octet, et le
 * corps d'un flux RSC peut continuer d'arriver longtemps après.
 *
 * On relève donc, pour la requête de navigation elle-même :
 *   • `premierOctet`  — `responseStart`, les en-têtes.
 *   • `finReception`  — `responseEnd`, le dernier octet du corps.
 *   • `octets`        — ce qui a été transféré.
 *
 * Et pour ce qui suit, on ne devine pas non plus : on relève les TÂCHES
 * LONGUES du fil principal, celles qui bloquent réellement l'affichage.
 */
const CREDS = JSON.parse(readFileSync("mesures/compte.json", "utf-8"));
const mediane = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
/** Écart entre le 1er et le 3e quartile : la dispersion, sans se laisser
 *  emporter par une valeur extrême. */
const dispersion = (v: number[]) => {
  const t = [...v].sort((a, b) => a - b);
  return t[Math.floor(t.length * 0.75)] - t[Math.floor(t.length * 0.25)];
};
const PASSAGES = Number(process.env.PASSAGES ?? 12);

test("décomposition sans déduction", async ({ page }) => {
  test.setTimeout(600_000);

  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Courriel").fill(CREDS.courriel);
  await page.getByLabel("Mot de passe", { exact: true }).fill(CREDS.motDePasse);
  await page.getByRole("button", { name: /Se connecter/ }).click();
  try { await page.waitForURL(/\/dashboard/, { timeout: 60000 }); }
  catch { await page.waitForURL(/\/dashboard/, { timeout: 60000 }); }

  for (const [nom, lien, route, preuve] of [
    ["clients", "Clients", "/customers", "table tbody tr"],
    ["soumissions", "Soumissions", "/quotes", "table tbody tr"],
  ] as const) {
    const po: number[] = [];
    const fin: number[] = [];
    const visible: number[] = [];
    const taches: number[] = [];
    const poids: number[] = [];

    for (let i = 0; i < PASSAGES; i++) {
      await page.goto("http://localhost:3000/settings", { waitUntil: "load" });
      await page.locator("h1").first().waitFor({ state: "visible" });

      // Observateur de tâches longues, posé avant le clic.
      await page.evaluate(() => {
        const w = window as unknown as { __longues?: number[]; __obsL?: PerformanceObserver };
        w.__longues = [];
        try {
          const o = new PerformanceObserver((l) => {
            for (const e of l.getEntries()) w.__longues!.push(Math.round(e.duration));
          });
          o.observe({ type: "longtask", buffered: false });
          w.__obsL = o;
        } catch { /* non pris en charge : on le dira */ }
        performance.clearResourceTimings();
        (window as unknown as { __t0?: number }).__t0 = performance.now();
      });

      const t0 = Date.now();
      await page.getByRole("navigation").getByRole("link", { name: lien, exact: true }).click();
      await page.locator(preuve).first().waitFor({ state: "visible", timeout: 90000 });
      visible.push(Date.now() - t0);

      const releve = await page.evaluate((chemin) => {
        const w = window as unknown as { __longues?: number[]; __t0?: number };
        const base = w.__t0 ?? 0;
        // La requête de navigation : celle qui porte le chemin demandé.
        const r = performance
          .getEntriesByType("resource")
          .filter((e) => e.name.includes(chemin))
          .map((e) => e as PerformanceResourceTiming)
          .sort((a, b) => b.responseEnd - a.responseEnd)[0];
        return {
          premierOctet: r ? Math.round(r.responseStart - base) : -1,
          finReception: r ? Math.round(r.responseEnd - base) : -1,
          octets: r ? r.transferSize || r.encodedBodySize : 0,
          longues: w.__longues ?? [],
        };
      }, route);

      if (releve.premierOctet >= 0) {
        po.push(releve.premierOctet);
        fin.push(releve.finReception);
        poids.push(releve.octets);
      }
      taches.push(releve.longues.reduce((s, d) => s + d, 0));
    }

    console.log(
      `TRACE >>> ${nom.padEnd(12)} octet ${String(mediane(po) || 0).padStart(4)}±${String(dispersion(po) || 0).padStart(3)} · ` +
        `réception ${String(mediane(fin) || 0).padStart(4)}±${String(dispersion(fin) || 0).padStart(3)} · ` +
        `contenu ${String(mediane(visible)).padStart(4)}±${String(dispersion(visible)).padStart(3)} ms · ` +
        `tâches ${String(mediane(taches)).padStart(3)} ms · ${Math.round((mediane(poids) || 0) / 1024)} Ko · ` +
        `${PASSAGES} passages`,
    );
  }
});
