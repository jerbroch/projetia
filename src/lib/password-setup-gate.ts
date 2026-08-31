/**
 * Porte qui force un employé invité à choisir son mot de passe.
 *
 * Sans elle, l'employé qui a suivi son lien d'invitation possède déjà une
 * session valide : taper /terrain directement dans la barre d'adresse suffirait
 * à sauter l'étape. Il entrerait dans l'application avec un compte sans mot de
 * passe — utilisable tant que la session dure, définitivement perdu ensuite.
 *
 * Le drapeau est posé dans les métadonnées à l'invitation et retiré au moment
 * où le mot de passe est enregistré. Le middleware le lit dans le JWT, sans
 * aucun aller-retour en base.
 */

export const PASSWORD_SETUP_PATH = "/definir-mot-de-passe";

/** Le drapeau, tel qu'il apparaît dans `user_metadata`. */
export function mustSetPassword(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  return (metadata as Record<string, unknown>).must_set_password === true;
}

/**
 * Faut-il détourner cette requête vers le choix du mot de passe ?
 *
 * La page de choix elle-même est évidemment exemptée, sans quoi on boucle.
 */
export function shouldForcePasswordSetup(params: {
  pathname: string;
  isLoggedIn: boolean;
  metadata: unknown;
}): boolean {
  if (!params.isLoggedIn) return false;
  if (!mustSetPassword(params.metadata)) return false;
  if (
    params.pathname === PASSWORD_SETUP_PATH ||
    params.pathname.startsWith(`${PASSWORD_SETUP_PATH}/`)
  ) {
    return false;
  }
  return true;
}
