import { test, expect } from "../fixtures/base";
import { loginWithCredentials } from "../helpers/auth";
import { createE2EAdmin } from "../helpers/field-employee";
import { readTestCredentials } from "../helpers/test-data";

test.describe("14. Accès employé — sécurité admin", () => {
  test("créer un employé avec accès ne modifie pas le compte admin", async ({ page }) => {
    const creds = readTestCredentials();
    /*
     * `creds.tenantEmail` N'EXISTAIT PAS — et cette épreuve ne s'est donc JAMAIS
     * exécutée. Le fichier d'identifiants porte `tenantEmail` et
     * `tenantPassword` ; `email` y est absent, la condition était donc
     * toujours vraie et le saut systématique. Une épreuve de sécurité
     * annoncée « ignorée » à chaque passage, que personne ne lisait.
     */
    test.skip(
      !creds.tenantEmail || !creds.tenantPassword || !creds.tenantCompanyId,
      "Identifiants E2E manquants",
    );

    const adminClient = createE2EAdmin();
    const runId = Date.now();
    const employeeEmail = `e2e+emp-access${runId}@e2e.constructionios.test`;

    await loginWithCredentials(page, creds.tenantEmail, creds.tenantPassword);
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });

    const { data: adminProfileBefore } = await adminClient
      .from("profiles")
      .select("id, role, employee_id")
      .eq("email", creds.tenantEmail)
      .maybeSingle();

    expect(adminProfileBefore?.role).not.toBe("employee");
    expect(adminProfileBefore?.employee_id).toBeNull();

    await page.goto("/employees");
    await page.getByRole("button", { name: /ajouter un employé/i }).click();
    await page.getByLabel("Prénom", { exact: true }).fill("E2E");
    // `exact` : `getByLabel` ignore la casse, donc « Nom » désignait aussi
    // « Prénom » — deux champs pour un seul sélecteur.
    await page.getByLabel("Nom", { exact: true }).fill(`Access${runId}`);
    await page.getByLabel("Métier", { exact: true }).fill("Plombier");
    await page.getByLabel("Courriel", { exact: true }).fill(employeeEmail);
    /*
     * Par son identifiant, pas par son libellé. La case est un `<input>`
     * natif stylé : `getByLabel` la trouvait sans pouvoir la cocher, et
     * l'employé était créé SANS accès — l'épreuve échouait alors sur
     * `user_id`, en accusant le produit d'un défaut qui n'existait pas.
     */
    await page.locator("#grantAppAccess").check();
    await expect(page.locator("#grantAppAccess")).toBeChecked();
    await page.getByRole("button", { name: /ajouter l'employé/i }).click();

    /*
     * CE QUE CETTE ÉPREUVE VÉRIFIE VRAIMENT : que la création d'un employé
     * avec accès ne dégrade PAS le compte qui l'a créée. Cette propriété
     * tient que l'invitation parte ou non.
     *
     * Elle exigeait auparavant que l'invitation aboutisse — donc qu'une place
     * d'abonnement soit libre. Quand elles sont toutes occupées, la fiche est
     * créée et l'invitation refusée, avec un message clair : ce n'est pas un
     * défaut, c'est la limite de places correctement appliquée. Faire échouer
     * une épreuve de sécurité sur cette limite, c'est se rendre aveugle à ce
     * qu'elle surveille.
     */
    await page.waitForTimeout(4000);

    const { data: adminProfileAfter } = await adminClient
      .from("profiles")
      .select("id, role, employee_id")
      .eq("email", creds.tenantEmail)
      .maybeSingle();

    // LE POINT : le compte administrateur est intact.
    expect(adminProfileAfter?.id).toBe(adminProfileBefore?.id);
    expect(adminProfileAfter?.role).toBe(adminProfileBefore?.role);
    expect(adminProfileAfter?.employee_id).toBeNull();

    const { data: employeeRow } = await adminClient
      .from("employees")
      .select("user_id, app_access_enabled")
      .eq("email", employeeEmail)
      .maybeSingle();

    // La fiche existe, et si un compte lui a été rattaché, ce n'est jamais
    // celui de l'administrateur.
    expect(employeeRow, "la fiche employé est créée").toBeTruthy();
    if (employeeRow?.user_id) {
      expect(employeeRow.user_id).not.toBe(adminProfileBefore?.id);
    }
    console.log(
      `SÉCURITÉ >>> compte admin intact · accès accordé : ${employeeRow?.user_id ? "oui" : "non (places occupées)"}`,
    );

    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    await adminClient.from("employees").delete().eq("email", employeeEmail);
    if (employeeRow?.user_id) {
      await adminClient.from("company_members").delete().eq("user_id", employeeRow.user_id);
      await adminClient.from("profiles").delete().eq("id", employeeRow.user_id);
      await adminClient.auth.admin.deleteUser(employeeRow.user_id);
    }
  });
});

/**
 * UN EMPLOYÉ N'ATTEINT PAS LES FONCTIONS D'ADMINISTRATION.
 *
 * L'épreuve précédente vérifie que CRÉER un employé ne dégrade pas le compte
 * qui l'a créé. Celle-ci vérifie l'autre sens, qui est le vrai risque : une
 * fois entré, l'employé ne doit pas pouvoir atteindre ce qui ne le regarde
 * pas.
 *
 * Elle ne dépend pas des places de l'abonnement : l'employé de terrain est
 * créé directement, comme pour les autres épreuves de `/terrain`.
 */
test.describe("14b. Un employé n'atteint pas l'administration", () => {
  test("les écrans de gestion lui sont refusés", async ({ page }) => {
    const creds = readTestCredentials();
    test.skip(!creds.tenantCompanyId, "Identifiants E2E manquants");

    const { createE2EAdmin: admin, setupFieldEmployeeTestData } = await import(
      "../helpers/field-employee"
    );
    const ctx = await setupFieldEmployeeTestData(admin(), creds.tenantCompanyId!);

    await page.goto("/login");
    await page.getByLabel("Courriel").fill(ctx.email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(ctx.password);
    await page.getByRole("button", { name: /Se connecter/ }).click();
    await page.waitForURL(/\/terrain/, { timeout: 30000 });

    /*
     * Chaque écran de gestion est demandé directement, à l'URL. C'est ainsi
     * qu'on contourne une interface : en tapant l'adresse. Aucun ne doit
     * s'ouvrir — l'employé doit être ramené vers son propre espace.
     */
    const refuses: string[] = [];
    for (const route of [
      "/dashboard",
      "/employees",
      "/settings",
      "/payments",
      "/customers",
      "/invoices",
      "/admin",
    ]) {
      await page.goto(route);
      await page.waitForTimeout(800);
      const arrivee = new URL(page.url()).pathname;
      if (arrivee === route) refuses.push(`${route} → ouvert !`);
    }

    console.log("SÉCURITÉ >>> écrans de gestion atteints par l'employé :", refuses.length);
    expect(refuses, refuses.join(" | ")).toHaveLength(0);
  });
});
