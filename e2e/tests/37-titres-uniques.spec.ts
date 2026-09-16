import { test, expect } from "../fixtures/base";
import { connexionLocataire } from "../helpers/auth";

/**
 * UN SEUL TITRE PAR ÉCRAN, ET UN SEUL `h1`.
 *
 * La barre supérieure affichait « Clients / Gérez vos relations clients »
 * pendant que l'écran affichait « Clients / Consultez et gérez tous vos
 * clients » quatre-vingts pixels plus bas. Deux titres pour une page, deux
 * descriptions disant la même chose autrement.
 *
 * La barre ne porte plus que la navigation et les commandes ; le titre
 * appartient au contenu, et c'est lui le `h1`.
 */
const ECRANS = [
  "/dashboard",
  "/customers",
  "/quotes",
  "/reviews",
  "/invoices",
  "/schedule",
  "/archives",
  "/employees",
  "/heures",
  "/outillage",
  "/payments",
  "/settings",
  "/aide",
] as const;

test("chaque écran a exactement un titre principal", async ({ page }) => {
  await connexionLocataire(page);
  const fautifs: string[] = [];

  for (const route of ECRANS) {
    await page.goto(route);
    await page.waitForTimeout(700);

    const h1s = await page.locator("h1").allInnerTexts();
    const visibles = h1s.map((t) => t.trim()).filter(Boolean);
    if (visibles.length !== 1) {
      fautifs.push(`${route} → ${visibles.length} h1 : ${JSON.stringify(visibles)}`);
      continue;
    }
    // Et ce titre ne doit pas être répété ailleurs à l'identique en en-tête.
    const doublons = await page.locator(`header:has-text("${visibles[0]}")`).count();
    if (doublons > 0) fautifs.push(`${route} → titre « ${visibles[0]} » répété dans la barre`);
  }

  console.log("TITRES >>>", fautifs.length, "écran(s) fautif(s)");
  for (const f of fautifs) console.log("   ", f);
  expect(fautifs, fautifs.join(" | ")).toHaveLength(0);
});
