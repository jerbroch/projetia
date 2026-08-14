import { redirect } from "next/navigation";
import { isSuperAdminUser } from "@/lib/platform/super-admin";
import { getSessionUser } from "@/lib/session";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.isDemo) redirect("/dashboard?admin_denied=1");

  const isAdmin = await isSuperAdminUser(user.id);
  if (!isAdmin) redirect("/dashboard?admin_denied=1");

  return <>{children}</>;
}
