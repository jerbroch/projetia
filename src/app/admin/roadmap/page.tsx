import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { RoadmapBoard } from "@/components/admin/roadmap-board";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";
import { getPlatformImprovements, getUnreadAlertCount } from "@/lib/data/platform-data";

export default async function AdminRoadmapPage() {
  const user = await requireSuperAdminUser();
  const [improvements, unreadAlerts] = await Promise.all([
    getPlatformImprovements(),
    getUnreadAlertCount(),
  ]);

  return (
    <AdminLayoutShell
      user={user}
      unreadAlerts={unreadAlerts}
      title="Feuille de route interne"
      description="Colonnes par statut — déplacer via sélecteur de statut"
    >
      <RoadmapBoard improvements={improvements} />
    </AdminLayoutShell>
  );
}
