import { test, expect } from "../fixtures/base";
import { connexionLocataire } from "../helpers/auth";
import { resetSeedJobIfNeeded } from "../helpers/schedule";

/**
 * TRACER UNE PLAGE, PUIS RENONCER.
 *
 * Le X du panneau d'actions ne fermait rien. La cause n'était pas dans le
 * bouton : la ligne du calendrier crée une sélection sur `click`, et le
 * rectangle est un ENFANT de cette ligne. Le clic sur le X effaçait bien la
 * sélection, puis remontait jusqu'à la ligne qui en recréait aussitôt une au
 * même endroit. À l'écran, le menu ne partait jamais.
 *
 * Ces épreuves visent la PROPRIÉTÉ, pas l'implémentation : après un clic sur
 * le X, plus aucun rectangle ne doit exister. Elles tomberaient de la même
 * façon si quelqu'un déplaçait la création de sélection sur `pointerup`, ou
 * retirait l'arrêt de propagation.
 */

const BLOC = '[data-testid="bloc-brouillon"]';
const ACTIONS = '[data-testid="brouillon-actions"]';
const ANNULER = '[data-testid="brouillon-annuler"]';
const CREER = '[data-testid="brouillon-creer"]';

/**
 * LE PANNEAU EST-IL VRAIMENT À L'ÉCRAN ?
 *
 * `toBeVisible()` ne suffit pas : un élément rogné par un `overflow-hidden`
 * parent garde une boîte non nulle et passe pour visible. Le défaut existait
 * réellement — le panneau était invisible à l'œil et vert à l'épreuve.
 *
 * On demande donc au navigateur ce qu'il y a SOUS le centre du bouton : si ce
 * n'est pas le bouton lui-même ou l'un des siens, c'est qu'il est masqué.
 */
async function vraimentAtteignable(page: import("@playwright/test").Page, selecteur: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return "absent du DOM";
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return "boîte vide";
    const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!dessus) return "rien sous son centre — hors écran ou rogné";
    return el.contains(dessus) || dessus.contains(el) ? "atteignable" : `masqué par ${dessus.tagName}`;
  }, selecteur);
}

/**
 * UNE PLACE LIBRE SUR LA GRILLE — pas une ligne vide.
 *
 * Chercher une ligne sans aucun call rendait ces épreuves dépendantes de ce
 * que les précédentes avaient créé : seules, elles passaient ; à la suite de
 * la suite complète, plus une seule ligne n'était libre et les six tombaient
 * d'un coup avec un message qui accusait la grille. Ce qu'il faut n'est pas
 * une ligne vide, c'est un ENDROIT vide — et il en reste toujours un.
 *
 * On balaie donc la première ligne en évitant les blocs déjà posés, à
 * l'intérieur de ce que l'écran montre vraiment.
 */
async function placeLibre(page: import("@playwright/test").Page, ratio = 0.35) {
  const ligne = page.locator("[data-timeline-body]").first();
  await ligne.waitFor({ state: "visible", timeout: 30000 });
  const boite = (await ligne.boundingBox())!;
  const vue = page.viewportSize()!;

  const gauche = Math.max(boite.x + 16, 0);
  const droite = Math.min(boite.x + boite.width, vue.width - 12);
  const y = boite.y + boite.height / 2;

  // Les blocs à éviter, sur cette ligne comme sur les voisines : la barre
  // d'actions se pose sous la plage et ne doit pas atterrir sur un call.
  const obstacles: { x1: number; x2: number }[] = [];
  const blocs = page.locator("[data-event-id]");
  for (let i = 0; i < (await blocs.count()); i++) {
    const b = await blocs.nth(i).boundingBox();
    if (b) obstacles.push({ x1: b.x - 30, x2: b.x + b.width + 30 });
  }

  const vise = gauche + (droite - gauche) * ratio;
  const libre = (x: number) => obstacles.every((o) => x < o.x1 || x > o.x2);
  if (libre(vise)) return { x: vise, y };

  // On s'écarte du point visé, de part et d'autre, jusqu'à trouver.
  for (let ecart = 24; ecart < droite - gauche; ecart += 24) {
    for (const x of [vise + ecart, vise - ecart]) {
      if (x >= gauche && x <= droite && libre(x)) return { x, y };
    }
  }
  throw new Error("Aucune place libre visible sur la ligne d'horaire.");
}

