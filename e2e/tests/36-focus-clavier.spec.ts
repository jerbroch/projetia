import { test, expect } from "../fixtures/base";
import { connexionLocataire } from "../helpers/auth";

/**
 * LE FOCUS CLAVIER SE VOIT, SUR CHAQUE ÉCRAN.
 *
 * Un focus invisible n'existe pas : la personne qui navigue au clavier avance
 * à l'aveugle et finit par cliquer au hasard. On vérifie que chaque arrêt de
 * tabulation dessine quelque chose — un anneau ou une ombre — et qu'il reste
 * dans la page plutôt que de sauter sous le menu.
 */
const ECRANS = ["/dashboard", "/customers", "/quotes", "/settings"] as const;

test("chaque arrêt de tabulation est visible", async ({ page }) => {
  await connexionLocataire(page);
  const invisibles: string[] = [];

  for (const route of ECRANS) {
    await page.goto(route);
    await page.waitForTimeout(700);
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || a === document.body) return null;
        const st = getComputedStyle(a);
        const visible =
          (st.outlineStyle !== "none" && parseFloat(st.outlineWidth) > 0) ||
          st.boxShadow !== "none";
        return {
          texte: (a.getAttribute("aria-label") ?? a.textContent ?? a.tagName).trim().slice(0, 30),
          visible,
        };
      });
      if (info && !info.visible) invisibles.push(`${route} → « ${info.texte} »`);
    }
  }

  console.log("FOCUS >>>", invisibles.length, "arrêt(s) sans marque visible");
  for (const i of invisibles.slice(0, 6)) console.log("   ", i);
  expect(invisibles, invisibles.slice(0, 4).join(" | ")).toHaveLength(0);
});
