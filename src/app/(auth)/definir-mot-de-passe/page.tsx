import { Suspense } from "react";
import { SetInitialPasswordForm } from "@/components/auth/set-initial-password-form";

export default function DefinirMotDePassePage() {
  return (
    <Suspense>
      <SetInitialPasswordForm />
    </Suspense>
  );
}
