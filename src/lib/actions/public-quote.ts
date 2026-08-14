"use server";

import {
  acceptQuoteByToken,
  markDepositPaidByToken,
  rejectQuoteByToken,
} from "@/lib/data/tenant-data";
import { acceptQuoteSchema, publicTokenSchema, rejectQuoteSchema } from "@/lib/validations/quotes";

export async function acceptPublicQuoteAction(token: string) {
  const parsed = acceptQuoteSchema.safeParse({ token });
  if (!parsed.success) {
    return { success: false as const, error: "Lien invalide." };
  }

  const result = await acceptQuoteByToken(parsed.data.token);
  if (!result.quote) {
    return { success: false as const, error: result.error ?? "Impossible d'accepter." };
  }

  return { success: true as const, quote: result.quote };
}

export async function rejectPublicQuoteAction(token: string, reason?: string) {
  const parsed = rejectQuoteSchema.safeParse({ token, reason });
  if (!parsed.success) {
    return { success: false as const, error: "Lien invalide." };
  }

  const result = await rejectQuoteByToken(parsed.data.token);
  if (!result.quote) {
    return { success: false as const, error: result.error ?? "Impossible de refuser." };
  }

  return { success: true as const, quote: result.quote };
}

/** Called after Stripe confirms deposit payment */
export async function confirmDepositPaidAction(token: string, stripePaymentId?: string) {
  const parsed = publicTokenSchema.safeParse({ token });
  if (!parsed.success) {
    return { success: false as const, error: "Lien invalide." };
  }

  const result = await markDepositPaidByToken(parsed.data.token, stripePaymentId);
  if (!result.quote) {
    return { success: false as const, error: result.error ?? "Impossible de confirmer le dépôt." };
  }

  return { success: true as const, quote: result.quote };
}
