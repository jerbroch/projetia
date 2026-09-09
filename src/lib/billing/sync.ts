/**
 * Synchronisation Stripe → `companies`.
 * Utilisé par le webhook et par le retour de Checkout (pour ne pas faire
 * attendre l'utilisateur derrière la livraison du webhook).
 */
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import {
  isBillingCycle,
  isSubscriptionTier,
  tierForPriceId,
  type BillingCycle,
  type SubscriptionTier,
} from "@/lib/billing/tiers";
import {
  buildCompanySubscriptionUpdate,
  subscriptionMetadataNeedsRealign,
  type ExistingSubscriptionRow,
} from "@/lib/billing/subscription-status";
import { subscriptionPeriodEnd } from "@/lib/billing/stripe-payload";
import { ligneAbonnementDepuisStripe } from "@/lib/billing/enregistrement-abonnement";

function asId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Repli sur les métadonnées posées au Checkout quand le Price ID n'est plus
 * reconnu (prix archivé chez Stripe, variable d'environnement changée).
 */
function readTierMetadata(value: unknown): SubscriptionTier | null {
  return isSubscriptionTier(value) ? value : null;
}

function readCycleMetadata(value: unknown): BillingCycle | null {
  return isBillingCycle(value) ? value : null;
}

/** Retrouve l'entreprise visée par un abonnement Stripe. */
export async function resolveCompanyId(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromSubscription = subscription.metadata?.companyId;
  if (fromSubscription) return fromSubscription;

  const customerId = asId(subscription.customer);
  if (!customerId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("companies")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (data?.id) return String(data.id);

  // Dernier recours : la métadonnée posée à la création du client Stripe.
  const customer = await getStripe().customers.retrieve(customerId);
  if (!customer.deleted && customer.metadata?.companyId) {
    return customer.metadata.companyId;
  }

  return null;
}

async function readExistingRow(companyId: string): Promise<ExistingSubscriptionRow> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("companies")
    .select("access_granted_at, subscription_started_at")
    .eq("id", companyId)
    .maybeSingle();

  return {
    accessGrantedAt: data?.access_granted_at ? String(data.access_granted_at) : null,
    subscriptionStartedAt: data?.subscription_started_at
      ? String(data.subscription_started_at)
      : null,
  };
}

export interface SyncResult {
  companyId: string;
  status: string;
  tier: SubscriptionTier | null;
  cycle: BillingCycle | null;
}

/** Stripe refuse toute mise à jour hors annulation sur ces statuts. */
const IMMUTABLE_STATUSES: ReadonlySet<string> = new Set([
  "canceled",
  "incomplete_expired",
]);

/**
 * Réaligne les métadonnées de l'abonnement sur le palier réellement facturé.
 *
 * N'est appelée que lorsque le Price ID a permis de résoudre le palier : c'est
 * la source de vérité, la métadonnée n'en est qu'une copie de secours. Le test
 * d'écart évite aussi la boucle — l'écriture déclenche un
 * `customer.subscription.updated`, dont la passe suivante ne réécrit rien.
 *
 * Non bloquant : la ligne `companies` est déjà à jour quand on arrive ici, et
 * un échec ne doit pas faire échouer le traitement du webhook.
 */
async function realignSubscriptionMetadata(
  subscription: Stripe.Subscription,
  tier: SubscriptionTier,
  cycle: BillingCycle,
): Promise<void> {
  if (IMMUTABLE_STATUSES.has(subscription.status)) return;

  try {
    await getStripe().subscriptions.update(subscription.id, {
      metadata: { ...(subscription.metadata ?? {}), tier, cycle },
    });
  } catch (err) {
    console.error(
      `Stripe: réalignement des métadonnées de ${subscription.id} échoué:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Applique l'état d'un abonnement Stripe sur la ligne `companies`. */
export async function syncSubscriptionToCompany(
  subscription: Stripe.Subscription,
  companyIdHint?: string | null,
): Promise<SyncResult | null> {
  const companyId = companyIdHint ?? (await resolveCompanyId(subscription));
  if (!companyId) {
    console.error(`Stripe: abonnement ${subscription.id} sans entreprise identifiable`);
    return null;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const matched = tierForPriceId(priceId);
  const tier = matched?.tier ?? readTierMetadata(subscription.metadata?.tier);
  const cycle = matched?.cycle ?? readCycleMetadata(subscription.metadata?.cycle);

  if (!matched && (tier || cycle)) {
    console.warn(
      `Stripe: prix ${priceId} inconnu de la configuration — repli sur les métadonnées de l'abonnement ${subscription.id}`,
    );
  }

  const existing = await readExistingRow(companyId);
  const update = buildCompanySubscriptionUpdate(
    {
      status: subscription.status,
      cycle,
      tier,
      priceId,
      subscriptionId: subscription.id,
      customerId: asId(subscription.customer),
      currentPeriodEnd: subscriptionPeriodEnd(subscription),
      trialEnd: subscription.trial_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    new Date().toISOString(),
    existing,
  );

  const admin = createAdminClient();
  const { error } = await admin.from("companies").update(update).eq("id", companyId);
  if (error) throw error;

  // LA TRACE DE L'ARGENT, à côté de l'état d'accès.
  //
  // `companies` dit QUI a accès ; il ne porte aucun montant. Le tableau de
  // revenus ne pouvait donc afficher que zéro, même avec des clients qui
  // paient — le même mensonge que « Stripe non connecté », en pire, parce
  // qu'on ne doute pas d'un chiffre.
  //
  // Non bloquant : l'accès du client est déjà enregistré ci-dessus. Un échec
  // ici doit coûter une ligne de statistique, jamais un abonnement.
  const ligne = ligneAbonnementDepuisStripe(
    subscription,
    companyId,
    nomDuPlan(tier, cycle),
  );
  if (ligne) {
    // Enveloppé : « non bloquant » doit tenir même si l'appel LÈVE au lieu de
    // rendre une erreur. Sans ce filet, une trace impossible à écrire ferait
    // échouer le webhook et Stripe le rejouerait indéfiniment.
    try {
      const { error: erreurTrace } = await admin
        .from("company_subscriptions")
        .upsert(ligne, { onConflict: "stripe_subscription_id" });
      if (erreurTrace) {
        console.error(
          `Stripe: montant de ${subscription.id} non enregistré:`,
          erreurTrace.message,
        );
      }
    } catch (err) {
      console.error(
        `Stripe: trace d'abonnement ${subscription.id} impossible:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  if (
    matched &&
    subscriptionMetadataNeedsRealign(subscription.metadata, matched.tier, matched.cycle)
  ) {
    await realignSubscriptionMetadata(subscription, matched.tier, matched.cycle);
  }

  return { companyId, status: subscription.status, tier, cycle };
}

/**
 * Le libellé lisible du plan, pour le tableau de revenus.
 *
 * `entrepreneur` + `monthly` ne se lit pas dans un rapport ; « Entrepreneur —
 * mensuel » se lit. Rend `null` plutôt qu'un libellé inventé quand le palier
 * n'a pas pu être résolu.
 */
function nomDuPlan(tier: SubscriptionTier | null, cycle: BillingCycle | null): string | null {
  if (!tier) return null;
  const paliers: Record<string, string> = {
    solo: "Solo",
    entreprise: "Entreprise",
    entrepreneur: "Entrepreneur",
    croissance: "Croissance",
  };
  const nom = paliers[tier] ?? tier;
  if (!cycle) return nom;
  return `${nom} — ${cycle === "annual" ? "annuel" : "mensuel"}`;
}

/** Recharge l'abonnement depuis Stripe puis synchronise (retour de Checkout). */
export async function syncSubscriptionById(
  subscriptionId: string,
  companyIdHint?: string | null,
): Promise<SyncResult | null> {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  return syncSubscriptionToCompany(subscription, companyIdHint);
}
