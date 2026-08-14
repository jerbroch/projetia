import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AtRiskList } from "@/components/admin/at-risk-list";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";
import { getAtRiskCompanies, getUnreadAlertCount } from "@/lib/data/platform-data";

export default async function AdminAtRiskPage() {
  const user = await requireSuperAdminUser();
  const [companies, unreadAlerts] = await Promise.all([
    getAtRiskCompanies(),
    getUnreadAlertCount(),
  ]);

  return (
    <AdminLayoutShell
      user={user}
      unreadAlerts={unreadAlerts}
      title="Clients à risque"
      description="Règles transparentes — raison affichée pour chaque entreprise"
    >
      <AtRiskList companies={companies} />
    </AdminLayoutShell>
  );
}
