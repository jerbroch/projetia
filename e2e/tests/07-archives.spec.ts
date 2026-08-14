import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";

test.describe("7. Archives", () => {
  test.use({ storageState: tenantAuth, pageName: "Archives" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/archives");
    await ensureDashboardAccess(page);
  });

  test("page archives charge sans erreur", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: /Archives/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test("recherche archives par client", async ({ page }) => {
    const search = page.getByLabel("Rechercher dans les archives");
    await expect(search).toBeVisible({ timeout: 5000 });
    await search.fill("E2E");
    await page.waitForTimeout(500);
  });
});
