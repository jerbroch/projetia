import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { CompaniesTable } from "@/components/admin/companies-table";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";
import { getPlatformCompanies, getUnreadAlertCount } from "@/lib/data/platform-data";

export default async function AdminCompaniesPage() {
  const user = await requireSuperAdminUser();
  const [companies, unreadAlerts] = await Promise.all([
    getPlatformCompanies(),
    getUnreadAlertCount(),
  ]);

  return (
    <AdminLayoutShell
      user={user}
      unreadAlerts={unreadAlerts}
      title="Entreprises"
      description="Liste de toutes les entreprises inscrites"
    >
      <CompaniesTable companies={companies} />
    </AdminLayoutShell>
  );
}
