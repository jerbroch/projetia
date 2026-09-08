/**
 * L'ÉTAT RÉEL DE STRIPE, PAS UNE SUPPOSITION.
 *
 * L'administration affichait « Connectez Stripe » dès que la liste
 * d'abonnements était vide. Elle ne vérifiait rien : c'était une phrase écrite
 * dans l'état vide, qui accusait Stripe d'une panne qui n'existait pas.
 *
 * Et elle se trompait doublement, parce que la liste lisait une table que rien
 * ne remplit — voir `getCompanySubscriptions`. Le message aurait dit
 * « connectez Stripe » avec cent abonnés payants.
 *
 * Zéro abonné et Stripe débranché sont deux situations différentes, qui
 * appellent deux gestes différents. On les distingue.
 */
export type ConfigurationStripe = "complete" | "cle_manquante" | "webhook_manquant" | "prix_manquants";

export interface EtatStripe {
  configuration: ConfigurationStripe;
  /** Vrai quand tout est en place pour encaisser. */
  pretAEncaisser: boolean;
  /** Ce qui manque, nommé — jamais « non connecté » tout court. */
  message: string;
  /** Les huit tarifs attendus, et ceux qui manquent. */
  prixManquants: string[];
}

/** Les huit tarifs du catalogue : quatre paliers, mensuel et annuel. */
export const VARIABLES_PRIX = [
  "STRIPE_PRICE_SOLO_MONTHLY",
  "STRIPE_PRICE_SOLO_ANNUAL",
  "STRIPE_PRICE_ENTREPRISE_MONTHLY",
  "STRIPE_PRICE_ENTREPRISE_ANNUAL",
  "STRIPE_PRICE_ENTREPRENEUR_MONTHLY",
  "STRIPE_PRICE_ENTREPRENEUR_ANNUAL",
  "STRIPE_PRICE_CROISSANCE_MONTHLY",
  "STRIPE_PRICE_CROISSANCE_ANNUAL",
] as const;

export interface VariablesStripe {
  secretKey?: string;
  webhookSecret?: string;
  prix: Record<string, string | undefined>;
}

/**
 * Juge la configuration à partir des variables, sans appeler Stripe.
 *
 * Pure exprès : un appel réseau dans une page d'administration la rendrait
 * lente et faillible, et une panne de réseau afficherait « Stripe débranché »
 * alors que tout est en place. Ce qu'on peut vérifier localement suffit à
 * distinguer les cas qui demandent un geste.
 */
export function jugerConfigurationStripe(v: VariablesStripe): EtatStripe {
  const prixManquants = VARIABLES_PRIX.filter((nom) => !v.prix[nom]?.trim());

  if (!v.secretKey?.trim()) {
    return {
      configuration: "cle_manquante",
      pretAEncaisser: false,
      message: "La clé secrète Stripe n'est pas posée. Aucun paiement ne peut être encaissé.",
      prixManquants,
    };
  }

  if (!v.webhookSecret?.trim()) {
    return {
      configuration: "webhook_manquant",
      pretAEncaisser: false,
      message:
        "La clé du webhook manque. Les paiements passeront, mais aucun abonnement " +
        "ne sera enregistré — l'application ne saura jamais qui a payé.",
      prixManquants,
    };
  }

  if (prixManquants.length) {
    return {
      configuration: "prix_manquants",
      pretAEncaisser: false,
      message: `${prixManquants.length} tarif(s) sur ${VARIABLES_PRIX.length} ne sont pas posés : ${prixManquants.join(", ")}.`,
      prixManquants,
    };
  }

  return {
    configuration: "complete",
    pretAEncaisser: true,
    message: "Stripe est branché : clé, webhook et les huit tarifs sont en place.",
    prixManquants: [],
  };
}

/** Lit l'environnement du serveur. À n'appeler que côté serveur. */
export function etatStripeDepuisEnvironnement(): EtatStripe {
  return jugerConfigurationStripe({
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    prix: Object.fromEntries(VARIABLES_PRIX.map((n) => [n, process.env[n]])),
  });
}

/**
 * Ce qu'on dit quand il n'y a aucun abonné.
 *
 * Le nombre d'entreprises en essai ou en beta est la moitié manquante : « aucun
 * abonné » sur une plateforme de sept entreprises en beta n'est pas une panne,
 * c'est le modèle d'affaires. Sans ce chiffre, on cherche un défaut là où il
 * n'y en a pas.
 */
export function messageAucunAbonne(etat: EtatStripe, comptes: { beta: number; essai: number }): string {
  if (!etat.pretAEncaisser) return etat.message;

  const details: string[] = [];
  if (comptes.beta > 0) details.push(`${comptes.beta} en accès beta`);
  if (comptes.essai > 0) details.push(`${comptes.essai} en période d'essai`);

  if (!details.length) {
    return "Stripe est branché. Aucune entreprise n'est encore abonnée.";
  }
  return `Stripe est branché. Aucun abonnement payant pour l'instant — ${details.join(", ")}.`;
}
