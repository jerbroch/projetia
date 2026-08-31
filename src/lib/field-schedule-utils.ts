import {
  addDays,
  endOfDay,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { frCA } from "date-fns/locale";
import type { ScheduleEvent } from "@/types";

export type FieldScheduleView = "today" | "tomorrow" | "week" | "upcoming";

export function sortJobsChronologically(events: ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort((a, b) => a.start.localeCompare(b.start));
}

export function filterJobsByFieldView(
  events: ScheduleEvent[],
  view: FieldScheduleView,
  now: Date = new Date()
): ScheduleEvent[] {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  return events.filter((event) => {
    const start = parseISO(event.start);
    if (Number.isNaN(start.getTime())) return false;

    switch (view) {
      case "today":
        return isWithinInterval(start, { start: todayStart, end: todayEnd });
      case "tomorrow":
        return isWithinInterval(start, { start: tomorrowStart, end: tomorrowEnd });
      case "week":
        return isWithinInterval(start, { start: weekStart, end: weekEnd });
      case "upcoming":
        return start >= todayStart;
      default:
        return true;
    }
  });
}

export function formatFieldJobTime(startIso: string, endIso: string): string {
  const start = parseISO(startIso);
  const end = parseISO(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  return `${format(start, "HH:mm", { locale: frCA })} – ${format(end, "HH:mm", { locale: frCA })}`;
}

export function formatFieldJobDate(iso: string): string {
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "EEE d MMM", { locale: frCA });
}

export const FIELD_SCHEDULE_VIEW_LABELS: Record<FieldScheduleView, string> = {
  today: "Aujourd'hui",
  tomorrow: "Demain",
  week: "Cette semaine",
  upcoming: "Prochains calls",
};
