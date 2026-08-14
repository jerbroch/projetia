import { describe, expect, it } from "vitest";
import {
  buildQuoteSearchContext,
  filterQuotesBySearch,
  groupQuotesByCustomer,
  matchesSearchText,
  normalizeSearchText,
  quoteMatchesSearch,
  searchCustomersForAutocomplete,
} from "@/lib/quote-search";
import type { Customer, Quote, ScheduleEvent } from "@/types";

const customers: Customer[] = [
  {
    id: "cust-1",
    companyId: "co-1",
    name: "Jean Tremblay",
    email: "jean@example.com",
    phone: "",
    address: "123 rue Exemple, Laval",
    company: "",
    status: "active",
    totalProjects: 1,
    createdAt: "2025-01-01",
  },
  {
    id: "cust-2",
    companyId: "co-1",
    name: "Émilie Gagné",
    email: "emilie@example.com",
    phone: "",
    address: "456 boulevard René-Lévesque, Montréal",
    company: "",
    status: "active",
    totalProjects: 0,
    createdAt: "2025-01-02",
  },
];

const quotes: Quote[] = [
  {
    id: "quote-1",
    companyId: "co-1",
    quoteNumber: "SO-2026-001",
    customerId: "cust-1",
    customerName: "Jean Tremblay",
    title: "Rénovation cuisine",
    description: "",
    amount: 1000,
    status: "accepted",
    validUntil: "2026-12-31",
    createdAt: "2026-01-01",
    depositRequired: false,
    depositStatus: "not_required",
    lineItems: [],
  },
  {
    id: "quote-2",
    companyId: "co-1",
    quoteNumber: "SO-2026-004",
    customerId: "cust-1",
    customerName: "Jean Tremblay",
    title: "Salle de bain",
    description: "",
    amount: 2000,
    status: "draft",
    validUntil: "2026-12-31",
    createdAt: "2026-02-01",
    depositRequired: false,
    depositStatus: "not_required",
    lineItems: [],
  },
  {
    id: "quote-3",
    companyId: "co-1",
    quoteNumber: "SO-2026-010",
    customerId: "cust-2",
    customerName: "Émilie Gagné",
    title: "Toiture",
    description: "",
    amount: 5000,
    status: "sent",
    validUntil: "2026-12-31",
    createdAt: "2026-03-01",
    depositRequired: false,
    depositStatus: "not_required",
    lineItems: [],
  },
];

const scheduledEvents: Record<string, ScheduleEvent> = {
  "quote-1": {
    id: "job-1",
    companyId: "co-1",
    title: "Chantier cuisine",
    description: "",
    start: "2026-04-01T09:00:00Z",
    end: "2026-04-01T17:00:00Z",
    jobSiteAddress: "999 rue du Chantier, Laval",
    employeeIds: [],
    employeeNames: [],
    location: "",
    status: "scheduled",
    type: "job",
    quoteId: "quote-1",
  },
};

describe("normalizeSearchText", () => {
  it("removes accents and lowercases", () => {
    expect(normalizeSearchText("Émilie Gagné")).toBe("emilie gagne");
  });
});

describe("matchesSearchText", () => {
  it("matches partial accent-insensitive text", () => {
    expect(matchesSearchText("Jean Tremblay", "trem")).toBe(true);
    expect(matchesSearchText("Émilie Gagné", "emilie")).toBe(true);
  });
});

describe("searchCustomersForAutocomplete", () => {
  it("returns nothing before 3 characters", () => {
    expect(searchCustomersForAutocomplete(customers, "je")).toEqual([]);
  });

  it("returns matching customers with address", () => {
    const results = searchCustomersForAutocomplete(customers, "laval");
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe("Jean Tremblay");
    expect(results[0]?.address).toContain("Laval");
  });
});

describe("filterQuotesBySearch", () => {
  const ctx = buildQuoteSearchContext(customers, scheduledEvents);

  it("filters by selected customer id", () => {
    const filtered = filterQuotesBySearch(quotes, "", ctx, "cust-1");
    expect(filtered).toHaveLength(2);
    expect(filtered.every((q) => q.customerId === "cust-1")).toBe(true);
  });

  it("filters by quote number", () => {
    const filtered = filterQuotesBySearch(quotes, "SO-2026-010", ctx);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("quote-3");
  });

  it("filters by job site address", () => {
    expect(quoteMatchesSearch(quotes[0]!, "chantier", ctx)).toBe(true);
  });
});

describe("groupQuotesByCustomer", () => {
  it("groups quotes under customer name and address", () => {
    const ctx = buildQuoteSearchContext(customers, scheduledEvents);
    const groups = groupQuotesByCustomer(
      filterQuotesBySearch(quotes, "", ctx, "cust-1"),
      ctx
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.customerName).toBe("Jean Tremblay");
    expect(groups[0]?.address).toBe("123 rue Exemple, Laval");
    expect(groups[0]?.quotes).toHaveLength(2);
  });
});
