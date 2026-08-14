import { test as setup } from "@playwright/test";
import path from "path";
import { readTestCredentials } from "../helpers/test-data";
import { ensureDashboardAccess } from "../helpers/auth";

const authFile = path.resolve(__dirname, "../.auth/tenant.json");

setup("authenticate tenant", async ({ page }) => {
  const creds = readTestCredentials();
  await page.goto("/login");
  await page.getByLabel("Courriel").fill(creds.tenantEmail);
  await page.getByLabel("Mot de passe").fill(creds.tenantPassword);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/(dashboard|choose-plan|onboarding)/, { timeout: 60000 });
  await ensureDashboardAccess(page);
  await page.context().storageState({ path: authFile });
});