/** Pose une sélection par un clic sur une place libre de la grille. */
async function poserUnePlage(page: import("@playwright/test").Page, ratio = 0.35) {
  const { x, y } = await placeLibre(page, ratio);
  await page.mouse.click(x, y);
  await expect(page.locator(BLOC)).toBeVisible({ timeout: 10000 });
}

test.describe("39. Choisir une plage au calendrier", () => {
  test.use({ pageName: "Sélection de plage" });

  test("le X ferme la sélection et n'en recrée pas une autre", async ({ page }) => {
    const seed = await resetSeedJobIfNeeded();
    await connexionLocataire(page);
    await page.goto(`/schedule?date=${seed?.scheduledDate ?? ""}`);
    await placeLibre(page);

    await poserUnePlage(page);
    await expect(page.locator(ACTIONS)).toBeVisible();
    // Visible À L'ŒIL, pas seulement présent dans le DOM.
    expect(await vraimentAtteignable(page, ACTIONS)).toBe("atteignable");
    expect(await vraimentAtteignable(page, ANNULER)).toBe("atteignable");

    await page.locator(ANNULER).click();

    /*
     * LE CŒUR DE L'ÉPREUVE.
     *
     * On laisse volontairement passer du temps : le défaut d'origine
     * recréait la sélection dans le MÊME clic, donc un `toHaveCount(0)`
     * immédiat pouvait être lu entre la disparition et la réapparition et
     * conclure au vert à tort.
     */
    await page.waitForTimeout(600);
    await expect(page.locator(BLOC), "le X doit fermer, pas rouvrir").toHaveCount(0);
    await expect(page.locator(ACTIONS)).toHaveCount(0);
  });

  test("après le X, on peut tracer une nouvelle plage normalement", async ({ page }) => {
    const seed = await resetSeedJobIfNeeded();
    await connexionLocataire(page);
    await page.goto(`/schedule?date=${seed?.scheduledDate ?? ""}`);
    await placeLibre(page);

    await poserUnePlage(page, 0.3);
    await page.locator(ANNULER).click();
    await page.waitForTimeout(400);
    await expect(page.locator(BLOC)).toHaveCount(0);

    // Fermer ne doit pas laisser la grille sourde : une seconde plage se pose.
    await poserUnePlage(page, 0.5);
    await expect(page.locator(ACTIONS)).toBeVisible();
  });

  test("un glissement trace la plage, et elle SURVIT au relâchement", async ({ page }) => {
    /*
     * Cette épreuve manquait, et son absence a coûté un défaut.
     *
     * Relâcher la souris après un glissement produit aussi un `click` sur la
     * ligne. La plage se dessinait correctement pendant le geste puis
     * disparaissait à l'instant du relâchement — visible à l'œil, invisible
     * pour des épreuves qui ne faisaient que cliquer.
     */
    const seed = await resetSeedJobIfNeeded();
    await connexionLocataire(page);
    await page.goto(`/schedule?date=${seed?.scheduledDate ?? ""}`);
    const { x: depart, y } = await placeLibre(page, 0.2);
    await page.mouse.move(depart, y);
    await page.mouse.down();
    await page.mouse.move(depart + 100, y, { steps: 6 });
    await expect(page.locator(BLOC), "la plage se dessine pendant le geste").toBeVisible();
    const pendant = await page.locator(BLOC).innerText();
    await page.mouse.move(depart + 220, y, { steps: 8 });
    await page.mouse.up();

    await page.waitForTimeout(600);
    await expect(page.locator(BLOC), "la plage doit survivre au relâchement").toHaveCount(1);
    await expect(page.locator(ACTIONS), "les actions apparaissent une fois lâché").toBeVisible();

    // Le geste a bien allongé la plage : ce n'est pas un rectangle figé.
    const apres = await page.locator(BLOC).innerText();
    expect(apres, `avant « ${pendant} », après « ${apres} »`).not.toBe(pendant);
  });

  test("Échap annule la sélection", async ({ page }) => {
    const seed = await resetSeedJobIfNeeded();
    await connexionLocataire(page);
    await page.goto(`/schedule?date=${seed?.scheduledDate ?? ""}`);
    await placeLibre(page);

    await poserUnePlage(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await expect(page.locator(BLOC), "Échap doit annuler").toHaveCount(0);
  });

  test("« Créer » ouvre le formulaire prérempli, et n'enregistre rien tant qu'on n'a pas validé", async ({
    page,
  }) => {
    const seed = await resetSeedJobIfNeeded();
    await connexionLocataire(page);
    await page.goto(`/schedule?date=${seed?.scheduledDate ?? ""}`);
    await placeLibre(page);

    const callsAvant = await page.locator("[data-event-id]").count();

    await poserUnePlage(page, 0.4);
    // L'heure annoncée par le panneau : c'est elle qui doit se retrouver
    // dans le formulaire, sans être arrondie ni remplacée en chemin.
    const annonce = await page.locator(ACTIONS).innerText();
    const heures = annonce.match(/(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/);
    expect(heures, `le panneau doit annoncer la plage (vu : « ${annonce} »)`).toBeTruthy();

    await page.locator(CREER).click();

    const dialogue = page.getByRole("dialog");
    await expect(dialogue).toBeVisible({ timeout: 15000 });

    // Les champs d'heure portent bien la plage tracée.
    const debut = dialogue.locator('input[name="startTime"], #startTime').first();
    const fin = dialogue.locator('input[name="endTime"], #endTime').first();
    await expect(debut).toHaveValue(heures![1]);
    await expect(fin).toHaveValue(heures![2]);

    // On renonce : rien ne doit avoir été écrit.
    await page.keyboard.press("Escape");
    await expect(dialogue).toBeHidden({ timeout: 10000 });
    await page.reload();
    await placeLibre(page);
    await expect(
      page.locator("[data-event-id]"),
      "ouvrir le formulaire puis renoncer ne crée aucun call",
    ).toHaveCount(callsAvant);
  });

  test("au doigt, le X est assez gros pour être touché", async ({ browser }) => {
    const seed = await resetSeedJobIfNeeded();
    const contexte = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const page = await contexte.newPage();
    await connexionLocataire(page);
    await page.goto(`/schedule?date=${seed?.scheduledDate ?? ""}`);
    await placeLibre(page);

    await poserUnePlage(page);

    /*
     * LA BARRE TIENT DANS L'ÉCRAN.
     *
     * Ancrée au rectangle, elle sortait du viewport dès que la plage
     * approchait du bord : « Créer » et le X étaient hors d'atteinte, sans
     * qu'aucune assertion de visibilité ne s'en aperçoive.
     */
    const vue = page.viewportSize()!;
    const barre = (await page.locator(ACTIONS).boundingBox())!;
    expect(barre.x, "la barre ne doit pas déborder à gauche").toBeGreaterThanOrEqual(0);
    expect(
      barre.x + barre.width,
      `la barre doit tenir dans les ${vue.width} px de l'écran`,
    ).toBeLessThanOrEqual(vue.width);
    expect(await vraimentAtteignable(page, CREER)).toBe("atteignable");
    expect(await vraimentAtteignable(page, ANNULER)).toBe("atteignable");

    const boite = await page.locator(ANNULER).boundingBox();
    expect(boite, "le bouton d'annulation doit être à l'écran").toBeTruthy();
    // 44 px : la cible qu'un pouce atteint sans viser.
    expect(boite!.width, "largeur du X au doigt").toBeGreaterThanOrEqual(44);
    expect(boite!.height, "hauteur du X au doigt").toBeGreaterThanOrEqual(44);

    // Et il ferme, au doigt comme à la souris.
    await page.locator(ANNULER).tap();
    await page.waitForTimeout(600);
    await expect(page.locator(BLOC)).toHaveCount(0);

    await contexte.close();
  });
});
