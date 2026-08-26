import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { formatFieldJobDate, formatFieldJobTime } from "@/lib/field-schedule-utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ScheduleEvent } from "@/types";

interface FieldCallCardProps {
  job: ScheduleEvent;
}

export function FieldCallCard({ job }: FieldCallCardProps) {
  const address = job.jobSiteAddress || job.location || "Adresse à confirmer";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <Link href={`/terrain/calls/${job.id}`} className="block p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {formatFieldJobDate(job.start)} · {formatFieldJobTime(job.start, job.end)}
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
