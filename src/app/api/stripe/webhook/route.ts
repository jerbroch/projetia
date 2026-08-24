import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getStripeWebhookSecret, isStripeConfigured } from "@/lib/stripe";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { syncSubscriptionById, syncSubscriptionToCompany } from "@/lib/billing/sync";
import { logAdminActivity } from "@/lib/data/platform-data";
import type { AdminActivityEventType } from "@/types/platform";

// Signature Stripe : le corps brut est requis, donc pas de cache ni d'Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.payment_succeeded",
]);

function subscriptionIdOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id: unknown }).id);
  }
  return null;
}

/** Évite de retraiter un évènement redélivré par Stripe. */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stripe_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    // Table absente (migration non appliquée) : on traite quand même l'évènement.
    console.warn("stripe_events indisponible:", error.message);
    return false;
  }

  return Boolean(data);
}

async function recordEvent(
  event: Stripe.Event,
  companyId: string | null,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    company_id: companyId,
    payload: { type: event.type, created: event.created },
  });

  if (error) {
    console.warn("Journalisation stripe_events échouée:", error.message);
  }
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  }

  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET manquant — webhook refusé");
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Base de données non configurée" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Signature Stripe invalide:", message);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const companyId = await handleEvent(event);
    await recordEvent(event, companyId);
    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Traitement du webhook ${event.type} (${event.id}) échoué:`, message);
    // 500 : Stripe redélivrera l'évènement.
    return NextResponse.json({ error: "Traitement échoué" }, { status: 500 });
  }
}

async function handleEvent(event: Stripe.Event): Promise<string | null> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return null;

      const subscriptionId = subscriptionIdOf(session.subscription);
      if (!subscriptionId) return null;

      const companyId =
        session.client_reference_id ?? session.metadata?.companyId ?? null;
      const result = await syncSubscriptionById(subscriptionId, companyId);
      if (result) {
        await safeLog(
          "subscription_activated",
          `Abonnement ${result.plan ?? "?"} payé via Stripe Checkout`,
          result.companyId,
          { plan: result.plan, stripe_status: result.status },
        );
      }
      return result?.companyId ?? companyId;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const result = await syncSubscriptionToCompany(subscription);
      if (result && event.type === "customer.subscription.deleted") {
        await safeLog(
          "subscription_cancelled",
          "Abonnement annulé chez Stripe",
          result.companyId,
          { stripe_status: result.status },
        );
      }
      return result?.companyId ?? null;
    }

    case "invoice.payment_failed":
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = subscriptionIdOf(
        (invoice as unknown as { subscription?: unknown }).subscription,
      );
      if (!subscriptionId) return null;

      // Stripe a déjà fait basculer l'abonnement (past_due, active…) :
      // on le relit pour rester aligné sur la source de vérité.
      const result = await syncSubscriptionById(subscriptionId);
      if (result && event.type === "invoice.payment_failed") {
        await safeLog(
          "payment_failed",
          "Échec de paiement de l'abonnement",
          result.companyId,
          { stripe_status: result.status },
        );
      }
      return result?.companyId ?? null;
    }

    default:
      return null;
  }
}

async function safeLog(
  type: AdminActivityEventType,
  description: string,
  companyId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await logAdminActivity(type, description, companyId, metadata);
  } catch {
    // Les tables plateforme peuvent ne pas exister — non bloquant.
  }
}
