import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";
import { clickQuickStatusIfEnabled, resetSeedJobIfNeeded } from "../helpers/schedule";

const STATUS_FLOW = [
  { label: /Transport \/ En route|En route/i },
  { label: /En travail|En cours/i },
];

test.describe("5. Statuts d'appel", () => {
  test.use({ storageState: tenantAuth, pageName: "Statuts" });

  test("transitions de statut sur calendrier", async ({ page }) => {
    const seed = await resetSeedJobIfNeeded();
    test.skip(!seed?.scheduledJobId, "Seed job manquant — vérifier globalSetup");

    await page.goto("/schedule");
    await ensureDashboardAccess(page);

    const jobBlock = page.locator(`[data-event-id="${seed!.scheduledJobId}"]`);
    await expect(jobBlock).toBeVisible({ timeout: 15000 });
    await jobBlock.click();

    for (const step of STATUS_FLOW) {
      await clickQuickStatusIfEnabled(page, step.label);
    }

    const completedBtn = page.getByRole("button", { name: "Travaux terminés" });
    await expect(completedBtn).toBeVisible({ timeout: 5000 });
  });
});
