import { describe, expect, it } from "vitest";
import {
  getEventDayKey,
  getEventPositionForDay,
} from "@/lib/calendar-utils";
import {
  calendarDayKey,
  dateFromScheduleDayKey,
  localDateTimeToISO,
} from "@/lib/schedule-timezone";
import {
  mergeScheduleJobForUpdate,
  syncScheduleEventsFromServer,
} from "@/lib/schedule-utils";
import type { ScheduleEvent } from "@/types";

function job(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: "job-1",
    companyId: "co-1",
    title: "Service call",
    description: "",
    start: localDateTimeToISO("2026-08-11", "09:00"),
    end: localDateTimeToISO("2026-08-11", "11:00"),
    employeeIds: ["emp-1"],
    employeeNames: ["Alice"],
    location: "123 Main",
    status: "scheduled",
    type: "job",
    ...overrides,
  };
}

describe("schedule edit calendar visibility", () => {
  it("navigates to the Quebec calendar day after edit, not browser-local midnight", () => {
    const edited = job();
    const dayKey = getEventDayKey(edited.start);
    const navigated = dateFromScheduleDayKey(dayKey);

    expect(getEventPositionForDay(edited, navigated)).not.toBeNull();
  });

  it("keeps edited job visible when server refresh returns partial placement fields", () => {
    const local = [job({ status: "en-route" })];
    const server = [
      {
        ...job({ status: "in-progress" }),
        employeeIds: [],
        employeeNames: [],
        start: "",
        end: "",
      },
    ];

    const synced = syncScheduleEventsFromServer(local, server);
    expect(synced).toHaveLength(1);
    expect(synced[0]?.status).toBe("in-progress");
    expect(synced[0]?.employeeIds).toEqual(["emp-1"]);

    const day = dateFromScheduleDayKey(getEventDayKey(synced[0]!.start));
    expect(getEventPositionForDay(synced[0]!, day)).not.toBeNull();
  });

  it("shows job on the new employee row after apply-all merge", () => {
    const existing = job();
    const moved = mergeScheduleJobForUpdate(
      existing,
      { ...existing, employeeIds: ["emp-2"], employeeNames: ["Bob"] },
      "apply-all"
    );

    expect(moved.employeeIds).toEqual(["emp-2"]);
    expect(moved.id).toBe(existing.id);
  });

  it("uses Quebec day keys consistently for calendar columns", () => {
    const dayKey = "2026-08-11";
    const navigated = dateFromScheduleDayKey(dayKey);
    expect(calendarDayKey(navigated)).toBe(dayKey);
  });
});

describe("saveScheduleJobAction update semantics", () => {
  it("preserves record id when applying a full form update patch", () => {
    const existing = job({ id: "550e8400-e29b-41d4-a716-446655440000" });
    const formPayload = mergeScheduleJobForUpdate(
      existing,
      {
        ...existing,
        title: "Updated title",
        start: localDateTimeToISO("2026-08-12", "10:00"),
        end: localDateTimeToISO("2026-08-12", "12:00"),
        employeeIds: ["emp-2"],
        employeeNames: ["Bob"],
      },
      "apply-all"
    );

    expect(formPayload.id).toBe(existing.id);
    expect(formPayload.title).toBe("Updated title");
    expect(getEventDayKey(formPayload.start)).toBe("2026-08-12");
  });
});
