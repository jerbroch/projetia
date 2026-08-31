import { PaymentsPageClient } from "@/components/payments/payments-page-client";
import { getPayments } from "@/lib/data/tenant-data";
import { requireTenantContext } from "@/lib/session";

export default async function PaymentsPage() {
  const ctx = await requireTenantContext();
  const payments = await getPayments(ctx.company.id, ctx.isDemo);

  return (
    <PaymentsPageClient
      payments={payments}
      company={ctx.company}
      user={ctx.user}
      isDemo={ctx.isDemo}
    />
  );
}
