/**
 * Lecture des champs Stripe qui ont changé d'emplacement selon la version d'API.
 *
 * Deux champs ont changé d'emplacement entre `acacia` et `basil` :
 *
 *   subscription.current_period_end → subscription.items.data[].current_period_end
 *   invoice.subscription            → invoice.parent.subscription_details.subscription
 *
 * Le SDK est désormais aligné sur la version du compte (`dahlia`), donc ses
 * types décrivent la forme récente. Ce module reste néanmoins nécessaire : la
 * version d'un endpoint webhook est indépendante de celle du SDK, elle est
 * figée à sa création et ne suit pas les montées de version. Un endpoint plus
 * ancien continue donc de livrer la forme `acacia`.
 *
 * On lit les deux emplacements, l'ancien d'abord. Les entrées sont typées
 * `unknown` volontairement : la forme d'un payload livré ne correspond pas
 * forcément aux types du SDK, et un cast donnerait une fausse garantie.
 */

/** Un champ Stripe référençant un objet peut être un id ou l'objet étendu. */
export function stripeIdOf(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "string" && id ? id : null;
  }
  return null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Fin de la période de facturation en cours, en secondes.
 * Racine (acacia) puis premier item (basil et plus récent) — l'application ne
 * gère qu'un seul item par abonnement, comme `syncSubscriptionToCompany`.
 */
export function subscriptionPeriodEnd(subscription: unknown): number | null {
  const sub = readRecord(subscription);
  if (!sub) return null;

  const atRoot = readTimestamp(sub.current_period_end);
  if (atRoot !== null) return atRoot;

  const items = readRecord(sub.items);
  const data = items?.data;
  if (!Array.isArray(data)) return null;

  for (const entry of data) {
    const item = readRecord(entry);
    const onItem = readTimestamp(item?.current_period_end);
    if (onItem !== null) return onItem;
  }
  return null;
}

/**
 * Id de l'abonnement facturé par une facture.
 * Racine (acacia) puis `parent.subscription_details` (basil et plus récent).
 */
export function invoiceSubscriptionId(invoice: unknown): string | null {
  const inv = readRecord(invoice);
  if (!inv) return null;

  const atRoot = stripeIdOf(inv.subscription);
  if (atRoot) return atRoot;

  const parent = readRecord(inv.parent);
  const details = readRecord(parent?.subscription_details);
  return stripeIdOf(details?.subscription);
}
