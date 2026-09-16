import { defineConfig, devices } from "@playwright/test";
// Le même chargement d'environnement que la configuration habituelle : sans
// lui, les épreuves n'ont ni URL ni clé de service et échouent avant même de
// toucher au serveur.
import "../e2e/load-env";

/**
 * LES ÉPREUVES CONTRE UN SERVEUR DE PRODUCTION DÉJÀ DÉMARRÉ.
 *
 * La configuration habituelle lance `npm run dev`, qui se redémarre de
 * lui-même lorsqu'il approche son seuil de mémoire — au milieu d'une longue
 * suite, ce redémarrage fait échouer l'épreuve en cours. Ici, aucun serveur
 * n'est lancé : on vise celui qui tourne déjà, construit en production, qui
 * ne recompile rien et ne redémarre pas.
 */
export default defineConfig({
  testDir: "../e2e/tests",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
    video: "off",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } }],
});
