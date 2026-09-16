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
/**
 * Chaque écran avec LE TITRE QU'IL DOIT PORTER.
 *
 * Vérifier « il y a exactement un h1 » ne suffit pas : un écran qui
 * afficherait le titre d'un autre passerait. On nomme donc ce qu'on attend,
 * écran par écran, pour que la disparition ou l'échange d'un titre se voie.
 */
const ECRANS = [
  ["/dashboard", "Tableau de bord"],
  ["/customers", "Clients"],
  ["/quotes", "Soumissions"],
  // Le menu dit « À vérifier », l'écran « Travaux à vérifier ». Les deux sont
  // volontaires : le menu est court, le titre nomme la chose.
  ["/reviews", "Travaux à vérifier"],
  ["/invoices", "Factures"],
  ["/schedule", "Calendrier de dispatch"],
  ["/archives", "Archives"],
  ["/employees", "Employés"],
  ["/heures", "Heures"],
  ["/outillage", "Outillage"],
  ["/payments", "Paiements"],
  ["/settings", "Paramètres"],
  ["/aide", "Nous joindre"],
] as const;

test("chaque écran a exactement un titre principal", async ({ page }) => {
  // Treize écrans à visiter : le délai par défaut de 90 s ne suffit pas quand
  // le serveur de développement compile une route au passage.
  test.setTimeout(180_000);
  await connexionLocataire(page);
  const fautifs: string[] = [];

  for (const [route, attendu] of ECRANS) {
    await page.goto(route);
    /*
     * ATTENDRE LE TITRE, PAS UNE DURÉE.
     *
     * Un `waitForTimeout(700)` suffit sur une machine au repos et pas sur un
     * coureur d'intégration continue qui compile la route au passage : cette
     * épreuve y a été marquée instable, échouant au premier essai et
     * réussissant au second. Un délai fixe ne mesure rien — on attend que le
     * titre soit là, ce qui est précisément la condition qu'on vérifie.
     */
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 30000 });

    const h1s = await page.locator("h1").allInnerTexts();
    const visibles = h1s.map((t) => t.trim()).filter(Boolean);

    // 1. Un seul titre principal.
    if (visibles.length !== 1) {
      fautifs.push(`${route} → ${visibles.length} h1 : ${JSON.stringify(visibles)}`);
      continue;
    }
    // 2. Et c'est bien CELUI de cet écran, pas un autre ni un titre vide.
    if (visibles[0] !== attendu) {
      fautifs.push(`${route} → titre « ${visibles[0]} » au lieu de « ${attendu} »`);
      continue;
    }
    // 3. Et il n'est pas répété dans la barre, ce qui ramènerait le doublon.
    const doublons = await page.locator(`header:has-text("${attendu}")`).count();
    if (doublons > 0) fautifs.push(`${route} → titre « ${attendu} » répété dans la barre`);
  }

  console.log("TITRES >>>", fautifs.length, "écran(s) fautif(s)");
  for (const f of fautifs) console.log("   ", f);
  expect(fautifs, fautifs.join(" | ")).toHaveLength(0);
});
