import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import {
  ALL_SCHEDULE_WORKFLOW_STATUSES,
  buildScheduleEventLink,
  filterScheduleCalendarEvents,
  filterScheduleEventsByHistory,
  getScheduleBlockAppearance,
  matchesScheduleHistoryFilter,
  mergeScheduleJobForUpdate,
  resolveScheduleInitialDate,
  syncScheduleEventsFromServer,
} from "@/lib/schedule-utils";
import type { Employee, ScheduleEvent } from "@/types";

function job(status: ScheduleEvent["status"], id = "job-1"): ScheduleEvent {
  return {
    id,
    companyId: "co-1",
    title: "Test job",
    description: "",
    start: "2025-02-10T08:00:00",
    end: "2025-02-10T12:00:00",
    employeeIds: ["emp-1"],
    employeeNames: ["Alice"],
    location: "123 Main",
    status,
    type: "job",
  };
}

const employees: Employee[] = [
  {
    id: "emp-1",
    companyId: "co-1",
    firstName: "Alice",
    lastName: "Martin",
    email: "alice@example.com",
    mobilePhone: "555-0100",
    trade: "Plomberie",
    truckNumber: "T-1",
    status: "active",
    department: "Field",
    hireDate: "2024-01-01",
    hourlyRate: 45,
  },
];

