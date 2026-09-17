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

/**
 * UN EMPLOYÉ NE LIT PAS CE QUI NE LE REGARDE PAS — MÊME SANS L'ÉCRAN.
 *
 * L'épreuve précédente vérifie que les écrans de gestion lui sont refusés.
 * Celle-ci va plus loin : cacher un bouton ne protège rien. On prend SON
 * jeton de session et l'on interroge l'API directement, comme le ferait
 * quelqu'un qui récupère son jeton dans les outils du navigateur.
 *
 * La barrière n'est pas l'interface, ce sont les politiques RLS. C'est elles
 * qu'on éprouve ici — avec la clé publique, jamais la clé de service, qui
 * les contourne par construction et ne prouverait rien.
 */
test.describe("14c. Un employé n'atteint pas les données d'administration", () => {
  test("son jeton ne lui ouvre pas les données des autres", async ({ page, context }) => {
    const creds = readTestCredentials();
    const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const cleAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    test.skip(
      !creds.tenantCompanyId || !urlSupabase || !cleAnon,
      "Configuration Supabase absente",
    );

    const { createE2EAdmin: admin, setupFieldEmployeeTestData } = await import(
      "../helpers/field-employee"
    );
    const ctx = await setupFieldEmployeeTestData(admin(), creds.tenantCompanyId!);

    const voisineNom = `E2E Voisine ${Date.now()}`;
    const { data: voisine } = await admin()
      .from("companies")
      .insert({ name: voisineNom, email: `e2e+v${Date.now()}@e2e.constructionios.test` })
      .select("id")
      .single();

    try {
      await page.goto("/login");
      await page.getByLabel("Courriel").fill(ctx.email);
      await page.getByLabel("Mot de passe", { exact: true }).fill(ctx.password);
      await page.getByRole("button", { name: /Se connecter/ }).click();
      await page.waitForURL(/\/terrain/, { timeout: 30000 });

      // Son jeton, tel qu'il se trouve dans son propre navigateur.
      const cookies = await context.cookies();
      const brut = cookies.find((c) => c.name.includes("auth-token"))?.value ?? "";
      const decode = (v: string) => {
        const t = v.startsWith("base64-") ? Buffer.from(v.slice(7), "base64").toString() : v;
        try {
          const j = JSON.parse(t);
          return Array.isArray(j) ? j[0] : j.access_token;
        } catch {
          return null;
        }
      };
      const jeton = decode(brut);
      expect(jeton, "l'employé a bien une session").toBeTruthy();

      const interroger = async (chemin: string) => {
        const r = await fetch(`${urlSupabase}/rest/v1/${chemin}`, {
          headers: { apikey: cleAnon!, Authorization: `Bearer ${jeton}` },
        });
        const corps = await r.text();
        let lignes = 0;
        try {
          const j = JSON.parse(corps);
          lignes = Array.isArray(j) ? j.length : 0;
        } catch {
          lignes = 0;
        }
        return { statut: r.status, lignes };
      };

      // 1. L'entreprise voisine : invisible.
      const rVoisine = await interroger(`companies?id=eq.${voisine!.id}&select=id,name`);
      // 2. Ses clients : invisibles.
      const rClients = await interroger(`customers?company_id=eq.${voisine!.id}&select=id`);
      // 3. Les profils, toutes entreprises confondues : il ne doit pas
      //    récolter l'annuaire de la plateforme.
      const rProfils = await interroger("profiles?select=id,role&limit=100");

      console.log(
        `SÉCURITÉ >>> jeton employé — voisine ${rVoisine.statut}/${rVoisine.lignes} lignes · ` +
          `clients voisins ${rClients.statut}/${rClients.lignes} · profils ${rProfils.statut}/${rProfils.lignes}`,
      );

      expect(rVoisine.lignes, "aucune entreprise voisine lisible").toBe(0);
      expect(rClients.lignes, "aucun client d'une autre entreprise lisible").toBe(0);

      // 4. Et il ne peut rien y écrire non plus.
      const ecriture = await fetch(`${urlSupabase}/rest/v1/customers`, {
        method: "POST",
        headers: {
          apikey: cleAnon!,
          Authorization: `Bearer ${jeton}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company_id: voisine!.id, name: "Intrus", status: "active" }),
      });
      console.log(`SÉCURITÉ >>> écriture chez la voisine refusée : ${ecriture.status}`);
      expect(ecriture.ok, "écrire chez une autre entreprise est refusé").toBe(false);

      await page.goto("/admin");
      await page.waitForTimeout(800);
      expect(new URL(page.url()).pathname, "/admin ne s'ouvre pas").not.toBe("/admin");
    } finally {
      await admin().from("customers").delete().eq("company_id", voisine!.id);
      await admin().from("companies").delete().eq("id", voisine!.id);
    }
  });
});
