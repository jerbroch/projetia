"use client";

import { useMemo, useRef } from "react";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, Phone, User } from "lucide-react";
import type { Employee, ScheduleEvent } from "@/types";
import { getEmployeeFullName, getEmployeeInitials } from "@/lib/employee-utils";
import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  HOUR_WIDTH,
  LEFT_COLUMN_WIDTH,
  ROW_HEIGHT,
  metriquesDeLigne,
  clampMinutes,
  getDayTimelineWidth,
  getEventDayKey,
  getEventPositionForDay,
  getEventPositionForWeek,
  getHourMarkers,
  getTimelineWidth,
  getWeekDayIndexFromPx,
  layoutOverlappingEvents,
  pxToMinutes,
  pxToMinutesInWeek,
  type CalendarView,
  type PlacedEvent,
} from "@/lib/calendar-utils";
import { CalendarJobBlock } from "@/components/schedule/calendar-job-block";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filterScheduleCalendarEvents } from "@/lib/schedule-utils";
import { calendarDayKey } from "@/lib/schedule-timezone";
import { cn } from "@/lib/utils";
import { gaucheEnPixels } from "@/lib/calendar-drag-preview";

export interface ScheduleFilters {
  workerId: string;
  trade: string;
  truck: string;
}

interface ResourceCalendarProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  employees: Employee[];
  events: ScheduleEvent[];
  filters: ScheduleFilters;
  onFiltersChange: (filters: ScheduleFilters) => void;
  onSlotClick: (employeeId: string | null, date: Date, startMinutes: number) => void;
  onEventClick: (event: ScheduleEvent) => void;
  onEventMove: (
    event: ScheduleEvent,
    sourceEmployeeId: string | null,
    targetEmployeeId: string | null,
    startMinutes: number,
    day: Date
  ) => void;
  onEventResizeStart: (event: ScheduleEvent, startMinutes: number, day: Date) => void;
  onEventResize: (event: ScheduleEvent, endMinutes: number, day: Date) => void;
  onEmployeeProfile: (employee: Employee) => void;
}

const UNASSIGNED_ID = "__unassigned__";

