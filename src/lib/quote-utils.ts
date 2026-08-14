import type { Company, Quote, QuoteLineItem } from "@/types";

export interface QuoteFormValues {
  title: string;
  description: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  amount: string;
  status: Quote["status"];
  validUntil: string;
  depositRequired: boolean;
  depositPercentage: string;
  terms: string;
}

export const QUOTE_STATUS_LABELS: Record<Quote["status"], string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  viewed: "Consultée",
  accepted: "Acceptée",
  rejected: "Refusée",
  expired: "Expirée",
  deposit_pending: "Dépôt en attente",
  deposit_paid: "Dépôt payé",
};

export interface QuoteTotals {
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
}

/** Quebec-style tax: QST applies to subtotal + GST */
export function calculateQuoteTotals(
  subtotal: number,
  company: Pick<Company, "gstRate" | "qstRate">
): QuoteTotals {
  const gstRate = company.gstRate ?? 0.05;
  const qstRate = company.qstRate ?? 0.09975;
  const gst = Math.round(subtotal * gstRate * 100) / 100;
  const qst = Math.round((subtotal + gst) * qstRate * 100) / 100;
  const total = Math.round((subtotal + gst + qst) * 100) / 100;
  return { subtotal, gst, qst, total };
}

export function buildDefaultLineItems(quote: Pick<Quote, "title" | "description" | "amount">): QuoteLineItem[] {
  return [
    {
      description: quote.title + (quote.description ? ` — ${quote.description}` : ""),
      quantity: 1,
      unitPrice: quote.amount,
      total: quote.amount,
    },
  ];
}

export function getQuoteLineItems(quote: Quote): QuoteLineItem[] {
  const items = quote.lineItems ?? [];
  if (items.length > 0) return items;
  return buildDefaultLineItems(quote);
}

/** Ensure quote props are safe after RSC / server-action serialization. */
export function normalizePublicQuote(quote: Quote): Quote {
  return {
    ...quote,
    description: quote.description ?? "",
    customerName: quote.customerName ?? "",
    title: quote.title ?? "",
    lineItems: quote.lineItems ?? [],
    depositRequired: quote.depositRequired ?? false,
    depositStatus: quote.depositStatus ?? "not_required",
    createdAt: quote.createdAt || new Date().toISOString(),
    validUntil: quote.validUntil ?? "",
  };
}

export function calculateDepositAmount(total: number, percentage: number): number {
  return Math.round(total * (percentage / 100) * 100) / 100;
}

export function getDefaultQuoteFormValues(quote?: Quote): QuoteFormValues {
  const defaultValidUntil = new Date();
  defaultValidUntil.setDate(defaultValidUntil.getDate() + 30);

  return {
    title: quote?.title ?? "",
    description: quote?.description ?? "",
    customerId: quote?.customerId ?? "",
    customerName: quote?.customerName ?? "",
    customerEmail: quote?.customerEmail ?? "",
    amount: quote ? String(quote.amount) : "",
    status: quote?.status ?? "draft",
    validUntil: quote?.validUntil ?? defaultValidUntil.toISOString().slice(0, 10),
    depositRequired: quote?.depositRequired ?? false,
    depositPercentage: quote?.depositPercentage != null ? String(quote.depositPercentage) : "20",
    terms: quote?.terms ?? "",
  };
}

export function buildDemoQuoteNumber(existing: Quote[]): string {
  const year = new Date().getFullYear();
  const prefix = `SO-${year}-`;
  const seq = existing
    .filter((q) => q.quoteNumber.startsWith(prefix))
    .reduce((max, q) => {
      const part = q.quoteNumber.split("-").pop() ?? "0";
      return Math.max(max, parseInt(part, 10));
    }, 0);
  return `${prefix}${String(seq + 1).padStart(3, "0")}`;
}

export function buildQuoteFromForm(
  values: QuoteFormValues,
  companyId: string,
  quoteNumber: string,
  id?: string
): Quote {
  const amount = Number(values.amount) || 0;
  const depositPercentage = values.depositRequired ? Number(values.depositPercentage) || 20 : undefined;

  return {
    id: id ?? `quote-${Date.now()}`,
    companyId,
    quoteNumber,
    customerId: values.customerId,
    customerName: values.customerName.trim(),
    customerEmail: values.customerEmail.trim() || undefined,
    title: values.title.trim(),
    description: values.description.trim(),
    amount,
    status: values.status,
    validUntil: values.validUntil,
    createdAt: new Date().toISOString(),
    depositRequired: values.depositRequired,
    depositPercentage,
    depositAmount: values.depositRequired && depositPercentage
      ? calculateDepositAmount(amount, depositPercentage)
      : undefined,
    depositStatus: values.depositRequired ? "pending" : "not_required",
    terms: values.terms.trim() || undefined,
    lineItems: buildDefaultLineItems({
      title: values.title.trim(),
      description: values.description.trim(),
      amount,
    }),
  };
}

export function duplicateQuote(source: Quote, newQuoteNumber: string): Quote {
  return {
    ...source,
    id: `quote-${Date.now()}`,
    quoteNumber: newQuoteNumber,
    status: "draft",
    createdAt: new Date().toISOString(),
    publicToken: undefined,
    sentAt: undefined,
    viewedAt: undefined,
    acceptedAt: undefined,
    rejectedAt: undefined,
    depositStatus: source.depositRequired ? "pending" : "not_required",
  };
}

export function canClientRespond(quote: Quote): boolean {
  return ["sent", "viewed"].includes(quote.status);
}

/** Whether a quote can be scheduled on the calendar (accepted + deposit rules). */
export function canScheduleQuote(quote: Quote): boolean {
  const acceptedStatuses: Quote["status"][] = ["accepted", "deposit_paid"];
  if (!acceptedStatuses.includes(quote.status)) return false;

  if (quote.depositRequired) {
    return quote.depositStatus === "paid" || quote.status === "deposit_paid";
  }

  return true;
}

export function buildQuoteScheduleNotes(quote: Quote): string {
  const parts = [`Soumission ${quote.quoteNumber}`];
  if (quote.amount > 0) {
    parts.push(`Montant: ${quote.amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`);
  }
  return parts.join(" · ");
}

export function resolveAppOriginFromHeaders(headersList: Headers): string {
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  if (!host) {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  }
  const proto =
    headersList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export function getPublicQuoteUrl(token: string, origin?: string): string {
  const base = origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/soumission/${token}`;
}
