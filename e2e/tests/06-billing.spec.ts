import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";
import { getResendCallCount, resetResendCallCount } from "../helpers/resend-mock";

test.describe("6. Facturation", () => {
  test.use({ storageState: tenantAuth, pageName: "Facturation" });

  test("onglet factures accessible", async ({ page, audit }) => {
    await page.goto("/invoices");
    await ensureDashboardAccess(page);
    await expect(page.getByRole("heading", { level: 1, name: /Factures/i })).toBeVisible({ timeout: 15000 });
  });

  test("billing prefill depuis travaux — workflow complet", async ({ page, audit }) => {
    await page.goto("/schedule");
    await ensureDashboardAccess(page);

    const event = page.locator("[data-event-id], .calendar-event, [class*='job-block']").first();
    if (!(await event.isVisible({ timeout: 8000 }).catch(() => false))) {
      audit.addFinding({
        severity: "IMPORTANT",
        page: "/schedule → billing",
        action: "Ouvrir facturation depuis appel terminé",
        expected: "Appel complété avec préremplissage billing",
        actual: "Aucun appel disponible — parcours billing non testé end-to-end",
        likelyFile: "src/components/billing/job-billing-dialog.tsx",
      });
      test.skip(true, "Prérequis: appel complété avec soumission $1000");
      return;
    }

    await event.click();
    const billingBtn = page.getByRole("button", { name: /Facturation|Facturer|Billing/i });
    if (await billingBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await billingBtn.click();
      await expect(page.getByText(/\$|CAD|total|dépôt|balance/i).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test("envoi facture une seule fois (Resend mock)", async ({ page, audit }) => {
    resetResendCallCount();
    await page.goto("/invoices");
    await ensureDashboardAccess(page);

    const sendBtn = page.getByRole("button", { name: /Envoyer/i }).first();
    if (!(await sendBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      audit.addFinding({
        severity: "MINEUR",
        page: "/invoices",
        action: "Envoyer facture",
        expected: "Facture émise avec bouton envoyer",
        actual: "Aucune facture à envoyer",
        likelyFile: "src/components/invoices/send-invoice-dialog.tsx",
      });
      return;
    }

    await sendBtn.click();
    const confirmSend = page.getByRole("button", { name: /^Envoyer$/i });
    if (await confirmSend.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmSend.click();
    }
    const firstCount = getResendCallCount();
    await page.reload();
    await ensureDashboardAccess(page);
    await page.goto("/invoices");

    if (firstCount > 0) {
      const resendBtn = page.getByRole("button", { name: /Renvoyer|Envoyer à nouveau/i });
      if (await resendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        audit.addFinding({
          severity: "IMPORTANT",
          page: "/invoices",
          action: "Pas de double envoi après refresh",
          expected: "Statut 'envoyé' sans bouton renvoyer immédiat",
          actual: "Bouton renvoyer visible après refresh",
          likelyFile: "src/components/invoices/invoices-page-client.tsx",
        });
      }
    }
  });
});
