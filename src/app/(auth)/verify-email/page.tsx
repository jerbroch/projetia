import { getSessionUser } from "@/lib/session";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email: emailFromQuery } = await searchParams;
  const user = await getSessionUser();
  const email = user?.email ?? emailFromQuery;

  return <VerifyEmailForm email={email} />;
}
