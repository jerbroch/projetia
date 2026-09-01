/**
 * Adresses de destination pour les envois de courriel en test.
 *
 * Resend expose des boîtes qui répondent d'une façon choisie SANS compter
 * comme de vrais rebonds. C'est important : un domaine inexistant comme
 * `test.local` produit un rebond dur, et les rebonds durs abîment la
 * réputation d'expédition et faussent le tableau de bord.
 *
 * Dix-sept rebonds sur quarante envois venaient de la suite e2e. Aucune
 * adresse réelle n'avait rebondi, mais le taux affiché était de 50 % — un
 * chiffre qui ne veut plus rien dire quand on doit juger d'un vrai problème.
 *
 * Voir https://resend.com/docs/dashboard/emails/send-test-emails
 */

/** Livré normalement. À utiliser partout où le test ne vérifie que l'envoi. */
export const COURRIEL_LIVRE = "delivered@resend.dev";

/** Rebondit volontairement, pour éprouver le traitement d'un échec. */
export const COURRIEL_REBOND = "bounced@resend.dev";

/** Marqué comme pourriel par le destinataire, pour éprouver ce cas-là. */
export const COURRIEL_PLAINTE = "complained@resend.dev";

/**
 * Adresse unique et livrable, quand un test a besoin de distinguer ses
 * exécutions. Le sous-adressage `+` est accepté par Resend et n'affecte pas
 * la boîte de destination.
 */
export function courrielLivrableUnique(prefixe = "e2e"): string {
  return `delivered+${prefixe}${Date.now()}@resend.dev`;
}
