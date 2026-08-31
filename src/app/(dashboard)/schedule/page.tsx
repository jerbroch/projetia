import { SchedulePageClient } from "@/components/schedule/schedule-page-client";
import {
  getCustomers,
  getEmployees,
  getScheduleEvents,
} from "@/lib/data/tenant-data";
import { getShiftsForJobs } from "@/lib/data/job-shifts-data";
import { getToolsWithDetails } from "@/lib/data/tools-data";
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
  const tools = await getToolsWithDetails(ctx.company.id, ctx.isDemo, employees);
  // Les plages par employé. Vide en démo, et vide tant qu'aucune n'est tracée :
  // l'affichage retombe alors sur les heures du call.
  const shifts = ctx.isDemo ? [] : await getShiftsForJobs(events.map((e) => e.id));

  return (
    <SchedulePageClient
      initialEvents={events}
      initialCustomers={customers}
      initialEmployees={employees}
      tools={tools}
      company={ctx.company}
      user={ctx.user}
      membershipRole={ctx.membershipRole}
      isDemo={ctx.isDemo}
      initialDate={date}
      initialEventId={eventId}
    />
  );
}
