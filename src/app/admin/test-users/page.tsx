import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { TestUsersManager } from "@/components/admin/test-users-manager";
import { getPlatformTestUsers, getUnreadAlertCount } from "@/lib/data/platform-data";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";

export default async function AdminTestUsersPage() {
  const user = await requireSuperAdminUser();
  const [testUsers, unreadAlerts] = await Promise.all([
    getPlatformTestUsers(),
    getUnreadAlertCount(),
  ]);

  return (
    <AdminLayoutShell
      user={user}
      unreadAlerts={unreadAlerts}
      title="Créer un utilisateur test"
      description="Outil réservé au super administrateur — environnement de développement"
    >
      <TestUsersManager testUsers={testUsers} />
    </AdminLayoutShell>
  );
}
