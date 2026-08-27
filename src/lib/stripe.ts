import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-08-26.dahlia",
      typescript: true,
    });
  }

  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

/** URL de base utilisée pour les retours Stripe (Checkout, portail client). */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}
