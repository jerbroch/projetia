/**
 * LES ÉVÉNEMENTS STRIPE QUE CE CODE SAIT TRAITER.
 *
 * Cette liste est la SOURCE, et le `switch` du gestionnaire doit lui
 * correspondre exactement — un test le vérifie en lisant le fichier.
 *
 * POURQUOI ELLE EXISTE. Le 13 septembre 2026, l'audit a trouvé que le point de
 * terminaison Stripe envoyait sept événements dont trois seulement étaient
 * traités. Quatre événements attendus n'arrivaient jamais :
 *
 *   customer.subscription.deleted  → une annulation n'était jamais reçue,
 *                                    l'accès n'était pas coupé
 *   customer.subscription.updated  → un changement de palier restait invisible
 *   invoice.payment_succeeded      → un renouvellement payé n'enregistrait rien
 *
 * Et `invoice.paid` arrivait à chaque renouvellement pour tomber dans le
 * `default`. Rien n'échouait : le webhook répondait 200, les journaux étaient
 * propres, et le tableau d'administration montrait un état figé. Un défaut qui
 * ne plante pas, qui ment.
 *
 * `npm run verify:webhook` compare cette liste à ce que Stripe envoie vraiment.
 */
export const EVENEMENTS_WEBHOOK_TRAITES = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.finalized",
  "invoice.voided",
  "invoice.marked_uncollectible",
  "invoice.payment_failed",
  "invoice.payment_succeeded",
] as const;

export type EvenementTraite = (typeof EVENEMENTS_WEBHOOK_TRAITES)[number];

export interface EcartDEvenements {
  /** Attendus par le code, jamais envoyés par Stripe. Le cas grave. */
  manquants: string[];
  /** Envoyés par Stripe, ignorés par le code. Du bruit, et un signe d'erreur. */
  superflus: string[];
  aligne: boolean;
}

/** Compare ce que Stripe envoie à ce que le code traite. */
export function comparerEvenements(
  abonnes: readonly string[],
  traites: readonly string[] = EVENEMENTS_WEBHOOK_TRAITES,
): EcartDEvenements {
  const manquants = traites.filter((e) => !abonnes.includes(e)).sort();
  const superflus = abonnes.filter((e) => !traites.includes(e)).sort();
  return { manquants, superflus, aligne: manquants.length === 0 && superflus.length === 0 };
}
