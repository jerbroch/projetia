"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addWeeks,
  format,
  parseISO,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Phone, User } from "lucide-react";
import type { Employee, ScheduleEvent } from "@/types";
import { getEmployeeFullName, getEmployeeInitials } from "@/lib/employee-utils";
import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  HOUR_WIDTH,
  LEFT_COLUMN_WIDTH,
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
  LIGNE_PADDING,
} from "@/lib/calendar-utils";
import { CalendarJobBlock } from "@/components/schedule/calendar-job-block";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VueSemaine } from "@/components/schedule/vue-semaine";
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
import { BlocBrouillon } from "@/components/schedule/bloc-brouillon";
import {
  brouillonDepuisGlissement,
  creerBrouillon,
  glissementSignificatif,
} from "@/lib/calendar-brouillon";
import type { ApercuPlage } from "@/lib/calendar-drag-preview";

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
  /**
   * Création directe depuis le rectangle, sans ouvrir le formulaire.
   * `onSlotClick` reste le chemin « Détails… », pour qui en a besoin.
   */
  onBrouillonConfirm: (
    employeeId: string | null,
    date: Date,
    startMinutes: number,
    endMinutes: number,
  ) => void;
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
  onBrouillonConfirm,
  onEventClick,
  onEventMove,
  onEventResizeStart,
  onEventResize,
  onEmployeeProfile,
}: ResourceCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const weekDays = useMemo(
    () =>
      // LUNDI, comme partout ailleurs. `startOfWeek` sans option commence le
      // dimanche : l'employeur voyait donc « la semaine du 13 » quand son
      // employé, dont /terrain utilise déjà `weekStartsOn: 1`, voyait « la
      // semaine du 14 ». Deux personnes qui ne parlent pas de la même semaine.
      Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i)),
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

  // Le rectangle posé au premier contact, avant tout formulaire.
  const [brouillon, setBrouillon] = useState<{
    employeeId: string | null;
    day: Date;
    dayIndex: number;
    plage: ApercuPlage;
  } | null>(null);

  /*
   * LE TRACÉ EN COURS : on appuie sur une case vide, on tire, on relâche.
   *
   * L'ancre reste dans une référence et non dans l'état : elle est lue à
   * chaque mouvement du pointeur, et la faire passer par un rendu ferait
   * traîner le rectangle derrière le curseur.
   */
  const trace = useRef<{ employeeId: string | null; ancre: number; pointerId: number } | null>(null);
  const [enTrace, setEnTrace] = useState(false);
  /*
   * LE CLIC QUI SUIT UN GLISSEMENT NE COMPTE PAS.
   *
   * Relâcher la souris après avoir tracé déclenche aussi un `click` sur la
   * ligne. Ce clic arrivait alors que le tracé était déjà terminé, et la
   * ligne le lisait comme « on clique à côté » : la plage qu'on venait de
   * tirer disparaissait à l'instant où on la lâchait. On marque donc le
   * glissement, et le premier clic qui suit est consommé sans rien faire.
   */
  const vientDeTracer = useRef(false);

  /*
   * ÉCHAP ET CLIC AU-DEHORS ANNULENT.
   *
   * Le clic au-dehors est écouté en phase de CAPTURE : autrement, un clic sur
   * un bouton de la page déclencherait son action avant qu'on ait pu effacer
   * la sélection, et le rectangle survivrait à l'écran qu'on vient de quitter.
   * Les clics venus du rectangle lui-même sont exclus — il a ses propres
   * boutons.
   */
  useEffect(() => {
    if (!brouillon) return;
    function surClicAilleurs(e: MouseEvent) {
      const cible = e.target as HTMLElement | null;
      if (cible?.closest('[data-testid="bloc-brouillon"]')) return;
      if (cible?.closest("[data-timeline-body]")) return; // la grille gère elle-même
      setBrouillon(null);
    }
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") setBrouillon(null);
    }
    document.addEventListener("mousedown", surClicAilleurs, true);
    document.addEventListener("keydown", surEchap);
    return () => {
      document.removeEventListener("mousedown", surClicAilleurs, true);
      document.removeEventListener("keydown", surEchap);
    };
  }, [brouillon]);

  const visibleDays = view === "day" ? [currentDate] : weekDays;
  const timelineWidth = getTimelineWidth(view);

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
    /*
     * UNE SÉLECTION OUVERTE SE FERME AVANT QU'ON EN OUVRE UNE AUTRE.
     *
     * Sans cela, « annuler en cliquant à côté » serait invisible : la
     * sélection disparaîtrait et une autre apparaîtrait dans le même geste.
     * Un clic referme, le suivant trace.
     */
    if (brouillon) {
      setBrouillon(null);
      return;
    }
    const x = getTimelineX(e.clientX);
    if (view === "week") {
      const dayIndex = getWeekDayIndexFromPx(x);
      setBrouillon({
        employeeId,
        day: weekDays[dayIndex],
        dayIndex,
        plage: creerBrouillon(pxToMinutesInWeek(x, dayIndex)),
      });
      return;
    }
    setBrouillon({
      employeeId,
      day: currentDate,
      dayIndex: 0,
      plage: creerBrouillon(pxToMinutes(x)),
    });
  }

  /**
   * Le tracé d'une plage à la souris ou au stylet.
   *
   * PAS AU DOIGT, ET C'EST VOLONTAIRE : capter le pointeur tactile sur la
   * ligne confisquerait le défilement horizontal du calendrier, qui est le
   * geste principal sur téléphone. Au doigt, on touche pour poser une plage
   * de deux heures, puis on l'étire par ses poignées — larges de 24 px.
   */
  function debutTrace(e: React.PointerEvent<HTMLDivElement>, employeeId: string | null) {
    if (e.pointerType === "touch") return;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-event-id]")) return;
    if ((e.target as HTMLElement).closest('[data-testid="bloc-brouillon"]')) return;

    const ancre = getMinutesFromClientX(e.clientX);
    trace.current = { employeeId, ancre, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function pendantTrace(e: React.PointerEvent<HTMLDivElement>) {
    const t = trace.current;
    if (!t || t.pointerId !== e.pointerId) return;

    const curseur = getMinutesFromClientX(e.clientX);
    // Tant que le geste tient dans un quart d'heure, c'est encore un clic :
    // afficher un rectangle à chaque frémissement de souris serait du bruit.
    if (!enTrace && !glissementSignificatif(t.ancre, curseur)) return;

    if (!enTrace) setEnTrace(true);
    const jourIndex = view === "week" ? getWeekDayIndexFromPx(getTimelineX(e.clientX)) : 0;
    setBrouillon({
      employeeId: t.employeeId,
      day: view === "week" ? weekDays[jourIndex] : currentDate,
      dayIndex: jourIndex,
      plage: brouillonDepuisGlissement(t.ancre, curseur),
    });
  }

  function finTrace(e: React.PointerEvent<HTMLDivElement>) {
    const t = trace.current;
    if (!t || t.pointerId !== e.pointerId) return;
    trace.current = null;
    if (enTrace) vientDeTracer.current = true;
    setEnTrace(false);
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
            {view === "day" ? format(currentDate, "EEEE d MMMM yyyy", { locale: fr }) : `Semaine du ${format(weekDays[0], "d MMM", { locale: fr })} au ${format(weekDays[6], "d MMM yyyy", { locale: fr })}`}
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
        {/*
          LA SEMAINE A SON PROPRE OUTIL.

          Étirer la ligne de temps du jour donnait 7 616 px de large — on
          voyait un jour et on défilait pour trouver les autres, ce qui revient
          à ne pas avoir de vue semaine. Dès qu'on renonce à placer les blocs
          au pixel près, les sept jours tiennent à l'écran.

          Le glisser, le redimensionnement et le rectangle de création restent
          la vue jour, où ils ont un sens : on ne dessine pas une plage horaire
          dans une case qui ne représente pas les heures.
        */}
        {view === "week" ? (
          <div className="p-4">
            <VueSemaine
              jours={weekDays}
              employes={filteredEmployees}
              evenements={filteredEvents}
              onEvenementClick={onEventClick}
              onCaseClick={(employeeId, jour) => {
                // Sans heure : 8 h, l'heure à laquelle une journée commence.
                onSlotClick(employeeId, jour, 8 * 60);
              }}
            />
          </div>
        ) : (
        <>
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
                          <AvatarFallback className="bg-primary/10 text-accent-encre text-[10px]">
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
                    onPointerDown={(e) => debutTrace(e, row.id)}
                    onPointerMove={pendantTrace}
                    onPointerUp={finTrace}
                    onPointerCancel={finTrace}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("[data-event-id]")) return;
                      /*
                       * DÉFENSE EN PROFONDEUR.
                       *
                       * Le rectangle arrête déjà les clics à sa racine. Ce
                       * garde-ci existe parce que le défaut d'origine était
                       * exactement celui-là : un bouton du rectangle fermait
                       * la sélection, et le même clic, en remontant jusqu'ici,
                       * en recréait une. Deux verrous valent mieux qu'un
                       * quand l'un d'eux dépend d'un composant enfant.
                       */
                      if ((e.target as HTMLElement).closest('[data-testid="bloc-brouillon"]')) return;
                      // Un glissement vient de tracer la plage : son relâchement
                      // ne doit pas être relu comme un clic qui la referme.
                      if (enTrace) return;
                      if (vientDeTracer.current) {
                        vientDeTracer.current = false;
                        return;
                      }
                      handleTimelineClick(e, row.id);
                    }}
                  >

                    {Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute inset-y-0 border-r border-border/20"
                        style={{ left: i * HOUR_WIDTH }}
                      />
                    ))}

                    {brouillon && brouillon.employeeId === row.id && (
                      <BlocBrouillon
                        plage={brouillon.plage}
                        top={LIGNE_PADDING}
                        hauteur={Math.max(28, rowHeight - LIGNE_PADDING * 2)}
                        decalageGauche={0}
                        minutesSousLeCurseur={getMinutesFromClientX}
                        enTrace={enTrace}
                        onPlageChange={(plage) => setBrouillon({ ...brouillon, plage })}
                        onConfirmer={() => {
                          onBrouillonConfirm(
                            brouillon.employeeId,
                            brouillon.day,
                            brouillon.plage.startMinutes,
                            brouillon.plage.endMinutes,
                          );
                          setBrouillon(null);
                        }}
                        onAnnuler={() => setBrouillon(null)}
                      />
                    )}
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
        </>
        )}
      </CardContent>
    </Card>
  );
}
