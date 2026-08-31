"use server";

import {
  acceptQuoteByToken,
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
