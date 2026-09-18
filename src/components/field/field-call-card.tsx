import Link from "next/link";
import { ChevronRight, MapPin, User } from "lucide-react";
import { formatFieldJobTime } from "@/lib/field-schedule-utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { plageDeLEmploye, plagesDuCall, type JobShift } from "@/lib/job-shifts";
import type { ScheduleEvent } from "@/types";

/**
 * UNE INTERVENTION DANS UNE LISTE.
 *
 * L'heure d'abord, en gras : c'est par elle qu'on se repère dans une journée.
 * Puis ce qu'on va faire, pour qui, et où. Le reste — description, notes —
 * s'obtient en ouvrant le call ; l'entasser ici rendrait la liste illisible
 * sur un écran de 360 px.
 */
interface FieldCallCardProps {
  job: ScheduleEvent;
  /** L'employé qui regarde, pour afficher SA plage plutôt que celle du call. */
  employeeId?: string;
  shifts?: JobShift[];
}

export function FieldCallCard({ job, employeeId, shifts = [] }: FieldCallCardProps) {
  const adresse = job.jobSiteAddress || job.location || "Adresse à confirmer";

  // Sa plage à lui en tête. Sans plage tracée, c'est celle du call — le
  // comportement d'avant.
  const sienne = employeeId
    ? plageDeLEmploye(employeeId, shifts, job.start, job.end)
    : { start: job.start, end: job.end, heriteeDuCall: true };

  // Les autres en petit dessous : savoir qui arrive quand sur son chantier
  // fait partie du travail.
  const autres = employeeId
    ? plagesDuCall(job.employeeIds, shifts, job.start, job.end).filter(
        (p) => p.employeeId !== employeeId,
      )
    : [];
  const nomDe = (id: string) => job.employeeNames[job.employeeIds.indexOf(id)] ?? "Collègue";

  return (
    <Link
      href={`/terrain/calls/${job.id}`}
      className="block rounded-xl border border-border bg-card shadow-sm transition-colors duration-normal hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2 motion-reduce:transition-none"
    >
      <div className="flex items-start gap-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[15px] font-bold tabular-nums leading-tight text-foreground">
              {formatFieldJobTime(sienne.start, sienne.end)}
            </p>
            <StatusBadge status={job.status} />
          </div>

          <h3 className="mt-1 text-[15px] font-semibold leading-snug text-foreground">
            {job.title}
          </h3>

          <div className="mt-2 space-y-1 text-[13px] text-muted-foreground">
            <p className="flex items-start gap-2">
              <User className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0">{job.customerName ?? "Client"}</span>
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0">{adresse}</span>
            </p>
          </div>

          {autres.length > 0 && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              {autres
                .map((p) => `${nomDe(p.employeeId)} ${formatFieldJobTime(p.start, p.end)}`)
                .join(" · ")}
            </p>
          )}
        </div>

        <ChevronRight
          className="mt-0.5 h-5 w-5 shrink-0 self-center text-muted-foreground/60"
          aria-hidden
        />
      </div>
    </Link>
  );
}
