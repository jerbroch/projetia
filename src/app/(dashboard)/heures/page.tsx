import { HeuresPageClient } from "@/components/heures/heures-page-client";
import { getFieldHoursForCompany } from "@/lib/data/field-hours-data";
import { requireTenantContext } from "@/lib/session";

export default async function HeuresPage() {
  const ctx = await requireTenantContext();
  const lignes = ctx.isDemo ? [] : await getFieldHoursForCompany(ctx.company.id);

  return (
    <HeuresPageClient
      lignes={lignes}
      company={ctx.company}
      user={ctx.user}
      isDemo={ctx.isDemo}
    />
  );
}
