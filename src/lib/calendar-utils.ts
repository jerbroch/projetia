import {
  addMinutes,
  differenceInMinutes,
  format,
  parseISO,
  setHours,
} from "date-fns";
import {
  calendarDayKey,
  isoToZonedDateKey,
  isoToZonedMinutes,
  localDateTimeToISO,
} from "@/lib/schedule-timezone";
import type { ScheduleEvent } from "@/types";

export const CALENDAR_START_HOUR = 6;
export const CALENDAR_END_HOUR = 20;
export const HOUR_WIDTH = 64;
export const ROW_HEIGHT = 80;
export const LEFT_COLUMN_WIDTH = 240;
export const MIN_JOB_MINUTES = 30;
export const SNAP_MINUTES = 15;

export type CalendarView = "day" | "week";

export function getTimelineWidth(view: CalendarView): number {
  if (view === "day") {
    return (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_WIDTH;
  }
  return 7 * (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_WIDTH;
}

export function getDayTimelineWidth(): number {
  return (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_WIDTH;
}

export function timeToMinutes(iso: string): number {
  return isoToZonedMinutes(iso);
}

export function minutesToTimeLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${mins.toString().padStart(2, "0")} ${period}`;
}

export function minutesToTimeValue(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

export function clampMinutes(minutes: number): number {
  const min = CALENDAR_START_HOUR * 60;
  const max = CALENDAR_END_HOUR * 60;
  return Math.max(min, Math.min(max, minutes));
}

export function getEventDurationMinutes(event: ScheduleEvent): number {
  return Math.max(MIN_JOB_MINUTES, differenceInMinutes(parseISO(event.end), parseISO(event.start)));
}

export function getEventDayKey(iso: string): string {
  return isoToZonedDateKey(iso);
}

export function buildIsoFromDayAndMinutes(day: Date, minutes: number): string {
  const date = calendarDayKey(day);
  const time = minutesToTimeValue(minutes);
  return localDateTimeToISO(date, time);
}

export function getEventPositionForDay(event: ScheduleEvent, day: Date): { left: number; width: number } | null {
  const eventDay = getEventDayKey(event.start);
  const targetDay = calendarDayKey(day);
  if (eventDay !== targetDay) return null;

  const startMinutes = timeToMinutes(event.start);
  const endMinutes = timeToMinutes(event.end);
  const left = ((startMinutes - CALENDAR_START_HOUR * 60) / 60) * HOUR_WIDTH;
  const width = ((endMinutes - startMinutes) / 60) * HOUR_WIDTH;
  return { left: Math.max(0, left), width: Math.max(HOUR_WIDTH / 2, width) };
}

export function getEventPositionForWeek(event: ScheduleEvent, weekDays: Date[]): { left: number; width: number } | null {
  const eventDayKey = getEventDayKey(event.start);
  const dayIndex = weekDays.findIndex((day) => calendarDayKey(day) === eventDayKey);
  if (dayIndex === -1) return null;

  const dayWidth = getDayTimelineWidth();
  const dayOffset = dayIndex * dayWidth;
  const startMinutes = timeToMinutes(event.start);
  const endMinutes = timeToMinutes(event.end);
  const left = dayOffset + ((startMinutes - CALENDAR_START_HOUR * 60) / 60) * HOUR_WIDTH;
  const width = ((endMinutes - startMinutes) / 60) * HOUR_WIDTH;
  return { left: Math.max(dayOffset, left), width: Math.max(HOUR_WIDTH / 2, width) };
}

export interface PlacedEvent {
  event: ScheduleEvent;
  lane: number;
  left: number;
  width: number;
}

export function layoutOverlappingEvents(items: PlacedEvent[]): { items: PlacedEvent[]; laneCount: number } {
  const sorted = [...items].sort((a, b) => a.left - b.left || b.width - a.width);
  const lanes: { end: number }[] = [];

  const placed = sorted.map((item) => {
    let lane = lanes.findIndex((entry) => entry.end <= item.left);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push({ end: item.left + item.width });
    } else {
      lanes[lane].end = item.left + item.width;
    }
    return { ...item, lane };
  });

  return { items: placed, laneCount: Math.max(1, lanes.length) };
}

export function pxToMinutes(px: number): number {
  return snapMinutes(CALENDAR_START_HOUR * 60 + (px / HOUR_WIDTH) * 60);
}

export function pxToMinutesInWeek(px: number, dayIndex: number): number {
  const dayWidth = getDayTimelineWidth();
  const dayOffset = dayIndex * dayWidth;
  const localPx = px - dayOffset;
  return pxToMinutes(localPx);
}

export function getWeekDayIndexFromPx(px: number): number {
  const dayWidth = getDayTimelineWidth();
  return Math.max(0, Math.min(6, Math.floor(px / dayWidth)));
}

export function updateEventTiming(event: ScheduleEvent, startMinutes: number, endMinutes: number, day: Date): ScheduleEvent {
  const duration = Math.max(MIN_JOB_MINUTES, endMinutes - startMinutes);
  const clampedStart = clampMinutes(startMinutes);
  const clampedEnd = clampMinutes(clampedStart + duration);
  return {
    ...event,
    start: buildIsoFromDayAndMinutes(day, clampedStart),
    end: buildIsoFromDayAndMinutes(day, clampedEnd),
  };
}

export function resizeEventEnd(event: ScheduleEvent, endMinutes: number, day: Date): ScheduleEvent {
  const startMinutes = timeToMinutes(event.start);
  const clampedEnd = clampMinutes(Math.max(startMinutes + MIN_JOB_MINUTES, endMinutes));
  return {
    ...event,
    end: buildIsoFromDayAndMinutes(day, clampedEnd),
  };
}

export function reassignEventWorker(
  event: ScheduleEvent,
  sourceEmployeeId: string | null,
  targetEmployeeId: string | null
): ScheduleEvent {
  let employeeIds = [...event.employeeIds];

  if (sourceEmployeeId) {
    employeeIds = employeeIds.filter((id) => id !== sourceEmployeeId);
  }

  if (targetEmployeeId && !employeeIds.includes(targetEmployeeId)) {
    employeeIds.push(targetEmployeeId);
  }

  return { ...event, employeeIds };
}

export function getHourMarkers(view: CalendarView, weekDays: Date[]): { label: string; left: number }[] {
  const markers: { label: string; left: number }[] = [];

  if (view === "day") {
    for (let hour = CALENDAR_START_HOUR; hour <= CALENDAR_END_HOUR; hour++) {
      markers.push({
        label: format(setHours(new Date(), hour), "ha"),
        left: (hour - CALENDAR_START_HOUR) * HOUR_WIDTH,
      });
    }
    return markers;
  }

  weekDays.forEach((day, dayIndex) => {
    const dayOffset = dayIndex * getDayTimelineWidth();
    markers.push({
      label: format(day, "EEE d"),
      left: dayOffset,
    });
    for (let hour = CALENDAR_START_HOUR; hour < CALENDAR_END_HOUR; hour += 4) {
      markers.push({
        label: format(setHours(day, hour), "ha"),
        left: dayOffset + (hour - CALENDAR_START_HOUR) * HOUR_WIDTH,
      });
    }
  });

  return markers;
}

export function moveEventToWeekDay(event: ScheduleEvent, weekDays: Date[], dayIndex: number, startMinutes: number): ScheduleEvent {
  const duration = getEventDurationMinutes(event);
  const day = weekDays[dayIndex];
  const clampedStart = clampMinutes(startMinutes);
  const clampedEnd = clampMinutes(clampedStart + duration);
  return {
    ...event,
    start: buildIsoFromDayAndMinutes(day, clampedStart),
    end: buildIsoFromDayAndMinutes(day, clampedEnd),
  };
}

export function addMinutesToIso(iso: string, minutes: number): string {
  return format(addMinutes(parseISO(iso), minutes), "yyyy-MM-dd'T'HH:mm:ss");
}
