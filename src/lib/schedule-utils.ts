import { format, parseISO } from "date-fns";
import { getEventDayKey } from "@/lib/calendar-utils";
import {
  isoToLocalDateTime,
  localDateTimeToISO,
} from "@/lib/schedule-timezone";
import type { Customer, Employee, Quote, ScheduleEvent } from "@/types";
import { getEmployeeFullName } from "@/lib/employee-utils";

import { generateId } from "@/lib/id";
import { getScheduleStatusBlockClassName } from "@/lib/status-colors";

export function getCustomerBillingAddress(customer: Customer): string {
  return customer.billingAddress ?? customer.address;
}

export function getCustomerJobSiteAddress(customer: Customer): string {
  return customer.address;
}

export function fillCustomerFields(customer: Customer) {
  return {
    customerId: customer.id,
    customerName: customer.company || customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    billingAddress: getCustomerBillingAddress(customer),
    jobSiteAddress: getCustomerJobSiteAddress(customer),
  };
}

export function buildDateTime(date: string, time: string): string {
  return localDateTimeToISO(date, time);
}

export function splitDateTime(iso: string): { date: string; time: string } {
  return isoToLocalDateTime(iso);
}

export function buildScheduleEvent(
  form: ScheduleFormValues,
  customers: Customer[],
  employees: Employee[],
  existingId?: string
): ScheduleEvent {
  const selectedEmployees = employees.filter((e) => form.employeeIds.includes(e.id));
  const customer = customers.find((c) => c.id === form.customerId);

  return {
    id: existingId ?? generateId("evt"),
    companyId: customer?.companyId ?? customers[0]?.companyId ?? "",
    title: form.title,
    description: form.description,
    start: buildDateTime(form.date, form.startTime),
    end: buildDateTime(form.date, form.endTime),
    customerId: form.customerId || undefined,
    customerName: customer?.company || customer?.name || form.customerName,
    customerPhone: form.customerPhone,
    customerEmail: form.customerEmail,
    billingAddress: form.billingAddress,
    jobSiteAddress: form.jobSiteAddress,
    location: form.jobSiteAddress,
    internalNotes: form.internalNotes,
    employeeIds: form.employeeIds,
    employeeNames: selectedEmployees.map((e) => getEmployeeFullName(e)),
    status: form.status,
    type: form.type,
    clientPoNumber: form.clientPoNumber.trim() || undefined,
    jobOrigin: "direct",
    jobNumberType: "service_call",
  };
}

export interface ScheduleFormValues {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  status: ScheduleEvent["status"];
  type: ScheduleEvent["type"];
  employeeIds: string[];
  internalNotes: string;
  clientPoNumber: string;
  customerMode: "existing" | "new";
  customerId: string;
  customerName: string;
  newCustomerName: string;
  newCustomerCompany: string;
  customerPhone: string;
  customerEmail: string;
  billingAddress: string;
  jobSiteAddress: string;
}

export interface ScheduleFormDefaults {
  date?: Date;
  employeeId?: string;
  startTime?: string;
  endTime?: string;
}

export function getDefaultFormValues(
  defaults?: ScheduleFormDefaults,
  event?: ScheduleEvent
): ScheduleFormValues {
  if (event) {
    const { date: eventDate, time: startTime } = splitDateTime(event.start);
    const { time: endTime } = splitDateTime(event.end);

    return {
      title: event.title,
      description: event.description,
      date: eventDate,
      startTime,
      endTime,
      status: event.status,
      type: event.type,
      employeeIds: event.employeeIds,
      internalNotes: event.internalNotes ?? "",
      clientPoNumber: event.clientPoNumber ?? "",
      customerMode: "existing",
      customerId: event.customerId ?? "",
      customerName: event.customerName ?? "",
      newCustomerName: "",
      newCustomerCompany: "",
      customerPhone: event.customerPhone ?? "",
      customerEmail: event.customerEmail ?? "",
      billingAddress: event.billingAddress ?? "",
      jobSiteAddress: event.jobSiteAddress ?? event.location,
    };
  }

  const baseDate = defaults?.date ?? new Date();
  return {
    title: "",
    description: "",
    date: format(baseDate, "yyyy-MM-dd"),
    startTime: defaults?.startTime ?? "08:00",
    endTime: defaults?.endTime ?? "12:00",
    status: "scheduled",
    type: "job",
    employeeIds: defaults?.employeeId ? [defaults.employeeId] : [],
    internalNotes: "",
    clientPoNumber: "",
    customerMode: "existing",
    customerId: "",
    customerName: "",
    newCustomerName: "",
    newCustomerCompany: "",
    customerPhone: "",
    customerEmail: "",
    billingAddress: "",
    jobSiteAddress: "",
  };
}

