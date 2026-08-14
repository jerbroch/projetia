import { z } from "zod";

const quoteStatusSchema = z.enum([
  "draft",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
  "deposit_pending",
  "deposit_paid",
]);

export const quoteFormSchema = z.object({
  title: z.string().trim().min(1, "Le titre est requis"),
  description: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  customerName: z.string().trim().min(1, "Le nom du client est requis"),
  customerEmail: z.string().trim().email("Courriel invalide").optional().or(z.literal("")),
  amount: z.coerce.number().min(0, "Le montant doit être positif"),
  status: quoteStatusSchema,
  validUntil: z.string().trim().optional(),
  depositRequired: z.coerce.boolean().optional().default(false),
  depositPercentage: z.coerce.number().min(1).max(100).optional(),
  terms: z.string().trim().optional(),
});

export type QuoteFormInput = z.infer<typeof quoteFormSchema>;

export const quoteIdSchema = z.object({
  id: z.string().uuid("Identifiant de soumission invalide"),
});

export const sendQuoteSchema = z.object({
  quoteId: z.string().uuid("Identifiant de soumission invalide"),
  recipientEmail: z.string().trim().email("Courriel du destinataire invalide"),
});

export const publicTokenSchema = z.object({
  token: z.string().min(32, "Jeton invalide"),
});

export const acceptQuoteSchema = publicTokenSchema;

export const rejectQuoteSchema = publicTokenSchema.extend({
  reason: z.string().trim().max(1000).optional(),
});
