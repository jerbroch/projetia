import { ArchivesPageClient } from "@/components/archives/archives-page-client";
import {
  getArchivedScheduleJobs,
  getCustomers,
  getEmployees,
  getQuotes,
} from "@/lib/data/tenant-data";
import { requireTenantContext } from "@/lib/session";
import type { Quote } from "@/types";

export default async function ArchivesPage() {
  const ctx = await requireTenantContext();
  const [events, customers, employees, quotes] = await Promise.all([
    getArchivedScheduleJobs(ctx.company.id, ctx.isDemo),
    getCustomers(ctx.company.id, ctx.isDemo),
    getEmployees(ctx.company.id, ctx.isDemo),
    getQuotes(ctx.company.id, ctx.isDemo),
  ]);

  const quotesById = quotes.reduce<Record<string, Quote>>((acc, quote) => {
    acc[quote.id] = quote;
    return acc;
  }, {});

  return (
    <ArchivesPageClient
      initialEvents={events}
      customers={customers}
      employees={employees}
      quotesById={quotesById}
      company={ctx.company}
      user={ctx.user}
      membershipRole={ctx.membershipRole}
      isDemo={ctx.isDemo}
    />
  );
}
