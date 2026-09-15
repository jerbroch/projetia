import type { Page, Locator } from "@playwright/test";

/**
 * CE QUE L'APPLICATION REPROCHE VRAIMENT À L'UTILISATEUR.
 *
 * Balayer `.text-destructive, [role="alert"]` sur la page entière paraît
 * simple et se trompe de trois façons, toutes rencontrées dans ce dépôt :
 *
 *  1. Le bandeau d'environnement porte `role="alert"` sur toutes les pages en
 *     intégration continue. Des tests ont échoué en annonçant « l'application
 *     a refusé » alors qu'elle n'avait rien refusé du tout.
 *  2. Les conteneurs d'erreur existent vides avant qu'il y ait une erreur —
 *     un test passait alors sur du néant.
 *  3. Next pose ses propres éléments en développement.
 *
 * On écarte le bandeau PAR SON SÉLECTEUR — il EST l'élément `role="alert"`,
 * il ne le contient pas, donc un filtre `hasNot` ne le retirerait jamais — et
 * on ne garde que du texte non vide.
 */
const SELECTEUR = [
  '.text-destructive:not([data-testid="banniere-environnement"])',
  '[role="alert"]:not([data-testid="banniere-environnement"])',
].join(", ");

export async function erreursAffichees(portee: Page | Locator): Promise<string[]> {
  return (await portee.locator(SELECTEUR).allInnerTexts())
    .map((t) => t.trim())
    // Ceinture et bretelles : si le bandeau perdait son repère, son texte
    // reste reconnaissable et ne doit toujours pas compter comme un refus.
    .filter((t) => t.length > 0 && !t.includes("Ce serveur local écrit"));
}
