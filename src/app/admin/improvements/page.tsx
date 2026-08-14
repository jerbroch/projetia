import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { ImprovementsManager } from "@/components/admin/improvements-manager";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";
import {
  getPlatformFeedback,
  getPlatformImprovements,
  getUnreadAlertCount,
} from "@/lib/data/platform-data";

export default async function AdminImprovementsPage() {
  const user = await requireSuperAdminUser();
  const [improvements, feedback, unreadAlerts] = await Promise.all([
    getPlatformImprovements(),
    getPlatformFeedback(),
    getUnreadAlertCount(),
  ]);

  return (
    <AdminLayoutShell
      user={user}
      unreadAlerts={unreadAlerts}
      title="Améliorations"
      description="Regroupement manuel des commentaires similaires"
    >
      <ImprovementsManager improvements={improvements} feedback={feedback} />
    </AdminLayoutShell>
  );
}
