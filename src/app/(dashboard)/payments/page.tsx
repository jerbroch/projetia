import { PaymentsPageClient } from "@/components/payments/payments-page-client";
import {
  getInvoices,
  getPayments,
} from "@/lib/data/tenant-data";
import { requireTenantContext } from "@/lib/session";

export default async function PaymentsPage() {
  const ctx = await requireTenantContext();
  const [payments, invoices] = await Promise.all([
    getPayments(ctx.company.id, ctx.isDemo),
    getInvoices(ctx.company.id, ctx.isDemo),
  ]);

  return (
    <PaymentsPageClient
      payments={payments}
      invoices={invoices}
      company={ctx.company}
      user={ctx.user}
      isDemo={ctx.isDemo}
    />
  );
}
