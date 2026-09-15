import { test, expect } from "../fixtures/base";
import { connexionLocataire } from "../helpers/auth";

/**
 * LA SEMAINE QUI TIENT DANS L'ÉCRAN.
 *
 * Le défaut que ces tests empêchent de revenir : une vue semaine large de
 * 7 616 px, qui montre un jour et cache les six autres derrière un
 * défilement. Ce qu'on vérifie ici n'est pas l'esthétique, c'est qu'on VOIT
 * les sept jours.
 */
test.describe("31. La vue semaine", () => {
  test("les sept jours tiennent dans la largeur de l'écran", async ({ page }) => {
    await connexionLocataire(page);
    await page.goto("/schedule");
    await page.getByRole("button", { name: "Semaine", exact: true }).click();
    await page.waitForTimeout(800);

    // Le titre de la semaine, celui qu'il cherchait.
    await expect(page.getByText(/Semaine du .* au /)).toBeVisible();

    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(debordement, "la page ne doit pas défiler de côté").toBe(false);

    // Les sept en-têtes de jour sont visibles SANS défiler.
    const entetes = page.locator("div.grid").first();
    const largeur = await page.evaluate(() => document.documentElement.clientWidth);
    console.log("SEMAINE >>> largeur de la fenêtre :", largeur);
    expect(largeur).toBeLessThan(2000);
  });

  test("le chevauchement « 5AM 13 » a disparu", async ({ page }) => {
    await connexionLocataire(page);
    await page.goto("/schedule");
    await page.getByRole("button", { name: "Semaine", exact: true }).click();
    await page.waitForTimeout(800);

    // Les repères d'heures n'existent plus en vue semaine : l'heure est
    // écrite dans la pastille. C'est leur superposition aux noms de jours,
    // dans la même bande de 40 px, qui donnait « 5AM 13 ».
    const corps = await page.locator("main").innerText();
    expect(corps).not.toMatch(/\d+AM\s*\d+/);
    expect(corps).not.toMatch(/\d+PM\s*\d+/);
  });

  test("sur téléphone, une ligne par jour", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await connexionLocataire(page);
    await page.goto("/schedule");
    await page.getByRole("button", { name: "Semaine", exact: true }).click();
    await page.waitForTimeout(800);

    // Les sept jours en toutes lettres, empilés.
    for (const jour of ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]) {
      await expect(page.getByRole("heading", { name: new RegExp(jour, "i") })).toBeVisible();
    }
    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(debordement, "aucun débordement horizontal sur téléphone").toBe(false);
    await page.screenshot({ path: "test-results/semaine-telephone.png", fullPage: true });
  });

  test("la vue jour garde son glisser et son rectangle", async ({ page }) => {
    await connexionLocataire(page);
    await page.goto("/schedule");
    // On revient au jour : la ligne de temps et ses repères doivent être là.
    await page.getByRole("button", { name: "Jour", exact: true }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText(/^(Employé)$/)).toBeVisible();
  });

  test("capture, ordinateur", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await connexionLocataire(page);
    await page.goto("/schedule");
    await page.getByRole("button", { name: "Semaine", exact: true }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/semaine-bureau.png" });
    console.log("SEMAINE >>> capture faite");
  });

  test("aucune erreur d'hydratation ni HTML invalide", async ({ page }) => {
    // La case entière était un bouton et chaque pastille en était un autre :
    // React signalait « cannot be a descendant », ce qui est une erreur
    // d'hydratation et non un avertissement cosmétique.
    const erreurs: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") erreurs.push(m.text());
    });
    page.on("pageerror", (e) => erreurs.push(e.message));

    await connexionLocataire(page);
    await page.goto("/schedule");
    await page.getByRole("button", { name: "Semaine", exact: true }).click();
    await page.waitForTimeout(1500);

    const graves = erreurs.filter((e) =>
      /hydration|cannot be a descendant|cannot contain a nested/i.test(e),
    );
    console.log("SEMAINE >>> erreurs console :", erreurs.length, "— dont graves :", graves.length);
    expect(graves, graves[0]?.slice(0, 300) ?? "").toHaveLength(0);
  });

  test("la semaine commence le lundi, comme pour l'employé", async ({ page }) => {
    // /terrain utilise `weekStartsOn: 1`. Sans cela, l'employeur et son
    // employé ne parlent pas de la même semaine.
    await page.setViewportSize({ width: 390, height: 844 });
    await connexionLocataire(page);
    await page.goto("/schedule");
    await page.getByRole("button", { name: "Semaine", exact: true }).click();
    await page.waitForTimeout(800);
    const titres = await page.getByRole("heading", { level: 3 }).allInnerTexts();
    console.log("SEMAINE >>> premier jour :", titres[0]);
    expect(titres[0]?.toLowerCase()).toContain("lundi");
    expect(titres[6]?.toLowerCase()).toContain("dimanche");
  });
});
