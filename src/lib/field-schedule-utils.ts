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
import { SCHEDULE_TIMEZONE, isoToZonedDateKey } from "@/lib/schedule-timezone";
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

/**
 * LES INTERVENTIONS, RANGÉES PAR JOURNÉE.
 *
 * Une liste plate de douze calls sur trois jours se lit mal sur un téléphone :
 * rien ne dit où finit jeudi et où commence vendredi, et l'heure seule ne
 * suffit pas — « 08 h 00 » apparaît trois fois.
 *
 * LA JOURNÉE EST CELLE DE L'ENTREPRISE, pas celle du téléphone. Un call de
 * 20 h à Montréal appartient au même jour pour l'homme sur le chantier et
 * pour la personne au bureau ; s'en remettre au fuseau de l'appareil ferait
 * basculer un call du soir au lendemain dès qu'on traverse une frontière.
 */
export interface JourneeDeCalls {
  /** Clé de journée dans le fuseau de l'entreprise, « 2026-09-18 ». */
  cle: string;
  /** « Vendredi 18 septembre », prêt à afficher. */
  libelle: string;
  jobs: ScheduleEvent[];
}

export function grouperParJournee(events: ScheduleEvent[]): JourneeDeCalls[] {
  const parJour = new Map<string, ScheduleEvent[]>();

  for (const event of sortJobsChronologically(events)) {
    const cle = isoToZonedDateKey(event.start);
    const liste = parJour.get(cle);
    if (liste) liste.push(event);
    else parJour.set(cle, [event]);
  }

  return [...parJour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cle, jobs]) => ({ cle, libelle: libelleDeJournee(cle), jobs }));
}

/** « Vendredi 18 septembre » — avec la majuscule qu'on met en début de ligne. */
export function libelleDeJournee(cle: string): string {
  const [a, m, j] = cle.split("-").map(Number);
  if (!a || !m || !j) return cle;
  // Midi : à minuit, un décalage d'une heure ferait basculer la date.
  const brut = new Intl.DateTimeFormat("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: SCHEDULE_TIMEZONE,
  }).format(new Date(Date.UTC(a, m - 1, j, 12)));
  return brut.charAt(0).toUpperCase() + brut.slice(1);
}
