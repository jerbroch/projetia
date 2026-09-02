import { test, expect, tenantAuth } from "../fixtures/base";
import { COURRIEL_LIVRE } from "../helpers/adresses-de-test";
import { ensureDashboardAccess } from "../helpers/auth";
import { archiveJobRow, invoiceCustomerCell, quoteNumberCell, tableCell } from "../helpers/locators";
import { clickQuickStatusIfEnabled, resetSeedJobIfNeeded } from "../helpers/schedule";
import { E2E_SEED_MARKER } from "../helpers/seed-data";
import { readTestCredentials } from "../helpers/test-data";

async function closeWorkFromSchedule(
  page: import("@playwright/test").Page,
  description: string
): Promise<void> {
  await page.getByRole("button", { name: "Travaux terminés" }).click();
  const closeDialog = page.getByRole("dialog", { name: /Fermer le travail/i });
  await expect(closeDialog).toBeVisible({ timeout: 10000 });
  await closeDialog.getByLabel("Travaux effectués *").fill(description);
  const closeBtn = closeDialog.getByRole("button", { name: "Fermer le travail" });
  await expect(closeBtn).toBeEnabled({ timeout: 20000 });
  await closeBtn.click();
  await expect(closeDialog).toBeHidden({ timeout: 20000 });
}

test.describe("11. Parcours métier complet", () => {
  test.use({ storageState: tenantAuth, pageName: "Parcours complet" });

  test("seed → statuts → review → facture → envoi unique", async ({ page }) => {
    test.setTimeout(300_000);

    const creds = readTestCredentials();
    const seed = creds.seed;
    test.skip(!seed, "Données seed E2E manquantes — vérifier globalSetup");

    const refreshedSeed = await resetSeedJobIfNeeded();
    const activeSeed = refreshedSeed ?? seed!;

    await page.goto("/customers");
    await ensureDashboardAccess(page);
    await page.getByLabel("Rechercher des clients").fill(E2E_SEED_MARKER);
    await expect(tableCell(page, activeSeed.customerName)).toBeVisible({
      timeout: 15000,
    });

    await page.goto("/quotes");
    await ensureDashboardAccess(page);
    await expect(quoteNumberCell(page, activeSeed.quoteNumber)).toBeVisible({ timeout: 15000 });

    await page.goto("/schedule");
    await ensureDashboardAccess(page);

    const jobBlock = page.locator(`[data-event-id="${activeSeed.scheduledJobId}"]`);
    await expect(jobBlock).toBeVisible({ timeout: 15000 });
    await jobBlock.click();

    await clickQuickStatusIfEnabled(page, "Transport / En route");
    await clickQuickStatusIfEnabled(page, "En travail");

    await closeWorkFromSchedule(page, "Travaux E2E terminés — parcours complet");

    await page.goto("/archives");
    await ensureDashboardAccess(page);
    await page.getByLabel("Rechercher dans les archives").fill(E2E_SEED_MARKER);
    await expect(archiveJobRow(page, activeSeed.customerName)).toBeVisible({ timeout: 20000 });

    await page.goto(`/reviews?jobId=${activeSeed.scheduledJobId}`);
    await ensureDashboardAccess(page);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Modifier la facturation" }).click();
    const billingDialog = page.getByRole("dialog", { name: /Facturation/i });
    await expect(billingDialog.getByText(/Dépôt déjà payé/i)).toBeVisible({ timeout: 10000 });
    await expect(billingDialog.getByText(/200[\s,.]?00|\$200/)).toBeVisible();
    await billingDialog.getByRole("button", { name: "Fermer" }).click();

    await page.getByRole("button", { name: "Approuver pour facturation" }).click();
    await expect(page.getByRole("button", { name: "Générer la facture" })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: "Générer la facture" }).click();
    await expect(page.getByText(/Facture.*créée|Envoyer la facture/i).first()).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: "Envoyer la facture" }).click();
    await page.getByLabel("Destinataire").fill(COURRIEL_LIVRE);
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText(/Facture envoyée|envoyée à/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "Envoyer la facture" })).toHaveCount(0);

    await page.goto("/schedule");
    await ensureDashboardAccess(page);
    await expect(jobBlock).toBeVisible({ timeout: 15000 });
    await jobBlock.click();
    await clickQuickStatusIfEnabled(page, "Payé");

    const closeScheduleDialog = page.getByRole("button", { name: "Fermer" });
    if (await closeScheduleDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeScheduleDialog.click();
    }

    await page.getByRole("navigation").getByRole("link", { name: "Factures" }).click();
    await page.waitForURL(/\/invoices/, { timeout: 30000, waitUntil: "domcontentloaded" });
    await ensureDashboardAccess(page);
    await expect(page.getByRole("heading", { level: 1, name: "Factures" })).toBeVisible({
      timeout: 15000,
    });
    await expect(invoiceCustomerCell(page, activeSeed.customerName)).toBeVisible({ timeout: 15000 });

    await page.goto("/archives");
    await ensureDashboardAccess(page);
    await page.getByLabel("Rechercher dans les archives").fill(E2E_SEED_MARKER);
    const archivedRow = archiveJobRow(page, activeSeed.customerName);
    if (await archivedRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await archivedRow.click();
      const restoreBtn = page.getByRole("button", { name: "Restaurer" });
      if (await restoreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await restoreBtn.click();
        await expect(restoreBtn).toBeHidden({ timeout: 10000 });
      }
    }
  });
});
