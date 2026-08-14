import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { RevenueDashboard } from "@/components/admin/revenue-dashboard";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";
import { getSaasMetrics, getUnreadAlertCount } from "@/lib/data/platform-data";

export default async function AdminRevenuePage() {
  const user = await requireSuperAdminUser();
  const [metrics, unreadAlerts] = await Promise.all([
    getSaasMetrics(),
    getUnreadAlertCount(),
  ]);

  return (
    <AdminLayoutShell
      user={user}
      unreadAlerts={unreadAlerts}
      title="Revenus SaaS"
      description="Métriques basées sur les abonnements réels — aucune donnée inventée"
    >
      <RevenueDashboard metrics={metrics} />
    </AdminLayoutShell>
  );
}
