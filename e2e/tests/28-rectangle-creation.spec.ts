import { erreursAffichees } from "../helpers/erreurs-affichees";
import { test, expect } from "../fixtures/base";
import { connexionLocataire } from "../helpers/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readTestCredentials } from "../helpers/test-data";

/**
 * LE RECTANGLE : ON TOUCHE, ON ÉTIRE, ON CONFIRME.
 *
 * Cliquer sur l'horaire ouvrait le formulaire complet, avec deux heures déjà
 * décidées à l'aveugle. Le rectangle règle cela : on choisit sa plage d'abord.
 *
 * CE QUE « CRÉER » FAIT A CHANGÉ, ET C'EST VOULU.
 *
 * Il enregistrait le call sur-le-champ — « le geste de trois secondes » — avec
 * un titre fabriqué et sans client. Le prix en était un garde-fou à la
 * fermeture, qui refusait un call anonyme pour que la facture ne parte pas
 * avec le mot « Client » à la place du nom. Mais un rectangle tracé par erreur
 * devenait un vrai call dans l'horaire de quelqu'un, qu'il fallait retrouver
 * et supprimer.
 *
 * « Créer » ouvre désormais le formulaire, prérempli avec la date, l'employé
 * et les heures tracées. Rien n'est écrit tant qu'on ne valide pas.
 */
test.describe("28. Le rectangle de création", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, pageName: "Rectangle" });

  let companyId = "";
  test.beforeAll(() => {
    companyId = readTestCredentials().tenantCompanyId!;
  });

  test.afterAll(async () => {
    if (!companyId) return;
    const db = createAdminClient();
    await db.from("scheduled_jobs").delete().eq("company_id", companyId).like("title", "Travail %");
  });

  /**
   * La grille fait 1088 px de large pour un écran de 390 : viser en
   * coordonnées d'écran tombe dans la marge de la carte, trois pixels à côté.
   * On clique RELATIVEMENT à l'élément, et Playwright fait défiler.
   */
  async function cliquerSurLaGrille(page: import("@playwright/test").Page, decalage: number) {
    const grille = page.locator('[data-timeline-body="true"]').first();
    const b = await grille.boundingBox();
    expect(b, "la grille doit être à l'écran").toBeTruthy();
    const largeurEcran = page.viewportSize()?.width ?? 1280;
    // La carte s'arrête avant le bord de l'écran : viser `b.x + décalage`
    // tombait trois pixels dans la marge sur un téléphone. On borne.
    const x = Math.max(b!.x + 8, Math.min(b!.x + decalage, largeurEcran - 30));
    await page.mouse.click(x, b!.y + b!.height / 2);
  }

  async function ouvrirCalendrier(page: import("@playwright/test").Page) {
    await connexionLocataire(page);
    await page.goto("/schedule");
    await expect(page.getByRole("button", { name: "Semaine", exact: true })).toBeVisible({ timeout: 20000 });
  }

  test("un contact sur l'horaire fait apparaître le rectangle, pas le formulaire", async ({ page }) => {
    await ouvrirCalendrier(page);

    // Clic RELATIF à la grille : elle fait 1088 px de large pour un écran de
    // 390, donc viser en coordonnées d'écran tombe dans la marge de la carte.
    // Playwright fait défiler jusqu'au point demandé.
    await cliquerSurLaGrille(page, 120);

    const rect = page.getByTestId("bloc-brouillon");
    await expect(rect, "le rectangle doit apparaître tout de suite").toBeVisible({ timeout: 5000 });
    // Et surtout : PAS le formulaire complet.
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const texte = await rect.innerText();
    console.log("RECTANGLE >>> à l'apparition :", texte.replace(/\n/g, " · "));
    expect(texte).toMatch(/\d{2}:\d{2} – \d{2}:\d{2}/);
    expect(texte).toContain("2 h");
  });

  test("on l'étire au doigt et l'heure suit", async ({ page }) => {
    await ouvrirCalendrier(page);
    await cliquerSurLaGrille(page, 120);

    const rect = page.getByTestId("bloc-brouillon");
    await expect(rect).toBeVisible();
    const avant = await rect.innerText();

    // 64 px = une heure. Au doigt, avec de vrais PointerEvent « touch ».
    await rect.locator('[data-handle="brouillon-fin"]').evaluate((el, dx) => {
      const r = el.getBoundingClientRect();
      const y = r.top + r.height / 2;
      const x = r.left + r.width / 2;
      const o = (cx: number) => ({
        bubbles: true, cancelable: true, composed: true,
        pointerId: 1, pointerType: "touch", isPrimary: true,
        clientX: cx, clientY: y, buttons: 1,
      });
      el.dispatchEvent(new PointerEvent("pointerdown", o(x)));
      el.dispatchEvent(new PointerEvent("pointermove", o(x + dx / 2)));
      el.dispatchEvent(new PointerEvent("pointermove", o(x + dx)));
      el.dispatchEvent(new PointerEvent("pointerup", o(x + dx)));
    }, 64);

    const apres = await rect.innerText();
    console.log(`RECTANGLE >>> avant « ${avant.replace(/\n/g, " · ")} » après « ${apres.replace(/\n/g, " · ")} »`);
    expect(apres, "l'heure doit suivre le doigt").not.toBe(avant);
    expect(apres).toContain("3 h");
  });

  test("« Créer » ouvre le formulaire prérempli et n'écrit rien avant validation", async ({ page }) => {
    await ouvrirCalendrier(page);
    await cliquerSurLaGrille(page, 120);

    const rect = page.getByTestId("bloc-brouillon");
    await expect(rect).toBeVisible();
    const plage = (await rect.innerText()).match(/(\d{2}:\d{2}) – (\d{2}:\d{2})/);
    expect(plage, "le rectangle doit annoncer sa plage").toBeTruthy();

    await page.getByRole("button", { name: "Créer", exact: true }).click();

    // Le formulaire s'ouvre, porteur de la plage tracée.
    const dialogue = page.getByRole("dialog");
    await expect(dialogue).toBeVisible({ timeout: 15000 });
    await expect(dialogue.locator("#startTime")).toHaveValue(plage![1]);
    await expect(dialogue.locator("#endTime")).toHaveValue(plage![2]);

    // On renonce.
    await page.keyboard.press("Escape");
    await expect(dialogue).toBeHidden({ timeout: 10000 });

    const refus = await erreursAffichees(page);
    expect(refus, `rien ne doit avoir echoue : ${refus.join(" | ")}`).toHaveLength(0);

    /*
     * RIEN EN BASE. C'est la garantie qui remplace l'ancien garde-fou de
     * fermeture : puisque plus aucun call anonyme n'est cree, il n'y a plus
     * de call anonyme a refuser plus tard.
     */
    const db = createAdminClient();
    await page.waitForTimeout(2000);
    const { data } = await db
      .from("scheduled_jobs")
      .select("title")
      .eq("company_id", companyId)
      .like("title", "Travail %");
    expect(
      (data ?? []).map((r) => (r as { title: string }).title),
      "ouvrir le formulaire puis renoncer ne doit rien enregistrer",
    ).toHaveLength(0);
  });
});
