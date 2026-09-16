import type { ScheduleEvent } from "@/types";

/**
 * CE CALL A-T-IL UN CLIENT ?
 *
 * Même raisonnement que pour les coordonnées de paiement — voir
 * [interac-a-remplir.ts]. Un travail sans client se ferme, se facture et
 * s'envoie sans que rien ne proteste : `billing.ts` écrit
 * `customer_id: job.customerId || null`, et le gabarit de courriel remplace le
 * nom manquant par le mot « Client ». L'entrepreneur découvre le trou au
 * moment où sa facture est déjà partie.
 *
 * Ce n'est pas nouveau — un call créé sans remplir le client donnait déjà ça.
 * Mais le rectangle de plage horaire rend le cas BEAUCOUP plus probable : il
 * est devenu le chemin rapide par défaut, et il ne demande pas de client.
 *
 * LA DIFFÉRENCE AVEC L'AVERTISSEMENT INTERAC : celui-là n'empêche pas l'envoi,
 * parce qu'il existe des façons de se faire payer que l'application ne connaît
 * pas. Ici, il n'y a aucune façon de facturer quelqu'un qu'on ne nomme pas.
 * On bloque.
 *
 * ET ON BLOQUE À LA FERMETURE, pas à l'envoi. C'est à la fermeture qu'on
 * décide que le travail est fini et facturable ; découvrir le client manquant
 * au moment d'envoyer, c'est le découvrir trop tard.
 */
/**
 * `null` autant que `undefined` : le type applicatif dit `string | undefined`,
 * mais la colonne en base est nullable et le `null` remonte tel quel par les
 * chemins qui ne passent pas par `mapScheduledJobRow`.
 */
export interface CallAFermer {
  customerId?: ScheduleEvent["customerId"] | null;
  customerName?: ScheduleEvent["customerName"] | null;
}

/** Vrai quand rien ne dit à qui ce travail sera facturé. */
export function clientARemplir(event: CallAFermer | null | undefined): boolean {
  if (!event) return false;
  // Un nom suffit : tous les clients ne sont pas dans la fiche clients, et
  // exiger l'identifiant refuserait un travail parfaitement facturable.
  if (event.customerName?.trim()) return false;
  if (event.customerId?.trim()) return false;
  return true;
}

/**
 * Ce qu'on montre au moment de fermer. Le problème, sa conséquence, puis
 * l'endroit exact où le régler — dans cet ordre, parce que c'est celui dans
 * lequel la question se pose.
 */
export function messageClientARemplir(event: CallAFermer | null | undefined): string | null {
  if (!clientARemplir(event)) return null;
  return (
    "Ce travail n'a pas de client. La facture partirait sans nom, " +
    "et vous ne sauriez pas à qui la réclamer. " +
    "Ajoutez-le avec « Modifier le call » avant de fermer."
  );
}
