"use client";

import { useMemo, useState } from "react";
import { FieldCallCard } from "@/components/field/field-call-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  FIELD_SCHEDULE_VIEW_LABELS,
  filterJobsByFieldView,
  sortJobsChronologically,
  type FieldScheduleView,
} from "@/lib/field-schedule-utils";
import type { JobShift } from "@/lib/job-shifts";
import type { ScheduleEvent } from "@/types";

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
  const [view, setView] = useState<FieldScheduleView>("today");

  const jobs = useMemo(
    () => sortJobsChronologically(filterJobsByFieldView(initialJobs, view)),
    [initialJobs, view]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mon horaire</h1>
        <p className="text-sm text-muted-foreground">Vos calls assignés uniquement</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(FIELD_SCHEDULE_VIEW_LABELS) as FieldScheduleView[]).map((key) => (
          <Button
            key={key}
            variant={view === key ? "default" : "outline"}
            className="h-11"
            onClick={() => setView(key)}
          >
            {FIELD_SCHEDULE_VIEW_LABELS[key]}
          </Button>
        ))}
      </div>

      {jobs.length === 0 ? (
        <EmptyState title="Aucun call" description="Rien de planifié pour cette période." />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <FieldCallCard
              key={job.id}
              job={job}
              employeeId={employeeId}
              shifts={shifts.filter((s) => s.scheduledJobId === job.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
