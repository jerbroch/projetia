import { test } from "@playwright/test";
import { readFileSync, writeFileSync } from "fs";

/**
 * TROIS INSTANTS, MESURÉS DEPUIS LE CLIC.
 *
 * Un squelette qui paraît plus tôt n'est pas une action plus rapide. On
 * sépare donc ce que le visiteur vit vraiment :
 *
 *  1. `retour` — le clic est-il reconnu ? L'entrée du menu se marque.
 *  2. `contenu` — les VRAIES données sont à l'écran, pas leur squelette.
 *  3. `utilisable` — le réseau s'est tu, la page ne bouge plus.
 *
 * Le deuxième est le seul qui dise si l'application est réellement plus
 * rapide. Les trois sont donnés pour que le troisième ne masque pas le
 * premier, ni l'inverse.
 */
const CREDS = JSON.parse(readFileSync("mesures/compte.json", "utf-8"));
const mediane = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
const PASSAGES = 5;

/** Ce qui prouve que les données réelles sont là, écran par écran. */
const PARCOURS = [
  ["tableau de bord", "Tableau de bord", "text=Revenus totaux"],
  ["clients", "Clients", "table tbody tr"],
  ["soumissions", "Soumissions", "table tbody tr"],
  /* La preuve doit être une DONNÉE, pas un titre : un titre est déjà là
     pendant que le squelette attend, et la mesure serait fausse. */
  ["factures", "Factures", "table tbody tr"],
  ["horaire", "Calendrier", "[data-event-id]"],
] as const;

/** Un 4G lent : ce qu'on a sur un chantier, pas au bureau. */
const RALENTI = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};

test("du clic à l'écran utilisable", async ({ page, context }) => {
  test.setTimeout(900_000);
  const ralenti = process.env.RALENTI === "1";
  console.log(`CLIC >>> réseau : ${ralenti ? "4G lent (simulé)" : "normal"}`);

  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Courriel").fill(CREDS.courriel);
  await page.getByLabel("Mot de passe", { exact: true }).fill(CREDS.motDePasse);
  await page.getByRole("button", { name: /Se connecter/ }).click();
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  } catch {
    await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  }

  if (ralenti) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", RALENTI);
  }

  const resultats: Record<string, unknown>[] = [];

  for (const [nom, lienMenu, preuveContenu] of PARCOURS) {
    const retours: number[] = [];
    const contenus: number[] = [];
    const utilisables: number[] = [];

    for (let i = 0; i < PASSAGES; i++) {
      // Toujours repartir d'ailleurs, pour que le clic navigue vraiment.
      await page.goto("http://localhost:3000/settings", { waitUntil: "load" });
      await page.locator("h1").first().waitFor({ state: "visible" });

      const lien = page.getByRole("navigation").getByRole("link", { name: lienMenu, exact: true });

      /*
       * LE RETOUR VISUEL EST LE PREMIER CHANGEMENT À L'ÉCRAN, quel qu'il
       * soit : la roue qui remplace l'icône, l'entrée qui se marque, le
       * squelette qui paraît. On pose donc l'observateur AVANT le clic et on
       * note le premier battement du DOM — c'est exactement ce que l'œil
       * perçoit comme « ça a réagi ».
       */
      await page.evaluate(() => {
        (window as unknown as { __premier?: number }).__premier = undefined;
        const o = new MutationObserver(() => {
          const w = window as unknown as { __premier?: number };
          if (w.__premier === undefined) w.__premier = performance.now();
        });
        o.observe(document.body, { childList: true, subtree: true, attributes: true });
        (window as unknown as { __obs?: MutationObserver }).__obs = o;
      });

      const depart = Date.now();
      const tDepart = await page.evaluate(() => performance.now());
      await lien.click();

      await page.waitForFunction(
        () => (window as unknown as { __premier?: number }).__premier !== undefined,
        { timeout: 30000 },
      ).catch(() => {});
      const tPremier = await page.evaluate(
        () => (window as unknown as { __premier?: number }).__premier ?? -1,
      );
      retours.push(tPremier >= 0 ? Math.round(tPremier - tDepart) : Date.now() - depart);

      // 2. Les vraies données, pas le squelette.
      await page.locator(preuveContenu).first().waitFor({ state: "visible", timeout: 90000 });
      contenus.push(Date.now() - depart);

      // 3. Plus rien ne bouge.
      await page.waitForLoadState("networkidle", { timeout: 90000 }).catch(() => {});
      utilisables.push(Date.now() - depart);
    }

    const r = {
      parcours: nom,
      reseau: ralenti ? "4G lent" : "normal",
      retour_ms: mediane(retours),
      contenu_ms: mediane(contenus),
      utilisable_ms: mediane(utilisables),
    };
    resultats.push(r);
    console.log(
      `CLIC >>> ${nom.padEnd(16)} retour ${String(r.retour_ms).padStart(4)} ms · ` +
        `contenu ${String(r.contenu_ms).padStart(5)} ms · utilisable ${String(r.utilisable_ms).padStart(5)} ms`,
    );
  }

  writeFileSync(process.env.SORTIE ?? "mesures/clic.json", JSON.stringify(resultats, null, 2));
});
