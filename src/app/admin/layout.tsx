import { redirect } from "next/navigation";
import { SuperAdminError, requireSuperAdminUser } from "@/lib/platform/super-admin";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireSuperAdminUser();
  } catch (error) {
    if (error instanceof SuperAdminError) {
      redirect("/dashboard?admin_denied=1");
    }
    redirect("/login?next=/admin");
  }

  return <>{children}</>;
}