export function syncEventEmployeeNames(event: ScheduleEvent, employees: Employee[]): ScheduleEvent {
  return {
    ...event,
    employeeNames: employees
      .filter((employee) => event.employeeIds.includes(employee.id))
      .map((employee) => getEmployeeFullName(employee)),
  };
}

export function reassignEventEmployee(
  event: ScheduleEvent,
  sourceEmployeeId: string | null,
  targetEmployeeId: string | null
): ScheduleEvent {
  let employeeIds = [...event.employeeIds];

  if (!sourceEmployeeId && targetEmployeeId) {
    return { ...event, employeeIds: [targetEmployeeId] };
  }

  if (sourceEmployeeId && !targetEmployeeId) {
    return { ...event, employeeIds: employeeIds.filter((id) => id !== sourceEmployeeId) };
  }

  if (sourceEmployeeId && targetEmployeeId) {
    if (sourceEmployeeId === targetEmployeeId) {
      return event;
    }
    employeeIds = employeeIds.filter((id) => id !== sourceEmployeeId);
    if (!employeeIds.includes(targetEmployeeId)) {
      employeeIds.push(targetEmployeeId);
    }
    return { ...event, employeeIds };
  }

  return event;
}

export function createCustomerFromForm(form: ScheduleFormValues, companyId = ""): Customer {
  const today = format(new Date(), "yyyy-MM-dd");
  return {
    id: generateId("cust"),
    companyId,
    name: form.newCustomerName,
    company: form.newCustomerCompany || form.newCustomerName,
    email: form.customerEmail,
    phone: form.customerPhone,
    address: form.jobSiteAddress,
    billingAddress: form.billingAddress,
    status: "lead",
    totalProjects: 0,
    createdAt: today,
  };
}

export interface QuoteScheduleFormValues {
  date: string;
  startTime: string;
  endTime: string;
  employeeId: string;
  status: ScheduleEvent["status"];
  internalNotes: string;
  clientPoNumber: string;
}

export function getDefaultQuoteScheduleFormValues(
  existing?: ScheduleEvent
): QuoteScheduleFormValues {
  if (existing) {
    const { date, time: startTime } = splitDateTime(existing.start);
    const { time: endTime } = splitDateTime(existing.end);
    return {
      date,
      startTime,
      endTime,
      employeeId: existing.employeeIds[0] ?? "",
      status: existing.status,
      internalNotes: existing.internalNotes ?? "",
      clientPoNumber: existing.clientPoNumber ?? "",
    };
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    date: format(tomorrow, "yyyy-MM-dd"),
    startTime: "08:00",
    endTime: "16:00",
    employeeId: "",
    status: "scheduled",
    internalNotes: "",
    clientPoNumber: "",
  };
}

export function buildScheduleEventFromQuote(
  quote: Quote,
  form: QuoteScheduleFormValues,
  customers: Customer[],
  employees: Employee[],
  companyId: string,
  existing?: ScheduleEvent
): ScheduleEvent {
  const customer = customers.find((c) => c.id === quote.customerId);
  const selectedEmployee = form.employeeId
    ? employees.find((e) => e.id === form.employeeId)
    : undefined;
  const employeeIds = form.employeeId ? [form.employeeId] : [];
  const employeeNames = selectedEmployee ? [getEmployeeFullName(selectedEmployee)] : [];

  const jobSiteAddress = customer?.address ?? "";
  const billingAddress = customer?.billingAddress ?? customer?.address ?? "";

  return {
    id: existing?.id ?? generateId("evt"),
    companyId,
    title: quote.title,
    description: quote.description,
    start: buildDateTime(form.date, form.startTime),
    end: buildDateTime(form.date, form.endTime),
    customerId: quote.customerId || undefined,
    customerName: quote.customerName || customer?.company || customer?.name,
    customerPhone: customer?.phone,
    customerEmail: quote.customerEmail ?? customer?.email,
    billingAddress,
    jobSiteAddress,
    location: jobSiteAddress,
    employeeIds,
    employeeNames,
    internalNotes: form.internalNotes,
    status: form.status,
    type: "job",
    quoteId: quote.id,
    jobNumber: existing?.jobNumber,
    jobNumberType: existing?.jobNumberType ?? "contract",
    jobOrigin: existing?.jobOrigin ?? "quote",
    clientPoNumber: form.clientPoNumber.trim() || existing?.clientPoNumber,
  };
}

