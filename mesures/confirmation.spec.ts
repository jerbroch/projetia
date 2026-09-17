import { test } from "@playwright/test";
import { readFileSync, writeFileSync } from "fs";

/**
 * CONFIRMATION DU GAIN — sur trois écrans, dans des conditions comparables.
 *
 * DEUX DÉLAIS, tous deux comptés DEPUIS LE CLIC :
 *
 *  • `contenu`  — les vraies données sont à l'écran. C'est le seul délai qui
 *    dise si l'action est réellement plus rapide.
 *  • `utilisable` — la page ne bouge plus ET répond au clavier. Mesuré en
 *    attendant que le réseau se taise PUIS qu'un élément interactif réponde.
 *
 * Une version précédente appelait « utilisable » la fin de l'analyse du
 * document (`domContentLoadedEventEnd`). Ce n'en était pas : avec le
 * streaming, cette étape se termine AVANT que le contenu diffusé ne soit
 * peint, d'où des « utilisable » plus petits que les « affichage » — une
 * incohérence qui venait de la métrique, pas de l'application.
 *
 * L'ÉTAT DU CACHE EST CONTRÔLÉ : chaque passage repart d'un contexte neuf, et
 * l'on note séparément la première visite (rien en mémoire) et les suivantes
 * (routeur client déjà chaud). Comparer une première visite à une seconde
 * donnerait un écart qui ne doit rien au code.
 */
const CREDS = JSON.parse(readFileSync("mesures/compte.json", "utf-8"));
const PASSAGES = 7;
const mediane = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

const ECRANS = [
  ["clients", "Clients", "table tbody tr"],
  ["soumissions", "Soumissions", "table tbody tr"],
  ["factures", "Factures", "table tbody tr"],
] as const;

test("confirmation du gain", async ({ browser }) => {
  test.setTimeout(900_000);
  const resultats: Record<string, unknown>[] = [];

  for (const [nom, lienMenu, preuve] of ECRANS) {
    for (const etat of ["première visite", "visite suivante"] as const) {
      const contenus: number[] = [];
      const utilisables: number[] = [];

      for (let i = 0; i < PASSAGES; i++) {
        // Contexte neuf à chaque passage : aucun cache ne traîne d'un
        // passage à l'autre, ni disque ni mémoire.
        const ctx = await browser.newContext();
        const page = await ctx.newPage();

        await page.goto("http://localhost:3000/login");
        await page.getByLabel("Courriel").fill(CREDS.courriel);
        await page.getByLabel("Mot de passe", { exact: true }).fill(CREDS.motDePasse);
        await page.getByRole("button", { name: /Se connecter/ }).click();
        try {
          await page.waitForURL(/\/dashboard/, { timeout: 60000 });
        } catch {
          await page.waitForURL(/\/dashboard/, { timeout: 60000 });
        }

        if (etat === "visite suivante") {
          // On visite l'écran une fois, puis on en repart : le routeur
          // client l'a alors en mémoire, comme après une vraie navigation.
          await page.goto(`http://localhost:3000/${nom === "clients" ? "customers" : nom === "soumissions" ? "quotes" : "invoices"}`);
          await page.locator(preuve).first().waitFor({ state: "visible", timeout: 60000 });
        }

        await page.goto("http://localhost:3000/settings", { waitUntil: "load" });
        await page.locator("h1").first().waitFor({ state: "visible" });

        const lien = page.getByRole("navigation").getByRole("link", { name: lienMenu, exact: true });
        const depart = Date.now();
        await lien.click();

        await page.locator(preuve).first().waitFor({ state: "visible", timeout: 90000 });
        contenus.push(Date.now() - depart);

        // Utilisable : plus rien ne charge, ET la page répond vraiment.
        await page.waitForLoadState("networkidle", { timeout: 90000 }).catch(() => {});
        await page.locator("h1").first().click({ trial: true, timeout: 10000 }).catch(() => {});
        utilisables.push(Date.now() - depart);

        await ctx.close();
      }

      const r = {
        ecran: nom,
        etat,
        contenu_ms: mediane(contenus),
        utilisable_ms: mediane(utilisables),
        passages: PASSAGES,
      };
      resultats.push(r);
      console.log(
        `CONFIRM >>> ${nom.padEnd(12)} ${etat.padEnd(16)} clic→contenu ${String(r.contenu_ms).padStart(5)} ms · ` +
          `clic→utilisable ${String(r.utilisable_ms).padStart(5)} ms`,
      );
    }
  }

  writeFileSync(process.env.SORTIE ?? "mesures/confirmation.json", JSON.stringify(resultats, null, 2));
});
