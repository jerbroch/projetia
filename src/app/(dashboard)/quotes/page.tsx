import { QuotesPageClient } from "@/components/quotes/quotes-page-client";
import {
  getCustomers,
  getEmployees,
  getQuotes,
  getScheduleEvents,
} from "@/lib/data/tenant-data";
import { requireTenantContext } from "@/lib/session";
import type { ScheduleEvent } from "@/types";

export default async function QuotesPage() {
  const ctx = await requireTenantContext();
  const [quotes, customers, employees, scheduleEvents] = await Promise.all([
    getQuotes(ctx.company.id, ctx.isDemo),
    getCustomers(ctx.company.id, ctx.isDemo),
    getEmployees(ctx.company.id, ctx.isDemo),
    getScheduleEvents(ctx.company.id, ctx.isDemo),
  ]);

  const scheduledEventsByQuoteId = scheduleEvents.reduce<Record<string, ScheduleEvent>>(
    (acc, event) => {
      if (event.quoteId) acc[event.quoteId] = event;
      return acc;
    },
    {}
  );

  return (
    <QuotesPageClient
      initialQuotes={quotes}
      customers={customers}
      employees={employees}
      scheduledEventsByQuoteId={scheduledEventsByQuoteId}
      company={ctx.company}
      user={ctx.user}
      isDemo={ctx.isDemo}
    />
  );
}
