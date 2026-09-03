import { describe, expect, it } from "vitest";
import { isArchivedJob } from "@/lib/job-utils";
import type { Invoice, ScheduleEvent } from "@/types";

function filterActiveInvoices(
  invoices: Invoice[],
  events: ScheduleEvent[]
): Invoice[] {
  const archivedJobIds = new Set(
    events.filter((event) => isArchivedJob(event)).map((event) => event.id)
  );
  return invoices.filter(
    (invoice) => !invoice.scheduledJobId || !archivedJobIds.has(invoice.scheduledJobId)
  );
}

describe("filterActiveInvoices", () => {
  const events: ScheduleEvent[] = [
    {
      id: "job-archived",
      companyId: "co-1",
      title: "Done",
      description: "",
      start: "2026-01-01T08:00:00",
      end: "2026-01-01T17:00:00",
      employeeIds: [],
      employeeNames: [],
      location: "",
      status: "paid",
      type: "job",
    },
    {
      id: "job-active",
      companyId: "co-1",
      title: "Active",
      description: "",
      start: "2026-02-01T08:00:00",
      end: "2026-02-01T17:00:00",
      employeeIds: [],
      employeeNames: [],
      location: "",
      status: "invoice-sent",
      type: "job",
    },
  ];

  const invoices: Invoice[] = [
    {
      id: "inv-archived",
      companyId: "co-1",
      invoiceNumber: "FA-001",
      customerId: "cust-1",
      customerName: "Client",
      scheduledJobId: "job-archived",
      amount: 100,
      paidAmount: 0,
      status: "sent",
      dueDate: "2026-02-01",
      createdAt: "2026-01-15",
    },
    {
      id: "inv-active",
      companyId: "co-1",
      invoiceNumber: "FA-002",
      customerId: "cust-1",
      customerName: "Client",
      scheduledJobId: "job-active",
      amount: 200,
      paidAmount: 0,
      status: "sent",
      dueDate: "2026-03-01",
      createdAt: "2026-02-01",
    },
  ];

  it("hides invoices linked to archived jobs", () => {
    const active = filterActiveInvoices(invoices, events);
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe("inv-active");
  });
});
