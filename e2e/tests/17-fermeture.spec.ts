import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";
import { createE2EAdmin } from "../helpers/field-employee";
import { readTestCredentials } from "../helpers/test-data";

test.describe("17. Fermeture d'un call", () => {
  test.use({ storageState: tenantAuth, pageName: "Fermeture" });

  test("une feuille vide dit pourquoi elle empêche de fermer", async ({ page }) => {
    const companyId = readTestCredentials().tenantCompanyId!;
    const admin = createE2EAdmin();
    const titre = `FERMETURE ${Date.now()}`;
    const debut = new Date();
    debut.setHours(9, 0, 0, 0);
    const fin = new Date(debut);
    fin.setHours(11, 0, 0, 0);

    const { data: job } = await admin
      .from("scheduled_jobs")
      .insert({
        company_id: companyId, title: titre,
        start_at: debut.toISOString(), end_at: fin.toISOString(),
        customer_name: "Client fermeture", employee_ids: [], employee_names: [],
        status: "in-progress", type: "job",
      })
      .select("id").single();

    await page.goto("/schedule");
    await ensureDashboardAccess(page);
    const bloc = page.locator(`[data-event-id="${job!.id}"]`);
    await expect(bloc).toBeVisible({ timeout: 15000 });
    await bloc.click();

    await page.getByRole("dialog").getByRole("button", { name: "Travaux terminés" }).click();
    const fermeture = page.getByRole("dialog", { name: /Fermer le travail/i });
    await expect(fermeture).toBeVisible({ timeout: 15000 });
    await fermeture.getByLabel("Travaux effectués *").fill("Réparation du drain");

    // Le refus est DIT, avant le clic.
    await expect(fermeture.getByText(/Ajoutez au moins une ligne d'heures ou de matériel/)).toBeVisible();
    await expect(fermeture.getByRole("button", { name: "Fermer le travail" })).toBeDisabled();
    console.log("FERMETURE >>> feuille vide : la raison est affichée, le bouton reste inactif");

    // Une ligne suffit à débloquer.
    // La feuille se crée à la demande : le call neuf n'en a pas encore.
    let { data: feuille } = await admin.from("job_billing_sheets")
      .select("id").eq("scheduled_job_id", job!.id).maybeSingle();
    if (!feuille) {
      const cree = await admin.from("job_billing_sheets")
        .insert({ company_id: companyId, scheduled_job_id: job!.id, status: "draft" })
        .select("id").single();
      expect(cree.error).toBeNull();
      feuille = cree.data;
    }
    {
      await admin.from("job_billing_lines").insert({
        billing_sheet_id: feuille!.id, company_id: companyId, line_type: "material",
        description: "Drain", quantity: 1, unit_cost: 50, unit_sell_price: 70,
        line_total: 70, sort_order: 0,
      });
      await page.reload();
      await ensureDashboardAccess(page);
      await bloc.click();
      await page.getByRole("dialog").getByRole("button", { name: "Travaux terminés" }).click();
      const f2 = page.getByRole("dialog", { name: /Fermer le travail/i });
      await f2.getByLabel("Travaux effectués *").fill("Réparation du drain");
      await expect(f2.getByRole("button", { name: "Fermer le travail" })).toBeEnabled({ timeout: 15000 });
      console.log("FERMETURE >>> une ligne ajoutée : le bouton s'active");
    }

    await admin.from("scheduled_jobs").delete().eq("id", job!.id);
  });
});
