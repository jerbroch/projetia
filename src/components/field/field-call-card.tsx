import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { formatFieldJobDate, formatFieldJobTime } from "@/lib/field-schedule-utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { plageDeLEmploye, plagesDuCall, type JobShift } from "@/lib/job-shifts";
import type { ScheduleEvent } from "@/types";

interface FieldCallCardProps {
  job: ScheduleEvent;
  /** L'employé qui regarde, pour afficher SA plage plutôt que celle du call. */
  employeeId?: string;
  shifts?: JobShift[];
}

export function FieldCallCard({ job, employeeId, shifts = [] }: FieldCallCardProps) {
  const address = job.jobSiteAddress || job.location || "Adresse à confirmer";

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
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <Link href={`/terrain/calls/${job.id}`} className="block p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {formatFieldJobDate(job.start)} · {formatFieldJobTime(sienne.start, sienne.end)}
              </p>
              <h3 className="mt-1 text-lg font-semibold leading-tight">{job.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{job.customerName ?? "Client"}</p>
            </div>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{address}</span>
          </div>
            {autres.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {autres
                  .map((p) => `${nomDe(p.employeeId)} ${formatFieldJobTime(p.start, p.end)}`)
                  .join(" · ")}
              </p>
            )}
          {job.description && (
            <p className="mt-3 line-clamp-2 text-sm">{job.description}</p>
          )}
          <div className="mt-4 flex items-center justify-between text-sm font-medium text-primary">
            <span>Ouvrir le call</span>
            <ChevronRight className="h-4 w-4" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
