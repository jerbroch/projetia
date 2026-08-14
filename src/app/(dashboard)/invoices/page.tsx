import { Suspense } from "react";
import { InvoicesPageClient } from "@/components/invoices/invoices-page-client";
import { getInvoices, getScheduleEvents } from "@/lib/data/tenant-data";
import { requireTenantContext } from "@/lib/session";

export default async function InvoicesPage() {
  const ctx = await requireTenantContext();
  const [invoices, scheduleEvents] = await Promise.all([
    getInvoices(ctx.company.id, ctx.isDemo),
    getScheduleEvents(ctx.company.id, ctx.isDemo),
  ]);

  return (
    <Suspense fallback={null}>
      <InvoicesPageClient
        invoices={invoices}
        scheduleEvents={scheduleEvents}
        company={ctx.company}
        user={ctx.user}
        membershipRole={ctx.membershipRole}
        isDemo={ctx.isDemo}
      />
    </Suspense>
  );
}
