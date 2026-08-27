import { test, expect } from "../fixtures/base";
import { loginWithCredentials } from "../helpers/auth";
import {
  cleanupFieldEmployeeTestData,
  createE2EAdmin,
  FIELD_MARKER,
  setupFieldEmployeeTestData,
  type FieldEmployeeTestContext,
} from "../helpers/field-employee";
import { readTestCredentials } from "../helpers/test-data";

test.describe("13. Employé terrain", () => {
  let fieldCtx: FieldEmployeeTestContext;
  let companyId: string;

  test.beforeAll(async () => {
    const creds = readTestCredentials();
    companyId = creds.tenantCompanyId!;
    test.skip(!companyId, "Company ID manquant");

    const admin = createE2EAdmin();
    fieldCtx = await setupFieldEmployeeTestData(admin, companyId);
  });

  test.afterAll(async () => {
    if (!companyId || !fieldCtx) return;
    const admin = createE2EAdmin();
    await cleanupFieldEmployeeTestData(admin, companyId, fieldCtx);
  });

  test("connexion employé redirige vers /terrain", async ({ page }) => {
    await loginWithCredentials(page, fieldCtx.email, fieldCtx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Aujourd'hui" })).toBeVisible();
  });

  test("voit seulement ses calls assignés", async ({ page }) => {
    await loginWithCredentials(page, fieldCtx.email, fieldCtx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    await expect(page.getByText(`${FIELD_MARKER} Call assigné`)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(`${FIELD_MARKER} Call non assigné`)).toHaveCount(0);
  });

  test("bloque l'accès direct à un call non assigné", async ({ page }) => {
    await loginWithCredentials(page, fieldCtx.email, fieldCtx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    const response = await page.goto(`/terrain/calls/${fieldCtx.otherJobId}`);
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByText("Call introuvable")).not.toBeVisible();
    await expect(page.getByRole("heading", { name: `${FIELD_MARKER} Call non assigné` })).toHaveCount(0);
  });

  test("flux statut, heures et matériaux", async ({ page }) => {
    await loginWithCredentials(page, fieldCtx.email, fieldCtx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    await page.getByText(`${FIELD_MARKER} Call assigné`).click();
    await expect(page.getByRole("heading", { name: `${FIELD_MARKER} Call assigné` })).toBeVisible();

    await page.getByRole("button", { name: "Je suis en route" }).click();
    await expect(page.getByText("En route")).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Commencer les travaux" }).click();
    await expect(page.getByText("En travail")).toBeVisible({ timeout: 10000 });

    await page.locator("#hours").fill("2");
    await page.getByRole("button", { name: "Ajouter les heures" }).click();
    await expect(page.getByText("2 h")).toBeVisible({ timeout: 10000 });

    await page.locator("#materialName").fill("Tuyau cuivre");
    await page.getByRole("button", { name: "Ajouter le matériau" }).click();
    await expect(page.getByText("Tuyau cuivre")).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Travaux terminés" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Confirmer travaux terminés" }).click();
    // Le texte « Travaux terminés » est aussi celui de deux boutons : on vise
    // le badge de statut, à côté du titre, plutôt que la page entière.
    await expect(
      page.locator("h1").locator("..").getByText("Travaux terminés", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("page Mes outils accessible", async ({ page }) => {
    await loginWithCredentials(page, fieldCtx.email, fieldCtx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    await page.getByRole("link", { name: "Mes outils" }).click();
    await expect(page.getByRole("heading", { name: "Mes outils" })).toBeVisible();
  });

  test("employé terrain bloqué du dashboard admin", async ({ page }) => {
    await loginWithCredentials(page, fieldCtx.email, fieldCtx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    await page.goto("/dashboard");
    await page.waitForURL(/\/terrain/, { timeout: 15000 });
  });
});
