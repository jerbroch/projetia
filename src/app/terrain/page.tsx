import Link from "next/link";
import { CalendarDays, ChevronRight, Wrench } from "lucide-react";
import { FieldCallCard } from "@/components/field/field-call-card";
import { FieldLayout } from "@/components/field/field-layout";
import { ProchaineIntervention } from "@/components/field/field-prochaine-intervention";
import { FieldEnteteJournee } from "@/components/field/field-entete-journee";
import { FieldApercuOutils } from "@/components/field/field-apercu-outils";
import { bandeauDisponible } from "@/lib/ressource-publique";
import { getEmployeeToolsForField, getFieldJobsForEmployeeScoped } from "@/lib/data/field-data";
import { getShiftsForJobs } from "@/lib/data/job-shifts-data";
import { filterJobsByFieldView, sortJobsChronologically } from "@/lib/field-schedule-utils";
import { toFieldSafeScheduleEvent } from "@/lib/field-permissions";
import { requireFieldContext } from "@/lib/session";
import { outilsARetourner, pluriel, salutation } from "@/lib/terrain-aujourdhui";
import { heureCourte } from "@/lib/tableau-de-bord-journee";
import { plageDeLEmploye } from "@/lib/job-shifts";
import { cn } from "@/lib/utils";

/** « Vendredi 18 septembre » — la date écrite comme on la dit. */
function dateDuJour(): string {
  const brut = new Intl.DateTimeFormat("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return brut.charAt(0).toUpperCase() + brut.slice(1);
}

export default async function TerrainTodayPage() {
  const ctx = await requireFieldContext();

  const [tousLesJobs, outils] = await Promise.all([
    getFieldJobsForEmployeeScoped(ctx.company.id, ctx.employeeId!, ctx.isDemo),
    getEmployeeToolsForField(ctx.company.id, ctx.employeeId!, ctx.isDemo),
  ]);

  const jobs = sortJobsChronologically(
    filterJobsByFieldView(tousLesJobs.map(toFieldSafeScheduleEvent), "today"),
  );
  const shifts = ctx.isDemo ? [] : await getShiftsForJobs(jobs.map((j) => j.id));

  const aRetourner = outilsARetourner(outils);
  const [prochaine, ...suivantes] = jobs;
  const enCours = prochaine
    ? prochaine.status === "in-progress" || prochaine.status === "en-route"
    : false;
  /* L'heure affichée est celle du quart de la personne quand il existe. */
  const debutPersonnel = prochaine
    ? plageDeLEmploye(ctx.employeeId!, shifts, prochaine.start, prochaine.end).start
    : prochaine;

  return (
    <FieldLayout company={ctx.company} user={ctx.user}>
      <div className="space-y-5">
        {/* ───────── Qui, et quel jour ───────── */}
        <FieldEnteteJournee
          salutation={salutation(ctx.user.name)}
          date={dateDuJour()}
          image={bandeauDisponible("mobile")}
        />

        {/* ───────── Ma journée ───────── */}
        <section aria-labelledby="titre-ma-journee">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="titre-ma-journee" className="text-[1.0625rem] font-bold text-foreground">
              Ma journée
            </h2>
            <Link
              href="/terrain/horaire"
              className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md px-1 text-[13px] font-semibold text-accent-encre transition-colors duration-normal hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole motion-reduce:transition-none"
            >
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
              Voir l&apos;horaire
            </Link>
          </div>

          {prochaine ? (
            <>
              {/*
                LA LIGNE DE TEMPS DE LA RÉFÉRENCE — une pastille, l'heure en
                grand, et ce que cette heure représente. C'est la seule chose
                qu'on lit à 6 h 30 dans un camion.

                L'HEURE EST CELLE DE LA PERSONNE, pas celle du call : quand un
                quart lui attribue une plage propre, c'est elle qui compte.
              */}
              <div className="mb-3 flex items-center gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    enCours ? "bg-succes" : "bg-petrole/40",
                  )}
                />
                <span className="text-[1.75rem] font-extrabold leading-none tabular-nums tracking-tight text-foreground">
                  {heureCourte(debutPersonnel)}
                </span>
                <span className="min-w-0 truncate text-[15px] text-muted-foreground">
                  {enCours ? "Chantier en cours" : "Premier chantier"}
                </span>
              </div>

              <ProchaineIntervention
                job={prochaine}
                employeeId={ctx.employeeId ?? undefined}
                shifts={shifts}
                enCours={enCours}
              />
            </>
          ) : (
          /*
            L'ÉTAT VIDE MÈNE QUELQUE PART.
            « Aucun call aujourd'hui » et rien d'autre laisse quelqu'un devant
            un écran mort, alors qu'il a peut-être du travail demain et un
            outil à rapporter.
          */
          <section className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <CalendarDays className="h-6 w-6 text-muted-foreground" aria-hidden />
            </span>
            <h2 className="mt-3 text-[17px] font-semibold text-foreground">
              Rien de prévu aujourd&apos;hui
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Votre horaire des prochains jours reste consultable.
            </p>
            <div className="mt-4 space-y-2">
              <Link
                href="/terrain/horaire"
                className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition-colors duration-normal hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                Voir mon horaire
              </Link>
              <Link
                href="/terrain/outils"
                className="flex min-h-[48px] w-full items-center justify-center rounded-lg border border-petrole/25 px-4 text-[15px] font-semibold text-petrole transition-colors duration-normal hover:bg-petrole/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                Mes outils
              </Link>
            </div>
          </section>
          )}
        </section>

        {suivantes.length > 0 && (
          <section aria-labelledby="titre-suite">
                <h2 id="titre-suite" className="mb-2 text-[17px] font-semibold text-foreground">
                  Ensuite aujourd&apos;hui
                </h2>
                <div className="space-y-3">
              {suivantes.map((job) => (
                    <FieldCallCard
                      key={job.id}
                      job={job}
                      employeeId={ctx.employeeId ?? undefined}
                      shifts={shifts}
                    />
                  ))}
                </div>
              </section>
            )}
        {/* ───────── Mes outils, en aperçu ───────── */}
        <FieldApercuOutils outils={outils} employeId={ctx.employeeId!} />

        {/* ───────── Le rappel du dépôt ───────── */}
        {aRetourner.length > 0 && (
          <Link
            href="/terrain/outils"
            className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.07] p-4 transition-colors duration-normal hover:bg-primary/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <Wrench className="h-5 w-5 shrink-0 text-accent-encre" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                {aRetourner.length} {pluriel(aRetourner.length, "outil")} à rapporter
              </span>
              <span className="block text-[13px] text-muted-foreground">
                Retour attendu au bureau
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-accent-encre">Voir</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-accent-encre" aria-hidden />
          </Link>
        )}
      </div>
    </FieldLayout>
  );
}
