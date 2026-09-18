import { test, expect } from "../fixtures/base";
import { connexionLocataire, loginWithCredentials } from "../helpers/auth";
import {
  cleanupFieldEmployeeTestData,
  createE2EAdmin,
  setupFieldEmployeeTestData,
  type FieldEmployeeTestContext,
} from "../helpers/field-employee";
import { readTestCredentials } from "../helpers/test-data";

/**
 * LE TRAVAILLEUR PREND ET REND SES OUTILS.
 *
 * Ces épreuves visent les PROPRIÉTÉS du mouvement, pas les boutons : après
 * une prise, l'outil est à son nom en base et le bureau le voit ; après un
 * retour, il ne l'est plus. Elles tiendraient si l'écran changeait de forme.
 *
 * Le contrôle se fait DES DEUX CÔTÉS — l'interface du travailleur, puis la
 * base que lit l'employeur. Vérifier seulement l'écran laisserait passer le
 * défaut le plus coûteux : un mouvement affiché mais jamais enregistré.
 */

const MARQUE = "E2E-OUTIL";

test.describe("40. Les outils du terrain", () => {
  let fieldCtx: FieldEmployeeTestContext;
  let companyId: string;
  let toolId = "";
  let autreToolId = "";

  test.beforeAll(async () => {
    const creds = readTestCredentials();
    companyId = creds.tenantCompanyId!;
    test.skip(!companyId, "Company ID manquant");

    const admin = createE2EAdmin();
    fieldCtx = await setupFieldEmployeeTestData(admin, companyId);

    const { data: outils, error } = await admin
      .from("tools")
      .insert([
        {
          company_id: companyId,
          name: `${MARQUE} Perceuse`,
          category: "Perçage",
          internal_number: `${MARQUE}-001`,
          base_status: "available",
          condition: "good",
        },
        {
          company_id: companyId,
          name: `${MARQUE} Scie`,
          category: "Coupe",
          internal_number: `${MARQUE}-002`,
          base_status: "available",
          condition: "good",
        },
      ])
      .select("id, name");
    if (error) throw new Error(`Semis d'outils impossible : ${error.message}`);
    toolId = (outils ?? []).find((o) => o.name.includes("Perceuse"))!.id as string;
    autreToolId = (outils ?? []).find((o) => o.name.includes("Scie"))!.id as string;
  });

  test.afterAll(async () => {
    const admin = createE2EAdmin();
    if (companyId) {
      await admin.from("tool_assignments").delete().eq("company_id", companyId).in("tool_id", [toolId, autreToolId].filter(Boolean));
      await admin.from("tools").delete().eq("company_id", companyId).like("name", `${MARQUE}%`);
    }
    if (fieldCtx && companyId) await cleanupFieldEmployeeTestData(admin, companyId, fieldCtx);
  });

  /** Remet l'outil au dépôt entre deux épreuves. */
  async function libererLOutil(id: string) {
    const admin = createE2EAdmin();
    await admin.from("tool_assignments").delete().eq("company_id", companyId).eq("tool_id", id);
    await admin.from("tools").update({ base_status: "available" }).eq("id", id);
  }

  async function ouvrirMesOutils(page: import("@playwright/test").Page) {
    await loginWithCredentials(page, fieldCtx.email, fieldCtx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    await page.goto("/terrain/outils");
    await expect(page.getByRole("heading", { name: "Mes outils" })).toBeVisible({ timeout: 20000 });
  }

  test("prendre un outil l'attribue au travailleur, et le bureau le voit", async ({ page }) => {
    await libererLOutil(toolId);
    await ouvrirMesOutils(page);

    await page.getByRole("tab", { name: /Inventaire/ }).click();
    await page.getByTestId(`prendre-${toolId}`).click();
    await page.getByTestId("confirmer-feuille").click();

    await expect(page.getByTestId("outils-succes")).toBeVisible({ timeout: 20000 });

    // L'outil est passé du côté « en ma possession ».
    await page.getByRole("tab", { name: /En ma possession/ }).click();
    await expect(page.getByTestId(`rendre-${toolId}`)).toBeVisible();

    /*
     * LA VÉRITÉ EST EN BASE, PAS À L'ÉCRAN.
     * C'est cette ligne que l'employeur lit sur son écran Outillage :
     * détenteur, date de sortie, retour prévu.
     */
    const admin = createE2EAdmin();
    const { data } = await admin
      .from("tool_assignments")
      .select("employee_id, start_date, expected_return_date, status, actual_return_date")
      .eq("company_id", companyId)
      .eq("tool_id", toolId)
      .eq("status", "active")
      .maybeSingle();

    expect(data, "une prise active doit exister").toBeTruthy();
    expect(data!.employee_id).toBe(fieldCtx.employeeId);
    expect(data!.actual_return_date).toBeNull();
    expect(data!.expected_return_date).toBeTruthy();
  });

  test("retourner en bon état libère l'outil pour les autres", async ({ page }) => {
    await libererLOutil(toolId);
    const admin = createE2EAdmin();
    await admin.from("tool_assignments").insert({
      company_id: companyId,
      tool_id: toolId,
      employee_id: fieldCtx.employeeId,
      start_date: new Date().toISOString().slice(0, 10),
      expected_return_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      status: "active",
    });

    await ouvrirMesOutils(page);
    await page.getByTestId(`rendre-${toolId}`).click();
    await page.getByTestId("confirmer-feuille").click();
    await expect(page.getByTestId("outils-succes")).toBeVisible({ timeout: 20000 });

    const { data: prise } = await admin
      .from("tool_assignments")
      .select("status, actual_return_date, return_condition")
      .eq("company_id", companyId)
      .eq("tool_id", toolId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(prise!.status).toBe("returned");
    expect(prise!.actual_return_date, "la date réelle du retour est posée").toBeTruthy();
    expect(prise!.return_condition).toBe("good");

    // L'outil retourne au parc : son statut de base n'a pas bougé.
    const { data: outil } = await admin
      .from("tools")
      .select("base_status")
      .eq("id", toolId)
      .single();
    expect(outil!.base_status).toBe("available");
  });

  test("un retour abîmé sort l'outil du parc et laisse une trace", async ({ page }) => {
    await libererLOutil(toolId);
    const admin = createE2EAdmin();
    await admin.from("tool_assignments").insert({
      company_id: companyId,
      tool_id: toolId,
      employee_id: fieldCtx.employeeId,
      start_date: new Date().toISOString().slice(0, 10),
      expected_return_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      status: "active",
      notes: "Pour le chantier de test",
    });

    await ouvrirMesOutils(page);
    await page.getByTestId(`rendre-${toolId}`).click();
    await page.getByRole("button", { name: "Abîmé" }).click();
    await page.getByLabel("Décrivez le problème").fill("Mandrin coincé");
    await page.getByTestId("confirmer-feuille").click();
    await expect(page.getByTestId("outils-succes")).toBeVisible({ timeout: 20000 });

    const { data: outil } = await admin
      .from("tools")
      .select("base_status")
      .eq("id", toolId)
      .single();
    expect(outil!.base_status, "un outil abîmé ne repart pas au chantier").toBe("in_repair");

    const { data: prise } = await admin
      .from("tool_assignments")
      .select("return_condition, notes")
      .eq("company_id", companyId)
      .eq("tool_id", toolId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(prise!.return_condition).toBe("damaged");
    // La note de la prise SURVIT au retour : la fiche se lit comme un journal.
    expect(prise!.notes).toContain("Pour le chantier de test");
    expect(prise!.notes).toContain("Mandrin coincé");

    await libererLOutil(toolId);
  });

  test("l'outil d'un collègue n'est ni rendu ni repris", async ({ page }) => {
    await libererLOutil(autreToolId);
    const admin = createE2EAdmin();

    // Un autre employé de la MÊME entreprise détient l'outil.
    const { data: collegue } = await admin
      .from("employees")
      .select("id")
      .eq("company_id", companyId)
      .neq("id", fieldCtx.employeeId)
      .limit(1)
      .maybeSingle();
    test.skip(!collegue, "Pas de second employé pour cette épreuve.");

    await admin.from("tool_assignments").insert({
      company_id: companyId,
      tool_id: autreToolId,
      employee_id: collegue!.id,
      start_date: new Date().toISOString().slice(0, 10),
      expected_return_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      status: "active",
    });

    await ouvrirMesOutils(page);

    // Il n'apparaît ni dans ses outils, ni parmi les disponibles.
    await expect(page.getByTestId(`rendre-${autreToolId}`)).toHaveCount(0);
    await page.getByRole("tab", { name: /Inventaire/ }).click();
    await expect(page.getByTestId(`prendre-${autreToolId}`)).toHaveCount(0);

    // Et la prise du collègue est intacte.
    const { data } = await admin
      .from("tool_assignments")
      .select("employee_id, status")
      .eq("company_id", companyId)
      .eq("tool_id", autreToolId)
      .eq("status", "active")
      .maybeSingle();
    expect(data!.employee_id).toBe(collegue!.id);

    await libererLOutil(autreToolId);
  });

  test("deux prises simultanées : la base n'en laisse passer qu'une", async () => {
    await libererLOutil(toolId);
    const admin = createE2EAdmin();
    const jour = new Date().toISOString().slice(0, 10);
    const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const { data: collegue } = await admin
      .from("employees")
      .select("id")
      .eq("company_id", companyId)
      .neq("id", fieldCtx.employeeId)
      .limit(1)
      .maybeSingle();
    test.skip(!collegue, "Pas de second employé pour cette épreuve.");

    /*
     * LA COURSE, JOUÉE POUR DE VRAI.
     *
     * Deux insertions parties ensemble. Sans l'index unique de la migration
     * 048, les deux passeraient et deux hommes repartiraient avec la même
     * perceuse — l'inventaire n'en montrant qu'une sortie.
     */
    const prise = (employeeId: string) =>
      admin.from("tool_assignments").insert({
        company_id: companyId,
        tool_id: toolId,
        employee_id: employeeId,
        start_date: jour,
        expected_return_date: demain,
        status: "active",
      });

    const [a, b] = await Promise.all([prise(fieldCtx.employeeId), prise(collegue!.id)]);
    const echecs = [a.error, b.error].filter(Boolean);
    expect(echecs, "exactement une des deux prises doit être refusée").toHaveLength(1);
    expect(echecs[0]!.code, "refusée par l'index unique").toBe("23505");

    const { count } = await admin
      .from("tool_assignments")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("tool_id", toolId)
      .eq("status", "active");
    expect(count, "une seule sortie active").toBe(1);

    await libererLOutil(toolId);
  });

  test("une prise ne traverse pas les entreprises", async () => {
    /*
     * LA FAILLE QUI A MOTIVÉ LA MIGRATION 049.
     *
     * L'employé ne voit pas l'outil d'un autre client et ne peut pas le lire.
     * Mais rien ne vérifiait que `tool_id` appartenait à l'entreprise
     * déclarée : une prise chez SOI pouvait pointer sur l'outil d'AILLEURS.
     * L'index unique portant sur l'outil, cette ligne fantôme verrouillait
     * l'outil du voisin — ses propres employés se voyaient refuser un outil
     * qui leur paraissait libre, sans explication possible.
     */
    const admin = createE2EAdmin();
    const marque = `E2E-VOISIN-${Date.now()}`;

    const { data: voisine } = await admin
      .from("companies")
      .insert({ name: marque, email: `${marque}@test.invalid` })
      .select("id")
      .single();

    const { data: outilVoisin } = await admin
      .from("tools")
      .insert({
        company_id: voisine!.id,
        name: `${marque} Outil`,
        category: "Divers",
        base_status: "available",
        condition: "good",
      })
      .select("id")
      .single();

    try {
      // Déclarée chez NOUS, pointant sur l'outil du VOISIN.
      const { error } = await admin.from("tool_assignments").insert({
        company_id: companyId,
        tool_id: outilVoisin!.id,
        employee_id: fieldCtx.employeeId,
        start_date: new Date().toISOString().slice(0, 10),
        expected_return_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        status: "active",
      });

      expect(error, "la base doit refuser une prise inter-entreprises").toBeTruthy();
      expect(error!.message).toContain("autre entreprise");

      // Et l'outil du voisin reste libre pour SES employés.
      const { count } = await admin
        .from("tool_assignments")
        .select("id", { count: "exact", head: true })
        .eq("tool_id", outilVoisin!.id)
        .eq("status", "active");
      expect(count, "l'outil du voisin n'est pas verrouillé").toBe(0);
    } finally {
      await admin.from("tool_assignments").delete().eq("company_id", voisine!.id);
      await admin.from("tools").delete().eq("company_id", voisine!.id);
      await admin.from("companies").delete().eq("id", voisine!.id);
    }
  });

  test("le bureau voit le détenteur après une prise du terrain", async ({ page }) => {
    await libererLOutil(toolId);
    const admin = createE2EAdmin();
    await admin.from("tool_assignments").insert({
      company_id: companyId,
      tool_id: toolId,
      employee_id: fieldCtx.employeeId,
      start_date: new Date().toISOString().slice(0, 10),
      expected_return_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      status: "active",
    });

    // Le nom du détenteur, tel que le bureau doit le lire.
    const { data: emp } = await admin
      .from("employees")
      .select("first_name, last_name")
      .eq("id", fieldCtx.employeeId)
      .single();
    const nom = `${emp!.first_name} ${emp!.last_name}`.trim();

    // Côté employeur, sans rien recharger à la main.
    await connexionLocataire(page);
    await page.goto("/outillage");
    // L'écran rend DEUX fois la même ligne — un tableau et des cartes, l'une
    // masquée selon la largeur. On vise celle qui est réellement à l'écran.
    const ligne = page.locator(`[data-testid="tool-row-${MARQUE}-001"]:visible`).first();
    await expect(ligne).toBeVisible({ timeout: 25000 });
    await expect(ligne, "le bureau voit qui détient l'outil").toContainText(nom);

    await libererLOutil(toolId);
  });
});
