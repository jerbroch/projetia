import { describe, expect, it } from "vitest";
import {
  buildArchiveSearchContext,
  filterArchivedJobs,
  getArchivedJobs,
} from "@/lib/job-search";
import type { Customer, Employee, ScheduleEvent } from "@/types";

const customers: Customer[] = [
  {
    id: "cust-1",
    companyId: "co-1",
    name: "Mitchell Properties",
    email: "a@test.com",
    phone: "555-1111",
    address: "1420 Oak Street",
    company: "Mitchell Properties LLC",
    status: "active",
    totalProjects: 1,
    createdAt: "2025-01-01",
  },
];

const employees: Employee[] = [
  {
    id: "emp-1",
    companyId: "co-1",
    firstName: "Jean",
    lastName: "Tremblay",
    trade: "Plombier",
    mobilePhone: "555-2222",
    email: "jean@test.com",
    truckNumber: "12",
    status: "active",
    department: "Field",
    hireDate: "2020-01-01",
    hourlyRate: 40,
  },
];

const archivedEvents: ScheduleEvent[] = [
  {
    id: "evt-1",
    companyId: "co-1",
    title: "Rénovation cuisine",
    description: "Travaux terminés",
    start: "2026-02-01T08:00:00",
    end: "2026-02-01T17:00:00",
    customerId: "cust-1",
    customerName: "Mitchell Properties LLC",
    jobSiteAddress: "1420 Oak Street",
    employeeIds: ["emp-1"],
    employeeNames: ["Jean Tremblay"],
    location: "1420 Oak Street",
    status: "completed",
    type: "job",
    quoteId: "quote-1",
    jobNumber: "CON-2026-0001",
    jobNumberType: "contract",
    jobOrigin: "quote",
    clientPoNumber: "PO-100",
  },
  {
    id: "evt-2",
    companyId: "co-1",
    title: "Réparation urgence",
    description: "Appel direct",
    start: "2026-01-15T09:00:00",
    end: "2026-01-15T11:00:00",
    customerId: "cust-1",
    customerName: "Mitchell Properties LLC",
    jobSiteAddress: "1420 Oak Street",
    employeeIds: ["emp-1"],
    employeeNames: ["Jean Tremblay"],
    location: "1420 Oak Street",
    status: "cancelled",
    type: "job",
    jobNumber: "BT-2026-0001",
    jobNumberType: "service_call",
    jobOrigin: "direct",
  },
  {
    id: "evt-3",
    companyId: "co-1",
    title: "Inspection planifiée",
    description: "Encore active",
    start: "2026-03-01T10:00:00",
    end: "2026-03-01T12:00:00",
    customerId: "cust-1",
    customerName: "Mitchell Properties LLC",
    jobSiteAddress: "1420 Oak Street",
    employeeIds: ["emp-1"],
    employeeNames: ["Jean Tremblay"],
    location: "1420 Oak Street",
    status: "scheduled",
    type: "inspection",
    jobNumber: "BT-2026-0002",
    jobNumberType: "service_call",
    jobOrigin: "direct",
  },
];

describe("getArchivedJobs", () => {
  it("returns only completed, cancelled, or legacy pending-review jobs sorted by date desc", () => {
    const archived = getArchivedJobs(archivedEvents);
    expect(archived).toHaveLength(2);
    expect(archived[0]?.id).toBe("evt-1");
    expect(archived[1]?.id).toBe("evt-2");
  });

  it("includes legacy pending-review jobs closed before completed archival fix", () => {
    const legacyPendingReview: ScheduleEvent = {
      ...archivedEvents[0]!,
      id: "evt-legacy",
      status: "pending-review",
      submittedForReviewAt: "2026-02-01T17:30:00",
    };
    const archived = getArchivedJobs([...archivedEvents, legacyPendingReview]);
    expect(archived.map((event) => event.id)).toContain("evt-legacy");
  });
});

describe("filterArchivedJobs", () => {
  const ctx = buildArchiveSearchContext(customers);

  it("filters by contract type", () => {
    const result = filterArchivedJobs(
      archivedEvents,
      "",
      { type: "contract", customerId: null, employeeId: null, year: null, status: "all" },
      ctx,
      employees
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.jobNumber).toBe("CON-2026-0001");
  });

  it("searches by PO number", () => {
    const result = filterArchivedJobs(
      archivedEvents,
      "PO-100",
      { type: "all", customerId: null, employeeId: null, year: null, status: "all" },
      ctx,
      employees
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("evt-1");
  });

  it("filters by employee and status", () => {
    const result = filterArchivedJobs(
      archivedEvents,
      "",
      { type: "all", customerId: null, employeeId: "emp-1", year: 2026, status: "cancelled" },
      ctx,
      employees
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("evt-2");
  });
});
