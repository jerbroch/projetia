/**
 * L'EXPÉDITEUR, EN UN SEUL ENDROIT.
 *
 * Quatre modules d'envoi lisaient chacun `RESEND_FROM_EMAIL` avec leur propre
 * repli recopié. Quatre copies de la même règle, c'est quatre occasions de
 * diverger — et un client qui reçoit sa soumission d'une adresse et sa facture
 * d'une autre ne reconnaît plus personne.
 */
export const EXPEDITEUR_DE_REPLI = "ConstructionIOS <onboarding@resend.dev>";

export function adresseExpediteur(): string {
  return process.env.RESEND_FROM_EMAIL ?? EXPEDITEUR_DE_REPLI;
}

/**
 * L'adresse à laquelle le client doit répondre.
 *
 * ELLE N'EST PAS CELLE DE L'EXPÉDITEUR, ET C'EST VOLONTAIRE.
 *
 * `constructionios.com` n'a aucun enregistrement MX : le domaine sait envoyer,
 * il ne sait pas recevoir. Un client qui répond à `info@constructionios.com`
 * reçoit donc un rebond, et l'entrepreneur ne le saura jamais — c'est la façon
 * exacte dont on perd un contrat sans l'apprendre.
 *
 * La réponse est donc dirigée vers l'adresse de l'ENTREPRISE, celle que
 * l'entrepreneur relève vraiment. Sans elle, on ne pose pas de `Reply-To` du
 * tout plutôt que d'en poser un qui rebondit.
 */
export function adresseDeReponse(courrielEntreprise?: string | null): string | undefined {
  const propre = courrielEntreprise?.trim();
  return propre ? propre : undefined;
}

/**
 * Le corps commun d'un envoi Resend. `reply_to` est omis quand il n'y a pas
 * d'adresse valable — un champ vide vaudrait moins que pas de champ.
 */
export function corpsResend(input: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Record<string, unknown> {
  const corps: Record<string, unknown> = {
    from: adresseExpediteur(),
    to: [input.to],
    subject: input.subject,
    html: input.html,
  };
  if (input.replyTo) corps.reply_to = [input.replyTo];
  return corps;
}
