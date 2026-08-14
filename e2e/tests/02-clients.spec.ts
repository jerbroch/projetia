import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";
import { E2E_SEED_MARKER } from "../helpers/seed-data";
import { readTestCredentials } from "../helpers/test-data";

function customerLocator(page: import("@playwright/test").Page, name: string) {
  return page.locator(`[data-testid^="customer-row-"]`).filter({ hasText: name });
}

test.describe("2. Clients", () => {
  test.use({ storageState: tenantAuth, pageName: "Clients" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/customers");
    await ensureDashboardAccess(page);
    if (!page.url().includes("/customers")) await page.goto("/customers");
  });

  test("créer un client et persister après refresh", async ({ page }) => {
    const uniqueName = `Client E2E ${Date.now()}`;
    const address = "123 Rue Laval, Montréal";

    await page.getByRole("button", { name: "Créer un client" }).click();
    await page.getByLabel("Nom du client").fill(uniqueName);
    await page.getByLabel("Courriel").fill(`client${Date.now()}@test.local`);
    await page.getByLabel("Adresse").fill(address);
    await page.getByRole("button", { name: "Créer le client" }).click();

    await expect(customerLocator(page, uniqueName)).toBeVisible({ timeout: 15000 });

    await page.reload();
    await ensureDashboardAccess(page);
    await expect(customerLocator(page, uniqueName)).toBeVisible({ timeout: 15000 });
  });

  test("recherche par nom", async ({ page }) => {
    const creds = readTestCredentials();
    const seedName = creds.seed?.customerName ?? `${E2E_SEED_MARKER} Client`;

    await page.getByLabel("Rechercher des clients").fill("Laval");
    await page.waitForTimeout(500);
    await expect(customerLocator(page, seedName)).toBeVisible({ timeout: 10000 });
  });

  test("recherche par adresse", async ({ page }) => {
    const creds = readTestCredentials();
    const seedName = creds.seed?.customerName ?? `${E2E_SEED_MARKER} Client`;

    await page.getByLabel("Rechercher des clients").fill("456 Rue Laval");
    await page.waitForTimeout(500);
    await expect(customerLocator(page, seedName)).toBeVisible({ timeout: 10000 });
  });

  test("autocomplete après 3 caractères", async ({ page }) => {
    const searchInput = page.getByLabel("Rechercher des clients");
    await searchInput.fill("ab");
    await expect(page.getByTestId("customers-search-suggestions")).toHaveCount(0);

    await searchInput.fill("E2E");
    await expect(page.getByTestId("customers-search-suggestions")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("option").first()).toBeVisible();
  });

  test("ouvrir, modifier, enregistrer et persister", async ({ page }) => {
    const uniqueName = `Client CRUD ${Date.now()}`;
    const updatedName = `${uniqueName} Modifié`;

    await page.getByRole("button", { name: "Créer un client" }).click();
    await page.getByLabel("Nom du client").fill(uniqueName);
    await page.getByLabel("Adresse").fill("789 Rue Test, Laval");
    await page.getByRole("button", { name: "Créer le client" }).click();
    await expect(customerLocator(page, uniqueName)).toBeVisible({ timeout: 15000 });

    await customerLocator(page, uniqueName).click();
    await expect(page.getByTestId("customer-detail-panel")).toBeVisible();
    await page.getByRole("button", { name: "Modifier" }).click();
    await page.getByLabel("Nom du client").fill(updatedName);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(customerLocator(page, updatedName).first()).toBeVisible({ timeout: 15000 });

    await page.reload();
    await ensureDashboardAccess(page);
    await expect(customerLocator(page, updatedName).first()).toBeVisible({ timeout: 15000 });
  });

  test("supprimer avec confirmation", async ({ page }) => {
    const uniqueName = `Client Delete ${Date.now()}`;

    await page.getByRole("button", { name: "Créer un client" }).click();
    await page.getByLabel("Nom du client").fill(uniqueName);
    await page.getByRole("button", { name: "Créer le client" }).click();
    await expect(customerLocator(page, uniqueName)).toBeVisible({ timeout: 15000 });

    await customerLocator(page, uniqueName).click();
    await page.getByRole("button", { name: "Supprimer" }).first().click();
    await page.getByRole("button", { name: "Supprimer" }).last().click();

    await expect(customerLocator(page, uniqueName)).toHaveCount(0, { timeout: 15000 });

    await page.reload();
    await ensureDashboardAccess(page);
    await expect(customerLocator(page, uniqueName)).toHaveCount(0);
  });
});
