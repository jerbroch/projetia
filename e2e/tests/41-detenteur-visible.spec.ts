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
 * QUI DÉTIENT CET OUTIL — vu par les trois personnes concernées.
 *
 * L'employé qui l'a, le collègue qui le cherche, et le bureau qui arbitre
 * doivent lire la MÊME chose au même moment. C'est tout l'objet de l'épreuve :
 * elle fait passer un seul outil d'une main à l'autre et vérifie les trois
 * écrans à chaque étape.
 */

const MARQUE = "E2E-DET";
const MDP = process.env.E2E_DEFAULT_PASSWORD ?? "TestE2ePass123!";

/**
 * LA DATE DE L'APPLICATION, PAS CELLE D'UTC.
 *
 * `todayDateString()` renvoie la date LOCALE du serveur. Les épreuves
 * semaient la date UTC (`toISOString`) :
 * après 20 h à Montréal, c'est déjà le lendemain. La prise devenait alors une
 * réservation future, l'outil n'était plus « en ma possession », et le bouton
 * de retour n'existait pas.
 *
 * Le défaut n'apparaissait donc que le soir — d'où des passages verts le jour
 * et rouges la nuit, sur le même code.
 */
function jourOuvrable(decalageJours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  return d.toLocaleDateString("en-CA");
}

