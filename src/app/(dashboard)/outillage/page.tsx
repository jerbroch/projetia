import { requireTenantContext } from "@/lib/session";
import { getEmployees } from "@/lib/data/tenant-data";
import { getToolsWithDetails } from "@/lib/data/tools-data";
import { OutillagePageClient } from "@/components/outillage/outillage-page-client";

export default async function OutillagePage() {
  const ctx = await requireTenantContext();
  const employees = await getEmployees(ctx.company.id, ctx.isDemo);
  const tools = await getToolsWithDetails(ctx.company.id, ctx.isDemo, employees);

  return (
    <OutillagePageClient
      initialTools={tools}
      employees={employees}
      company={ctx.company}
      user={ctx.user}
      membershipRole={ctx.membershipRole}
      isDemo={ctx.isDemo}
    />
  );
}
