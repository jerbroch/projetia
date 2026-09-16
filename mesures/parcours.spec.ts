import { test } from "@playwright/test";
import { readFileSync, writeFileSync } from "fs";

/**
 * MESURE DES PARCOURS, SUR UN BUILD DE PRODUCTION.
 *
 * MÉDIANE SUR CINQ PASSAGES, jamais une valeur unique : sur un même écran,
 * deux mesures consécutives pouvaient varier du simple au double. Conclure
 * d'un seul passage, c'est mesurer le bruit.
 *
 * Trois grandeurs, parce qu'elles se corrigent différemment :
 *  • `ttfb` — premier octet : le rendu serveur et ce qu'il attend, donc
 *    essentiellement Supabase.
 *  • `utilisable` — du départ jusqu'à ce que le contenu soit à l'écran.
 *  • `requetes` — le nombre d'appels réseau de la page.
 */
const CREDS = JSON.parse(readFileSync("mesures/compte.json", "utf-8"));
const PASSAGES = 5;

const PARCOURS = [
  ["tableau de bord", "/dashboard"],
  ["clients", "/customers"],
  ["soumissions", "/quotes"],
  ["factures", "/invoices"],
  ["horaire", "/schedule"],
  ["outillage", "/outillage"],
  ["heures", "/heures"],
] as const;

const mediane = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

test("mesure des parcours", async ({ page, context }) => {
  test.setTimeout(900_000);
  const ralenti = process.env.RALENTI === "1";

  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Courriel").fill(CREDS.courriel);
  await page.getByLabel("Mot de passe", { exact: true }).fill(CREDS.motDePasse);
  await page.getByRole("button", { name: /Se connecter/ }).click();
  try {
    await page.waitForURL(/\/(dashboard|choose-plan|onboarding)/, { timeout: 60000 });
  } catch {
    await page.waitForURL(/\/(dashboard|choose-plan|onboarding)/, { timeout: 60000 });
  }

  if (ralenti) {
    /*
     * 4G LENT : 1,6 Mb/s en descente, 150 ms de latence. C'est le réseau d'un
     * chantier, pas d'un bureau. Il s'applique à un CHARGEMENT COMPLET — une
     * navigation cliente ne transfère qu'une réponse légère où cette latence
     * se noie, et la mesurer là ne dirait rien du réseau.
     */
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      latency: 150,
    });
  }
  console.log(`MESURE >>> réseau : ${ralenti ? "4G lent (simulé)" : "normal"}`);

  const resultats: Record<string, unknown>[] = [];

  for (const [nom, route] of PARCOURS) {
    const ttfbs: number[] = [];
    const fcps: number[] = [];
    const utilisables: number[] = [];
    let requetes = 0;

    for (let i = 0; i < PASSAGES; i++) {
      let n = 0;
      const compter = () => { n += 1; };
      page.on("request", compter);

      await page.goto(`http://localhost:3000${route}`, { waitUntil: "load" });
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 60000 });

      const t = await page.evaluate(() => {
        const e = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        // Le premier affichage : le moment où quelque chose apparaît à
        // l'écran. Avec le streaming, c'est lui qui dit ce que la personne
        // voit — le premier octet ne le dit plus.
        const fcp = performance
          .getEntriesByType("paint")
          .find((p) => p.name === "first-contentful-paint");
        return {
          ttfb: Math.round(e.responseStart),
          fin: Math.round(e.domContentLoadedEventEnd),
          fcp: fcp ? Math.round(fcp.startTime) : -1,
        };
      });
      page.off("request", compter);

      ttfbs.push(t.ttfb);
      utilisables.push(t.fin);
      if (t.fcp >= 0) fcps.push(t.fcp);
      requetes = n;
    }

    const r = {
      parcours: nom,
      route,
      ttfb_ms: mediane(ttfbs),
      affichage_ms: fcps.length ? mediane(fcps) : null,
      utilisable_ms: mediane(utilisables),
      requetes,
    };
    resultats.push(r);
    console.log(
      `MESURE >>> ${nom.padEnd(16)} octet ${String(r.ttfb_ms).padStart(4)} ms · ` +
        `affichage ${String(r.affichage_ms ?? "—").padStart(4)} ms · ` +
        `utilisable ${String(r.utilisable_ms).padStart(4)} ms · ${r.requetes} req.`,
    );
  }

  writeFileSync(process.env.SORTIE ?? "mesures/resultats.json", JSON.stringify(resultats, null, 2));
});
