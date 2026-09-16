import { test, expect } from "../fixtures/base";
import { connexionLocataire } from "../helpers/auth";
import { readTestCredentials } from "../helpers/test-data";

/**
 * GLISSER UN CALL AVEC LE DOIGT.
 *
 * Les blocs écoutaient déjà `onPointerDown`, ce qui couvre le tactile — mais
 * sans `touch-action: none`, le navigateur interprète le mouvement comme un
 * défilement de page et le bloc ne bouge jamais. Le geste marchait à la
 * souris et nulle part ailleurs, ce qui est exactement le genre de défaut
 * qu'on ne voit pas depuis un bureau.
 */
test.describe("27. Le calendrier au doigt", () => {
  // Un vrai contexte tactile : `hasTouch` change ce que le navigateur fait
  // des événements de pointeur.
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, pageName: "Calendrier tactile" });

  test("les blocs déclarent touch-action: none", async ({ page }) => {
    const creds = readTestCredentials();
    void creds;
    await connexionLocataire(page);
    await page.goto("/schedule");

    const bloc = page.locator('[data-event-id]').first();
    const present = await bloc.count();
    test.skip(present === 0, "Aucun call au calendrier aujourd'hui : rien à glisser.");

    const touchAction = await bloc.evaluate((e) => getComputedStyle(e).touchAction);
    // C'est LA propriété qui décide si le doigt déplace ou fait défiler.
    expect(touchAction, "sans « none », le doigt fait défiler la page").toBe("none");
  });

  test("les poignées sont assez larges pour un doigt", async ({ page }) => {
    await connexionLocataire(page);
    await page.goto("/schedule");

    const bloc = page.locator('[data-event-id]').first();
    test.skip((await bloc.count()) === 0, "Aucun call au calendrier aujourd'hui.");

    const poignee = bloc.locator('[data-handle="resize"]').first();
    const boite = await poignee.boundingBox();
    console.log("TACTILE >>> largeur de poignée :", boite?.width, "px");
    // 8 px se visent à la souris, jamais au doigt.
    expect(boite?.width ?? 0).toBeGreaterThanOrEqual(20);
    const ta = await poignee.evaluate((e) => getComputedStyle(e).touchAction);
    expect(ta).toBe("none");
  });

  test("un vrai glissement au doigt déplace le call", async ({ page }) => {
    // Les deux tests précédents décrivent des attributs. Celui-ci fait le
    // geste : des PointerEvent de type « touch », comme un doigt en produit.
    const creds = readTestCredentials();
    await connexionLocataire(page);
    await page.goto(`/schedule?date=${creds.seed?.scheduledDate ?? ""}`);

    const bloc = page.locator('[data-event-id]').first();
    test.skip((await bloc.count()) === 0, "Aucun call au calendrier ce jour-là.");

    const heuresAvant = await bloc.locator('[data-testid="bloc-heures"]').innerText().catch(() => "");
    const boite = await bloc.boundingBox();
    expect(boite, "le bloc doit être à l'écran").toBeTruthy();

    // 128 px = deux heures à 64 px/heure.
    await bloc.evaluate((el, dx) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const opts = (cx: number) => ({
        bubbles: true, cancelable: true, composed: true,
        pointerId: 1, pointerType: "touch", isPrimary: true,
        clientX: cx, clientY: y, buttons: 1,
      });
      el.dispatchEvent(new PointerEvent("pointerdown", opts(x)));
      el.dispatchEvent(new PointerEvent("pointermove", opts(x + dx / 2)));
      el.dispatchEvent(new PointerEvent("pointermove", opts(x + dx)));
      el.dispatchEvent(new PointerEvent("pointerup", opts(x + dx)));
    }, 128);

    await page.waitForTimeout(1500);
    const heuresApres = await page
      .locator('[data-event-id]')
      .first()
      .locator('[data-testid="bloc-heures"]')
      .innerText()
      .catch(() => "");
    console.log(`TACTILE >>> avant « ${heuresAvant} » · après « ${heuresApres} »`);
    expect(heuresApres, "le doigt doit avoir déplacé le call").not.toBe(heuresAvant);
  });
});
