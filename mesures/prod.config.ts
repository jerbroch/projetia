import { defineConfig, devices } from "@playwright/test";
// Le même chargement d'environnement que la configuration habituelle : sans
// lui, les épreuves n'ont ni URL ni clé de service.
import "../e2e/load-env";

/**
 * LA SUITE CONTRE UN SERVEUR DE PRODUCTION DÉJÀ DÉMARRÉ.
 *
 * La configuration habituelle lance `npm run dev`, qui se redémarre de
 * lui-même lorsqu'il approche son seuil de mémoire — au milieu d'une longue
 * suite, ce redémarrage fait échouer l'épreuve en cours. Ici, aucun serveur
 * n'est lancé : on vise celui qui tourne déjà, construit en production, qui
 * ne recompile rien et ne redémarre pas.
 *
 * TOUT LE RESTE EST IDENTIQUE, et cela compte : le projet `setup`, les
 * dépendances, la préparation et le nettoyage. Sans le `setup`,
 * les épreuves n'ont pas de session et échouent toutes en délai dépassé —
 * quarante et une l'ont fait avant que cette configuration ne soit complétée,
 * et aucune de ces quarante et une n'était un vrai défaut.
 */
export default defineConfig({
  testDir: "../e2e/tests",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  globalSetup: "../e2e/global-setup.ts",
  globalTeardown: "../e2e/global-teardown.ts",
  projects: [
    { name: "setup", testDir: "../e2e", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop-chrome",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      dependencies: ["setup"],
      testMatch: /09-mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
