import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";
import { createE2EAdmin } from "../helpers/field-employee";
import { readTestCredentials } from "../helpers/test-data";

/**
 * Un entrepreneur qui n'a pas configuré ses coordonnées de paiement doit
 * l'apprendre AU MOMENT D'ENVOYER, pas après coup par un client qui n'a pas osé
 * demander où envoyer l'argent.
 */
test.describe("18. Coordonnées de paiement à remplir", () => {
  test.use({ storageState: tenantAuth, pageName: "Interac" });

  test("prévient à l'envoi et mène à la bonne carte des Paramètres", async ({ page }) => {
    const companyId = readTestCredentials().tenantCompanyId!;
    test.skip(!companyId, "Company ID manquant");
    const admin = createE2EAdmin();
    const numero = `FA-INTERAC-${Date.now()}`;

    // On part d'une entreprise SANS coordonnées — l'état de tout nouvel inscrit.
    await admin.from("companies")
      .update({ interac_enabled: false, interac_email: null })
      .eq("id", companyId);

    const { data: client } = await admin.from("customers")
      .insert({ company_id: companyId, name: "Client interac", email: "delivered@resend.dev" })
      .select("id").single();

    const { data: facture } = await admin.from("invoices").insert({
      company_id: companyId, invoice_number: numero,
      customer_id: client!.id, customer_name: "Client interac",
      amount: 500, subtotal: 434.9, gst_amount: 21.75, qst_amount: 43.38,
      paid_amount: 0, status: "draft",
      due_date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
      line_items: [{ description: "Appel", quantity: 1, unit_sell_price: 434.9, line_total: 434.9 }],
    }).select("id").single();

    await page.goto("/invoices");
    await ensureDashboardAccess(page);
    const ligne = page.getByRole("row", { name: new RegExp(numero) });
    await expect(ligne).toBeVisible({ timeout: 15000 });
    await ligne.getByRole("button", { name: "Envoyer" }).click();

    const envoi = page.getByRole("dialog").last();
    await expect(envoi.getByText(/sans savoir où envoyer l'argent/)).toBeVisible({ timeout: 10000 });
    console.log("INTERAC >>> l'avertissement s'affiche à l'envoi");

    // Il n'empêche PAS d'envoyer : on peut se faire payer autrement.
    await expect(envoi.getByRole("button", { name: /^Envoyer$/ })).toBeEnabled();

    // Et le lien mène à la carte, pas au haut d'une longue page.
    const lien = envoi.getByRole("link", { name: /Paramètres/ });
    await expect(lien).toHaveAttribute("href", "/settings#interac");
    await lien.click();
    await page.waitForURL(/\/settings#interac/, { timeout: 20000 });
    await ensureDashboardAccess(page);
    const carte = page.locator("#interac");
    await expect(carte).toBeVisible({ timeout: 15000 });
    await expect(carte.getByText("Paiement Interac")).toBeVisible();
    console.log("INTERAC >>> le lien mène bien à la carte Paiement Interac");

    // Une fois rempli, l'avertissement disparaît.
    await admin.from("companies")
      .update({ interac_enabled: true, interac_email: "paiement@exemple.com" })
      .eq("id", companyId);
    await page.goto("/invoices");
    await ensureDashboardAccess(page);
    await page.getByRole("row", { name: new RegExp(numero) })
      .getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByRole("dialog").last().getByText(/sans savoir où envoyer/))
      .toHaveCount(0);
    console.log("INTERAC >>> une fois rempli, l'avertissement se tait");

    await admin.from("invoices").delete().eq("id", facture!.id);
    await admin.from("customers").delete().eq("id", client!.id);
    await admin.from("companies")
      .update({ interac_enabled: false, interac_email: null }).eq("id", companyId);
  });
});
