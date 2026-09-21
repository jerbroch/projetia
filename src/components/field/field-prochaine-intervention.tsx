import Link from "next/link";
import { ChevronRight, Clock, MapPin, Navigation, Phone } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatFieldJobTime } from "@/lib/field-schedule-utils";
import { lienItineraire } from "@/lib/terrain-aujourdhui";
import { plageDeLEmploye, type JobShift } from "@/lib/job-shifts";
import { cn } from "@/lib/utils";
import type { ScheduleEvent } from "@/types";

/**
 * L'INTERVENTION DU MOMENT, mise en avant.
 *
 * Les calls du jour se suivaient dans une liste uniforme : celui de 8 h et
 * celui de 15 h avaient le même poids visuel. Or à 6 h 30, une seule question
 * se pose — où est-ce que je vais maintenant.
 *
 * TROIS GESTES, ET CE SONT LES TROIS QU'ON FAIT VRAIMENT : partir, appeler le
 * client, ouvrir le call. Chacun disparaît s'il n'a pas de quoi fonctionner —
 * pas d'adresse, pas d'itinéraire ; pas de numéro, pas d'appel. Un bouton qui
 * ouvre une carte vide use la confiance plus qu'il ne rend service.
 */
interface ProchaineInterventionProps {
  job: ScheduleEvent;
  employeeId?: string;
  shifts?: JobShift[];
  /** Vrai quand ce call est celui qui est commencé. */
  enCours?: boolean;
}

export function ProchaineIntervention({
  job,
  employeeId,
  shifts = [],
  enCours = false,
}: ProchaineInterventionProps) {
  const adresse = job.jobSiteAddress || job.location || null;
  const itineraire = lienItineraire(adresse);
  const telephone = job.customerPhone?.trim() || null;
  const sienne = employeeId
    ? plageDeLEmploye(employeeId, shifts, job.start, job.end)
    : { start: job.start, end: job.end, heriteeDuCall: true };

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/*
        LE HAUT DE LA CARTE EST UN LIEN.

        Les boutons disent explicitement quoi faire, mais on tape d'instinct
        sur le titre d'un call pour l'ouvrir : c'est ce que faisait l'ancienne
        carte, entièrement cliquable. Retirer ce geste au profit d'un bouton
        aurait été une perte déguisée en clarté.
      */}
      <Link
        href={`/terrain/calls/${job.id}`}
        className="block p-4 pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-petrole"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-encre">
            {enCours ? "Votre intervention" : "Prochaine intervention"}
          </span>
          <StatusBadge status={job.status} />
        </div>

        <h3 className="mt-2.5 text-[19px] font-bold leading-tight text-foreground">
          {job.customerName ?? "Client à confirmer"}
        </h3>
        {job.title && (
          <p className="mt-0.5 text-[15px] leading-snug text-muted-foreground">{job.title}</p>
        )}

        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex items-start gap-2">
            <dt className="sr-only">Horaire</dt>
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <dd className="font-medium tabular-nums text-foreground">
              {formatFieldJobTime(sienne.start, sienne.end)}
            </dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="sr-only">Adresse</dt>
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <dd className="text-muted-foreground">{adresse ?? "Adresse à confirmer"}</dd>
          </div>
        </dl>
      </Link>

      <div className="p-4 pt-0">
        {/* Les deux gestes secondaires, côte à côte comme sur la référence. */}
        {(itineraire || telephone) && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {itineraire && (
              <a
                href={itineraire}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-petrole/25 px-3",
                  "text-[15px] font-semibold text-petrole",
                  "transition-colors duration-normal hover:bg-petrole/[0.06] motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2",
                  !telephone && "col-span-2",
                )}
              >
                <Navigation className="h-4 w-4" aria-hidden />
                Itinéraire
              </a>
            )}
            {telephone && (
              <a
                href={`tel:${telephone.replace(/[^\d+]/g, "")}`}
                className={cn(
                  "flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-petrole/25 px-3",
                  "text-[15px] font-semibold text-petrole",
                  "transition-colors duration-normal hover:bg-petrole/[0.06] motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2",
                  !itineraire && "col-span-2",
                )}
              >
                <Phone className="h-4 w-4" aria-hidden />
                Appeler
              </a>
            )}
          </div>
        )}

        {/*
          LE BOUTON DIT CE QU'IL FAIT, ET RIEN DE PLUS.

          La référence l'appelle « Terminer le travail ». Ce bouton ouvre la
          fiche : il s'appelle donc « Ouvrir l'intervention ». La clôture
          existe toujours, entière, à l'intérieur — avec ses heures et ses
          matériaux, que l'application exige avant de laisser terminer. Un
          libellé qui promet de terminer d'un seul geste mentirait sur les
          deux écrans à la fois.
        */}
        <Link
          href={`/terrain/calls/${job.id}`}
          className="mt-2 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition-colors duration-normal hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Ouvrir l&apos;intervention
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
