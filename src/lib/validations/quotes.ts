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

const laborCategorySchema = z.enum(["compagnon", "apprenti", "equipe", "autre"]);
const feeTypeSchema = z.enum([
  "transport",
  "location",
  "sous_traitance",
  "permis",
  "livraison",
  "divers",
  "autre",
]);

export const quoteLaborLineSchema = z.object({
  id: z.string().min(1),
  category: laborCategorySchema,
  employeeCategory: z.string().trim().optional(),
  hours: z.coerce.number().min(0),
  hourlyRate: z.coerce.number().min(0),
  workerCount: z.coerce.number().min(1),
  total: z.coerce.number().min(0),
});

export const quoteMaterialLineSchema = z.object({
  id: z.string().min(1),
  catalogItemId: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Le nom du matériau est requis"),
  description: z.string().trim().optional(),
  quantity: z.coerce.number().min(0),
  unit: z.string().trim().min(1),
  costPrice: z.coerce.number().min(0),
  marginPct: z.coerce.number().min(0),
  salePrice: z.coerce.number().min(0),
  total: z.coerce.number().min(0),
  isCustom: z.coerce.boolean().optional(),
});

export const quoteFeeLineSchema = z.object({
  id: z.string().min(1),
  feeType: feeTypeSchema,
  description: z.string().trim().min(1, "La description du frais est requise"),
  quantity: z.coerce.number().min(0),
  price: z.coerce.number().min(0),
  marginPct: z.coerce.number().min(0).optional(),
  total: z.coerce.number().min(0),
});

export const quoteCostEstimationSchema = z.object({
  labor: z.array(quoteLaborLineSchema).default([]),
  materials: z.array(quoteMaterialLineSchema).default([]),
  fees: z.array(quoteFeeLineSchema).default([]),
  showLaborOnClient: z.coerce.boolean().optional(),
  showMaterialsOnClient: z.coerce.boolean().optional(),
  manualPriceOverride: z.coerce.boolean().optional(),
});

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
  costEstimation: quoteCostEstimationSchema.optional(),
  manualPriceOverride: z.coerce.boolean().optional().default(false),
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
