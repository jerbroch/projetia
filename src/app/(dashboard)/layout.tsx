import { Suspense } from "react";
import { AdminQuickLink } from "@/components/admin/admin-quick-link";
import { AdminDeniedBanner } from "@/components/admin/admin-denied-banner";
import { requireCompanyAccess } from "@/lib/session";

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  await requireCompanyAccess();
  return (
    <>
      <Suspense fallback={null}>
        <AdminDeniedBanner />
      </Suspense>
      {children}
      <AdminQuickLink />
    </>
  );
}
