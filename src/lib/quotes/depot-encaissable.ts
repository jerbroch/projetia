import type { Quote } from "@/types";

/**
 * QUAND PEUT-ON ENREGISTRER UN DÉPÔT REÇU ?
 *
 * Pas seulement après l'acceptation du client. Le bloc « Comment payer »
 * s'affiche sur la soumission dès sa réception, donc un client peut virer son
 * dépôt avant de cliquer. Sans ceci, l'argent arriverait et l'entrepreneur
 * n'aurait aucun bouton pour l'enregistrer.
 *
 * `deposit_pending` : le client a accepté, le dépôt est attendu.
 * `sent` / `viewed`  : il a payé avant de cliquer — l'enregistrement fera
 *                      passer la soumission par l'acceptation d'abord.
 *
 * `draft` est exclu : une soumission jamais envoyée ne peut pas avoir été
 * payée. Et une fois `deposit_paid`, c'est fait.
 */
export function depotEncaissable(quote: Pick<Quote, "status" | "depositRequired">): boolean {
  if (quote.status === "deposit_pending") return true;
  if (!quote.depositRequired) return false;
  return quote.status === "sent" || quote.status === "viewed";
}
