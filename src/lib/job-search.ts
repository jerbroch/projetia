import {
  getJobYear,
  isArchivedJob,
  resolveJobNumberType,
  type JobNumberType,
} from "@/lib/job-utils";
import { matchesSearchText, normalizeSearchText } from "@/lib/quote-search";
import type { Customer, Employee, ScheduleEvent } from "@/types";

export type ArchiveFilterType = "all" | JobNumberType;
export type ArchiveStatusFilter = "all" | ScheduleEvent["status"];

export interface ArchiveFilters {
  type: ArchiveFilterType;
  customerId: string | null;
  employeeId: string | null;
  year: number | null;
  status: ArchiveStatusFilter;
}

export interface ArchiveSearchContext {
  customersById: Map<string, Customer>;
}

export function buildArchiveSearchContext(customers: Customer[]): ArchiveSearchContext {
  return { customersById: new Map(customers.map((customer) => [customer.id, customer])) };
}

export function getArchivedJobs(events: ScheduleEvent[]): ScheduleEvent[] {
  return events
    .filter(isArchivedJob)
    .sort((a, b) => b.start.localeCompare(a.start));
}

export function getArchiveYears(events: ScheduleEvent[]): number[] {
  const years = new Set(events.map((event) => getJobYear(event)));
  return Array.from(years).sort((a, b) => b - a);
}

function getJobSearchableText(
  event: ScheduleEvent,
  ctx: ArchiveSearchContext,
  employees: Employee[]
): string {
  const customer = event.customerId ? ctx.customersById.get(event.customerId) : undefined;
  const customerName = customer?.name ?? event.customerName ?? "";
  const address = event.jobSiteAddress ?? event.location ?? customer?.address ?? "";
  const employeeNames = event.employeeNames.join(" ");
  const employeeMatches = employees
    .filter((employee) => event.employeeIds.includes(employee.id))
    .map((employee) => `${employee.firstName} ${employee.lastName}`)
    .join(" ");

  return [
    event.jobNumber ?? "",
    event.clientPoNumber ?? "",
    customerName,
    address,
    employeeNames,
    employeeMatches,
    event.title,
    event.description,
  ].join(" ");
}

export function archiveJobMatchesSearch(
  event: ScheduleEvent,
  query: string,
  ctx: ArchiveSearchContext,
  employees: Employee[]
): boolean {
  if (!query.trim()) return true;
  return matchesSearchText(getJobSearchableText(event, ctx, employees), query);
}

export function filterArchivedJobs(
  events: ScheduleEvent[],
  query: string,
  filters: ArchiveFilters,
  ctx: ArchiveSearchContext,
  employees: Employee[]
): ScheduleEvent[] {
  return getArchivedJobs(events).filter((event) => {
    if (filters.type !== "all" && resolveJobNumberType(event) !== filters.type) {
      return false;
    }
    if (filters.customerId && event.customerId !== filters.customerId) {
      return false;
    }
    if (filters.employeeId && !event.employeeIds.includes(filters.employeeId)) {
      return false;
    }
    if (filters.year != null && getJobYear(event) !== filters.year) {
      return false;
    }
    if (filters.status !== "all" && event.status !== filters.status) {
      return false;
    }
    return archiveJobMatchesSearch(event, query, ctx, employees);
  });
}

export interface ArchiveSearchSuggestion {
  id: string;
  label: string;
  sublabel: string;
}

export function searchArchivesForAutocomplete(
  events: ScheduleEvent[],
  query: string,
  ctx: ArchiveSearchContext,
  employees: Employee[],
  limit = 10
): ArchiveSearchSuggestion[] {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 3) return [];

  return filterArchivedJobs(events, query, {
    type: "all",
    customerId: null,
    employeeId: null,
    year: null,
    status: "all",
  }, ctx, employees)
    .slice(0, Math.min(Math.max(limit, 5), 10))
    .map((event) => ({
      id: event.id,
      label: event.jobNumber ?? event.title,
      sublabel: [event.customerName, event.jobSiteAddress ?? event.location].filter(Boolean).join(" · "),
    }));
}