/** Optional archive-style grouping — never used to hide jobs on /schedule. */
export type ScheduleHistoryFilter = "all" | "active" | "completed" | "pending-review" | "invoiced";

export const ACTIVE_SCHEDULE_STATUSES: ScheduleEvent["status"][] = [
  "scheduled",
  "en-route",
  "in-progress",
];

export const INVOICED_SCHEDULE_STATUSES: ScheduleEvent["status"][] = ["invoice-sent", "paid"];

export const ALL_SCHEDULE_WORKFLOW_STATUSES: ScheduleEvent["status"][] = [
  "scheduled",
  "en-route",
  "in-progress",
  "completed",
  "pending-review",
  "ready-to-invoice",
  "invoice-sent",
  "paid",
  "cancelled",
];

export function matchesScheduleHistoryFilter(
  event: ScheduleEvent,
  filter: ScheduleHistoryFilter
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return ACTIVE_SCHEDULE_STATUSES.includes(event.status);
    case "completed":
      return event.status === "completed";
    case "pending-review":
      return event.status === "pending-review";
    case "invoiced":
      return INVOICED_SCHEDULE_STATUSES.includes(event.status);
    default:
      return true;
  }
}

export function filterScheduleEventsByHistory(
  events: ScheduleEvent[],
  filter: ScheduleHistoryFilter
): ScheduleEvent[] {
  if (filter === "all") return events;
  return events.filter((event) => matchesScheduleHistoryFilter(event, filter));
}

export interface ScheduleCalendarFilters {
  workerId: string;
  trade: string;
  truck: string;
}

/** Calendar filters — worker/trade/truck only; status never hides a scheduled job. */
export function filterScheduleCalendarEvents(
  events: ScheduleEvent[],
  filters: ScheduleCalendarFilters,
  employees: Employee[]
): ScheduleEvent[] {
  return events.filter((event) => {
    if (
      filters.workerId !== "all" &&
      !event.employeeIds.includes(filters.workerId) &&
      event.employeeIds.length > 0
    ) {
      return false;
    }
    if (filters.trade !== "all") {
      const assigned = employees.filter((employee) => event.employeeIds.includes(employee.id));
      if (assigned.length > 0 && !assigned.some((employee) => employee.trade === filters.trade)) {
        return false;
      }
    }
    if (filters.truck !== "all") {
      const assigned = employees.filter((employee) => event.employeeIds.includes(employee.id));
      if (
        assigned.length > 0 &&
        !assigned.some((employee) => employee.truckNumber === filters.truck)
      ) {
        return false;
      }
    }
    return true;
  });
}

export function hasScheduleTimestamp(value: string | undefined): boolean {
  if (!value) return false;
  return !Number.isNaN(parseISO(value).getTime());
}

const FIELD_ACTIVE_STATUSES: ScheduleEvent["status"][] = ["en-route", "in-progress"];

export interface ResolveScheduleInitialDateOptions {
  initialDate?: string;
  eventId?: string;
  now?: Date;
}

