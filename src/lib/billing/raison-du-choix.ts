/**
 * POURQUOI CETTE PERSONNE EST SUR LA PAGE DES FORFAITS.
 *
 * Elle y arrive par trois chemins très différents, et la page disait la même
 * chose aux trois : « Bienvenue, <entreprise>. Choisissez votre forfait. »
 *
 * Un entrepreneur dont l'essai de 30 jours vient de finir voyait donc un
 * message de première visite. Ce n'est pas un écran blanc, mais ce n'est pas
 * clair non plus : rien ne lui disait que son essai était terminé, ni que son
 * travail était conservé. Un défaut qui ne plante pas — il désoriente.
 */

export type RaisonDuChoix = "premiere-visite" | "essai-termine" | "abonnement-fini" | "changement";

export interface EtatPourChoix {
  subscriptionStatus?: string | null;
  accessType?: string | null;
  /** Vrai tant que l'entreprise n'a jamais choisi : posé à l'inscription. */
  requiresAccessChoice?: boolean | null;
  /** Un palier enregistré prouve qu'un abonnement Stripe a existé. */
  tier?: string | null;
  /** Fin d'essai enregistrée, quand il y en a eu une. */
  trialEndsAt?: string | null;
}

/**
 * ATTENTION AU STATUT `cancelled`.
 *
 * Ce n'est PAS un état de fin : c'est aussi l'état INITIAL d'une inscription.
 * `src/lib/actions/auth.ts` pose `subscription_status: "cancelled"`,
 * `access_type: "pending"`, `requires_access_choice: true`.
 *
 * Une première version de cette fonction en déduisait « essai terminé », et
 * tout nouveau venu lisait « Votre essai est terminé — les 30 jours de
 * <entreprise> sont écoulés » à sa toute première visite. Le test
 * d'inscription l'a attrapé ; il faut des signaux qui disent qu'un essai a
 * VRAIMENT eu lieu, pas l'absence d'abonnement.
 */
export function raisonDuChoix(e: EtatPourChoix): RaisonDuChoix {
  if (e.subscriptionStatus === "active" || e.subscriptionStatus === "trial") {
    return "changement";
  }

  // Jamais rien choisi : c'est une première visite, quel que soit le statut.
  if (e.requiresAccessChoice && !e.tier) return "premiere-visite";
  if (e.accessType === "pending" && !e.tier) return "premiere-visite";

  // Un essai qui s'est vraiment terminé a laissé une date derrière lui.
  if (e.trialEndsAt && new Date(e.trialEndsAt) <= new Date()) return "essai-termine";

  // Un palier enregistré prouve qu'un abonnement a existé et n'est plus actif.
  if (e.tier) return "abonnement-fini";

  return "premiere-visite";
}

export interface MessageDuChoix {
  titre: string;
  explication: string;
  rassurance: string | null;
}

export function messageDuChoix(raison: RaisonDuChoix, nomEntreprise: string): MessageDuChoix {
  switch (raison) {
    case "essai-termine":
      return {
        titre: "Votre essai est terminé",
        explication:
          "Les 30 jours d'essai de " + nomEntreprise + " sont écoulés. " +
          "Choisissez un forfait pour reprendre là où vous étiez.",
        // Ce qu'on craint en voyant un mur de paiement : avoir tout perdu.
        rassurance:
          "Rien n'est effacé : vos soumissions, vos chantiers et les heures " +
          "saisies vous attendent.",
      };
    case "abonnement-fini":
      return {
        titre: "Votre abonnement est terminé",
        explication:
          "L'abonnement de " + nomEntreprise + " n'est plus actif. " +
          "Choisissez un forfait pour rouvrir l'accès.",
        rassurance:
          "Rien n'est effacé : vos soumissions, vos chantiers et les heures " +
          "saisies vous attendent.",
      };
    case "changement":
      return {
        titre: "Choisissez votre forfait",
        explication: nomEntreprise + " — projets et chantiers illimités sur tous les forfaits.",
        rassurance: null,
      };
    case "premiere-visite":
    default:
      return {
        titre: "Choisissez votre forfait",
        explication:
          "Bienvenue, " + nomEntreprise +
          ". Projets et chantiers illimités sur tous les forfaits.",
        rassurance: "Les 30 premiers jours sont gratuits.",
      };
  }
}
