import { requireTenantContext } from "@/lib/session";
import { getEmployees, getScheduleEvents } from "@/lib/data/tenant-data";
import { getToolsWithDetails } from "@/lib/data/tools-data";
import { OutillagePageClient } from "@/components/outillage/outillage-page-client";

export default async function OutillagePage() {
  const ctx = await requireTenantContext();
  const employees = await getEmployees(ctx.company.id, ctx.isDemo);
  const tools = await getToolsWithDetails(ctx.company.id, ctx.isDemo, employees);

  // Un outil sorti pour un chantier doit dire LEQUEL : « où est-il » est la
  // question qu'on se pose devant un outil manquant au magasin.
  const calls = await getScheduleEvents(ctx.company.id, ctx.isDemo);
  const titresDeCalls: Record<string, string> = {};
  for (const c of calls) {
    titresDeCalls[c.id] = [c.title, c.customerName].filter(Boolean).join(" — ");
  }

  return (
    <OutillagePageClient
      initialTools={tools}
      employees={employees}
        jobTitles={titresDeCalls}
      company={ctx.company}
      user={ctx.user}
      membershipRole={ctx.membershipRole}
      isDemo={ctx.isDemo}
    />
  );
}
