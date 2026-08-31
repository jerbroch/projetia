import { FieldCallCard } from "@/components/field/field-call-card";
import { FieldLayout } from "@/components/field/field-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { getFieldJobsForEmployeeScoped } from "@/lib/data/field-data";
import { filterJobsByFieldView, sortJobsChronologically } from "@/lib/field-schedule-utils";
import { toFieldSafeScheduleEvent } from "@/lib/field-permissions";
import { requireFieldContext } from "@/lib/session";

export default async function TerrainTodayPage() {
  const ctx = await requireFieldContext();
  const jobs = sortJobsChronologically(
    filterJobsByFieldView(
      (await getFieldJobsForEmployeeScoped(ctx.company.id, ctx.employeeId!, ctx.isDemo)).map(
        toFieldSafeScheduleEvent
      ),
      "today"
    )
  );

  return (
    <FieldLayout company={ctx.company} user={ctx.user}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Aujourd&apos;hui</h1>
          <p className="text-sm text-muted-foreground">Vos calls assignés pour aujourd&apos;hui</p>
        </div>
        {jobs.length === 0 ? (
          <EmptyState
            title="Aucun call aujourd'hui"
            description="Profitez de votre journée ou consultez Mon horaire."
          />
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <FieldCallCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </FieldLayout>
  );
}
