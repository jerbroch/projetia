import { test } from "@playwright/test";
import { readFileSync } from "fs";

/**
 * OÙ PASSENT LES 820 ms ENTRE LE CLIC ET LE CONTENU.
 *
 * On chronomètre la requête que la navigation déclenche — celle que Next
 * envoie pour obtenir le nouvel écran — et ce qui se passe après elle. Si le
 * temps est dans la requête, le goulot est au serveur ; s'il est après, il
 * est dans le rendu ou l'hydratation côté navigateur.
 */
const CREDS = JSON.parse(readFileSync("mesures/compte.json", "utf-8"));

test("décomposition du clic", async ({ page }) => {
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

  for (const [nom, lien, preuve] of [
    ["clients", "Clients", "table tbody tr"],
    ["soumissions", "Soumissions", "table tbody tr"],
  ] as const) {
    await page.goto("http://localhost:3000/settings", { waitUntil: "load" });
    await page.locator("h1").first().waitFor({ state: "visible" });

    /*
     * Horodatage à l'envoi et à la fin, par nos soins : `request.timing()`
     * compte à partir d'une origine qui n'est pas la nôtre, et le mélanger à
     * `Date.now()` donne des durées absurdes.
     */
    const debuts = new Map<import("@playwright/test").Request, number>();
    const requetes: { url: string; duree: number; rsc: boolean }[] = [];
    const t0 = Date.now();
    const onDebut = (r: import("@playwright/test").Request) => debuts.set(r, Date.now());
    const onFini = (r: import("@playwright/test").Request) => {
      const d = debuts.get(r);
      if (d === undefined) return;
      const u = new URL(r.url());
      requetes.push({
        url: u.pathname,
        duree: Date.now() - d,
        rsc: u.search.includes("_rsc"),
      });
    };
    page.on("request", onDebut);
    page.on("requestfinished", onFini);

    await page.getByRole("navigation").getByRole("link", { name: lien, exact: true }).click();
    await page.locator(preuve).first().waitFor({ state: "visible", timeout: 90000 });
    const total = Date.now() - t0;
    page.off("request", onDebut);
    page.off("requestfinished", onFini);

    const triees = [...requetes].sort((a, b) => b.duree - a.duree);
    const rsc = requetes.filter((r) => r.rsc);
    const plusLongue = triees[0];

    console.log(
      `GOULOT >>> ${nom.padEnd(12)} total ${String(total).padStart(4)} ms · ` +
        `${requetes.length} requêtes dont ${rsc.length} de navigation · ` +
        `la plus longue ${plusLongue?.duree ?? 0} ms · hors réseau ≈ ${total - (plusLongue?.duree ?? 0)} ms`,
    );
    for (const r of triees.slice(0, 4)) {
      console.log(`           ${String(r.duree).padStart(4)} ms  ${r.url}${r.rsc ? " [navigation]" : ""}`);
    }
  }
});
