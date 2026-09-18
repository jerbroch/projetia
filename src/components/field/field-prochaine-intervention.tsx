import Link from "next/link";
import { ChevronRight, MapPin, Navigation, User } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatFieldJobTime } from "@/lib/field-schedule-utils";
import { lienItineraire } from "@/lib/terrain-aujourdhui";
import { plageDeLEmploye, type JobShift } from "@/lib/job-shifts";
import type { ScheduleEvent } from "@/types";

/**
 * LA PROCHAINE INTERVENTION, MISE EN AVANT.
 *
 * Les calls du jour se suivaient dans une liste uniforme : celui de 8 h et
 * celui de 15 h avaient exactement le même poids visuel. Or à 6 h 30, une
 * seule question se pose — où est-ce que je vais maintenant.
 *
 * Deux gestes seulement, et ce sont les deux qu'on fait vraiment : ouvrir le
 * call, ou partir. « Itinéraire » DISPARAÎT s'il n'y a pas d'adresse : un
 * bouton qui ouvre une carte vide use la confiance plus qu'il ne rend service.
 */
interface ProchaineInterventionProps {
  job: ScheduleEvent;
  employeeId?: string;
  shifts?: JobShift[];
}

export function ProchaineIntervention({
  job,
  employeeId,
  shifts = [],
}: ProchaineInterventionProps) {
  const adresse = job.jobSiteAddress || job.location || null;
  const itineraire = lienItineraire(adresse);
  const sienne = employeeId
    ? plageDeLEmploye(employeeId, shifts, job.start, job.end)
    : { start: job.start, end: job.end, heriteeDuCall: true };

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/*
        LE HAUT DE LA CARTE EST UN LIEN.

        Les deux boutons disent explicitement quoi faire, mais on tape
        d'instinct sur le titre d'un call pour l'ouvrir : c'est ce que faisait
        l'ancienne carte, entièrement cliquable. Retirer ce geste au profit
        d'un bouton aurait été une perte déguisée en clarté.
      */}
      <Link
        href={`/terrain/calls/${job.id}`}
        className="block p-4 pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-inset"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-bold tabular-nums leading-tight text-foreground">
            {formatFieldJobTime(sienne.start, sienne.end)}
          </p>
          <StatusBadge status={job.status} />
        </div>

        <h3 className="mt-1.5 text-[17px] font-semibold leading-snug text-foreground">
          {job.title}
        </h3>

        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex items-start gap-2">
            <dt className="sr-only">Client</dt>
            <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <dd className="text-muted-foreground">{job.customerName ?? "Client à confirmer"}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="sr-only">Adresse</dt>
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <dd className="text-muted-foreground">{adresse ?? "Adresse à confirmer"}</dd>
          </div>
        </dl>
      </Link>

      <div className="p-4 pt-0">
        <div className="mt-4 space-y-2">
          <Link
            href={`/terrain/calls/${job.id}`}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition-colors duration-normal hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            Voir l&apos;intervention
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>

          {itineraire && (
            <a
              href={itineraire}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-petrole/25 px-4 text-[15px] font-semibold text-petrole transition-colors duration-normal hover:bg-petrole/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              <Navigation className="h-4 w-4" aria-hidden />
              Itinéraire
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
