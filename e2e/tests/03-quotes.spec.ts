import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";
import { tableCell } from "../helpers/locators";
import { getResendCallCount, resetResendCallCount } from "../helpers/resend-mock";

test.describe("3. Soumissions", () => {
  test.use({ storageState: tenantAuth, pageName: "Soumissions" });

  test.beforeEach(async ({ page }) => {
    resetResendCallCount();
    await page.goto("/quotes");
    await ensureDashboardAccess(page);
    if (!page.url().includes("/quotes")) await page.goto("/quotes");
  });

  test("créer soumission avec client et dépôt 20%", async ({ page }) => {
    await page.goto("/customers");
    await ensureDashboardAccess(page);

    const clientName = `QuoteClient ${Date.now()}`;
    await page.getByRole("button", { name: "Créer un client" }).click();
    await page.getByLabel("Nom du client").fill(clientName);
    await page.getByLabel("Courriel").fill(`qc${Date.now()}@test.local`);
    await page.getByRole("button", { name: "Créer le client" }).click();
    await expect(tableCell(page, clientName)).toBeVisible({ timeout: 15000 });

    await page.goto("/quotes");
    await ensureDashboardAccess(page);
    await page.getByRole("button", { name: "Nouvelle soumission" }).click();

    const title = `Soumission E2E ${Date.now()}`;
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Titre").fill(title);

    // Un seul chemin pour entrer un client depuis que CustomerPicker a
    // remplacé le menu « Client existant » ET les champs nom/courriel séparés.
    // Le choix pré-remplit tout : il n'y a plus rien à retaper.
    await dialog.getByLabel("Client", { exact: true }).click();
    await page.getByRole("option", { name: clientName, exact: true }).click();
    await expect(dialog.getByText(clientName)).toBeVisible({ timeout: 10000 });

    const amountInput = dialog.getByLabel("Montant ($)");
    await amountInput.click();
    await amountInput.fill("1000");

    const depositCheckbox = dialog.getByRole("checkbox", {
      name: /Demander un dépôt/i,
    });
    await depositCheckbox.check();
    await dialog.getByLabel("Pourcentage du dépôt (%)").fill("20");

    await dialog.getByRole("button", { name: "Créer" }).click();
    await expect(dialog).toBeHidden({ timeout: 20000 });
    // Desktop view uses table; mobile cards are md:hidden in desktop-chrome project.
    await expect(page.locator("table tbody").getByText(title)).toBeVisible({ timeout: 15000 });
  });

  test("envoyer par courriel (Resend mocké)", async ({ page, audit }) => {
    const quoteRow = page.locator("table tbody tr, [class*='Card']").first();
    if (!(await quoteRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Aucune soumission disponible");
      return;
    }

    const menuBtn = page.getByRole("button", { name: /actions|menu/i }).first();
    const mailBtn = page.getByRole("button", { name: /envoyer|mail|courriel/i }).first();

    if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuBtn.click();
      await page.getByRole("menuitem", { name: /envoyer|courriel/i }).click();
    } else if (await mailBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mailBtn.click();
    } else {
      audit.addFinding({
        severity: "IMPORTANT",
        page: "/quotes",
        action: "Envoyer soumission par courriel",
        expected: "Action d'envoi visible",
        actual: "Bouton d'envoi introuvable",
        likelyFile: "src/components/quotes/send-quote-dialog.tsx",
      });
      return;
    }

    const sendBtn = page.getByRole("button", { name: /Envoyer/i });
    if (await sendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sendBtn.click();
      await page.waitForTimeout(2000);
      const calls = getResendCallCount();
      if (calls === 0) {
        audit.addFinding({
          severity: "MINEUR",
          page: "/quotes",
          action: "Mock Resend",
          expected: "Appel Resend intercepté ou log console",
          actual: "Aucun appel Resend (peut utiliser provider console sans RESEND_API_KEY)",
          likelyFile: "src/lib/email/send-quote.ts",
        });
      }
    }
  });

  test("lien public et acceptation", async ({ page, audit }) => {
    const sentBadge = page.getByText(/envoyé|sent|accepté/i).first();
    if (!(await sentBadge.isVisible({ timeout: 5000 }).catch(() => false))) {
      audit.addFinding({
        severity: "MINEUR",
        page: "/quotes",
        action: "Tester lien public accept/reject",
        expected: "Soumission envoyée avec lien public",
        actual: "Aucune soumission envoyée — test partiel",
        likelyFile: "src/app/soumission/[token]/page.tsx",
      });
      return;
    }

    const previewBtn = page.getByRole("button", { name: /aperçu|preview|lien/i }).first();
    if (await previewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await previewBtn.click();
      const publicLink = page.locator('a[href*="/soumission/"]');
      if (await publicLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        const href = await publicLink.getAttribute("href");
        if (href) {
          await page.goto(href);
          await expect(page.getByRole("button", { name: /Accepter|Accept/i })).toBeVisible({
            timeout: 10000,
          });
        }
      }
    }
  });
});
