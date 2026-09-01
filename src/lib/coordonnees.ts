/**
 * Coordonnées à afficher, et comment les rendre cliquables.
 *
 * DEUX RELATIONS DIFFÉRENTES, JAMAIS MÉLANGÉES.
 *
 *   L'entrepreneur nous joint, NOUS — c'est notre soutien, lu dans
 *   l'environnement pour qu'il change sans toucher au code.
 *
 *   L'employé de terrain joint SON EMPLOYEUR, jamais nous. Un gars bloqué sur
 *   un chantier appelle son patron ; nous ne saurions rien lui dire de son
 *   chantier, et le renvoyer vers nous casserait cette relation.
 *
 * SUR MOBILE, LE NUMÉRO DOIT SE COMPOSER D'UN TOUCHER. Un homme avec des gants
 * ne recopie pas dix chiffres. D'où `lienTelephonique`, qui produit un `tel:`
 * dépouillé de tout ce qui n'est pas un chiffre.
 */

export interface Coordonnees {
  email: string;
  telephone: string;
  nom?: string;
}

/**
 * Numéro sous forme composable : `tel:` n'accepte ni espaces, ni parenthèses,
 * ni tirets sur certains appareils, et un numéro non composable est pire
 * qu'un numéro affiché en texte — il donne l'illusion du lien.
 *
 * Rend `null` quand il ne reste pas de quoi appeler : afficher un lien mort
 * ferait perdre plus de temps qu'un simple texte.
 */
export function lienTelephonique(telephone: string | null | undefined): string | null {
  const brut = (telephone ?? "").trim();
  if (!brut) return null;

  // Le « + » international se garde, mais seulement en tête.
  const international = brut.startsWith("+");
  const chiffres = brut.replace(/\D/g, "");
  if (chiffres.length < 7) return null;

  return `tel:${international ? "+" : ""}${chiffres}`;
}

/** Lien courriel, ou `null` si l'adresse n'en est visiblement pas une. */
export function lienCourriel(email: string | null | undefined): string | null {
  const brut = (email ?? "").trim();
  if (!brut || !brut.includes("@") || brut.startsWith("@") || brut.endsWith("@")) return null;
  return `mailto:${brut}`;
}

/**
 * Nos coordonnées, depuis l'environnement.
 *
 * Lues côté serveur, donc à l'exécution — elles ne sont pas figées dans le
 * paquet JavaScript. Changer la variable et redéployer suffit ; il n'y a pas
 * de code à toucher.
 *
 * Les valeurs de repli ne sont pas décoratives : sans elles, un déploiement
 * mal configuré afficherait une section « Nous joindre » vide, ce qui est pire
 * que pas de section du tout — l'entrepreneur en conclut que personne ne
 * répond.
 */
export function coordonneesDuSoutien(
  env: Record<string, string | undefined> = process.env,
): Coordonnees {
  return {
    email: env.SUPPORT_EMAIL?.trim() || "jerome_brochu@hotmail.fr",
    telephone: env.SUPPORT_PHONE?.trim() || "438-403-6673",
    nom: env.SUPPORT_NAME?.trim() || undefined,
  };
}

/**
 * Coordonnées de l'employeur, pour l'employé de terrain.
 *
 * Rend `null` quand l'entreprise n'a ni courriel ni téléphone : mieux vaut ne
 * rien afficher que d'annoncer « Joindre mon employeur » sous un cadre vide.
 */
export function coordonneesDeLEmployeur(company: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}): Coordonnees | null {
  const email = (company.email ?? "").trim();
  const telephone = (company.phone ?? "").trim();
  if (!email && !telephone) return null;
  return { email, telephone, nom: (company.name ?? "").trim() || undefined };
}
