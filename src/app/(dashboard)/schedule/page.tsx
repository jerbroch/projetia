import { SchedulePageClient } from "@/components/schedule/schedule-page-client";
import {
  getCustomers,
  getEmployees,
  getScheduleEvents,
} from "@/lib/data/tenant-data";
import { requireTenantContext } from "@/lib/session";

interface SchedulePageProps {
  searchParams: Promise<{ date?: string; eventId?: string }>;
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const ctx = await requireTenantContext();
  const { date, eventId } = await searchParams;
  const [events, customers, employees] = await Promise.all([
    getScheduleEvents(ctx.company.id, ctx.isDemo),
    getCustomers(ctx.company.id, ctx.isDemo),
    getEmployees(ctx.company.id, ctx.isDemo),
  ]);

  return (
    <SchedulePageClient
      initialEvents={events}
      initialCustomers={customers}
      initialEmployees={employees}
      company={ctx.company}
      user={ctx.user}
      membershipRole={ctx.membershipRole}
      isDemo={ctx.isDemo}
      initialDate={date}
      initialEventId={eventId}
    />
  );
}
