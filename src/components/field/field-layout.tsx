"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, CalendarDays, Hammer, Wrench } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import type { Company, User } from "@/types";

const NAV_ITEMS = [
  { href: "/terrain", label: "Aujourd'hui", icon: Hammer, exact: true },
  { href: "/terrain/horaire", label: "Mon horaire", icon: CalendarDays },
  { href: "/terrain/outils", label: "Mes outils", icon: Wrench },
];

interface FieldLayoutProps {
  children: React.ReactNode;
  company: Company;
  user: User;
}

export function FieldLayout({ children, company, user }: FieldLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{company.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.name}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-muted-foreground"
              aria-label="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-3 gap-1 px-2 py-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl px-2 py-2 text-xs font-medium",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="mb-1 h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
