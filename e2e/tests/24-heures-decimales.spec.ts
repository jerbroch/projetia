import { test, expect } from "../fixtures/base";
import { loginWithCredentials } from "../helpers/auth";
import {
  cleanupFieldEmployeeTestData, createE2EAdmin, setupFieldEmployeeTestData,
  type FieldEmployeeTestContext,
} from "../helpers/field-employee";
import { readTestCredentials } from "../helpers/test-data";

/**
 * 1,5 h TAPÉ AU CLAVIER DOIT ARRIVER EN BASE COMME 1.5.
 *
 * Avec `<input type="number">`, la virgule vidait le champ : `e.target.value`
 * rendait "" et `Number("")` rendait 0. Une journée et demie s'enregistrait
 * comme zéro heure, sans message d'erreur — le champ n'échouait pas, il
 * mentait. Et côté serveur, `z.coerce.number()` sur « 1,5 » rendait NaN, si
 * bien que le formulaire répondait « les heures doivent être supérieures à 0 »
 * alors qu'une heure et demie venait d'être tapée.
 *
 * Ce test tape la virgule sur un vrai téléphone simulé, puis lit la colonne.
 */
test.describe("24. Heures décimales, virgule comprise", () => {
  let ctx: FieldEmployeeTestContext;
  let companyId: string;

  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    companyId = readTestCredentials().tenantCompanyId!;
    test.skip(!companyId, "Company ID manquant");
    const admin = createE2EAdmin();
    ctx = await setupFieldEmployeeTestData(admin, companyId);
    await admin.from("labor_rate_templates").delete().eq("company_id", companyId).eq("name", "E2E Décimales");
    await admin.from("labor_rate_templates").insert({
      company_id: companyId, name: "E2E Décimales", worker_count: 1,
      cost_per_hr: 45, bill_rate: 125, is_active: true,
    });
  });

  test.afterAll(async () => {
    if (!companyId || !ctx) return;
    const admin = createE2EAdmin();
    await admin.from("labor_rate_templates").delete().eq("company_id", companyId).eq("name", "E2E Décimales");
    await cleanupFieldEmployeeTestData(admin, companyId, ctx);
  });

  /** Saisit des heures sur le chantier de l'employé et rend la valeur en base. */
  async function saisirEtRelire(page: import("@playwright/test").Page, tape: string): Promise<number | null> {
    const admin = createE2EAdmin();
    await admin.from("field_hours").delete().eq("company_id", companyId).eq("scheduled_job_id", ctx.jobId);

    await loginWithCredentials(page, ctx.email, ctx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    await page.goto(`/terrain/calls/${ctx.jobId}`);

    const champ = page.locator("#hours");
    await expect(champ).toBeVisible({ timeout: 20000 });

    // Le clavier du téléphone doit être le pavé DÉCIMAL. `numeric` n'offre pas
    // de séparateur : impossible d'écrire 1,5 avec des gants sur un chantier.
    await expect(champ).toHaveAttribute("inputmode", "decimal");

    const choix = page.locator("#laborType");
    await expect(choix.locator("option", { hasText: "E2E Décimales" }))
      .toHaveCount(1, { timeout: 20000 });
    // `selectOption` n'accepte pas d'expression régulière pour le libellé : on
    // relève la valeur de l'option voulue et on la choisit par elle.
    const valeurTaux = await choix
      .locator("option", { hasText: "E2E Décimales" })
      .first()
      .getAttribute("value");
    await choix.selectOption(valeurTaux!);

    await champ.fill(tape);
    // Le champ n'a pas été vidé par la virgule — c'est tout le sujet. Ce qui
    // s'affiche est la forme normalisée : le point saisi devient une virgule,
    // parce qu'ici on écrit 1,5. La VALEUR, elle, est la même.
    await expect(champ).toHaveValue(tape.replace(".", ","));

    await page.getByRole("button", { name: "Ajouter les heures" }).click();

    // Si le serveur refuse, on veut lire POURQUOI plutôt que de regarder un
    // compteur rester à zéro pendant vingt secondes. Le message doit être NON
    // VIDE : la page porte des conteneurs d'erreur toujours présents, et les
    // prendre pour un refus ferait échouer le test sur du néant.
    const refus = await page
      .locator('[role="alert"], .text-destructive')
      .allInnerTexts()
      .then((t) => t.map((x) => x.trim()).filter(Boolean));
    if (refus.length) {
      throw new Error(`le formulaire a refusé la saisie : ${refus.join(" | ")}`);
    }

    // On attend que la ligne existe avant de lire, plutôt que de dormir.
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("field_hours").select("hours")
          .eq("company_id", companyId).eq("scheduled_job_id", ctx.jobId);
        return (data ?? []).length;
      }, { timeout: 20000 })
      .toBe(1);

    const { data } = await admin
      .from("field_hours").select("hours")
      .eq("company_id", companyId).eq("scheduled_job_id", ctx.jobId).single();
    return data ? Number((data as { hours: number }).hours) : null;
  }

  test("« 1,5 » arrive en base comme 1.5", async ({ page }) => {
    const enBase = await saisirEtRelire(page, "1,5");
    console.log("TERRAIN >>> tapé « 1,5 » — en base :", enBase);
    expect(enBase).toBe(1.5);
  });

  test("« 1.5 » donne exactement la même valeur", async ({ page }) => {
    const enBase = await saisirEtRelire(page, "1.5");
    console.log("TERRAIN >>> tapé « 1.5 » — en base :", enBase);
    expect(enBase).toBe(1.5);
  });

  test("deux décimales passent sans arrondi en chemin", async ({ page }) => {
    const enBase = await saisirEtRelire(page, "7,25");
    console.log("TERRAIN >>> tapé « 7,25 » — en base :", enBase);
    expect(enBase).toBe(7.25);
  });

  test("une troisième décimale ne peut pas s'inscrire", async ({ page }) => {
    await loginWithCredentials(page, ctx.email, ctx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    await page.goto(`/terrain/calls/${ctx.jobId}`);

    const champ = page.locator("#hours");
    await expect(champ).toBeVisible({ timeout: 20000 });
    await champ.fill("1,555");
    await expect(champ).toHaveValue("1,55");
  });
});
