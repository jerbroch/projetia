"use client";

import { useRef } from "react";
import type { ScheduleEvent } from "@/types";
import { isoToLocalDateTime, isoToZonedMinutes } from "@/lib/schedule-timezone";
import { getScheduleBlockAppearance } from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";
import {
  HOUR_WIDTH,
  clampMinutes,
  snapMinutes,
} from "@/lib/calendar-utils";

interface CalendarJobBlockProps {
  event: ScheduleEvent;
  left: number;
  width: number;
  lane: number;
  laneCount: number;
  rowEmployeeId: string | null;
  onClick: (event: ScheduleEvent) => void;
  onMove: (event: ScheduleEvent, sourceEmployeeId: string | null, targetEmployeeId: string | null, startMinutes: number, clientX: number) => void;
  onResize: (event: ScheduleEvent, endMinutes: number) => void;
  getMinutesFromClientX: (clientX: number) => number;
  getEmployeeIdFromClientY: (clientY: number) => string | null;
}

export function CalendarJobBlock({
  event,
  left,
  width,
  lane,
  laneCount,
  rowEmployeeId,
  onClick,
  onMove,
  onResize,
  getMinutesFromClientX,
  getEmployeeIdFromClientY,
}: CalendarJobBlockProps) {
  const interaction = useRef<{ mode: "move" | "resize"; startX: number; startMinutes: number; endMinutes: number; moved: boolean } | null>(null);
  const appearance = getScheduleBlockAppearance(event.status);

  const laneHeight = Math.max(28, Math.floor(64 / laneCount));
  const top = 8 + lane * laneHeight;

  function beginMove(e: React.PointerEvent) {
    if ((e.target as HTMLElement).dataset.handle === "resize") return;
    e.stopPropagation();
    const startMinutes = isoToZonedMinutes(event.start);
    const endMinutes = isoToZonedMinutes(event.end);
    interaction.current = { mode: "move", startX: e.clientX, startMinutes, endMinutes, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function beginResize(e: React.PointerEvent) {
    e.stopPropagation();
    const startMinutes = isoToZonedMinutes(event.start);
    const endMinutes = isoToZonedMinutes(event.end);
    interaction.current = { mode: "resize", startX: e.clientX, startMinutes, endMinutes, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!interaction.current) return;
    if (Math.abs(e.clientX - interaction.current.startX) > 4) {
      interaction.current.moved = true;
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!interaction.current) return;
    const state = interaction.current;
    interaction.current = null;

    if (!state.moved && state.mode === "move") {
      onClick(event);
      return;
    }

    if (state.mode === "resize") {
      const deltaMinutes = snapMinutes(((e.clientX - state.startX) / HOUR_WIDTH) * 60);
      onResize(event, clampMinutes(state.endMinutes + deltaMinutes));
      return;
    }

    const newStartMinutes = clampMinutes(getMinutesFromClientX(e.clientX));
    const targetEmployeeId = getEmployeeIdFromClientY(e.clientY);
    onMove(event, rowEmployeeId, targetEmployeeId, newStartMinutes, e.clientX);
  }

  return (
    <div
      data-event-id={event.id}
      className={cn(
        "absolute z-10 overflow-hidden rounded-md border px-2 py-1 shadow-sm transition-shadow hover:shadow-md cursor-grab active:cursor-grabbing",
        appearance.className
      )}
      style={{ left, width, top, height: laneHeight }}
      onPointerDown={beginMove}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="pointer-events-none space-y-0.5">
        {event.jobNumber && (
          <p className="truncate text-[10px] font-bold opacity-95">{event.jobNumber}</p>
        )}
        <p className="truncate text-[11px] font-semibold leading-tight">{event.title}</p>
        <p className="truncate text-[10px] opacity-90">{event.customerName}</p>
        <p className="hidden truncate text-[10px] opacity-80 sm:block">{event.jobSiteAddress ?? event.location}</p>
        <p className="text-[10px] opacity-80">
          {isoToLocalDateTime(event.start).time} – {isoToLocalDateTime(event.end).time}
        </p>
      </div>
      <div
        data-handle="resize"
        className="absolute bottom-0 right-0 top-0 w-2 cursor-ew-resize bg-black/10"
        onPointerDown={beginResize}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
}
