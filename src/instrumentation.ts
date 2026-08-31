/**
 * Point d'entrée exécuté une fois au démarrage du serveur Next.js.
 *
 * On y refuse de démarrer sur une configuration Stripe partielle : mieux vaut
 * un échec bruyant au déploiement qu'un client qui découvre le problème en
 * cliquant sur « Payer ».
 */
import {
  findStripeEnvProblems,
  formatStripeEnvProblems,
} from "@/lib/billing/env-check";

export async function register() {
  // Le runtime edge n'exécute pas le paiement et n'a pas les variables serveur.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const problems = findStripeEnvProblems(process.env);
  if (problems.length) {
    throw new Error(`\n\n${formatStripeEnvProblems(problems)}\n`);
  }
}
