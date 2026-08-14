import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AlertList } from "@/components/admin/alert-list";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";
import { getAdminAlerts, getUnreadAlertCount } from "@/lib/data/platform-data";

export default async function AdminAlertsPage() {
  const user = await requireSuperAdminUser();
  const [alerts, unreadAlerts] = await Promise.all([
    getAdminAlerts(100),
    getUnreadAlertCount(),
  ]);

  return (
    <AdminLayoutShell
      user={user}
      unreadAlerts={unreadAlerts}
      title="Centre d'alertes"
      description="Alertes plateforme non lues et historique"
    >
      <AlertList alerts={alerts} />
    </AdminLayoutShell>
  );
}
