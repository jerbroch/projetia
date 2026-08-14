import { AdminQuickLink } from "@/components/admin/admin-quick-link";
import { requireCompanyAccess } from "@/lib/session";

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  await requireCompanyAccess();
  return (
    <>
      {children}
      <AdminQuickLink />
    </>
  );
}
