import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";
import { resetSeedJobIfNeeded } from "../helpers/schedule";
import { readTestCredentials } from "../helpers/test-data";

test.describe("4. Planification", () => {
  test.use({ storageState: tenantAuth, pageName: "Calendrier" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/schedule");
    await ensureDashboardAccess(page);
    if (!page.url().includes("/schedule")) await page.goto("/schedule");
  });

  test("calendrier visible et création d'appel", async ({ page, audit }) => {
    await expect(page.getByRole("heading", { name: "Calendrier", exact: true })).toBeVisible({
      timeout: 15000,
    });

    await expect(page.getByRole("button", { name: "Nouveau travail" })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: "Nouveau travail" }).click();

    const title = `Appel E2E ${Date.now()}`;
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await dialog.getByLabel("Job Title").fill(title);

    const customerSelect = dialog.getByLabel("Select Customer");
    await customerSelect.click();
    await page.getByRole("option").first().click();

    await dialog.getByRole("button", { name: "Create Job" }).click();
    await expect(dialog).toBeHidden({ timeout: 20000 });
    await expect(page.locator("[data-event-id]").filter({ hasText: title })).toBeVisible({
      timeout: 20000,
    });
  });

  test("appel visible après refresh", async ({ page }) => {
    await resetSeedJobIfNeeded();

    const creds = readTestCredentials();
    const jobId = creds.seed?.scheduledJobId;
    test.skip(!jobId, "Seed job manquant — vérifier globalSetup");

    const jobBlock = page.locator(`[data-event-id="${jobId}"]`);
    await expect(jobBlock).toBeVisible({ timeout: 20000 });

    await page.reload();
    await ensureDashboardAccess(page);
    await page.goto("/schedule");
    await expect(page.locator(`[data-event-id="${jobId}"]`)).toBeVisible({ timeout: 15000 });
  });

  test("planifier depuis soumission acceptée", async ({ page, audit }) => {
    await page.goto("/quotes");
    await ensureDashboardAccess(page);
    const scheduleItem = page.getByRole("menuitem", { name: /planifier|calendrier/i }).first();
    const scheduleBtn = page.getByRole("button", { name: /Planifier/i }).first();

    if (await scheduleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scheduleBtn.click();
    } else {
      const menu = page.getByRole("button", { name: /actions|menu/i }).first();
      if (await menu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await menu.click();
        if (await scheduleItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await scheduleItem.click();
        }
      } else {
        audit.addFinding({
          severity: "IMPORTANT",
          page: "/quotes",
          action: "Planifier soumission acceptée",
          expected: "Action planifier disponible",
          actual: "Aucune soumission acceptée ou action indisponible",
          likelyFile: "src/components/quotes/schedule-from-quote-dialog.tsx",
        });
      }
    }
  });
});
