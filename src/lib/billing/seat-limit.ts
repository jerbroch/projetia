/**
 * Limite de comptes connectés par palier d'abonnement.
 *
 * Ce qui est compté, et pourquoi : une **place** est un compte qui se connecte,
 * pas une fiche employé. Les deux vivent dans des tables différentes — un
 * entrepreneur Solo peut avoir vingt employés à son dossier (horaire, chantiers,
 * paie) et rester seul à ouvrir l'application. Les fiches ne sont jamais
 * limitées ; seuls les accès le sont.
 *
 * Le propriétaire occupe une place : il n'a pas de fiche employé mais c'est
 * bien quelqu'un qui se connecte. Sans lui, un compte Solo (1 place) pourrait
 * donner accès à un employé et se retrouver à deux personnes connectées.
 *
 * Révoquer un accès libère une place — `revokeEmployeeAccessAction` passe le
 * profil à `inactive` sans supprimer le compte. C'est le moyen offert au client
 * de faire de la place sans monter de palier.
 *
 * Module pur : il reçoit des décomptes, il ne les calcule pas. C'est ce qui
 * permettra d'ajouter les invitations en attente sans toucher à la politique.
 */
import { getTier, tierLabel, userLimitForTier } from "@/lib/billing/tiers";

export interface SeatCounts {
  /** Profils `active` rattachés à l'entreprise, propriétaire compris. */
  activeProfiles: number;
  /**
   * Invitations envoyées et non encore acceptées. Une invitation réserve une
   * place : sans cela, un compte Solo pourrait en envoyer cinquante et se
   * retrouver à cinquante personnes le jour où elles sont acceptées.
   * Reste à 0 tant que la migration 024 n'est pas appliquée — le code commité
   * crée le compte immédiatement, il n'existe aucun état « en attente ».
   */
  pendingInvitations?: number;
}

export interface SeatUsage {
  used: number;
  /** `null` = illimité. */
  limit: number | null;
  /** `null` = illimité. Jamais négatif, même en surnombre. */
  remaining: number | null;
  isUnlimited: boolean;
  /** Plus aucune place : une invitation de plus doit être refusée. */
  isFull: boolean;
  /** Au-delà de la limite — arrive après une descente de palier. */
  isOverLimit: boolean;
  /** Il reste exactement une place : moment d'avertir, avant le blocage. */
  isLastSeat: boolean;
}

export function seatUsage(
  counts: SeatCounts,
  tier: string | null | undefined,
): SeatUsage {
  const used = Math.max(0, counts.activeProfiles) + Math.max(0, counts.pendingInvitations ?? 0);
  const limit = userLimitForTier(tier);

  if (limit == null) {
    return {
      used,
      limit: null,
      remaining: null,
      isUnlimited: true,
      isFull: false,
      isOverLimit: false,
      isLastSeat: false,
    };
  }

  const remaining = Math.max(0, limit - used);
  return {
    used,
    limit,
    remaining,
    isUnlimited: false,
    isFull: used >= limit,
    isOverLimit: used > limit,
    isLastSeat: remaining === 1,
  };
}

const UPGRADE_PATH = "/choose-plan?upgrade=1";

const seats = (n: number) => (n === 1 ? "1 place" : `${n} places`);

/**
 * Message de refus, quand la limite est atteinte. Nomme le palier, le nombre
 * de places et la sortie — monter de palier, ou libérer une place.
 */
export function seatLimitMessage(
  usage: SeatUsage,
  tier: string | null | undefined,
): string {
  const name = getTier(tier) ? tierLabel(tier) : null;
  const palier = name ? `Le palier ${name}` : "Votre abonnement";

  const tete = usage.isOverLimit
    ? `${palier} inclut ${seats(usage.limit ?? 0)}, et ${usage.used} sont occupées.`
    : `${palier} inclut ${seats(usage.limit ?? 0)}, toutes occupées.`;

  return (
    `${tete} ` +
    "Pour donner accès à une personne de plus, passez à un palier supérieur " +
    `(${UPGRADE_PATH}) ou retirez l'accès d'un utilisateur actuel — ` +
    "sa fiche employé et son historique sont conservés."
  );
}

/**
 * Avertissement en amont, avant le refus. Prévenir à la dernière place évite
 * la découverte du blocage un lundi matin, au moment d'intégrer quelqu'un.
 * Retourne `null` quand il n'y a rien à signaler.
 */
export function seatWarningMessage(
  usage: SeatUsage,
  tier: string | null | undefined,
): string | null {
  if (usage.isUnlimited) return null;

  const name = getTier(tier) ? tierLabel(tier) : null;
  const palier = name ? `le palier ${name}` : "votre abonnement";

  if (usage.isOverLimit) {
    const trop = usage.used - (usage.limit ?? 0);
    return (
      `Vous avez ${usage.used} utilisateurs alors que ${palier} en inclut ` +
      `${usage.limit}. Vos utilisateurs actuels gardent leur accès, mais vous ne ` +
      `pourrez pas en ajouter avant d'en retirer ${trop === 1 ? "un" : `${trop}`} ` +
      `ou de monter de palier (${UPGRADE_PATH}).`
    );
  }

  if (usage.isFull) {
    return (
      `Vous occupez les ${seats(usage.limit ?? 0)} de ${palier}. ` +
      `Pour en ajouter, montez de palier (${UPGRADE_PATH}) ou retirez un accès.`
    );
  }

  if (usage.isLastSeat) {
    return (
      `Il vous reste 1 place sur ${usage.limit} avec ${palier}. ` +
      `Au-delà, il faudra monter de palier (${UPGRADE_PATH}).`
    );
  }

  return null;
}
