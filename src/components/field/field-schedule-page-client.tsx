"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { FieldCallCard } from "@/components/field/field-call-card";
import {
  FIELD_SCHEDULE_VIEW_LABELS,
  filterJobsByFieldView,
  grouperParJournee,
  type FieldScheduleView,
} from "@/lib/field-schedule-utils";
import { cn } from "@/lib/utils";
import type { JobShift } from "@/lib/job-shifts";
import type { ScheduleEvent } from "@/types";

/**
 * MON HORAIRE — quatre filtres, et des journées qui se distinguent.
 *
 * Les calls arrivaient en liste plate : douze cartes d'affilée sur trois
 * jours, sans qu'on voie où finissait jeudi. L'heure seule ne suffit pas,
 * « 08 h 00 » revenant à chaque journée.
 *
 * Les filtres sont des ONGLETS, pas quatre boutons empilés : sur 360 px, deux
 * rangées de boutons mangeaient déjà le tiers de l'écran avant le premier
 * call.
 */

const VUES = Object.keys(FIELD_SCHEDULE_VIEW_LABELS) as FieldScheduleView[];

/** Les onglets tiennent sur une ligne : les libellés y sont resserrés. */
const LIBELLE_COURT: Record<FieldScheduleView, string> = {
  today: "Aujourd'hui",
  tomorrow: "Demain",
  week: "Semaine",
  upcoming: "À venir",
};

interface FieldSchedulePageClientProps {
  initialJobs: ScheduleEvent[];
  employeeId?: string;
  shifts?: JobShift[];
}

export function FieldSchedulePageClient({
  initialJobs,
  employeeId,
  shifts = [],
}: FieldSchedulePageClientProps) {
  const [vue, setVue] = useState<FieldScheduleView>("today");

  const journees = useMemo(
    () => grouperParJournee(filterJobsByFieldView(initialJobs, vue)),
    [initialJobs, vue],
  );

  const total = journees.reduce((n, j) => n + j.jobs.length, 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[26px] font-bold leading-tight text-foreground">Mon horaire</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Vos interventions assignées</p>
      </header>

      {/* ───────── Les quatre périodes ───────── */}
      <div
        role="tablist"
        aria-label="Période affichée"
        className="flex gap-1 rounded-xl bg-secondary p-1"
      >
        {VUES.map((cle) => {
          const actif = vue === cle;
          return (
            <button
              key={cle}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => setVue(cle)}
              title={FIELD_SCHEDULE_VIEW_LABELS[cle]}
              className={cn(
                "min-h-[44px] flex-1 rounded-lg px-1 text-[13px] font-semibold leading-tight",
                "transition-colors duration-normal motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-1",
                actif
                  ? "bg-petrole text-petrole-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {LIBELLE_COURT[cle]}
            </button>
          );
        })}
      </div>

      {total === 0 ? (
        <section className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <CalendarDays className="h-6 w-6 text-muted-foreground" aria-hidden />
          </span>
          <h2 className="mt-3 text-[17px] font-semibold text-foreground">
            Rien pour cette période
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Essayez « Semaine » ou « À venir » pour voir plus loin.
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {journees.map((journee) => (
            <section key={journee.cle} aria-labelledby={`jour-${journee.cle}`}>
              {/*
                Le titre de journée COLLE EN HAUT pendant le défilement : sur
                une semaine chargée, on perd sinon de vue le jour qu'on lit.
              */}
              <h2
                id={`jour-${journee.cle}`}
                className="sticky top-[calc(env(safe-area-inset-top)+3.25rem)] z-10 -mx-1 bg-secondary/40 px-1 py-1.5 text-[15px] font-semibold text-foreground backdrop-blur"
              >
                {journee.libelle}
              </h2>
              <div className="mt-1.5 space-y-3">
                {journee.jobs.map((job) => (
                  <FieldCallCard
                    key={job.id}
                    job={job}
                    employeeId={employeeId}
                    shifts={shifts.filter((s) => s.scheduledJobId === job.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
