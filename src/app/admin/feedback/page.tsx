import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { FeedbackList } from "@/components/admin/feedback-list";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";
import { getPlatformFeedback, getUnreadAlertCount } from "@/lib/data/platform-data";

export default async function AdminFeedbackPage() {
  const user = await requireSuperAdminUser();
  const [feedback, unreadAlerts] = await Promise.all([
    getPlatformFeedback(),
    getUnreadAlertCount(),
  ]);

  return (
    <AdminLayoutShell
      user={user}
      unreadAlerts={unreadAlerts}
      title="Commentaires utilisateurs"
      description="Retours des entreprises — traiter et regrouper en améliorations"
    >
      <FeedbackList feedback={feedback} />
    </AdminLayoutShell>
  );
}
