import { parseISO } from "date-fns";

/** Quebec business timezone — planned schedule hours are always interpreted here. */
export const SCHEDULE_TIMEZONE = "America/Montreal";

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function getZonedParts(date: Date, timeZone: string = SCHEDULE_TIMEZONE): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

export function formatZonedDate(parts: ZonedParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function formatZonedTime(parts: ZonedParts): string {
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** Convert a Quebec-local date+time to UTC ISO for timestamptz storage. */
export function localDateTimeToISO(
  date: string,
  time: string,
  timeZone: string = SCHEDULE_TIMEZONE
): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  if (
    [year, month, day, hour, minute].some((value) => Number.isNaN(value)) ||
    time.split(":").length < 2
  ) {
    return `${date}T${time}:00`;
  }

  let timestamp = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let attempt = 0; attempt < 6; attempt++) {
    const probe = new Date(timestamp);
    const zoned = getZonedParts(probe, timeZone);

    if (
      zoned.year === year &&
      zoned.month === month &&
      zoned.day === day &&
      zoned.hour === hour &&
      zoned.minute === minute
    ) {
      return probe.toISOString();
    }

    const targetMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const actualMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, 0);
    timestamp += targetMs - actualMs;
  }

  return new Date(timestamp).toISOString();
}

/** Read a stored timestamptz as Quebec-local date and time for forms. */
export function isoToLocalDateTime(
  iso: string,
  timeZone: string = SCHEDULE_TIMEZONE
): { date: string; time: string } {
  const parsed = parseISO(iso);
  if (Number.isNaN(parsed.getTime())) {
    return { date: "", time: "" };
  }

  const parts = getZonedParts(parsed, timeZone);
  return {
    date: formatZonedDate(parts),
    time: formatZonedTime(parts),
  };
}

/** Calendar placement — minutes since midnight in Quebec local time. */
export function isoToZonedMinutes(iso: string, timeZone: string = SCHEDULE_TIMEZONE): number {
  const parsed = parseISO(iso);
  if (Number.isNaN(parsed.getTime())) return 0;
  const parts = getZonedParts(parsed, timeZone);
  return parts.hour * 60 + parts.minute;
}

/** Calendar day column — yyyy-MM-dd in Quebec local time. */
export function isoToZonedDateKey(iso: string, timeZone: string = SCHEDULE_TIMEZONE): string {
  const parsed = parseISO(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return formatZonedDate(getZonedParts(parsed, timeZone));
}

/** Calendar navigation column — Quebec business day for a Date value. */
export function calendarDayKey(date: Date, timeZone: string = SCHEDULE_TIMEZONE): string {
  return formatZonedDate(getZonedParts(date, timeZone));
}

/** Stable Date for calendar navigation to a Quebec schedule day. */
export function dateFromScheduleDayKey(dayKey: string, timeZone: string = SCHEDULE_TIMEZONE): Date {
  return new Date(localDateTimeToISO(dayKey, "12:00", timeZone));
}
