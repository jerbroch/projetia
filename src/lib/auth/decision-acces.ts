import { AuthRetryableFetchError, isAuthRetryableFetchError } from "@supabase/supabase-js";

/**
 * « PAS DE SESSION » ET « JE N'AI PAS PU VÉRIFIER » SONT DEUX RÉPONSES.
 *
 * Le middleware faisait `const { data: { user } } = await getUser()` et jetait
 * l'erreur. Un utilisateur sans session et un utilisateur dont la vérification
 * a échoué donnaient tous deux `user === null`, donc tous deux une redirection
 * vers la connexion.
 *
 * Sur un chantier, ça veut dire : le réseau tombe une seconde dans un
 * sous-sol, et le plombier est renvoyé à l'écran de connexion alors que sa
 * session est parfaitement valide. Le symptôme ressemble à une expiration, la
 * cause n'a rien à voir.
 *
 * CE QUI SÉPARE LES DEUX, ce n'est pas l'absence d'utilisateur — c'est le TYPE
 * de l'erreur. `AuthRetryableFetchError` est levée par la bibliothèque quand
 * la requête n'a pas abouti : rien qui ressemble à une réponse HTTP
 * (`status: 0`), ou un code d'infrastructure (500 à 504, 520 à 530). Son
 * propre commentaire le dit : « These are infrastructure errors and should not
 * cause session invalidation. »
 *
 * Tout le reste — 401, 403, jeton expiré, aucune session — est un VERDICT de
 * Supabase, pas un silence.
 */

export type DecisionDAcces =
  /** Session valide, vérifiée. */
  | "connecte"
  /** Supabase a répondu : ce jeton ne vaut rien, ou il n'y en a pas. */
  | "non-connecte"
  /** On n'a pas pu joindre Supabase. On ne sait pas, et on ne devine pas. */
  | "verification-impossible";

export interface EntreeDecision {
  user: unknown;
  error: unknown;
}

export function deciderAcces({ user, error }: EntreeDecision): DecisionDAcces {
  // L'ordre compte : on regarde l'ERREUR avant l'utilisateur. Un échec réseau
  // rend aussi `user === null`, et se fier à l'utilisateur d'abord ramènerait
  // exactement le défaut qu'on corrige.
  if (error && isAuthRetryableFetchError(error)) {
    return "verification-impossible";
  }
  if (error) {
    // Une erreur qui n'est pas rejouable est une réponse de Supabase.
    return "non-connecte";
  }
  return user ? "connecte" : "non-connecte";
}

/**
 * L'ERREUR QU'ON FABRIQUE QUAND LA REQUÊTE TRAÎNE.
 *
 * Une requête qui met trente secondes à échouer est pire qu'un échec en deux :
 * l'utilisateur voit une page blanche et ferme l'application. Passé le délai,
 * on traite l'attente comme ce qu'elle est — une impossibilité de vérifier —
 * et on rend la main tout de suite.
 *
 * Le type est celui de la bibliothèque, pas un imitateur : `deciderAcces` le
 * reconnaîtra par le même chemin que les vrais échecs réseau.
 */
export function erreurDeDelaiDepasse(): unknown {
  // Importé en haut du fichier, pas par `require` : le middleware tourne sur
  // le runtime Edge, qui n'en a pas.
  return new AuthRetryableFetchError("délai de vérification dépassé", 0);
}
