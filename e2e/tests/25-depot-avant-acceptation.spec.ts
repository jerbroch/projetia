import { test, expect } from "../fixtures/base";
import { connexionLocataire } from "../helpers/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readTestCredentials } from "../helpers/test-data";

/**
 * LE CLIENT PAIE AVANT DE CLIQUER.
 *
 * Le bloc « Comment payer » est sur la soumission dès sa réception : rien
 * n'empêche le client de virer son dépôt avant d'accepter. Avant ce
 * changement, l'entrepreneur n'avait alors aucun bouton — l'argent arrivait et
 * rien ne s'y rattachait.
 *
 * Ce parcours passe par l'action réelle, depuis le navigateur.
 */
test.describe("25. Dépôt reçu avant l'acceptation", () => {
  test.use({ pageName: "Dépôt anticipé" });

  let companyId = "";
  const creees: string[] = [];

  test.beforeAll(async () => {
    companyId = readTestCredentials().tenantCompanyId!;
    test.skip(!companyId, "Company ID manquant");
  });

  test.afterAll(async () => {
    if (!companyId || !creees.length) return;
    const db = createAdminClient();
    await db.from("payments").delete().eq("company_id", companyId).in("invoice_number",
      creees.map((n) => `Dépôt ${n}`));
    await db.from("quotes").delete().eq("company_id", companyId).in("quote_number", creees);
  });

  test("« Dépôt reçu » accepte la soumission puis encaisse", async ({ page }) => {
    const db = createAdminClient();
    const numero = `SO-DEP-${Date.now()}`;
    creees.push(numero);

    const { error } = await db.from("quotes").insert({
      company_id: companyId,
      quote_number: numero,
      title: `Dépôt anticipé ${Date.now()}`,
      customer_name: "Michel Brochu",
      amount: 5000,
      status: "sent",
      deposit_required: true,
      deposit_percentage: 20,
      line_items: [{ description: "Travaux", quantity: 1, unit_price: 5000, total: 5000 }],
    });
    expect(error, "la soumission d'essai doit être posée").toBeNull();

    await connexionLocataire(page);
    await page.goto("/quotes");

    const ligne = page.getByRole("row").filter({ hasText: numero });
    await expect(ligne).toBeVisible({ timeout: 20000 });
    await ligne.getByRole("button", { name: "Actions" }).click();

    // Le bouton doit être là AVANT toute acceptation — c'est tout le sujet.
    const bouton = page.getByRole("menuitem", { name: "Dépôt reçu" });
    await expect(bouton).toBeVisible();
    await bouton.click();

    await expect
      .poll(async () => {
        const { data } = await db
          .from("quotes")
          .select("status, accepted_source")
          .eq("company_id", companyId)
          .eq("quote_number", numero)
          .maybeSingle();
        return (data as { status: string } | null)?.status ?? null;
      }, { timeout: 25000 })
      .toBe("deposit_paid");

    const { data: q } = await db
      .from("quotes")
      .select("status, accepted_at, accepted_source, deposit_status, deposit_amount")
      .eq("company_id", companyId)
      .eq("quote_number", numero)
      .single();
    const r = q as {
      accepted_at: string | null; accepted_source: string | null;
      deposit_status: string | null; deposit_amount: number | null;
    };

    // Première transition : l'acceptation, et son origine.
    expect(r.accepted_at, "la soumission doit être acceptée").toBeTruthy();
    expect(r.accepted_source).toBe("depot_enregistre");
    // Seconde transition : l'encaissement.
    expect(r.deposit_status).toBe("paid");
    expect(Number(r.deposit_amount)).toBeCloseTo(1149.75, 2);

    // Et la trace comptable, avec le numéro de soumission lisible.
    const { data: p } = await db
      .from("payments")
      .select("invoice_number, amount, invoice_id")
      .eq("company_id", companyId)
      .eq("invoice_number", `Dépôt ${numero}`)
      .single();
    const paiement = p as { invoice_number: string; amount: number; invoice_id: string | null };
    expect(paiement.invoice_number).toBe(`Dépôt ${numero}`);
    expect(Number(paiement.amount)).toBeCloseTo(1149.75, 2);
    expect(paiement.invoice_id, "un dépôt précède la facturation").toBeNull();

    // Aucun échec d'écriture au compteur.
    const { data: echecs } = await db
      .from("write_failures")
      .select("operation")
      .eq("company_id", companyId)
      .eq("domain", "deposit");
    expect(echecs ?? []).toEqual([]);

    console.log(`DÉPÔT >>> ${numero} : accepté par « ${r.accepted_source} », encaissé ${paiement.amount} $`);
  });
});
