import { describe, expect, it } from "vitest";
import {
  buildDateTime,
  splitDateTime,
} from "@/lib/schedule-utils";
import {
  isoToLocalDateTime,
  isoToZonedDateKey,
  isoToZonedMinutes,
  localDateTimeToISO,
  calendarDayKey,
  dateFromScheduleDayKey,
  SCHEDULE_TIMEZONE,
} from "@/lib/schedule-timezone";

describe("schedule timezone (America/Montreal)", () => {
  it("stores 08:00 Quebec time as UTC and reads it back as 08:00", () => {
    const stored = localDateTimeToISO("2026-08-11", "08:00");
    expect(stored).toMatch(/Z$/);

    const { date, time } = isoToLocalDateTime(stored);
    expect(date).toBe("2026-08-11");
    expect(time).toBe("08:00");
  });

  it("round-trips 13:30→16:00 through buildDateTime and splitDateTime", () => {
    const start = buildDateTime("2026-08-11", "13:30");
    const end = buildDateTime("2026-08-11", "16:00");

    expect(splitDateTime(start)).toEqual({ date: "2026-08-11", time: "13:30" });
    expect(splitDateTime(end)).toEqual({ date: "2026-08-11", time: "16:00" });
  });

  it("maps stored UTC to Quebec calendar minutes and day key", () => {
    const iso = localDateTimeToISO("2026-02-10", "08:00");
    expect(isoToZonedMinutes(iso)).toBe(8 * 60);
    expect(isoToZonedDateKey(iso)).toBe("2026-02-10");
  });

  it("handles EST winter offset (UTC-5)", () => {
    const stored = localDateTimeToISO("2026-01-15", "09:00");
    expect(stored).toBe("2026-01-15T14:00:00.000Z");
    expect(isoToLocalDateTime(stored).time).toBe("09:00");
  });

  it("handles EDT summer offset (UTC-4)", () => {
    const stored = localDateTimeToISO("2026-07-15", "09:00");
    expect(stored).toBe("2026-07-15T13:00:00.000Z");
    expect(isoToLocalDateTime(stored).time).toBe("09:00");
  });

  it("uses America/Montreal as the schedule timezone constant", () => {
    expect(SCHEDULE_TIMEZONE).toBe("America/Montreal");
  });

  it("calendarDayKey and dateFromScheduleDayKey round-trip a Quebec business day", () => {
    const dayKey = "2026-08-11";
    const navigated = dateFromScheduleDayKey(dayKey);
    expect(calendarDayKey(navigated)).toBe(dayKey);
  });
});