/** Pick the calendar day shown on /schedule — aligns with active field jobs when possible. */
export function resolveScheduleInitialDate(
  events: ScheduleEvent[],
  options: ResolveScheduleInitialDateOptions = {}
): Date {
  const now = options.now ?? new Date();
  const todayKey = format(now, "yyyy-MM-dd");

  if (options.initialDate) {
    const parsed = new Date(`${options.initialDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  if (options.eventId) {
    const target = events.find((event) => event.id === options.eventId);
    if (target && hasScheduleTimestamp(target.start)) {
      return parseISO(target.start);
    }
  }

  const activeJobs = events.filter(
    (event) =>
      FIELD_ACTIVE_STATUSES.includes(event.status) &&
      event.employeeIds.length > 0 &&
      hasScheduleTimestamp(event.start)
  );

  if (activeJobs.length > 0) {
    const onToday = activeJobs.find((event) => getEventDayKey(event.start) === todayKey);
    if (onToday) return now;

    activeJobs.sort((a, b) => b.start.localeCompare(a.start));
    return parseISO(activeJobs[0]!.start);
  }

  return now;
}

export function buildScheduleEventLink(event: Pick<ScheduleEvent, "id" | "start">): string {
  const date = hasScheduleTimestamp(event.start) ? getEventDayKey(event.start) : undefined;
  const params = new URLSearchParams({ eventId: event.id });
  if (date) params.set("date", date);
  return `/schedule?${params.toString()}`;
}

export type MergeScheduleMode = "preserve-placement" | "apply-all";

/** Preserve schedule placement fields when persisting status or metadata edits. */
export function mergeScheduleJobForUpdate(
  existing: ScheduleEvent,
  updates: ScheduleEvent,
  mode: MergeScheduleMode = "preserve-placement"
): ScheduleEvent {
  const preservePlacement = mode === "preserve-placement";
  const employeeIds =
    preservePlacement && updates.employeeIds.length === 0
      ? existing.employeeIds
      : updates.employeeIds;
  const employeeNames =
    preservePlacement && updates.employeeIds.length === 0
      ? existing.employeeNames
      : updates.employeeNames;
  const start = hasScheduleTimestamp(updates.start) ? updates.start : existing.start;
  const end = hasScheduleTimestamp(updates.end) ? updates.end : existing.end;

  return {
    ...existing,
    ...updates,
    id: existing.id,
    companyId: existing.companyId,
    start,
    end,
    employeeIds,
    employeeNames,
    jobNumber: existing.jobNumber,
    jobNumberType: existing.jobNumberType ?? updates.jobNumberType,
    jobOrigin: existing.jobOrigin ?? updates.jobOrigin,
    quoteId: existing.quoteId ?? updates.quoteId,
    workDescription: existing.workDescription,
    closureNotes: existing.closureNotes,
    submittedForReviewAt: existing.submittedForReviewAt,
    workCompletedAt: existing.workCompletedAt,
    approvedBy: existing.approvedBy,
    approvedAt: existing.approvedAt,
    sentAt: existing.sentAt,
    sentTo: existing.sentTo,
    sentBy: existing.sentBy,
  };
}

export interface ScheduleBlockAppearance {
  className: string;
  badgeLabel: string | null;
}

/** Calendar block labels — may differ from global StatusBadge text. */
const SCHEDULE_BLOCK_BADGE: Partial<Record<ScheduleEvent["status"], string>> = {
  "en-route": "En route",
  "in-progress": "En travail",
  completed: "Terminé",
  "pending-review": "À vérifier",
  "ready-to-invoice": "Prêt à facturer",
  "invoice-sent": "Facturé",
  paid: "Payé",
  cancelled: "Annulé",
};

export function getScheduleBlockAppearance(status: ScheduleEvent["status"]): ScheduleBlockAppearance {
  return {
    className: getScheduleStatusBlockClassName(status),
    badgeLabel: SCHEDULE_BLOCK_BADGE[status] ?? null,
  };
}

/** Merge server-fetched events into local state without dropping placement fields. */
export function syncScheduleEventsFromServer(
  localEvents: ScheduleEvent[],
  serverEvents: ScheduleEvent[]
): ScheduleEvent[] {
  const localById = new Map(localEvents.map((event) => [event.id, event]));
  const serverIds = new Set(serverEvents.map((event) => event.id));

  const merged = serverEvents.map((serverEvent) => {
    const local = localById.get(serverEvent.id);
    return local
      ? mergeScheduleJobForUpdate(local, serverEvent, "preserve-placement")
      : serverEvent;
  });

  for (const localEvent of localEvents) {
    if (!serverIds.has(localEvent.id)) {
      merged.push(localEvent);
    }
  }

  return merged;
}
