import { describe, expect, it } from "vitest";
import {
  buildFieldCompletionSummary,
  canAccessAdminDashboard,
  canAccessFieldWorkerUI,
  canCompleteFieldWork,
  canEnterFieldHours,
  canUpdateFieldStatus,
  canViewJobAsEmployee,
  filterJobsForEmployee,
  isFieldJobEditable,
  toFieldSafeScheduleEvent,
} from "@/lib/field-permissions";
import type { ScheduleEvent } from "@/types";

const baseJob: ScheduleEvent = {
  id: "job-1",
  companyId: "co-1",
  title: "Appel plomberie",
  description: "Fuite",
  start: "2026-08-20T08:00:00",
  end: "2026-08-20T12:00:00",
  employeeIds: ["emp-1"],
  employeeNames: ["Jean Plombier"],
  location: "123 Rue Test",
  status: "scheduled",
  type: "job",
  internalNotes: "Secret interne",
  billingAddress: "456 Facturation",
  clientPoNumber: "PO-999",
  quoteEstimationSnapshot: {
    quoteId: "q-1",
    quoteNumber: "SO-001",
    estimatedHours: 4,
    capturedAt: "2026-08-01T00:00:00Z",
    calculatedCost: 500,
    proposedAmount: 800,
  },
};

describe("field permissions", () => {
  it("identifies field worker vs admin dashboard access", () => {
    expect(canAccessFieldWorkerUI({ membershipRole: "employee" })).toBe(true);
    expect(canAccessFieldWorkerUI({ membershipRole: "admin" })).toBe(false);
    expect(canAccessAdminDashboard("employee")).toBe(false);
    expect(canAccessAdminDashboard("admin")).toBe(true);
  });

  it("restricts job visibility to assigned employee", () => {
    expect(canViewJobAsEmployee(baseJob, "emp-1")).toBe(true);
    expect(canViewJobAsEmployee(baseJob, "emp-2")).toBe(false);
    expect(filterJobsForEmployee([baseJob, { ...baseJob, id: "j2", employeeIds: ["emp-2"] }], "emp-1")).toHaveLength(1);
  });

  it("allows field status transitions only for assigned employee", () => {
    expect(canUpdateFieldStatus("employee", baseJob, "emp-1", "en-route")).toBe(true);
    expect(canUpdateFieldStatus("employee", baseJob, "emp-2", "en-route")).toBe(false);
    expect(canUpdateFieldStatus("employee", baseJob, "emp-1", "ready-to-invoice")).toBe(false);
    expect(canUpdateFieldStatus("employee", { ...baseJob, status: "in-progress" }, "emp-1", "completed")).toBe(true);
  });

  it("blocks field edits after work is locked", () => {
    expect(isFieldJobEditable("completed")).toBe(false);
    expect(canEnterFieldHours("employee", { ...baseJob, status: "completed" }, "emp-1")).toBe(true);
    expect(canEnterFieldHours("employee", { ...baseJob, status: "pending-review" }, "emp-1")).toBe(false);
  });

  it("strips financial and internal data for field view", () => {
    const safe = toFieldSafeScheduleEvent(baseJob);
    expect(safe.internalNotes).toBeUndefined();
    expect(safe.billingAddress).toBeUndefined();
    expect(safe.clientPoNumber).toBeUndefined();
    expect(safe.quoteEstimationSnapshot?.estimatedHours).toBe(4);
    expect(safe.quoteEstimationSnapshot?.calculatedCost).toBeUndefined();
  });

  it("builds completion summary with hours warning", () => {
    const summary = buildFieldCompletionSummary([], [], 2, "Note");
    expect(summary.missingHours).toBe(true);
    expect(summary.toolsCount).toBe(2);
    expect(canCompleteFieldWork("employee", { ...baseJob, status: "in-progress" }, "emp-1")).toBe(true);
  });
});
