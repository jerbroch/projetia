import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";
import { createE2EAdmin } from "../helpers/field-employee";
import { COURRIEL_LIVRE } from "../helpers/adresses-de-test";
import { readTestCredentials } from "../helpers/test-data";

/**
 * LE PARCOURS COMPLET, D'UN BOUT À L'AUTRE :
 * terminer → approuver → générer → envoyer → payer.
 *
 * Chaque étape vérifie DEUX choses : ce que l'écran montre, et ce que la base
 * enregistre. Un écran qui dit « envoyée » sans courriel derrière, c'est
 * exactement le défaut que ces épreuves existent pour attraper.
 */
test.describe("16. Parcours de fermeture et de facturation", () => {
  test.use({ storageState: tenantAuth, pageName: "Parcours" });

  // Le nettoyage vit HORS du corps du test. Placé à la fin du test, il ne
  // s'exécutait pas quand le test dépassait son temps — et laissait des
  // rangées derrière lui, précisément dans le cas où on relance.
  const aNettoyer: { jobId?: string; feuilleId?: string; clientId?: string } = {};

  test.afterEach(async () => {
    const admin = createE2EAdmin();
    if (aNettoyer.jobId) {
      await admin.from("invoices").delete().eq("scheduled_job_id", aNettoyer.jobId);
    }
    if (aNettoyer.feuilleId) {
      await admin.from("job_billing_lines").delete().eq("billing_sheet_id", aNettoyer.feuilleId);
      await admin.from("job_billing_sheets").delete().eq("id", aNettoyer.feuilleId);
    }
    if (aNettoyer.jobId) await admin.from("scheduled_jobs").delete().eq("id", aNettoyer.jobId);
    if (aNettoyer.clientId) await admin.from("customers").delete().eq("id", aNettoyer.clientId);
    aNettoyer.jobId = undefined;
    aNettoyer.feuilleId = undefined;
    aNettoyer.clientId = undefined;
  });

  // Le parcours complet touche Resend, qui met parfois une minute à publier
  // le courriel dans sa liste. Le budget par défaut de 90 s ne suffit pas.
  test("un call va de « en travail » à « payé » sans jamais mentir", async ({ page }) => {
    test.setTimeout(300_000);
    const companyId = readTestCredentials().tenantCompanyId!;
    test.skip(!companyId, "Company ID manquant");
    const admin = createE2EAdmin();
    const titre = `PARCOURS ${Date.now()}`;

    const debut = new Date();
    debut.setHours(9, 0, 0, 0);
    const fin = new Date(debut);
    fin.setHours(11, 0, 0, 0);

    const { data: client } = await admin
      .from("customers")
      .insert({
        company_id: companyId,
        name: "Client parcours",
        email: COURRIEL_LIVRE,
      })
      .select("id")
      .single();
    aNettoyer.clientId = client!.id as string;

    const { data: job } = await admin
      .from("scheduled_jobs")
      .insert({
        company_id: companyId,
        title: titre,
        start_at: debut.toISOString(),
        end_at: fin.toISOString(),
        customer_id: client!.id,
        customer_name: "Client parcours",
        customer_email: COURRIEL_LIVRE,
        employee_ids: [],
        employee_names: [],
        // Terminé SANS marque de soumission : c'était le cul-de-sac.
        status: "completed",
        submitted_for_review_at: null,
        type: "job",
      })
      .select("id")
      .single();
    const jobId = job!.id as string;
    aNettoyer.jobId = jobId;

    const { data: feuille } = await admin
      .from("job_billing_sheets")
      .insert({ company_id: companyId, scheduled_job_id: jobId, status: "draft" })
      .select("id")
      .single();
    const { error: erreurLigne } = await admin.from("job_billing_lines").insert({
      billing_sheet_id: feuille!.id,
      company_id: companyId,
      line_type: "material",
      description: "Robinet de cuisine",
      quantity: 1,
      unit_cost: 200,
      unit_sell_price: 280,
      line_total: 280,
      sort_order: 0,
    });
    // Une semence qui échoue en silence fait accuser l'application à tort.
    expect(erreurLigne).toBeNull();

    async function ouvrirLeCall() {
      await page.goto("/schedule");
      await ensureDashboardAccess(page);
      const bloc = page.locator(`[data-event-id="${jobId}"]`);
      await expect(bloc).toBeVisible({ timeout: 15000 });
      await bloc.click();
      return page.getByRole("dialog");
    }

    // ── 1. Un call terminé sans soumission n'est plus un cul-de-sac ──────────
    let dialogue = await ouvrirLeCall();
    await expect(dialogue.getByRole("button", { name: "Approuver pour facturation" })).toBeVisible();
    // Le mur de statuts a disparu : plus de marche arrière au même niveau.
    await expect(dialogue.getByRole("button", { name: "Facture envoyée" })).toHaveCount(0);
    await expect(dialogue.getByRole("button", { name: /^Prêt à facturer$/ })).toHaveCount(0);
    console.log("ÉTAPE 1 >>> call terminé sans soumission : le bouton d'approbation est là");

    // ── 2. Approuver, sur le call ───────────────────────────────────────────
    await dialogue.getByRole("button", { name: "Approuver pour facturation" }).click();
    await expect(dialogue.getByRole("button", { name: "Générer la facture" })).toBeVisible({
      timeout: 15000,
    });
    const { data: apresApprobation } = await admin
      .from("scheduled_jobs").select("status, approved_at").eq("id", jobId).single();
    expect(apresApprobation!.status).toBe("ready-to-invoice");
    expect(apresApprobation!.approved_at).toBeTruthy();
    console.log("ÉTAPE 2 >>> approuvé sur le call :", JSON.stringify(apresApprobation));

    // ── 3. Générer la facture ───────────────────────────────────────────────
    await dialogue.getByRole("button", { name: "Générer la facture" }).click();
    await page.getByRole("button", { name: "Générer la facture" }).last().click();
    await expect(page.getByText(/Facture générée|consultez le module Factures/i)).toBeVisible({
      timeout: 20000,
    });
    const { data: facture } = await admin
      .from("invoices").select("id, invoice_number, status, sent_at, amount")
      .eq("scheduled_job_id", jobId).single();
    expect(facture!.status).toBe("draft");
    expect(facture!.sent_at).toBeNull();
    console.log("ÉTAPE 3 >>> facture créée :", JSON.stringify(facture));

    // ── 4. Envoyer — POUR DE VRAI ───────────────────────────────────────────
    await page.keyboard.press("Escape");
    dialogue = await ouvrirLeCall();
    await dialogue.getByRole("button", { name: "Envoyer la facture au client" }).click();
    const envoi = page.getByRole("dialog").last();
    await expect(envoi.getByLabel("Destinataire")).toHaveValue(COURRIEL_LIVRE, { timeout: 10000 });
    await envoi.getByRole("button", { name: /^Envoyer$/ }).click();

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("invoices").select("status, sent_at, sent_to").eq("id", facture!.id).single();
        return data?.sent_at ? `${data.status}|${data.sent_to}` : null;
      }, { timeout: 30000 })
      .toBe(`sent|${COURRIEL_LIVRE}`);

    const { data: apresEnvoi } = await admin
      .from("scheduled_jobs").select("status, sent_at, sent_to").eq("id", jobId).single();
    expect(apresEnvoi!.status).toBe("invoice-sent");
    expect(apresEnvoi!.sent_at).toBeTruthy();
    console.log("ÉTAPE 4 >>> envoyée :", JSON.stringify(apresEnvoi));

    // ── 5. Resend confirme que le courriel est parti ────────────────────────
    const numero = String(facture!.invoice_number);
    await expect
      .poll(async () => {
        const r = await fetch("https://api.resend.com/emails?limit=15", {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        });
        if (!r.ok) return null;
        const body = await r.json();
        const trouve = (body.data ?? []).find((e: { subject?: string }) =>
          (e.subject ?? "").includes(numero),
        );
        return trouve ? String(trouve.last_event ?? "envoyé") : null;
      }, { timeout: 60000, intervals: [3000] })
      .not.toBeNull();
    console.log(`ÉTAPE 5 >>> Resend confirme le courriel pour ${numero}`);

    // ── 6. Marquer payé ─────────────────────────────────────────────────────
    await page.keyboard.press("Escape");
    dialogue = await ouvrirLeCall();
    await dialogue.getByRole("button", { name: "Marquer payé" }).click();
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("scheduled_jobs").select("status").eq("id", jobId).single();
        return data?.status;
      }, { timeout: 20000 })
      .toBe("paid");
    console.log("ÉTAPE 6 >>> payé");

    // ── 7. Plus rien à faire, et c'est dit ──────────────────────────────────
    await page.keyboard.press("Escape");
    dialogue = await ouvrirLeCall();
    await expect(dialogue.getByText("Ce call est payé. Rien à faire.")).toBeVisible();
    console.log("ÉTAPE 7 >>> le call est clos, l'écran le dit");

  });

  test("la page Factures offre l'envoi, et le retire une fois parti", async ({ page }) => {
    const companyId = readTestCredentials().tenantCompanyId!;
    const admin = createE2EAdmin();
    const numero = `FA-TEST-${Date.now()}`;

    const { data: client } = await admin
      .from("customers")
      .insert({ company_id: companyId, name: "Client facture", email: COURRIEL_LIVRE })
      .select("id")
      .single();

    // Une facture RAPIDE : aucun call derrière. C'est le cas que l'ancien
    // envoi ne savait pas traiter, faute de jobId.
    const { data: facture } = await admin
      .from("invoices")
      .insert({
        company_id: companyId,
        invoice_number: numero,
        customer_id: client!.id,
        customer_name: "Client facture",
        amount: 287.44,
        subtotal: 250,
        gst_amount: 12.5,
        qst_amount: 24.94,
        paid_amount: 0,
        status: "draft",
        due_date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
        line_items: [
          { description: "Appel de service", quantity: 1, unit_sell_price: 250, line_total: 250 },
        ],
      })
      .select("id")
      .single();

    await page.goto("/invoices");
    await ensureDashboardAccess(page);
    const ligne = page.getByRole("row", { name: new RegExp(numero) });
    await expect(ligne).toBeVisible({ timeout: 15000 });
    await ligne.getByRole("button", { name: "Envoyer" }).click();

    const envoi = page.getByRole("dialog").last();
    await envoi.getByLabel("Destinataire").fill(COURRIEL_LIVRE);
    await envoi.getByRole("button", { name: /^Envoyer$/ }).click();

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("invoices").select("status, sent_at").eq("id", facture!.id).single();
        return data?.sent_at ? data.status : null;
      }, { timeout: 30000 })
      .toBe("sent");
    console.log(`FACTURE RAPIDE >>> ${numero} envoyée sans call derrière`);

    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(numero) })).toContainText("Envoyée");

    await admin.from("invoices").delete().eq("id", facture!.id);
    await admin.from("customers").delete().eq("id", client!.id);
  });

  test("« À vérifier » est dans le menu", async ({ page }) => {
    await page.goto("/dashboard");
    await ensureDashboardAccess(page);
    const liens = await page.locator("nav a").allInnerTexts();
    expect(liens.map((l) => l.trim())).toContain("À vérifier");
  });
});
