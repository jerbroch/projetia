import { test, expect, tenantAuth } from "../fixtures/base";
import { loginWithCredentials, ensureDashboardAccess } from "../helpers/auth";
import { tableCell } from "../helpers/locators";
import { readTestCredentials } from "../helpers/test-data";
import { E2E_SEED_MARKER } from "../helpers/seed-data";
import { resetSeedJobIfNeeded } from "../helpers/schedule";

function customerLocator(page: import("@playwright/test").Page, name: string) {
  return page.locator(`[data-testid^="customer-row-"]`).filter({ hasText: name });
}

const ADMIN_SECTIONS = [
  { path: "/admin", label: "Administration" },
  { path: "/admin/companies", label: "Entreprises" },
  { path: "/admin/feedback", label: "Commentaires" },
  { path: "/admin/roadmap", label: "Feuille de route" },
  { path: "/admin/revenue", label: "Revenus" },
  { path: "/admin/test-users", label: "Comptes test" },
];

test.describe("8. Super Admin", () => {
  test.use({ pageName: "Super Admin" });

  test("utilisateur normal — /admin refusé", async ({ browser }) => {
    const context = await browser.newContext({ storageState: tenantAuth });
    const page = await context.newPage();
    await page.goto("/admin");
    await page.waitForURL(/\/(dashboard|login)/, { timeout: 15000 });
    expect(page.url()).not.toContain("/admin");
    await context.close();
  });

  test("super_admin — sections admin principales", async ({ page }) => {
    const creds = readTestCredentials();
    expect(creds.superAdminEmail, "Super admin doit être provisionné par globalSetup").toBeTruthy();

    await loginWithCredentials(page, creds.superAdminEmail!, creds.superAdminPassword!);
    await page.waitForURL(/\/(admin|dashboard|choose-plan)/, { timeout: 30000 });
    await ensureDashboardAccess(page);

    if (!page.url().includes("/admin")) {
      await page.goto("/dashboard");
      await ensureDashboardAccess(page);
      const quickLink = page.getByTestId("super-admin-quick-link");
      await expect(quickLink).toBeVisible({ timeout: 15000 });
      await quickLink.click();
      await page.waitForURL(/\/admin/, { timeout: 15000 });
    }

    await expect(
      page.getByRole("heading", { name: /Administration|Super Admin|Tableau de bord/i }).first()
    ).toBeVisible({ timeout: 15000 });

    for (const section of ADMIN_SECTIONS) {
      const response = await page.goto(section.path);
      expect(response?.status(), `${section.path} should not 5xx`).toBeLessThan(500);
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 15000 });
    }

    const returnLink = page.getByRole("link", { name: /Retour|entreprise|dashboard/i });
    if (await returnLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await returnLink.click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    }
  });

  test("isolation multi-tenant — tenant A ne voit pas données B", async ({ browser }) => {
    await resetSeedJobIfNeeded();

    const context = await browser.newContext({ storageState: tenantAuth });
    const page = await context.newPage();
    await page.goto("/customers");
    await ensureDashboardAccess(page);

    const creds = readTestCredentials();
    const seedName = creds.seed?.customerName;
    if (seedName) {
      await page.getByLabel("Rechercher des clients").fill(E2E_SEED_MARKER);
      await expect(tableCell(page, seedName)).toBeVisible({
        timeout: 15000,
      });
    }

    const foreignMarker = page.getByText(/DEMO|Autre entreprise|company-b/i);
    await expect(foreignMarker).toHaveCount(0);
    await context.close();
  });
});