test.describe("41. Le détenteur est visible des deux côtés", () => {
  let premier: FieldEmployeeTestContext;
  let companyId = "";
  let toolId = "";
  let nomDuPremier = "";
  const second = { email: "", userId: "", employeeId: "", nom: "" };

  test.beforeAll(async () => {
    companyId = readTestCredentials().tenantCompanyId!;
    test.skip(!companyId, "Company ID manquant");
    const admin = createE2EAdmin();

    premier = await setupFieldEmployeeTestData(admin, companyId);
    const { data: e1 } = await admin
      .from("employees")
      .select("first_name, last_name")
      .eq("id", premier.employeeId)
      .single();
    nomDuPremier = `${e1!.first_name} ${e1!.last_name}`.trim();

    // LE SECOND EMPLOYÉ, créé à la main : le semis partagé en supprime un
    // avant d'en poser un, donc l'appeler deux fois n'en donnerait qu'un.
    const marqueur = Date.now();
    second.email = `e2e+second${marqueur}@e2e.constructionios.test`;
    const { data: u } = await admin.auth.admin.createUser({
      email: second.email,
      password: MDP,
      email_confirm: true,
    });
    second.userId = u!.user!.id;
    const { data: emp } = await admin
      .from("employees")
      .insert({
        company_id: companyId,
        first_name: `${MARQUE}Second`,
        last_name: "Collegue",
        email: second.email,
        trade: "Plombier",
        status: "active",
      })
      .select("id")
      .single();
    second.employeeId = emp!.id;
    second.nom = `${MARQUE}Second Collegue`;
    await admin.from("profiles").upsert({
      id: second.userId,
      company_id: companyId,
      email: second.email,
      first_name: `${MARQUE}Second`,
      last_name: "Collegue",
      role: "employee",
      status: "active",
      employee_id: second.employeeId,
    });
    await admin
      .from("company_members")
      .insert({ user_id: second.userId, company_id: companyId, role: "employee" });

    const { data: t } = await admin
      .from("tools")
      .insert({
        company_id: companyId,
        name: `${MARQUE} Perceuse Milwaukee`,
        category: "Perçage",
        internal_number: `${MARQUE}-900`,
        base_status: "available",
        condition: "good",
      })
      .select("id")
      .single();
    toolId = t!.id;
  });

  test.afterAll(async () => {
    const admin = createE2EAdmin();
    if (toolId) {
      await admin.from("tool_assignments").delete().eq("tool_id", toolId);
      await admin.from("tools").delete().eq("id", toolId);
    }
    if (second.userId) {
      await admin.from("company_members").delete().eq("user_id", second.userId);
      await admin.from("profiles").delete().eq("id", second.userId);
      await admin.from("employees").delete().eq("id", second.employeeId);
      await admin.auth.admin.deleteUser(second.userId);
    }
    if (premier && companyId) await cleanupFieldEmployeeTestData(admin, companyId, premier);
  });

  async function libererLOutil() {
    const admin = createE2EAdmin();
    await admin.from("tool_assignments").delete().eq("tool_id", toolId);
    await admin.from("tools").update({ base_status: "available" }).eq("id", toolId);
  }

  async function ouvrirOutils(page: import("@playwright/test").Page, courriel: string) {
    await loginWithCredentials(page, courriel, MDP);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    await page.goto("/terrain/outils");
    await expect(page.getByRole("heading", { name: "Mes outils" })).toBeVisible({ timeout: 25000 });
  }

  /** L'état affiché pour cet outil, tel qu'un œil le lit. */
  function etat(page: import("@playwright/test").Page) {
    return page.getByTestId(`etat-outil-${toolId}`);
  }

  test("le collègue voit le nom du détenteur, sans pouvoir agir", async ({ browser }) => {
    await libererLOutil();
    const admin = createE2EAdmin();

    // ── Le premier employé prend l'outil ────────────────────────────────
    const c1 = await browser.newContext({ viewport: { width: 390, height: 860 }, hasTouch: true });
    const p1 = await c1.newPage();
    await ouvrirOutils(p1, premier.email);
    await p1.getByRole("tab", { name: /Inventaire/ }).click();
    await p1.getByTestId(`prendre-${toolId}`).click();
    await p1.getByTestId("confirmer-feuille").click();
    /*
     * L'outil QUITTE l'onglet Inventaire au moment où il devient sien :
     * cet onglet ne montre que ce qui n'est pas à soi. On attend donc sa
     * disparition d'ici, puis on va le chercher dans ses outils.
     */
    await p1.getByTestId(`prendre-${toolId}`).waitFor({ state: "detached", timeout: 30000 });

    // Il lit « En ma possession » et garde son bouton.
    await p1.getByRole("tab", { name: /En ma possession/ }).click();
    await p1.getByTestId(`rendre-${toolId}`).waitFor({ timeout: 30000 });
    await expect(etat(p1)).toHaveAttribute("data-genre", "a-moi");
    await expect(etat(p1)).toContainText("En ma possession");
    await expect(p1.getByTestId(`rendre-${toolId}`)).toBeVisible();

    // ── Le collègue, sur son propre téléphone ───────────────────────────
    const c2 = await browser.newContext({ viewport: { width: 390, height: 860 }, hasTouch: true });
    const p2 = await c2.newPage();
    await ouvrirOutils(p2, second.email);
    await p2.getByRole("tab", { name: /Inventaire/ }).click();

    await expect(etat(p2), "l'outil ne disparaît plus de sa liste").toBeVisible();
    await expect(etat(p2)).toHaveAttribute("data-genre", "detenu");
    await expect(etat(p2)).toContainText("Indisponible");
    await expect(p2.getByTestId(`detenteur-${toolId}`)).toContainText(nomDuPremier);
    // « Depuis le 18 septembre à 7 h 30 » : la date ET l'heure de la prise.
    await expect(p2.getByText(/Depuis le \d{1,2} \p{L}+ à \d{1,2} h \d{2}/u).first()).toBeVisible();

    /*
     * IL NE PEUT NI LE PRENDRE NI LE RENDRE.
     * Un bouton qui refuserait ensuite serait une promesse en l'air ; on n'en
     * affiche aucun.
     */
    await expect(p2.getByTestId(`prendre-${toolId}`)).toHaveCount(0);
    await expect(p2.getByTestId(`rendre-${toolId}`)).toHaveCount(0);

    // ── Le bureau lit la même chose ─────────────────────────────────────
    const c3 = await browser.newContext();
    const p3 = await c3.newPage();
    await connexionLocataire(p3);
    await p3.goto("/outillage");
    const ligne = p3.locator(`[data-testid="tool-row-${MARQUE}-900"]:visible`).first();
    await expect(ligne).toBeVisible({ timeout: 25000 });
    await expect(ligne, "le bureau voit le détenteur sans ouvrir la fiche").toContainText(
      nomDuPremier,
    );

    // ── Le premier rapporte l'outil ─────────────────────────────────────
    await p1.getByTestId(`rendre-${toolId}`).click();
    await p1.getByTestId("confirmer-feuille").click();
    await p1.getByTestId(`rendre-${toolId}`).waitFor({ state: "detached", timeout: 30000 });

    const { data: apres } = await admin
      .from("tool_assignments")
      .select("status, actual_return_date")
      .eq("tool_id", toolId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(apres!.status).toBe("returned");
    expect(apres!.actual_return_date).toBeTruthy();

    // ── Tout le monde le revoit disponible ──────────────────────────────
    await p2.reload();
    await p2.getByRole("tab", { name: /Inventaire/ }).click();
    await expect(etat(p2)).toHaveAttribute("data-genre", "disponible");
    await expect(
      p2.getByTestId(`detenteur-${toolId}`),
      "le nom du détenteur disparaît de l'affichage courant",
    ).toHaveCount(0);
    await expect(p2.getByTestId(`prendre-${toolId}`), "il peut le prendre à son tour").toBeVisible();

    await p3.reload();
    const ligne2 = p3.locator(`[data-testid="tool-row-${MARQUE}-900"]:visible`).first();
    await expect(ligne2).toBeVisible({ timeout: 25000 });
    await expect(ligne2).not.toContainText(nomDuPremier);

    await c1.close();
    await c2.close();
    await c3.close();
  });

  test("voir les noms n'ouvre pas les salaires", async () => {
    /*
     * LA CONTREPARTIE DE LA VUE `employes_noms`.
     *
     * La table `employees` a été fermée au terrain parce qu'elle porte le
     * taux horaire de tout le monde. Nommer un détenteur ne doit pas rouvrir
     * cette porte.
     *
     * On éprouve la BASE avec le vrai jeton de l'employé, pas l'interface :
     * un écran qui n'affiche pas une colonne ne prouve rien sur ce que la
     * base laisse lire à qui sait demander.
     */
    const { createClient } = await import("@supabase/supabase-js");
    const urlSb = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const anonyme = createClient(urlSb, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sess, error: eSess } = await anonyme.auth.signInWithPassword({
      email: second.email,
      password: MDP,
    });
    expect(eSess, "la session de l'employé doit s'ouvrir").toBeNull();

    const sien = createClient(urlSb, anon, {
      global: { headers: { Authorization: `Bearer ${sess!.session!.access_token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Il voit les noms de ses collègues.
    const { data: noms } = await sien
      .from("employes_noms")
      .select("id, first_name, last_name")
      .eq("company_id", companyId);
    const trouve = (noms ?? []).some((n) => (n as { id: string }).id === premier.employeeId);
    expect(trouve, "le nom du détenteur doit être lisible").toBe(true);

    // 2. La vue ne porte AUCUN taux horaire.
    const { error: eTaux } = await sien.from("employes_noms").select("hourly_rate").limit(1);
    expect(eTaux, "la vue ne doit pas exposer le taux horaire").toBeTruthy();

    // 3. La fiche complète d'un collègue reste fermée.
    const { data: fiches } = await sien
      .from("employees")
      .select("id, hourly_rate")
      .eq("id", premier.employeeId);
    expect(
      fiches ?? [],
      "la table employees reste fermée sur la fiche d'un collègue",
    ).toHaveLength(0);
  });

  test("une réservation future n'invente pas de détenteur", async ({ browser }) => {
    await libererLOutil();
    const admin = createE2EAdmin();
    const dans3 = jourOuvrable(3);
    const dans5 = jourOuvrable(5);
    await admin.from("tool_assignments").insert({
      company_id: companyId,
      tool_id: toolId,
      employee_id: premier.employeeId,
      start_date: dans3,
      expected_return_date: dans5,
      status: "reserved",
    });

    const c = await browser.newContext({ viewport: { width: 390, height: 860 }, hasTouch: true });
    const page = await c.newPage();
    await ouvrirOutils(page, second.email);
    await page.getByRole("tab", { name: /Inventaire/ }).click();

    // Réservé pour plus tard ≠ détenu maintenant : l'outil est encore au dépôt.
    await expect(etat(page)).toHaveAttribute("data-genre", "disponible");
    await expect(page.getByTestId(`detenteur-${toolId}`)).toHaveCount(0);

    await c.close();
    await libererLOutil();
  });

  test("un outil en réparation dit sa raison, sans détenteur", async ({ browser }) => {
    await libererLOutil();
    const admin = createE2EAdmin();
    await admin.from("tools").update({ base_status: "in_repair" }).eq("id", toolId);

    const c = await browser.newContext({ viewport: { width: 390, height: 860 }, hasTouch: true });
    const page = await c.newPage();
    await ouvrirOutils(page, second.email);
    await page.getByRole("tab", { name: /Inventaire/ }).click();

    await expect(etat(page)).toHaveAttribute("data-genre", "indisponible");
    await expect(etat(page)).toContainText("En réparation");
    await expect(
      page.getByTestId(`detenteur-${toolId}`),
      "aucun détenteur inventé pour un outil immobilisé",
    ).toHaveCount(0);
    await expect(page.getByTestId(`prendre-${toolId}`)).toHaveCount(0);

    await c.close();
    await libererLOutil();
  });
});
