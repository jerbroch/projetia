import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * LE FICHIER EST-IL LÀ ?
 *
 * Les bandeaux acceptent une image, mais elle n'existe pas encore. Deux
 * mauvaises façons de gérer ça :
 *
 *   • pointer vers le fichier quand même — le navigateur demande une image
 *     absente, reçoit une page 404, et affiche l'icône d'image cassée ;
 *   • écrire le chemin en dur et attendre que quelqu'un pense à l'activer —
 *     personne n'y pense, et le fichier dort dans `public/` pendant des mois.
 *
 * On regarde donc sur le disque, au rendu, côté serveur. DÉPOSER LE FICHIER
 * SUFFIT : aucune ligne de code à changer, aucun déploiement à déclencher
 * au-delà du dépôt lui-même.
 *
 * Le coût est un `existsSync` par rendu de page. C'est un appel système sur
 * un chemin déjà en cache du noyau — quelques microsecondes, à comparer aux
 * deux cents millisecondes de lecture de données de la même page.
 */
export function ressourcePubliqueExiste(chemin: string): boolean {
  const relatif = chemin.replace(/^\//, "");
  // Pas de remontée de répertoire : ce chemin vient du code, mais une
  // fonction qui lit le disque ne doit jamais accepter « ../ » par principe.
  if (relatif.includes("..")) return false;
  try {
    return existsSync(join(process.cwd(), "public", relatif));
  } catch {
    return false;
  }
}

/** Le chemin s'il existe, sinon rien — prêt à passer en propriété. */
export function imageSiPresente(chemin: string): string | undefined {
  return ressourcePubliqueExiste(chemin) ? chemin : undefined;
}

/**
 * LES FICHIERS DU BANDEAU, nommés une seule fois.
 *
 * Écrits ici plutôt que dans chaque composant : le jour où le nom change, il
 * change à un endroit, et les deux bandeaux suivent.
 *
 * DEUX CADRAGES SONT LIVRÉS — large et téléphone — en WebP : le même
 * découpage pesait 192 Ko en PNG et 28 Ko ici, pour une image que tout
 * navigateur actuel sait lire. Le cadrage intermédiaire porte un nom réservé
 * mais n'existe pas : `bandeauDisponible` retombe alors sur l'image large
 * plutôt que de servir une copie identique sous un troisième nom.
 */
export const BANDEAU_CHANTIER = {
  /** Le rendu de l'immeuble, ancré à droite du bandeau. */
  large: "/bandeau-chantier.webp",
  /** Cadrage intermédiaire, si un jour il est fourni. */
  moyen: "/bandeau-chantier@1x.webp",
  /** Cadrage téléphone, plus serré, si un jour il est fourni. */
  mobile: "/bandeau-chantier-mobile.webp",
} as const;

/** Le cadrage demandé s'il existe, sinon l'image large, sinon rien. */
export function bandeauDisponible(
  cadrage: keyof typeof BANDEAU_CHANTIER = "large",
): string | undefined {
  return imageSiPresente(BANDEAU_CHANTIER[cadrage]) ?? imageSiPresente(BANDEAU_CHANTIER.large);
}
