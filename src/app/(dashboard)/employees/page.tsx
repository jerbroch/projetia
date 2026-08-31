import { EmployeesPageClient } from "@/components/employees/employees-page-client";
import { getEmployees } from "@/lib/data/tenant-data";
import { getToolsWithDetails } from "@/lib/data/tools-data";
import { requireTenantContext } from "@/lib/session";

export default async function EmployeesPage() {
  const ctx = await requireTenantContext();
  const employees = await getEmployees(ctx.company.id, ctx.isDemo);
  const tools = await getToolsWithDetails(ctx.company.id, ctx.isDemo, employees);

  return (
    <EmployeesPageClient
      initialEmployees={employees}
      tools={tools}
      company={ctx.company}
      user={ctx.user}
      membershipRole={ctx.membershipRole}
      isDemo={ctx.isDemo}
    />
  );
}
