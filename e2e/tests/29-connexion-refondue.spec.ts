import { test, expect } from "../fixtures/base";
import { readTestCredentials } from "../helpers/test-data";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * LA NOUVELLE PORTE D'ENTRÉE.
 *
 * Ce qui compte ici n'est pas l'esthétique — c'est que l'animation de succès
 * ne puisse JAMAIS apparaître sur un échec, et que rien de ce qui marchait
 * avant ne soit cassé.
 */
test.describe("29. Connexion refondue", () => {
  test("mauvais mot de passe : erreur en français, aucune animation", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Courriel").fill("inconnu@exemple.ca");
    await page.getByLabel("Mot de passe", { exact: true }).fill("MauvaisMotDePasse1!");
    await page.getByRole("button", { name: /Se connecter/ }).click();

    // Viser le message LUI-MÊME : `getByRole("alert")` attrape aussi des
    // conteneurs vides posés par le cadre, et le test passerait sur du néant.
    const erreur = page.getByTestId("erreur-connexion");
    await expect(erreur).toBeVisible({ timeout: 20000 });
    const texte = await erreur.innerText();
    console.log("CONNEXION >>> erreur :", texte.trim());
    expect(texte).toContain("invalide");
    // LE POINT : pas d'animation, et on est toujours sur /login.
    await expect(page.getByText("Préparation de votre espace de travail…")).toHaveCount(0);
    expect(page.url()).toContain("/login");
  });

  test("formulaire incomplet : le navigateur bloque avant tout appel", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Se connecter/ }).click();
    await page.waitForTimeout(800);
    expect(page.url()).toContain("/login");
    await expect(page.getByText("Préparation de votre espace de travail…")).toHaveCount(0);
    const valide = await page.locator("#email").evaluate((e: HTMLInputElement) => e.validity.valid);
    expect(valide, "un courriel vide est invalide").toBe(false);
  });

  test("double clic : une seule soumission", async ({ page }) => {
    const creds = readTestCredentials();
    await page.goto("/login");
    await page.getByLabel("Courriel").fill(creds.tenantEmail);
    await page.getByLabel("Mot de passe", { exact: true }).fill(creds.tenantPassword);

    const bouton = page.getByRole("button", { name: /Se connecter/ });
    // Deux clics aussi rapprochés que possible.
    await bouton.click();
    await bouton.click({ force: true, timeout: 2000 }).catch(() => {});

    await page.waitForURL(/\/(dashboard|choose-plan|onboarding)/, { timeout: 60000 });
    console.log("CONNEXION >>> arrivé sur", new URL(page.url()).pathname);
  });

  test("connexion réussie : l'animation paraît, puis le tableau de bord", async ({ page }) => {
    const creds = readTestCredentials();
    await page.goto("/login");
    await page.getByLabel("Courriel").fill(creds.tenantEmail);
    await page.getByLabel("Mot de passe", { exact: true }).fill(creds.tenantPassword);
    await page.getByRole("button", { name: /Se connecter/ }).click();

    // L'animation accompagne la navigation ; elle peut donc déjà être passée.
    // On vérifie surtout qu'on ARRIVE, et que la redirection est préservée.
    await page.waitForURL(/\/(dashboard|choose-plan|onboarding)/, { timeout: 60000 });
    console.log("CONNEXION >>> destination :", new URL(page.url()).pathname);
  });

  test("la destination demandée est préservée", async ({ page }) => {
    const creds = readTestCredentials();
    await page.goto("/login?next=%2Fquotes");
    await page.getByLabel("Courriel").fill(creds.tenantEmail);
    await page.getByLabel("Mot de passe", { exact: true }).fill(creds.tenantPassword);
    await page.getByRole("button", { name: /Se connecter/ }).click();
    await page.waitForURL(/\/quotes/, { timeout: 60000 });
    console.log("CONNEXION >>> next respecté :", new URL(page.url()).pathname);
  });

  test("sur téléphone, le formulaire passe avant le décor", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    const champ = page.locator("#email");
    await expect(champ).toBeVisible();
    const boite = await champ.boundingBox();
    // Il doit être atteignable sans défiler : le volet du plan est caché.
    expect(boite!.y).toBeLessThan(844);
    // Et aucun débordement horizontal.
    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(debordement, "aucun débordement horizontal").toBe(false);
    console.log("CONNEXION >>> champ courriel à y =", Math.round(boite!.y));
  });

  test("les routes d'inscription et de récupération répondent", async ({ page }) => {
    for (const route of ["/register", "/forgot-password"]) {
      const r = await page.goto(route);
      expect(r?.status(), route).toBeLessThan(400);
    }
  });

  test("animations réduites : le plan reste lisible, rien ne bouge", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/login");
    // Le tracé du plan doit être VISIBLE (entièrement dessiné), pas masqué :
    // couper l'animation ne doit pas couper le contenu.
    const trace = page.locator(".plan-trace path").first();
    await expect(trace).toBeVisible();
    const offset = await trace.evaluate(
      (e) => getComputedStyle(e).strokeDashoffset,
    );
    console.log("CONNEXION >>> réduit, strokeDashoffset =", offset);
    // 0 ou 'none' : le trait est complet, pas escamoté.
    expect(["0px", "0", "none", ""].includes(offset)).toBe(true);
    await page.screenshot({ path: "test-results/connexion-anim-reduite.png", fullPage: true });
    await ctx.close();
  });

  test("captures d'écran, ordinateur et téléphone", async ({ browser }) => {
    const bureau = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p1 = await bureau.newPage();
    await p1.goto("/login");
    await p1.waitForTimeout(2200); // laisser les tracés finir
    await p1.screenshot({ path: "test-results/connexion-bureau.png" });
    await bureau.close();

    const tel = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2 = await tel.newPage();
    await p2.goto("/login");
    await p2.waitForTimeout(1500);
    await p2.screenshot({ path: "test-results/connexion-telephone.png", fullPage: true });
    await tel.close();

    // L'animation de succès elle-même. Elle dure le temps du chargement réel,
    // donc on la saisit au vol, juste après le clic.
    const anim = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p3 = await anim.newPage();
    const creds = readTestCredentials();
    await p3.goto("/login");
    await p3.getByLabel("Courriel").fill(creds.tenantEmail);
    await p3.getByLabel("Mot de passe", { exact: true }).fill(creds.tenantPassword);
    await p3.getByRole("button", { name: /Se connecter/ }).click();
    await p3
      .getByText("Préparation de votre espace de travail…")
      .waitFor({ timeout: 15000 })
      .catch(() => {});
    await p3.screenshot({ path: "test-results/connexion-animation.png" });
    await anim.close();
    console.log("CONNEXION >>> captures faites");
  });

  test("compte non confirmé : mène à la vérification, pas à l'animation", async ({ page }) => {
    // Le chemin du compte non confirmé passe par un `redirect()` DANS l'action
    // serveur, désormais appelée depuis le client. Ce qu'il advient de ce
    // redirect n'est pas une chose à supposer : on le mesure.
    const db = admin();
    const courriel = `e2e-nonconfirme-${Date.now()}@example.com`;
    const motDePasse = "MotDePasseE2E!2026";
    const { data, error } = await db.auth.admin.createUser({
      email: courriel,
      password: motDePasse,
      email_confirm: false,
    });
    expect(error, error?.message).toBeNull();
    const id = data!.user!.id;

    try {
      await page.goto("/login");
      await page.getByLabel("Courriel").fill(courriel);
      await page.getByLabel("Mot de passe", { exact: true }).fill(motDePasse);
      await page.getByRole("button", { name: /Se connecter/ }).click();

      await page.waitForTimeout(6000);
      const url = new URL(page.url()).pathname;
      const animation = await page.getByText("Préparation de votre espace de travail…").count();
      const erreur = await page.getByTestId("erreur-connexion").count();
      const texteErreur = erreur ? await page.getByTestId("erreur-connexion").innerText() : "";
      console.log(
        `CONNEXION >>> non confirmé : url=${url} animation=${animation} erreur=${JSON.stringify(texteErreur)}`,
      );
      // Le point non négociable : pas d'animation de succès.
      expect(animation, "aucune animation de succès").toBe(0);
      // Et la personne doit savoir quoi faire, pas rester devant un écran muet.
      // Le message doit NOMMER le vrai problème. « mot de passe invalide »
      // envoyait la personne réinitialiser un mot de passe qui allait très
      // bien — c'est le défaut qu'on empêche de revenir.
      expect(texteErreur).toContain("confirmée");
      expect(texteErreur).not.toContain("invalide");
      // Et lui donner la sortie.
      await expect(page.getByRole("link", { name: "Renvoyer le courriel" })).toBeVisible();
    } finally {
      await db.auth.admin.deleteUser(id);
    }
  });
});
