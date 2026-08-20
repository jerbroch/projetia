import { FieldSchedulePageClient } from "@/components/field/field-schedule-page-client";
import { FieldLayout } from "@/components/field/field-layout";
import { getFieldJobsForEmployeeScoped } from "@/lib/data/field-data";
import { toFieldSafeScheduleEvent } from "@/lib/field-permissions";
import { requireFieldContext } from "@/lib/session";

export default async function TerrainSchedulePage() {
  const ctx = await requireFieldContext();
  const jobs = (await getFieldJobsForEmployeeScoped(ctx.company.id, ctx.employeeId!, ctx.isDemo)).map(
    toFieldSafeScheduleEvent
  );

  return (
    <FieldLayout company={ctx.company} user={ctx.user}>
      <FieldSchedulePageClient initialJobs={jobs} />
    </FieldLayout>
  );
}
