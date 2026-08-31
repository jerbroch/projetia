import { FieldLayout } from "@/components/field/field-layout";
import { FieldToolsPageClient } from "@/components/field/field-tools-page-client";
import { getEmployeeToolsForField } from "@/lib/data/field-data";
import { requireFieldContext } from "@/lib/session";

export default async function TerrainToolsPage() {
  const ctx = await requireFieldContext();
  const tools = await getEmployeeToolsForField(ctx.company.id, ctx.employeeId!, ctx.isDemo);

  return (
    <FieldLayout company={ctx.company} user={ctx.user}>
      <FieldToolsPageClient tools={tools} />
    </FieldLayout>
  );
}
