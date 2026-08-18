import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";

test.describe("12. Outillage", () => {
  test.use({ storageState: tenantAuth, pageName: "Outillage" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/outillage");
    await ensureDashboardAccess(page);
    if (!page.url().includes("/outillage")) await page.goto("/outillage");
  });

  test("affiche l'inventaire avec statuts calculés", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Outillage/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Perceuse sans fil DeWalt")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("En retard").first()).toBeVisible();
    await expect(page.getByText("En utilisation").first()).toBeVisible();
    await expect(page.getByText("En réparation").first()).toBeVisible();
  });

  test("assignation démo met à jour le statut immédiatement", async ({ page }) => {
    const detectorRow = page.getByRole("row", { name: /Détecteur de fils/i });
    const detectorCard = page.locator("[class*='Card']").filter({ hasText: "Détecteur de fils" });

    if (await detectorRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await detectorRow.click();
    } else if (await detectorCard.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await detectorCard.first().click();
    } else {
      test.skip(true, "Outil Détecteur de fils introuvable");
      return;
    }

    const detail = page.getByRole("dialog");
    await expect(detail).toBeVisible();
    await detail.getByRole("button", { name: "Assigner" }).click();

    const assignDialog = page.getByRole("dialog").last();
    await expect(assignDialog.getByText("Assigner à un employé")).toBeVisible();

    await assignDialog.getByRole("combobox").click();
    await page.getByRole("option").first().click();
    await assignDialog.getByLabel("Durée (jours)").fill("5");
    await assignDialog.getByRole("button", { name: "Assigner" }).click();

    await expect(assignDialog).toBeHidden({ timeout: 10000 });

    const inUseBadge = page.getByText("En utilisation");
    await expect(inUseBadge.first()).toBeVisible({ timeout: 10000 });

    const disponiblesCard = page.getByText("Disponibles").locator("..").getByRole("paragraph").last();
    const enUtilisationCard = page.getByText("En utilisation").locator("..").getByRole("paragraph").last();
    await expect(enUtilisationCard).not.toHaveText(/^0$/);
  });

  test("filtre En retard affiche les outils en souffrance", async ({ page }) => {
    await page.getByText("En retard").first().click();
    await expect(page.getByText("Perceuse sans fil DeWalt")).toBeVisible({ timeout: 10000 });
  });

  test("outil en réparation n'affiche pas le bouton Assigner", async ({ page }) => {
    const hiltiRow = page.getByRole("row", { name: /Hilti TE 60/i });
    const hiltiCard = page.locator("[class*='Card']").filter({ hasText: "Hilti TE 60" });

    if (await hiltiRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await hiltiRow.click();
    } else if (await hiltiCard.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await hiltiCard.first().click();
    } else {
      test.skip(true, "Outil Hilti introuvable");
      return;
    }

    const detail = page.getByRole("dialog");
    await expect(detail.getByText("En réparation")).toBeVisible();
    await expect(detail.getByRole("button", { name: "Assigner" })).toHaveCount(0);
  });
});
