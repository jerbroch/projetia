import { CustomersPageClient } from "@/components/customers/customers-page-client";
import { getCustomers } from "@/lib/data/tenant-data";
import { requireTenantContext } from "@/lib/session";

export default async function CustomersPage() {
  const ctx = await requireTenantContext();
  const customers = await getCustomers(ctx.company.id, ctx.isDemo);

  return (
    <CustomersPageClient
      initialCustomers={customers}
      company={ctx.company}
      user={ctx.user}
      isDemo={ctx.isDemo}
    />
  );
}
