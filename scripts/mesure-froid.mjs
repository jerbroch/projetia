/** Première visite sur un chantier : cache vide, 4G. Lecture seule. */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const PAGES = ["/schedule", "/quotes", "/invoices", "/customers", "/terrain"];
const BASE = "http://localhost:3000";
const etat = JSON.parse(fs.readFileSync("e2e/.auth/tenant.json", "utf8"));
const LENT = !process.argv.includes("--rapide");

const nav = await chromium.launch();
console.log(LENT ? "Première visite, cache vide, 4G de chantier\n" : "Première visite, cache vide, réseau local\n");
console.log("page          1er affichage   complet   JS reçu   requêtes réseau");
console.log("─".repeat(70));

for (const chemin of PAGES) {
  // UN CONTEXTE NEUF PAR PAGE : c'est la seule façon d'avoir un cache vide,
  // donc de mesurer ce que vit un employé qui ouvre l'application le matin.
  const ctx = await nav.newContext({ storageState: etat, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  if (LENT) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      latency: 150,
    });
  }

  const depart = Date.now();
  await page.goto(`${BASE}${chemin}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const fcp = await page.evaluate(() => new Promise((r) => {
    const lire = () => performance.getEntriesByName("first-contentful-paint")[0];
    if (lire()) return r(Math.round(lire().startTime));
    new PerformanceObserver(() => { if (lire()) r(Math.round(lire().startTime)); })
      .observe({ type: "paint", buffered: true });
    setTimeout(() => r(lire() ? Math.round(lire().startTime) : null), 15000);
  }));
  await page.waitForLoadState("networkidle").catch(() => {});
  const total = Date.now() - depart;

  const res = await page.evaluate(() => {
    const r = performance.getEntriesByType("resource");
    return {
      js: r.filter((x) => x.initiatorType === "script")
           .reduce((s, x) => s + (x.encodedBodySize || 0), 0),
      n: r.length,
    };
  });

  console.log(
    `${chemin.padEnd(13)} ${String(fcp ?? "?").padStart(8)} ms  ${String(total).padStart(7)} ms  ` +
    `${String(Math.round(res.js / 1024)).padStart(6)} Ko  ${String(res.n).padStart(10)}`);
  await ctx.close();
}
await nav.close();
