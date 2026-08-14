import Link from "next/link";
import { Shield } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { isSuperAdminUser } from "@/lib/platform/super-admin";

export async function AdminQuickLink() {
  const user = await getSessionUser();
  if (!user || user.isDemo) return null;

  const isAdmin = await isSuperAdminUser(user.id);
  if (!isAdmin) return null;

  return (
    <Link
      href="/admin"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90"
    >
      <Shield className="h-4 w-4" />
      Super Admin
    </Link>
  );
}
