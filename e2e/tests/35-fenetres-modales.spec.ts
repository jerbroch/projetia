import { test, expect } from "../fixtures/base";
import { connexionLocataire } from "../helpers/auth";

/**
 * LES FENÊTRES MODALES TIENNENT DANS L'ÉCRAN.
 *
 * Le dialogue n'avait aucune hauteur maximale : un formulaire long
 * dépassait simplement en bas, et son bouton d'enregistrement devenait
 * inatteignable — sans barre de défilement pour le dire, puisque c'est la
 * fenêtre qui débordait, pas son contenu.
 *
 * Sur téléphone, le clavier réduit encore la hauteur utile. `100dvh` suit la
 * hauteur réellement visible ; `100vh` ne bouge pas quand le clavier monte.
 */
test.describe("35. Les fenêtres modales", () => {
  test("sur téléphone, la fenêtre et son bouton restent atteignables", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await connexionLocataire(page);
    await page.goto("/customers");
    await page.getByRole("button", { name: /Créer un client/i }).first().click();

    const dialogue = page.getByRole("dialog");
    await expect(dialogue).toBeVisible({ timeout: 10000 });
    // L'animation d'ouverture applique un `scale` qui écrase le centrage le
    // temps qu'elle dure. Mesurer pendant, c'est mesurer une position qui
    // n'existe que 200 ms.
    await page.waitForFunction(
      () => {
        const d = document.querySelector('[role="dialog"]') as HTMLElement | null;
        if (!d) return false;
        const t = getComputedStyle(d).transform;
        return !t.includes("0.95");
      },
      { timeout: 5000 },
    );

    const boite = await dialogue.boundingBox();
    const vue = page.viewportSize()!;
    console.log(
      `MODALE >>> fenêtre ${Math.round(boite!.width)}×${Math.round(boite!.height)} dans ${vue.width}×${vue.height}`,
    );
    // Elle ne dépasse ni en bas ni sur les côtés.
    expect(boite!.height, "la fenêtre tient en hauteur").toBeLessThanOrEqual(vue.height);
    expect(boite!.x, "elle ne sort pas à gauche").toBeGreaterThanOrEqual(-1);
    expect(boite!.x + boite!.width, "elle ne sort pas à droite").toBeLessThanOrEqual(vue.width + 1);

    // Et la croix offre une vraie zone tactile.
    const croix = dialogue.getByRole("button", { name: "Fermer" });
    const bc = await croix.boundingBox();
    console.log(`MODALE >>> croix ${Math.round(bc!.width)}×${Math.round(bc!.height)} px`);
    expect(Math.min(bc!.width, bc!.height), "44 px au doigt").toBeGreaterThanOrEqual(40);
  });

  test("la fenêtre se ferme au clavier et rend le focus", async ({ page }) => {
    await connexionLocataire(page);
    await page.goto("/customers");
    await page.getByRole("button", { name: /Créer un client/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
