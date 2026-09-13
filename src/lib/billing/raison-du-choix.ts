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
  /** Vrai quand l'entreprise a déjà eu un abonnement Stripe. */
  aDejaPaye?: boolean;
}

export function raisonDuChoix(e: EtatPourChoix): RaisonDuChoix {
  // Quelqu'un qui a encore un accès vient regarder les forfaits : il change.
  if (e.subscriptionStatus === "active" || e.subscriptionStatus === "trial") {
    return "changement";
  }
  if (e.subscriptionStatus === "cancelled") {
    // On distingue l'essai qui se termine de l'abonnement qui s'arrête : ce
    // n'est pas la même nouvelle à annoncer.
    return e.aDejaPaye ? "abonnement-fini" : "essai-termine";
  }
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
