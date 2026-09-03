import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";
import { resetSeedJobIfNeeded } from "../helpers/schedule";


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

    // UNE seule action à la fois, nommée par ce qu'elle fait. Le mur de
    // statuts — dont deux marches arrière offertes du même poids visuel — a
    // été remplacé par la suite évidente de l'état courant.
    const dialogue = page.getByRole("dialog");
    await dialogue.getByRole("button", { name: "Commencer les travaux" }).click();

    // Et la suite de « en travail » est la fermeture du chantier.
    await expect(dialogue.getByRole("button", { name: "Travaux terminés" })).toBeVisible({
      timeout: 15000,
    });

    // Les marches arrière existent toujours, mais repliées.
    await expect(dialogue.getByRole("button", { name: /Transport \/ En route/ })).toHaveCount(0);
    await dialogue.getByRole("button", { name: "Corriger le statut" }).click();
    await expect(dialogue.getByRole("button", { name: /Transport \/ En route/ })).toBeVisible();
  });
});
