"use client";

import type { ScheduleEvent } from "@/types";

const STORAGE_KEY = "constructionios_demo_schedule_events";

function readStore(): ScheduleEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScheduleEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(events: ScheduleEvent[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export function getDemoScheduleEvents(): ScheduleEvent[] {
  return readStore();
}

export function upsertDemoScheduleEvent(event: ScheduleEvent): void {
  const events = readStore();
  const index = events.findIndex((e) => e.id === event.id);
  if (index >= 0) {
    events[index] = event;
  } else {
    events.push(event);
  }
  writeStore(events);
}

export function mergeDemoScheduleEvents(baseEvents: ScheduleEvent[]): ScheduleEvent[] {
  const demoEvents = getDemoScheduleEvents();
  if (demoEvents.length === 0) return baseEvents;

  const merged = [...baseEvents];
  for (const event of demoEvents) {
    const index = merged.findIndex((e) => e.id === event.id);
    if (index >= 0) {
      merged[index] = event;
    } else {
      merged.push(event);
    }
  }
  return merged;
}