describe("matchesScheduleHistoryFilter", () => {
  it("includes every workflow status when filter is all", () => {
    const statuses: ScheduleEvent["status"][] = [
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

    for (const status of statuses) {
      expect(matchesScheduleHistoryFilter(job(status), "all")).toBe(true);
    }
  });

  it("filters active jobs only", () => {
    expect(matchesScheduleHistoryFilter(job("scheduled"), "active")).toBe(true);
    expect(matchesScheduleHistoryFilter(job("en-route"), "active")).toBe(true);
    expect(matchesScheduleHistoryFilter(job("in-progress"), "active")).toBe(true);
    expect(matchesScheduleHistoryFilter(job("completed"), "active")).toBe(false);
    expect(matchesScheduleHistoryFilter(job("pending-review"), "active")).toBe(false);
    expect(matchesScheduleHistoryFilter(job("invoice-sent"), "active")).toBe(false);
  });

  it("filters completed, pending-review, and invoiced groups separately", () => {
    expect(matchesScheduleHistoryFilter(job("completed"), "completed")).toBe(true);
    expect(matchesScheduleHistoryFilter(job("pending-review"), "completed")).toBe(false);

    expect(matchesScheduleHistoryFilter(job("pending-review"), "pending-review")).toBe(true);
    expect(matchesScheduleHistoryFilter(job("completed"), "pending-review")).toBe(false);

    expect(matchesScheduleHistoryFilter(job("invoice-sent"), "invoiced")).toBe(true);
    expect(matchesScheduleHistoryFilter(job("paid"), "invoiced")).toBe(true);
    expect(matchesScheduleHistoryFilter(job("ready-to-invoice"), "invoiced")).toBe(false);
  });
});

describe("filterScheduleEventsByHistory", () => {
  it("never removes events from the source list semantics — only narrows view", () => {
    const events = [
      job("scheduled", "a"),
      job("completed", "b"),
      job("invoice-sent", "c"),
    ];

    expect(filterScheduleEventsByHistory(events, "all")).toHaveLength(3);
    expect(filterScheduleEventsByHistory(events, "active")).toHaveLength(1);
    expect(filterScheduleEventsByHistory(events, "invoiced")).toHaveLength(1);
  });
});

describe("filterScheduleCalendarEvents", () => {
  it("keeps every workflow status visible on the schedule calendar", () => {
    const events = ALL_SCHEDULE_WORKFLOW_STATUSES.map((status, index) =>
      job(status, `job-${index}`)
    );

    expect(
      filterScheduleCalendarEvents(
        events,
        { workerId: "all", trade: "all", truck: "all" },
        employees
      )
    ).toHaveLength(ALL_SCHEDULE_WORKFLOW_STATUSES.length);
  });

  it("still filters by worker assignment without using status", () => {
    const events = [job("scheduled", "a"), job("paid", "b")];

    expect(
      filterScheduleCalendarEvents(
        events,
        { workerId: "emp-1", trade: "all", truck: "all" },
        employees
      )
    ).toHaveLength(2);
  });
});

describe("mergeScheduleJobForUpdate", () => {
  it("preserves employee assignment and schedule timing on status-only edits", () => {
    const existing = job("scheduled");
    const updated = mergeScheduleJobForUpdate(existing, {
      ...existing,
      status: "invoice-sent",
      employeeIds: [],
      employeeNames: [],
      start: "",
      end: "",
    });

    expect(updated.status).toBe("invoice-sent");
    expect(updated.employeeIds).toEqual(["emp-1"]);
    expect(updated.employeeNames).toEqual(["Alice"]);
    expect(updated.start).toBe("2025-02-10T08:00:00");
    expect(updated.end).toBe("2025-02-10T12:00:00");
  });

  it("preserves placement when server payload has invalid timestamps", () => {
    const existing = job("scheduled");
    const updated = mergeScheduleJobForUpdate(existing, {
      ...existing,
      status: "paid",
      start: "not-a-date",
      end: "also-invalid",
    });

    expect(updated.status).toBe("paid");
    expect(updated.start).toBe("2025-02-10T08:00:00");
    expect(updated.end).toBe("2025-02-10T12:00:00");
  });

  it("apply-all mode allows intentional employee unassignment on form save", () => {
    const existing = job("scheduled");
    const updated = mergeScheduleJobForUpdate(
      existing,
      { ...existing, employeeIds: [], employeeNames: [] },
      "apply-all"
    );

    expect(updated.employeeIds).toEqual([]);
    expect(updated.employeeNames).toEqual([]);
  });

  it("apply-all mode moves job to a new employee row", () => {
    const existing = job("scheduled");
    const updated = mergeScheduleJobForUpdate(
      existing,
      { ...existing, employeeIds: ["emp-2"], employeeNames: ["Bob"] },
      "apply-all"
    );

    expect(updated.employeeIds).toEqual(["emp-2"]);
    expect(updated.employeeNames).toEqual(["Bob"]);
  });
});

describe("syncScheduleEventsFromServer", () => {
  it("keeps local placement when server refresh drops assignment fields", () => {
    const local = [job("en-route")];
    const server = [
      {
        ...job("pending-review"),
        employeeIds: [],
        employeeNames: [],
        start: "",
        end: "",
      },
    ];

    const synced = syncScheduleEventsFromServer(local, server);
    expect(synced).toHaveLength(1);
    expect(synced[0]?.status).toBe("pending-review");
    expect(synced[0]?.employeeIds).toEqual(["emp-1"]);
    expect(synced[0]?.start).toBe("2025-02-10T08:00:00");
  });

  it("retains optimistic local events missing from server refresh", () => {
    const local = [job("scheduled", "local-only")];
    const synced = syncScheduleEventsFromServer(local, []);
    expect(synced).toHaveLength(1);
    expect(synced[0]?.id).toBe("local-only");
  });

  it("never excludes jobs by status during server sync", () => {
    const local = ALL_SCHEDULE_WORKFLOW_STATUSES.map((status, index) =>
      job(status, `local-${index}`)
    );
    const server = ALL_SCHEDULE_WORKFLOW_STATUSES.map((status, index) =>
      job(status, `local-${index}`)
    );

    expect(syncScheduleEventsFromServer(local, server)).toHaveLength(
      ALL_SCHEDULE_WORKFLOW_STATUSES.length
    );
  });
});

describe("getScheduleBlockAppearance", () => {
  it("uses centralized status colors for completed and pending-review", () => {
    expect(getScheduleBlockAppearance("completed").className).toContain("green");
    expect(getScheduleBlockAppearance("pending-review").className).toContain("amber");
    expect(getScheduleBlockAppearance("pending-review").badgeLabel).toBe("À vérifier");
  });

  it("uses Facturé label for invoice-sent on the calendar", () => {
    expect(getScheduleBlockAppearance("invoice-sent").badgeLabel).toBe("Facturé");
  });

  it("uses strikethrough for cancelled jobs", () => {
    expect(getScheduleBlockAppearance("cancelled").className).toContain("line-through");
  });
});

describe("resolveScheduleInitialDate", () => {
  const now = new Date("2026-08-11T10:00:00");

  it("uses explicit initialDate when provided", () => {
    const resolved = resolveScheduleInitialDate([], { initialDate: "2026-08-05", now });
    expect(resolved.toISOString()).toContain("2026-08-05");
  });

  it("jumps to an in-progress job date when calendar defaults to today", () => {
    const events = [job("in-progress", "active-job")];
    events[0]!.start = "2026-08-09T08:00:00";
    events[0]!.end = "2026-08-09T17:00:00";

    const resolved = resolveScheduleInitialDate(events, { now });
    expect(resolved.toISOString()).toContain("2026-08-09");
  });

  it("keeps today when an active job is scheduled today", () => {
    const events = [job("in-progress", "today-job")];
    events[0]!.start = "2026-08-11T08:00:00";
    events[0]!.end = "2026-08-11T17:00:00";

    const resolved = resolveScheduleInitialDate(events, { now });
    expect(resolved.toISOString()).toContain("2026-08-11");
  });

  it("opens the requested event date via eventId", () => {
    const events = [
      job("scheduled", "other"),
      job("in-progress", "target"),
    ];
    events[1]!.start = "2026-08-07T09:00:00";

    const resolved = resolveScheduleInitialDate(events, { eventId: "target", now });
    expect(resolved.toISOString()).toContain("2026-08-07");
  });
});

describe("buildScheduleEventLink", () => {
  it("includes eventId and date query params", () => {
    expect(
      buildScheduleEventLink({ id: "job-123", start: "2026-08-09T08:00:00" })
    ).toBe("/schedule?eventId=job-123&date=2026-08-09");
  });
});

describe("dashboard and schedule data consistency", () => {
  it("shows the same in-progress job on dashboard field list and schedule calendar day filter", () => {
    const events = [job("in-progress", "shared-job")];
    events[0]!.start = "2026-08-09T08:00:00";
    events[0]!.end = "2026-08-09T17:00:00";

    const calendarDay = resolveScheduleInitialDate(events, {
      now: new Date("2026-08-11T10:00:00"),
    });
    const dayKey = format(calendarDay, "yyyy-MM-dd");

    const visibleOnCalendar = filterScheduleCalendarEvents(
      events,
      { workerId: "all", trade: "all", truck: "all" },
      employees
    ).filter((event) => event.start.startsWith(dayKey));

    expect(visibleOnCalendar).toHaveLength(1);
    expect(visibleOnCalendar[0]?.id).toBe("shared-job");
  });
});
