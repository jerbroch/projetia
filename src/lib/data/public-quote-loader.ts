import {
  getCompanyById,
  markQuoteViewed,
} from "@/lib/data/tenant-data";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { publicTokenSchema } from "@/lib/validations/quotes";
import { normalizePublicQuote } from "@/lib/quote-utils";
import type { Company, Quote } from "@/types";

export type PublicQuoteResult =
  | { success: true; quote: Quote; company: Company }
  | { success: false; error: string };

export { normalizePublicQuote };

export async function loadPublicQuote(token: string): Promise<PublicQuoteResult> {
  const parsed = publicTokenSchema.safeParse({ token });
  if (!parsed.success) {
    return { success: false, error: "Lien invalide." };
  }

  if (!isSupabaseAdminConfigured()) {
    return { success: false, error: "Service temporairement indisponible." };
  }

  const quote = await markQuoteViewed(parsed.data.token);
  if (!quote) {
    return { success: false, error: "Soumission introuvable ou lien expiré." };
  }

  const company = await getCompanyById(quote.companyId);
  if (!company) {
    return { success: false, error: "Entreprise introuvable." };
  }

  return { success: true, quote: normalizePublicQuote(quote), company };
}

/** Demo mode: resolve quote from demo-{quoteId} token without Supabase */
export async function loadDemoPublicQuote(token: string): Promise<PublicQuoteResult | null> {
  if (!token.startsWith("demo-")) return null;

  const quoteId = token.slice("demo-".length);
  const { quotes: demoQuotes } = await import("@/lib/mock-data");
  const { DEMO_COMPANY_ID } = await import("@/lib/demo/constants");
  const quote = demoQuotes.find((q) => q.id === quoteId);
  if (!quote) return null;

  const company: Company = {
    id: DEMO_COMPANY_ID,
    name: "Construction Démo Inc.",
    legalName: "Construction Démo Inc.",
    phone: "514-555-0100",
    email: "info@demo.constructionios.ca",
    address: "123 rue Principale",
    city: "Montréal",
    province: "QC",
    postalCode: "H2X 1Y4",
    gstRate: 0.05,
    qstRate: 0.09975,
  };

  const viewedQuote = normalizePublicQuote({
    ...quote,
    status: quote.status === "sent" ? "viewed" : quote.status,
    viewedAt: quote.viewedAt ?? new Date().toISOString(),
  });

  return { success: true, quote: viewedQuote, company };
}
