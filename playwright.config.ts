import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// L'ORDRE COMPTE. dotenv n'écrase jamais une variable déjà définie : le
// premier fichier chargé l'emporte. `.env.local` était chargé en premier, si
// bien que `.env.e2e` ne pouvait RIEN rediriger — les tests visaient toujours
// la base de `.env.local`, la production. C'est ainsi que 151 entreprises de
// test s'y sont accumulées.
//
// `.env.e2e` passe donc devant. `.env.local` ne sert plus qu'à compléter ce
// qu'il ne définit pas. Les variables déjà présentes dans l'environnement
// (CI) gardent la priorité sur les deux.
dotenv.config({ path: path.resolve(__dirname, ".env.e2e") });
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "e2e/report/html", open: "never" }],
    ["json", { outputFile: "e2e/report/results.json" }],
  ],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
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
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
