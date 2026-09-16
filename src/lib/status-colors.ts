import type { ScheduleEvent } from "@/types";

export type ScheduleStatus = ScheduleEvent["status"];

export interface ScheduleStatusAppearance {
  /** Filled calendar / work-card styling */
  blockClassName: string;
  /** Light badge styling for lists and dialogs */
  badgeClassName: string;
}

/**
 * Fixed colors per call/workflow status — single source of truth for the app.
 *
 * LES BLOCS SONT OPAQUES ET FONCÉS D'UN CRAN. Ils étaient posés à 90 %
 * d'opacité sur des teintes de niveau 500 : composé sur le blanc du
 * calendrier, le texte blanc par-dessus tombait entre 2,00 et 3,91 selon la
 * couleur — tous sous le seuil AA de 4,5, et l'ambre à 2,00 était presque
 * illisible au soleil. Le code couleur ne change pas : c'est la même
 * famille, un ton plus bas, et sans transparence. Chaque valeur ci-dessous
 * est mesurée contre le blanc.
 */
export const SCHEDULE_STATUS_APPEARANCE: Record<ScheduleStatus, ScheduleStatusAppearance> = {
  scheduled: {
    blockClassName: "bg-slate-600 border-slate-700 text-white",
    badgeClassName: "border-transparent bg-slate-100 text-slate-800",
  },
  "en-route": {
    blockClassName: "bg-blue-600 border-blue-700 text-white",
    badgeClassName: "border-transparent bg-blue-100 text-blue-800",
  },
  "in-progress": {
    blockClassName: "bg-orange-700 border-orange-800 text-white",
    badgeClassName: "border-transparent bg-orange-100 text-orange-800",
  },
  completed: {
    blockClassName: "bg-green-700 border-green-800 text-white",
    badgeClassName: "border-transparent bg-green-100 text-green-800",
  },
  "pending-review": {
    blockClassName: "bg-amber-700 border-amber-800 text-white",
    badgeClassName: "border-transparent bg-amber-100 text-amber-800",
  },
  "ready-to-invoice": {
    blockClassName: "bg-indigo-600 border-indigo-700 text-white",
    badgeClassName: "border-transparent bg-indigo-100 text-indigo-800",
  },
  "invoice-sent": {
    blockClassName: "bg-teal-700 border-teal-800 text-white",
    badgeClassName: "border-transparent bg-teal-100 text-teal-800",
  },
  /**
   * PAYÉ SE RETIRE VISUELLEMENT, SANS DISPARAÎTRE.
   *
   * Un call payé reste à sa date — un travail fait mardi appartient au mardi,
   * et l'effacer trouerait l'historique. Mais il est fini : au même poids
   * visuel que les autres, il se confondait avec ce qui reste à faire.
   *
   * Pas de texte barré, contrairement à « annulé » : le travail a été fait et
   * payé. C'est un aboutissement, pas un renoncement.
   */
  paid: {
    blockClassName: "bg-muted/80 border-border text-muted-foreground opacity-60",
    badgeClassName: "border-transparent bg-violet-100 text-violet-800",
  },
  cancelled: {
    blockClassName:
      "bg-muted/90 border-border text-muted-foreground opacity-70 line-through",
    badgeClassName: "border-transparent bg-muted text-muted-foreground line-through",
  },
};

export const ALL_SCHEDULE_STATUSES = Object.keys(
  SCHEDULE_STATUS_APPEARANCE
) as ScheduleStatus[];

export function isScheduleStatus(status: string): status is ScheduleStatus {
  return status in SCHEDULE_STATUS_APPEARANCE;
}

export function getScheduleStatusAppearance(
  status: ScheduleStatus
): ScheduleStatusAppearance {
  return SCHEDULE_STATUS_APPEARANCE[status] ?? SCHEDULE_STATUS_APPEARANCE.scheduled;
}

export function getScheduleStatusBlockClassName(status: ScheduleStatus): string {
  return getScheduleStatusAppearance(status).blockClassName;
}

export function getScheduleStatusBadgeClassName(status: ScheduleStatus): string {
  return getScheduleStatusAppearance(status).badgeClassName;
}
