import { test, expect } from "../fixtures/base";
import { loginWithCredentials } from "../helpers/auth";
import {
  cleanupFieldEmployeeTestData, createE2EAdmin, setupFieldEmployeeTestData,
  type FieldEmployeeTestContext,
} from "../helpers/field-employee";
import { readTestCredentials } from "../helpers/test-data";

/**
 * L'employé CHOISIT dans les listes de son employeur, il ne crée rien.
 * Et il voit les prix de VENTE, jamais les coûts.
 */
test.describe("22. Saisie terrain dans les listes de l'employeur", () => {
  let ctx: FieldEmployeeTestContext;
  let companyId: string;
  let articleId: string;

  test.beforeAll(async () => {
    companyId = readTestCredentials().tenantCompanyId!;
    test.skip(!companyId, "Company ID manquant");
    const admin = createE2EAdmin();
    ctx = await setupFieldEmployeeTestData(admin, companyId);

    await admin.from("labor_rate_templates").delete().eq("company_id", companyId).eq("name", "E2E Compagnon");
    await admin.from("labor_rate_templates").insert({
      company_id: companyId, name: "E2E Compagnon", worker_count: 1,
      cost_per_hr: 45, bill_rate: 125, is_active: true,
    });

    await admin.from("companies").update({ default_material_margin: 0.4 }).eq("id", companyId);
    const { data: categorie } = await admin.from("material_categories").select("id").limit(1).single();
    const { data: item } = await admin.from("material_catalog_items").insert({
      company_id: companyId, category_id: categorie!.id,
      name: "E2E Chauffe-eau 60 gal", unit: "unité",
    }).select("id").single();
    articleId = item!.id as string;
    await admin.from("company_catalog_prices").insert({
      company_id: companyId, catalog_item_id: articleId, reference_price: 1000,
    });
  });

  test.afterAll(async () => {
    if (!companyId || !ctx) return;
    const admin = createE2EAdmin();
    await admin.from("company_catalog_prices").delete().eq("catalog_item_id", articleId);
    await admin.from("material_catalog_items").delete().eq("id", articleId);
    await admin.from("labor_rate_templates").delete().eq("company_id", companyId).eq("name", "E2E Compagnon");
    await cleanupFieldEmployeeTestData(admin, companyId, ctx);
  });

  test.use({ viewport: { width: 390, height: 844 } });

  test("il choisit son taux dans une liste, prix de vente affiché", async ({ page }) => {
    await loginWithCredentials(page, ctx.email, ctx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    await page.goto(`/terrain/calls/${ctx.jobId}`);

    const choix = page.locator("#laborType");
    await expect(choix).toBeVisible({ timeout: 20000 });
    // Ce n'est plus un champ libre.
    expect(await choix.evaluate((e) => e.tagName)).toBe("SELECT");

    // La liste arrive après un aller-retour serveur : on l'attend au lieu de
    // lire un menu qui ne contient encore que « Choisir… ».
    await expect(choix.locator("option", { hasText: "E2E Compagnon" }))
      .toHaveCount(1, { timeout: 20000 });

    const options = await choix.locator("option").allInnerTexts();
    const compagnon = options.find((o) => o.includes("E2E Compagnon"));
    expect(compagnon, "le taux de l'employeur est proposé").toBeTruthy();
    // Le prix de VENTE, jamais le coût de 45 $.
    expect(compagnon).toContain("125");
    expect(options.join(" ")).not.toContain("45");
    console.log("TERRAIN >>> taux proposé :", compagnon);
  });

  test("il pique un matériau au catalogue et voit le prix marge comprise", async ({ page }) => {
    await loginWithCredentials(page, ctx.email, ctx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    await page.goto(`/terrain/calls/${ctx.jobId}`);

    await page.locator("#rechercheMateriau").fill("Chauffe-eau");
    const resultat = page.getByRole("button", { name: /E2E Chauffe-eau 60 gal/ });
    await expect(resultat).toBeVisible({ timeout: 20000 });

    // 1000 $ d'achat + 40 % → 1 400 $. Le 1000 ne doit apparaître nulle part.
    await expect(resultat).toContainText("1 400");
    const texte = await page.locator("main").innerText();
    expect(texte).not.toMatch(/1\s?000,00/);
    console.log("TERRAIN >>> matériau proposé à 1 400 $, achat invisible");

    await resultat.click();
    await page.getByRole("button", { name: "Ajouter au call" }).click();

    await expect
      .poll(async () => {
        const { data } = await createE2EAdmin()
          .from("field_materials").select("name, is_custom, catalog_item_id")
          .eq("scheduled_job_id", ctx.jobId);
        return data?.length ?? 0;
      }, { timeout: 20000 })
      .toBeGreaterThan(0);

    const { data } = await createE2EAdmin()
      .from("field_materials").select("name, is_custom, catalog_item_id").eq("scheduled_job_id", ctx.jobId);
    expect(data![0].catalog_item_id, "l'article est rattaché au catalogue").toBe(articleId);
    expect(data![0].is_custom, "ce n'est pas un hors-catalogue").toBe(false);
    console.log("TERRAIN >>> saisi depuis le catalogue :", JSON.stringify(data![0]));
  });

  test("un matériau absent se signale et part à chiffrer", async ({ page }) => {
    const admin = createE2EAdmin();
    await admin.from("field_materials").delete().eq("scheduled_job_id", ctx.jobId);

    await loginWithCredentials(page, ctx.email, ctx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    await page.goto(`/terrain/calls/${ctx.jobId}`);

    await page.locator("#rechercheMateriau").fill("valve introuvable");
    await page.getByRole("button", { name: /n'est pas dans la liste/ }).click();
    await page.locator("#materialName").fill("Valve d'arrêt 3/4 laiton");
    await page.getByRole("button", { name: "Signaler et ajouter au call" }).click();

    await expect
      .poll(async () => {
        const { data } = await admin.from("field_materials")
          .select("name, is_custom").eq("scheduled_job_id", ctx.jobId);
        return data?.[0]?.is_custom ?? null;
      }, { timeout: 20000 })
      .toBe(true);
    console.log("TERRAIN >>> signalement enregistré comme hors catalogue");

    await admin.from("field_materials").delete().eq("scheduled_job_id", ctx.jobId);
  });
});
