"use client";

import { useSearchParams } from "next/navigation";

export function AdminDeniedBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("admin_denied") !== "1") return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Accès Super Admin refusé pour ce compte. Vérifiez que votre utilisateur est bien
      enregistré dans <code className="text-xs">platform_admins</code>.
    </div>
  );
}
