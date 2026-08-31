/**
 * Ce que le statut d'un profil autorise.
 *
 * `profiles.status` était posé par la révocation d'accès mais lu par personne :
 * ni le middleware, ni les politiques RLS. Un employé révoqué gardait la porte
 * grande ouverte. Ce module donne la décision, en un seul endroit, pour que le
 * middleware et les tests parlent de la même chose.
 */

export type PorteDeProfil = "ouverte" | "invitation-en-attente" | "acces-retire";

/** Où envoyer quelqu'un que sa porte n'autorise pas. */
export const CHEMINS_DE_PORTE: Record<Exclude<PorteDeProfil, "ouverte">, string> = {
  "invitation-en-attente": "/invitation-en-attente",
  "acces-retire": "/acces-retire",
};

/**
 * Un profil ABSENT laisse la porte ouverte.
 *
 * C'est délibéré : un nouvel inscrit n'a pas encore de profil, et le bloquer
 * ici casserait l'inscription. Les autres gardes du middleware s'occupent de
 * ce cas. On ne ferme que sur un statut explicitement non actif.
 */
export function porteDeProfil(status: string | null | undefined): PorteDeProfil {
  if (status === null || status === undefined || status === "") return "ouverte";
  if (status === "active") return "ouverte";

  // Une invitation acceptée mais non activée — faute de place, par exemple.
  // Lui dire « accès retiré » serait faux : rien ne lui a été retiré.
  if (status === "invited") return "invitation-en-attente";

  // « inactive », et tout statut futur qu'on ne connaît pas encore. Fermer par
  // défaut : un statut inconnu ne doit pas ouvrir la porte.
  return "acces-retire";
}
