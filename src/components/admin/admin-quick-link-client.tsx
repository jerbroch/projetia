"use client";

import Link from "next/link";
import { Shield } from "lucide-react";

export function AdminQuickLinkClient() {
  return (
    <Link
      href="/admin"
      prefetch
      data-testid="super-admin-quick-link"
      className="pointer-events-auto fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90"
    >
      <Shield className="h-4 w-4" aria-hidden />
      Super Admin
    </Link>
  );
}
