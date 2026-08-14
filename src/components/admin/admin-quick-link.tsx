import { getSessionUser } from "@/lib/session";
import { isSuperAdminUser } from "@/lib/platform/super-admin";
import { AdminQuickLinkClient } from "@/components/admin/admin-quick-link-client";

export async function AdminQuickLink() {
  const user = await getSessionUser();
  if (!user || user.isDemo) return null;

  const isAdmin = await isSuperAdminUser(user.id);
  if (!isAdmin) return null;

  return <AdminQuickLinkClient />;
}
