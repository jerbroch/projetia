import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";
import { createE2EAdmin } from "../helpers/field-employee";
import { getResendCallCount, resetResendCallCount } from "../helpers/resend-mock";
import { readTestCredentials } from "../helpers/test-data";

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
  /**
   * Le gabarit ligne par ligne : décision de bureau prise APRÈS l'import.
   *
   * L'import terrain attribue à chaque employé le gabarit trouvé pour lui.
   * Mais c'est au bureau de dire « ces onze heures-là, c'est du temps
   * supplémentaire ». Le sélecteur de la ligne doit donc recalculer le prix,
   * réécrire la description, et marquer la ligne comme retouchée — sans quoi
   * un ré-import viendrait l'écraser.
   *
   * Ce test a une histoire : un premier essai avait conclu que le sélecteur
   * ne faisait rien. Il ne prouvait rien — un seul gabarit existait, donc
   * choisir « l'autre » revenait à rechoisir le même. D'où les DEUX gabarits
   * de taux différents ci-dessous : sans eux, le test passerait à vide.
   */
  test("changer le gabarit d'une ligne recalcule le prix", async ({ page }) => {
    const creds = readTestCredentials();
    test.skip(!creds.tenantCompanyId, "Identifiants E2E manquants");
    const admin = createE2EAdmin();
    const companyId = creds.tenantCompanyId!;
    const runId = Date.now();
    const titre = `E2E Gabarit ${runId}`;

    const { data: employe } = await admin
      .from("employees")
      .insert({
        company_id: companyId,
        first_name: "E2E Gabarit",
        last_name: `${runId}`,
        trade: "Plombier",
        status: "active",
      })
      .select("id")
      .single();

    const { data: gabarits } = await admin
      .from("labor_rate_templates")
      .insert([
        { company_id: companyId, name: `E2E régulier ${runId}`, worker_count: 1, cost_per_hr: 45, bill_rate: 95, is_active: true },
        { company_id: companyId, name: `E2E supplémentaire ${runId}`, worker_count: 1, cost_per_hr: 68, bill_rate: 142.5, is_active: true },
      ])
      .select("id, bill_rate");

    const debut = new Date();
    debut.setHours(9, 0, 0, 0);
    const fin = new Date();
    fin.setHours(17, 0, 0, 0);
    const { data: job } = await admin
      .from("scheduled_jobs")
      .insert({
        company_id: companyId,
        title: titre,
        customer_name: "E2E Client",
        start_at: debut.toISOString(),
        end_at: fin.toISOString(),
        status: "ready-to-invoice",
        employee_ids: [employe!.id],
        employee_names: [`E2E Gabarit ${runId}`],
      })
      .select("id")
      .single();

    await admin.from("field_hours").insert({
      company_id: companyId,
      scheduled_job_id: job!.id,
      employee_id: employe!.id,
      work_date: new Date().toISOString().slice(0, 10),
      hours: 11,
    });

    try {
      await page.goto("/schedule");
      await ensureDashboardAccess(page);

      const bloc = page.locator("[data-event-id]").filter({ hasText: titre }).first();
      await bloc.scrollIntoViewIfNeeded();
      await bloc.click();
      await page
        .locator('[role="dialog"]')
        .first()
        .getByRole("button", { name: "Générer la facture" })
        .click();

      const dialogue = page.locator('[role="dialog"]').last();
      const selecteur = dialogue.locator("select[aria-label^='Gabarit']").first();
      await expect(selecteur).toBeVisible({ timeout: 20000 });
      await expect(selecteur).toBeEnabled();

      const avant = await selecteur.inputValue();
      const cible = gabarits!.find((g) => g.id !== avant)!;
      await selecteur.selectOption(cible.id);
      await expect(selecteur).toHaveValue(cible.id);

      const { data: feuille } = await admin
        .from("job_billing_sheets")
        .select("id")
        .eq("scheduled_job_id", job!.id)
        .single();

      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from("job_billing_lines")
              .select("unit_sell_price, line_total, labor_template_id, manually_edited")
              .eq("billing_sheet_id", feuille!.id)
              .eq("labor_template_id", cible.id)
              .maybeSingle();
            return data;
          },
          { timeout: 20000 },
        )
        .toMatchObject({
          unit_sell_price: cible.bill_rate,
          line_total: Math.round(11 * Number(cible.bill_rate) * 100) / 100,
          manually_edited: true,
        });
    } finally {
      const { data: feuille } = await admin
        .from("job_billing_sheets")
        .select("id")
        .eq("scheduled_job_id", job!.id)
        .maybeSingle();
      if (feuille) {
        await admin.from("job_billing_lines").delete().eq("billing_sheet_id", feuille.id);
        await admin.from("job_billing_sheets").delete().eq("id", feuille.id);
      }
      await admin.from("field_hours").delete().eq("scheduled_job_id", job!.id);
      await admin.from("scheduled_jobs").delete().eq("id", job!.id);
      await admin.from("labor_rate_templates").delete().in("id", gabarits!.map((g) => g.id));
      await admin.from("employees").delete().eq("id", employe!.id);
    }
  });
});
