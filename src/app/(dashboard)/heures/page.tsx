import { HeuresPageClient } from "@/components/heures/heures-page-client";
import {
  getFieldHoursForCompany,
  getPlannedHoursForCompany,
} from "@/lib/data/field-hours-data";
import { requireTenantContext } from "@/lib/session";

export default async function HeuresPage() {
  const ctx = await requireTenantContext();
  const [reelles, prevues] = ctx.isDemo
    ? [[], []]
    : await Promise.all([
        getFieldHoursForCompany(ctx.company.id),
        getPlannedHoursForCompany(ctx.company.id),
      ]);

  return (
    <HeuresPageClient
      lignes={reelles}
      prevues={prevues}
      company={ctx.company}
      user={ctx.user}
      isDemo={ctx.isDemo}
    />
  );
}
