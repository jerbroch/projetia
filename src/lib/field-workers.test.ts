import { describe, expect, it } from "vitest";
import {
  countActiveFieldWorkers,
  getActiveFieldJobs,
  getActiveFieldWorkers,
  isJobActiveOnField,
} from "@/lib/field-workers";
import type { ScheduleEvent } from "@/types";

const baseEvent: ScheduleEvent = {
  id: "evt-test",
  companyId: "co-1",
  title: "Test Job",
  description: "",
  start: "2026-08-10T08:00:00",
  end: "2026-08-10T17:00:00",
  employeeIds: ["emp-1", "emp-2"],
  employeeNames: ["Alice Martin", "Bob Tremblay"],
  location: "123 Rue Principale",
  jobSiteAddress: "123 Rue Principale",
  customerName: "Client ABC",
  status: "scheduled",
  type: "job",
};

describe("isJobActiveOnField", () => {
  it("returns true for in-progress jobs with assigned employees", () => {
    const now = new Date("2026-08-10T12:00:00");
    expect(isJobActiveOnField({ ...baseEvent, status: "in-progress" }, now)).toBe(true);
  });

  it("returns true for scheduled jobs within the time window", () => {
    const now = new Date("2026-08-10T10:00:00");
    expect(isJobActiveOnField(baseEvent, now)).toBe(true);
  });

  it("returns false outside the time window", () => {
    const now = new Date("2026-08-10T18:00:00");
    expect(isJobActiveOnField(baseEvent, now)).toBe(false);
  });

  it("returns false for completed or cancelled jobs", () => {
    const now = new Date("2026-08-10T10:00:00");
    expect(isJobActiveOnField({ ...baseEvent, status: "completed" }, now)).toBe(false);
    expect(isJobActiveOnField({ ...baseEvent, status: "cancelled" }, now)).toBe(false);
  });

  it("returns false when no employees are assigned", () => {
    const now = new Date("2026-08-10T10:00:00");
    expect(
      isJobActiveOnField({ ...baseEvent, employeeIds: [], employeeNames: [] }, now)
    ).toBe(false);
  });
});

describe("getActiveFieldWorkers", () => {
  it("deduplicates employees across multiple active jobs", () => {
    const now = new Date("2026-08-10T10:00:00");
    const events: ScheduleEvent[] = [
      baseEvent,
      {
        ...baseEvent,
        id: "evt-test-2",
        employeeIds: ["emp-2", "emp-3"],
        employeeNames: ["Bob Tremblay", "Claire Gagnon"],
        status: "in-progress",
      },
    ];

    const workers = getActiveFieldWorkers(events, now);
    expect(workers).toHaveLength(3);
    expect(countActiveFieldWorkers(events, now)).toBe(3);
  });

  it("excludes employees when job is completed", () => {
    const now = new Date("2026-08-10T10:00:00");
    const events: ScheduleEvent[] = [{ ...baseEvent, status: "completed" }];
    expect(getActiveFieldWorkers(events, now)).toHaveLength(0);
    expect(getActiveFieldJobs(events, now)).toHaveLength(0);
  });
});
