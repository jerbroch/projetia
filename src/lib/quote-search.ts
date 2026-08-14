import type { Customer, Quote, ScheduleEvent } from "@/types";

/** Case- and accent-insensitive normalization for French search. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesSearchText(haystack: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return normalizeSearchText(haystack).includes(normalizedQuery);
}

export interface CustomerSearchSuggestion {
  id: string;
  name: string;
  address: string;
}

export function getCustomerDisplayAddress(customer: Customer): string {
  return customer.address || customer.billingAddress || "";
}

export function searchCustomersForAutocomplete(
  customers: Customer[],
  query: string,
  limit = 10
): CustomerSearchSuggestion[] {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 3) return [];

  return customers
    .filter((customer) => {
      const searchable = [customer.name, customer.address, customer.billingAddress ?? ""].join(" ");
      return normalizeSearchText(searchable).includes(normalizedQuery);
    })
    .slice(0, Math.min(Math.max(limit, 5), 10))
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      address: getCustomerDisplayAddress(customer),
    }));
}

export interface QuoteSearchContext {
  customersById: Map<string, Customer>;
  jobSiteByQuoteId: Map<string, string>;
}

export function buildQuoteSearchContext(
  customers: Customer[],
  scheduledEventsByQuoteId: Record<string, ScheduleEvent>
): QuoteSearchContext {
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const jobSiteByQuoteId = new Map<string, string>();

  for (const [quoteId, event] of Object.entries(scheduledEventsByQuoteId)) {
    const site = event.jobSiteAddress ?? event.location;
    if (site) jobSiteByQuoteId.set(quoteId, site);
  }

  return { customersById, jobSiteByQuoteId };
}

export function getQuoteCustomerAddress(quote: Quote, ctx: QuoteSearchContext): string {
  const customer = ctx.customersById.get(quote.customerId);
  if (customer) return getCustomerDisplayAddress(customer);
  return "";
}

export function getQuoteJobSiteAddress(quote: Quote, ctx: QuoteSearchContext): string {
  return ctx.jobSiteByQuoteId.get(quote.id) ?? "";
}

export function quoteMatchesSearch(quote: Quote, query: string, ctx: QuoteSearchContext): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const customer = ctx.customersById.get(quote.customerId);
  const customerName = customer?.name ?? quote.customerName;
  const customerAddress = getQuoteCustomerAddress(quote, ctx);
  const jobSite = getQuoteJobSiteAddress(quote, ctx);

  const searchable = [customerName, quote.customerName, customerAddress, jobSite, quote.quoteNumber].join(
    " "
  );

  return matchesSearchText(searchable, query);
}

export function filterQuotesBySearch(
  quotes: Quote[],
  query: string,
  ctx: QuoteSearchContext,
  selectedCustomerId?: string | null
): Quote[] {
  if (selectedCustomerId) {
    return quotes.filter((quote) => quote.customerId === selectedCustomerId);
  }
  if (!query.trim()) return quotes;
  return quotes.filter((quote) => quoteMatchesSearch(quote, query, ctx));
}

export interface CustomerQuoteGroup {
  customerId: string;
  customerName: string;
  address: string;
  quotes: Quote[];
}

export function groupQuotesByCustomer(
  quotes: Quote[],
  ctx: QuoteSearchContext
): CustomerQuoteGroup[] {
  const groups = new Map<string, CustomerQuoteGroup>();

  for (const quote of quotes) {
    const customerId = quote.customerId || `unknown-${quote.customerName}`;
    const customer = ctx.customersById.get(quote.customerId);
    const customerName = customer?.name ?? quote.customerName;
    const address = customer ? getCustomerDisplayAddress(customer) : "";

    const existing = groups.get(customerId);
    if (existing) {
      existing.quotes.push(quote);
    } else {
      groups.set(customerId, {
        customerId,
        customerName,
        address,
        quotes: [quote],
      });
    }
  }

  const result = Array.from(groups.values());
  for (const group of result) {
    group.quotes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  result.sort((a, b) => a.customerName.localeCompare(b.customerName, "fr"));
  return result;
}
