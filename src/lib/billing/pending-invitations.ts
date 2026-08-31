/**
 * Décompte des invitations qui réservent encore une place.
 *
 * Une invitation envoyée occupe une place : sans cela, un compte Solo pourrait
 * en envoyer cinquante et se retrouver à cinquante utilisateurs le jour où
 * elles sont acceptées.
 *
 * Mais une invitation jamais acceptée ne doit pas bloquer cette place
 * indéfiniment. Rien ne fait changer son statut si la personne ne clique
 * jamais : le compte auth non confirmé, `app_access_invited_at` et
 * `app_access_enabled: false` restent en place à jamais. Un entrepreneur se
 * retrouverait bloqué sans comprendre pourquoi.
 *
 * Elles cessent donc de compter au bout d'un délai. Ce délai est le nôtre, et
 * ne dépend pas de la durée de vie du lien Supabase — un réglage
 * d'administration que le code ne peut pas lire. La limite est revérifiée au
 * moment de l'activation (voir `activateEmployeeAccessAfterConfirmation`), ce
 * qui rend ce vieillissement sûr même si le lien survit plus longtemps.
 */

/** Une invitation cesse de réserver une place au-delà de ce délai. */
export const INVITATION_SEAT_HOLD_DAYS = 14;

const JOUR_MS = 24 * 60 * 60 * 1000;

export interface InvitationRow {
  /** `app_access_invited_at`, ISO ou null. */
  invitedAt?: string | null;
  /** `app_access_enabled` — une invitation acceptée compte comme profil actif. */
  enabled?: boolean | null;
}

/**
 * Vrai quand l'invitation est assez récente pour retenir une place.
 *
 * Une invitation déjà acceptée renvoie faux : la personne a un profil actif,
 * elle est comptée à ce titre. La compter deux fois retirerait une place à
 * chaque employé qui accepte.
 */
export function invitationHoldsSeat(
  row: InvitationRow,
  now: Date = new Date(),
  holdDays: number = INVITATION_SEAT_HOLD_DAYS,
): boolean {
  if (row.enabled === true) return false;
  if (!row.invitedAt) return false;

  const envoyee = Date.parse(row.invitedAt);
  if (!Number.isFinite(envoyee)) return false;

  const age = now.getTime() - envoyee;
  // Une date future — horloge décalée, saisie manuelle — retient la place
  // plutôt que d'ouvrir une brèche.
  if (age < 0) return true;

  return age <= holdDays * JOUR_MS;
}

/** Combien d'invitations retiennent encore une place. */
export function countPendingInvitations(
  rows: InvitationRow[],
  now: Date = new Date(),
  holdDays: number = INVITATION_SEAT_HOLD_DAYS,
): number {
  return rows.filter((r) => invitationHoldsSeat(r, now, holdDays)).length;
}

/**
 * Message présenté à l'EMPLOYÉ dont l'activation est refusée faute de place.
 *
 * Il n'y est pour rien et ne peut rien y faire : réessayer, redemander un
 * lien ou recréer un compte ne changeront rien. Le message doit donc écarter
 * l'idée d'une erreur de sa part, et le renvoyer vers la seule personne qui
 * peut débloquer la situation.
 */
export function activationRefusedMessage(companyName?: string | null): string {
  const entreprise = companyName?.trim() ? companyName.trim() : "votre employeur";
  return (
    "Votre invitation est valide, mais toutes les places de l'abonnement de " +
    `${entreprise} sont occupées. Il n'y a rien à corriger de votre côté : ` +
    `contactez ${entreprise} pour qu'une place soit libérée ou que l'abonnement ` +
    "soit ajusté. Votre invitation reste valide en attendant."
  );
}
