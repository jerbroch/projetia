/**
 * Stripe Checkout + portail client pour l'abonnement SaaS ConstructionIOS.
 * Toutes les fonctions sont serveur uniquement (clé secrète Stripe).
 */
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl, getStripe } from "@/lib/stripe";
import {
  getTrialDays,
  priceIdForTier,
  type BillingCycle,
  type SubscriptionTier,
} from "@/lib/billing/tiers";

export interface CompanyBillingIdentity {
  companyId: string;
  companyName: string;
  email: string;
}

/** Colonnes Stripe lues sur `companies`. */
export interface CompanyBillingRow {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

async function readBillingRow(companyId: string): Promise<CompanyBillingRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companies")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    stripe_customer_id: data.stripe_customer_id ? String(data.stripe_customer_id) : null,
    stripe_subscription_id: data.stripe_subscription_id
      ? String(data.stripe_subscription_id)
      : null,
  };
}

/**
 * Retourne le Stripe Customer de l'entreprise, en le créant au besoin.
 * L'id est persisté immédiatement pour éviter les doublons de clients.
 */
export async function ensureStripeCustomer(
  identity: CompanyBillingIdentity,
): Promise<string> {
  const existing = await readBillingRow(identity.companyId);
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: identity.companyName,
    email: identity.email,
    metadata: { companyId: identity.companyId },
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .update({ stripe_customer_id: customer.id })
    .eq("id", identity.companyId);

  if (error) throw error;

  return customer.id;
}

export interface CheckoutSessionResult {
  url: string;
  sessionId: string;
}

/** Crée la session Checkout d'abonnement et retourne l'URL hébergée par Stripe. */
export async function createSubscriptionCheckoutSession(
  identity: CompanyBillingIdentity,
  tier: SubscriptionTier,
  cycle: BillingCycle,
): Promise<CheckoutSessionResult> {
  const priceId = priceIdForTier(tier, cycle);
  if (!priceId) {
    throw new Error(
      `Aucun Stripe Price ID configuré pour le palier « ${tier} » en ${cycle}`,
    );
  }

  const customerId = await ensureStripeCustomer(identity);
  const stripe = getStripe();
  const appUrl = getAppUrl();
  const trialDays = getTrialDays();

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
    metadata: { companyId: identity.companyId, tier, cycle },
  };
  if (trialDays > 0) {
    subscriptionData.trial_period_days = trialDays;
  }

  // Managed Payments est activé par défaut sur le compte. On le désactive :
  // l'application calcule elle-même les taxes via automatic_tax, et bascule
  // dessus changerait le parcours de paiement sans que rien ne le demande.
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    managed_payments: { enabled: false },
    // Taxes canadiennes (TPS/TVQ) : nécessite Stripe Tax activé au dashboard.
    automatic_tax: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    billing_address_collection: "required",
    allow_promotion_codes: true,
    locale: "fr-CA",
    client_reference_id: identity.companyId,
    metadata: { companyId: identity.companyId, tier, cycle },
    subscription_data: subscriptionData,
    success_url: `${appUrl}/choose-plan?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/choose-plan?checkout=cancel`,
  };

  const session = await stripe.checkout.sessions.create(params);

  if (!session.url) {
    throw new Error("Stripe n'a pas retourné d'URL de paiement");
  }

  return { url: session.url, sessionId: session.id };
}

/** Palier visé quand le portail est ouvert pour un changement précis. */
export interface PortalUpdateTarget {
  subscriptionId: string;
  priceId: string;
}

/** Portail Stripe : changer de palier, changer de carte, voir les factures, annuler. */
export async function createBillingPortalSession(
  identity: CompanyBillingIdentity,
  returnPath = "/settings",
  target?: PortalUpdateTarget | null,
): Promise<string> {
  const customerId = await ensureStripeCustomer(identity);
  const stripe = getStripe();

  const params: Stripe.BillingPortal.SessionCreateParams = {
    customer: customerId,
    locale: "fr-CA",
    return_url: `${getAppUrl()}${returnPath}`,
  };

  if (target) {
    // Amène droit à l'écran de confirmation du changement au lieu de l'accueil
    // du portail. Stripe exige l'id de l'item d'abonnement, qui n'est pas
    // persisté en base : on le relit chez Stripe. Sans lui, on retombe sur le
    // portail générique plutôt que d'échouer.
    const subscription = await stripe.subscriptions.retrieve(target.subscriptionId);
    const itemId = subscription.items.data[0]?.id;
    if (itemId) {
      params.flow_data = {
        type: "subscription_update_confirm",
        subscription_update_confirm: {
          subscription: target.subscriptionId,
          items: [{ id: itemId, price: target.priceId, quantity: 1 }],
        },
      };
    }
  }

  const session = await stripe.billingPortal.sessions.create(params);

  return session.url;
}
