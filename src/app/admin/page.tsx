import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";
import {
  getAdminAlerts,
  getAdminDashboardSummary,
  getUnreadAlertCount,
} from "@/lib/data/platform-data";

export default async function AdminDashboardPage() {
  const user = await requireSuperAdminUser();
  const [summary, alerts, unreadAlerts] = await Promise.all([
    getAdminDashboardSummary(),
    getAdminAlerts(8),
    getUnreadAlertCount(),
  ]);

  return (
    <AdminLayoutShell
      user={user}
      unreadAlerts={unreadAlerts}
      title="Administration plateforme"
      description="Vue d'ensemble Construction iOS"
    >
      <AdminDashboardClient summary={summary} recentAlerts={alerts} />
    </AdminLayoutShell>
  );
}