export function ResourceCalendar({
  view,
  onViewChange,
  currentDate,
  onDateChange,
  employees,
  events,
  filters,
  onFiltersChange,
  onSlotClick,
  onEventClick,
  onEventMove,
  onEventResizeStart,
  onEventResize,
  onEmployeeProfile,
}: ResourceCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate), i)),
    [currentDate]
  );

  const trades = useMemo(() => [...new Set(employees.map((e) => e.trade))].sort(), [employees]);
  const trucks = useMemo(() => [...new Set(employees.map((e) => e.truckNumber).filter(Boolean))].sort(), [employees]);

  const filteredEmployees = employees.filter((employee) => {
    if (filters.workerId !== "all" && employee.id !== filters.workerId) return false;
    if (filters.trade !== "all" && employee.trade !== filters.trade) return false;
    if (filters.truck !== "all" && employee.truckNumber !== filters.truck) return false;
    return true;
  });

  const filteredEvents = filterScheduleCalendarEvents(events, filters, employees);

  const visibleDays = view === "day" ? [currentDate] : weekDays;
  const timelineWidth = getTimelineWidth(view);
  const dayWidth = getDayTimelineWidth();

  function eventsForRow(employeeId: string | null) {
    return filteredEvents.filter((event) => {
      const inRange = visibleDays.some(
        (day) => getEventDayKey(event.start) === calendarDayKey(day)
      );
      if (!inRange) return false;
      if (employeeId === null) return event.employeeIds.length === 0;
      return event.employeeIds.includes(employeeId);
    });
  }

  function getPlacedEvents(employeeId: string | null): { items: PlacedEvent[]; laneCount: number; rowHeight: number } {
    const rowEvents = eventsForRow(employeeId);
    const placed: PlacedEvent[] = [];

    rowEvents.forEach((event) => {
      if (view === "day") {
        const pos = getEventPositionForDay(event, currentDate);
        if (pos) placed.push({ event, lane: 0, ...pos });
      } else {
        const pos = getEventPositionForWeek(event, weekDays);
        if (pos) placed.push({ event, lane: 0, ...pos });
      }
    });

    const layout = layoutOverlappingEvents(placed);
    return {
      ...layout,
      rowHeight: metriquesDeLigne(layout.laneCount).rowHeight,
    };
  }

  function navigateBack() {
    onDateChange(view === "day" ? subDays(currentDate, 1) : subWeeks(currentDate, 1));
  }

  function navigateForward() {
    onDateChange(view === "day" ? addDays(currentDate, 1) : addWeeks(currentDate, 1));
  }

  function getTimelineX(clientX: number): number {
    const scroll = scrollRef.current;
    if (!scroll) return 0;
    const rect = scroll.getBoundingClientRect();
    return clientX - rect.left - LEFT_COLUMN_WIDTH + scroll.scrollLeft;
  }

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>, employeeId: string | null) {
    const x = getTimelineX(e.clientX);
    let startMinutes: number;
    if (view === "week") {
      const dayIndex = getWeekDayIndexFromPx(x);
      startMinutes = pxToMinutesInWeek(x, dayIndex);
      onSlotClick(employeeId, weekDays[dayIndex], startMinutes);
      return;
    }
    startMinutes = pxToMinutes(x);
    onSlotClick(employeeId, currentDate, startMinutes);
  }

  function getMinutesFromClientX(clientX: number): number {
    const x = getTimelineX(clientX);
    if (view === "week") {
      const dayIndex = getWeekDayIndexFromPx(x);
      return pxToMinutesInWeek(x, dayIndex);
    }
    return pxToMinutes(x);
  }

  /**
   * Position gauche du bloc s'il était déposé sous ce curseur.
   *
   * Calculée à partir des minutes ARRONDIES, comme l'enregistrement : rendre
   * la position brute du curseur ferait glisser le bloc en continu puis sauter
   * au quart d'heure le plus proche au relâchement.
   */
  function getLeftFromClientX(clientX: number): number {
    const x = getTimelineX(clientX);
    if (view === "week") {
      const dayIndex = getWeekDayIndexFromPx(x);
      const minutes = clampMinutes(pxToMinutesInWeek(x, dayIndex));
      return dayIndex * getDayTimelineWidth() + gaucheEnPixels(minutes);
    }
    return gaucheEnPixels(clampMinutes(pxToMinutes(x)));
  }

  function getEmployeeIdFromClientY(clientY: number): string | null {
    for (const [id, el] of rowRefs.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return id === UNASSIGNED_ID ? null : id;
      }
    }
    return null;
  }

  function getDayFromClientX(clientX: number): Date {
    const x = getTimelineX(clientX);
    if (view === "week") return weekDays[getWeekDayIndexFromPx(x)] ?? currentDate;
    return currentDate;
  }

  const rows: { id: string | null; label: string; employee?: Employee }[] = [
    { id: null, label: "Non assignés" },
    ...filteredEmployees.map((employee) => ({ id: employee.id, label: getEmployeeFullName(employee), employee })),
  ];

  return (
    <Card className="max-w-full overflow-hidden">
      <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigateBack}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => onDateChange(new Date())}>Aujourd&apos;hui</Button>
          <Button variant="outline" size="icon" onClick={navigateForward}><ChevronRight className="h-4 w-4" /></Button>
          <h2 className="min-w-[180px] text-lg font-semibold">
            {view === "day" ? format(currentDate, "EEEE d MMMM yyyy", { locale: undefined }) : `Semaine du ${format(weekDays[0], "d MMM")} au ${format(weekDays[6], "d MMM yyyy")}`}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "day" ? "default" : "outline"} size="sm" onClick={() => onViewChange("day")}>Jour</Button>
          <Button variant={view === "week" ? "default" : "outline"} size="sm" onClick={() => onViewChange("week")}>Semaine</Button>
        </div>
      </div>

      <div className="grid gap-3 border-b p-4 md:grid-cols-3">
        <Select value={filters.workerId} onValueChange={(v) => onFiltersChange({ ...filters, workerId: v })}>
          <SelectTrigger><SelectValue placeholder="Employé" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les employés</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>{getEmployeeFullName(e)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.trade} onValueChange={(v) => onFiltersChange({ ...filters, trade: v })}>
          <SelectTrigger><SelectValue placeholder="Métier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les métiers</SelectItem>
            {trades.map((trade) => <SelectItem key={trade} value={trade}>{trade}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.truck} onValueChange={(v) => onFiltersChange({ ...filters, truck: v })}>
          <SelectTrigger><SelectValue placeholder="Camion" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les camions</SelectItem>
            {trucks.map((truck) => <SelectItem key={truck} value={truck}>{truck}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <CardContent className="p-0">
        <div ref={scrollRef} className="max-w-full overflow-x-auto overflow-y-auto">
          <div className="min-w-[720px]">
            <div className="flex border-b bg-muted/30">
              <div
                className="sticky left-0 z-20 shrink-0 border-r bg-background px-3 py-2 text-xs font-medium text-muted-foreground"
                style={{ width: LEFT_COLUMN_WIDTH }}
              >
                Employé
              </div>
              <div className="relative" style={{ width: timelineWidth, minWidth: timelineWidth }}>
                {view === "week" && weekDays.map((day, index) => (
                  <div
                    key={day.toISOString()}
                    className="absolute top-0 border-r border-border/60 bg-muted/20 px-2 py-2 text-xs font-semibold"
                    style={{ left: index * dayWidth, width: dayWidth, height: "100%" }}
                  >
                    {format(day, "EEE d")}
                  </div>
                ))}
                <div className="relative h-10">
                  {getHourMarkers(view, weekDays).map((marker) => (
                    <div
                      key={`${marker.label}-${marker.left}`}
                      className="absolute top-6 text-[10px] text-muted-foreground"
                      style={{ left: marker.left + 4 }}
                    >
                      {marker.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {rows.map((row) => {
              const rowKey = row.id ?? UNASSIGNED_ID;
              const { items, laneCount, rowHeight } = getPlacedEvents(row.id);
              return (
                <div key={rowKey} className="flex border-b">
                  <div
                    className={cn(
                      "sticky left-0 z-20 shrink-0 border-r bg-background px-2 py-1.5",
                      row.id === null && "bg-amber-50/80 dark:bg-amber-950/20"
                    )}
                    style={{ width: LEFT_COLUMN_WIDTH, height: rowHeight }}
                  >
                    {row.employee ? (
                      <div className="flex h-full items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          {row.employee.profilePhoto ? (
                            <AvatarImage src={row.employee.profilePhoto} alt={row.label} />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                            {getEmployeeInitials(row.employee)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-semibold">{row.label}</p>
                            <StatusBadge status={row.employee.status} />
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {[
                              row.employee.trade,
                              row.employee.truckNumber ? `Camion ${row.employee.truckNumber}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-0.5">
                          {row.employee.mobilePhone && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                              <a href={`tel:${row.employee.mobilePhone}`} aria-label="Call">
                                <Phone className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onEmployeeProfile(row.employee!)}
                            aria-label="Profile"
                          >
                            <User className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Non assignés</p>
                        <p className="text-xs text-muted-foreground">Travaux en attente d&apos;assignation</p>
                      </div>
                    )}
                  </div>

                  <div
                    ref={(el) => {
                      if (el) rowRefs.current.set(rowKey, el);
                    }}
                    data-timeline-body="true"
                    className="relative bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px)] [background-size:64px_100%]"
                    style={{ width: timelineWidth, minWidth: timelineWidth, minHeight: rowHeight }}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("[data-event-id]")) return;
                      handleTimelineClick(e, row.id);
                    }}
                  >
                    {view === "week" &&
                      weekDays.map((day, index) => (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "absolute inset-y-0 border-r border-border/40",
                            isSameDay(day, new Date()) && "bg-primary/5"
                          )}
                          style={{ left: index * dayWidth, width: dayWidth }}
                        />
                      ))}

                    {Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute inset-y-0 border-r border-border/20"
                        style={{ left: (view === "week" ? 0 : 0) + i * HOUR_WIDTH }}
                      />
                    ))}

                    {items.map(({ event, left, width, lane }) => (
                      <CalendarJobBlock
                        key={`${rowKey}-${event.id}`}
                        event={event}
                        left={left}
                        width={width}
                        lane={lane}
                        laneCount={laneCount}
                        rowEmployeeId={row.id}
                        onClick={onEventClick}
                        onMove={(evt, source, target, startMinutes, clientX) => {
                          onEventMove(evt, source, target, startMinutes, getDayFromClientX(clientX));
                        }}
                        onResize={(evt, endMinutes) => {
                          const day = parseISO(evt.start);
                          onEventResize(evt, endMinutes, day);
                        }}
                        onResizeStart={(evt, startMinutes) => {
                          const day = parseISO(evt.start);
                          onEventResizeStart(evt, startMinutes, day);
                        }}
                        getMinutesFromClientX={getMinutesFromClientX}
                        getLeftFromClientX={getLeftFromClientX}
                        getEmployeeIdFromClientY={getEmployeeIdFromClientY}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
