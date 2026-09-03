import type { Company } from "@/types";

/**
 * L'entrepreneur peut-il se faire payer avec ses réglages actuels ?
 *
 * Même raisonnement que pour les taux de main-d'œuvre — voir
 * [gabarits-a-remplir.ts]. Les coordonnées de paiement arrivent VIDES à
 * l'inscription, et c'est voulu : une adresse de virement inventée enverrait
 * l'argent d'un client chez quelqu'un d'autre. Chaque entrepreneur doit poser
 * les siennes.
 *
 * Mais un réglage vide qui ne dit rien produit exactement le défaut qu'on vient
 * de corriger : le courriel part, le client lit sa facture, ne trouve aucune
 * instruction de paiement, et n'ose pas demander. L'entrepreneur, lui, ne sait
 * même pas que la section manquait — sa facture est partie « avec succès ».
 *
 * L'avertissement N'EMPÊCHE PAS L'ENVOI. Une facture sans instructions de
 * paiement vaut mieux qu'une facture jamais envoyée, et il y a des façons de se
 * faire payer que l'application ne connaît pas — chèque, comptant, terminal.
 */
export type CoordonneesPaiement = Pick<Company, "interac">;

/** Vrai quand rien ne dira au client comment payer, sinon le numéro à citer. */
export function interacARemplir(company: CoordonneesPaiement): boolean {
  const interac = company.interac;
  if (!interac?.enabled) return true;
  return !interac.email?.trim();
}

/**
 * Ce qu'on montre au moment d'envoyer. Le problème, sa conséquence pour le
 * client, puis l'endroit exact où le régler — dans cet ordre, parce que c'est
 * celui dans lequel la question se pose.
 */
export function messageInteracARemplir(company: CoordonneesPaiement): string | null {
  if (!interacARemplir(company)) return null;

  const interac = company.interac;
  if (interac?.email?.trim() && !interac.enabled) {
    return (
      "Vos coordonnées Interac sont enregistrées mais désactivées. " +
      "Votre client ne verra pas comment vous payer."
    );
  }

  return (
    "Vous n'avez pas configuré vos coordonnées de paiement. " +
    "Votre client recevra sa facture sans savoir où envoyer l'argent."
  );
}

/** L'ancre exacte, pour que le lien mène à la bonne carte et non au haut de page. */
export const LIEN_REGLAGES_INTERAC = "/settings#interac";
