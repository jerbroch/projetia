import { EmployeesPageClient } from "@/components/employees/employees-page-client";
import { getEmployees } from "@/lib/data/tenant-data";
import { requireTenantContext } from "@/lib/session";

export default async function EmployeesPage() {
  const ctx = await requireTenantContext();
  const employees = await getEmployees(ctx.company.id, ctx.isDemo);

  return (
    <EmployeesPageClient
      initialEmployees={employees}
      company={ctx.company}
      user={ctx.user}
      isDemo={ctx.isDemo}
    />
  );
}
