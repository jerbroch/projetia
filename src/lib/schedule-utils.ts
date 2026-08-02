import { format, parseISO } from "date-fns";
import type { Customer, Employee, ScheduleEvent } from "@/types";
import { getEmployeeFullName } from "@/lib/employee-utils";

import { generateId } from "@/lib/id";

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
  return `${date}T${time}:00`;
}

export function splitDateTime(iso: string): { date: string; time: string } {
  const parsed = parseISO(iso);
  return {
    date: format(parsed, "yyyy-MM-dd"),
    time: format(parsed, "HH:mm"),
  };
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

export function createCustomerFromForm(form: ScheduleFormValues): Customer {
  const today = format(new Date(), "yyyy-MM-dd");
  return {
    id: generateId("cust"),
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
