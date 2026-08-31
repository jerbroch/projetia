import { notFound } from "next/navigation";
import { FieldCallDetailClient } from "@/components/field/field-call-detail-client";
import { FieldLayout } from "@/components/field/field-layout";
import {
  getEmployeeToolsForField,
  getFieldHoursForJob,
  getFieldJobById,
  getFieldMaterialsForJob,
} from "@/lib/data/field-data";
import { toFieldSafeScheduleEvent } from "@/lib/field-permissions";
import { requireFieldContext } from "@/lib/session";

interface TerrainCallPageProps {
  params: Promise<{ id: string }>;
}

export default async function TerrainCallPage({ params }: TerrainCallPageProps) {
  const { id } = await params;
  const ctx = await requireFieldContext();
  const job = await getFieldJobById(ctx.company.id, id, ctx.employeeId!, ctx.isDemo);

  if (!job) notFound();

  const [hours, materials, tools] = await Promise.all([
    getFieldHoursForJob(ctx.company.id, id),
    getFieldMaterialsForJob(ctx.company.id, id),
    getEmployeeToolsForField(ctx.company.id, ctx.employeeId!, ctx.isDemo),
  ]);

  return (
    <FieldLayout company={ctx.company} user={ctx.user}>
      <FieldCallDetailClient
        job={toFieldSafeScheduleEvent(job)}
        hours={hours}
        materials={materials}
        tools={tools}
        employeeId={ctx.employeeId!}
      />
    </FieldLayout>
  );
}
