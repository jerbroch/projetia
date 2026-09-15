import { erreursAffichees } from "../helpers/erreurs-affichees";
import { test, expect } from "../fixtures/base";
import { connexionLocataire } from "../helpers/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readTestCredentials } from "../helpers/test-data";
import { messageClientARemplir } from "@/lib/client-a-remplir";

/**
 * LE GESTE DE TROIS SECONDES.
 *
 * Cliquer sur l'horaire ouvrait le formulaire complet, avec deux heures déjà
 * décidées à l'aveugle : choisir sa plage demandait d'ouvrir le call, de
 * corriger deux champs et d'enregistrer.
 *
 * Ici : on touche, le rectangle apparaît, on l'étire, on confirme.
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

  test("« Créer » enregistre le travail avec la plage choisie", async ({ page }) => {
    await ouvrirCalendrier(page);
    await cliquerSurLaGrille(page, 120);

    const rect = page.getByTestId("bloc-brouillon");
    await expect(rect).toBeVisible();
    const plage = (await rect.innerText()).match(/(\d{2}:\d{2}) – (\d{2}:\d{2})/);
    expect(plage, "le rectangle doit annoncer sa plage").toBeTruthy();

    await page.getByRole("button", { name: "Créer", exact: true }).click();

    // Si l'enregistrement refuse, on veut LIRE pourquoi plutôt que de regarder
    // un compteur rester à zéro.
    await page.waitForTimeout(2500);
    const refus = await erreursAffichees(page);
    if (refus.length) {
      throw new Error(`l'application a refusé la création : ${refus.join(" | ")}`);
    }

    const db = createAdminClient();
    await expect
      .poll(async () => {
        const { data } = await db
          .from("scheduled_jobs")
          .select("title")
          .eq("company_id", companyId)
          .like("title", "Travail %");
        return (data ?? []).map((r) => (r as { title: string }).title);
      }, { timeout: 20000 })
      .toContain(`Travail ${plage![1]} – ${plage![2]}`);

    // UN CALL DU RECTANGLE N'A PAS DE CLIENT, et c'est assumé : le geste doit
    // rester à trois secondes. Mais la fermeture doit alors le refuser, sinon
    // la facture partirait avec le mot « Client » à la place du nom.
    const { data: cree } = await db
      .from("scheduled_jobs")
      .select("customer_id, customer_name")
      .eq("company_id", companyId)
      .eq("title", `Travail ${plage![1]} – ${plage![2]}`)
      .single();
    const c = cree as { customer_id: string | null; customer_name: string | null };
    const refusFermeture = messageClientARemplir({ customerId: c.customer_id, customerName: c.customer_name });
    console.log(`RECTANGLE >>> refus à la fermeture : ${refusFermeture ?? "AUCUN"}`);
    expect(refusFermeture, "la fermeture doit refuser un call sans client").toBeTruthy();
    expect(refusFermeture).toContain("Modifier le call");

    console.log(`RECTANGLE >>> créé : « Travail ${plage![1]} – ${plage![2]} »`);
  });
});
