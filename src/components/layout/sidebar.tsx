"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  CreditCard,
  FileText,
  HardHat,
  LayoutDashboard,
  Menu,
  Receipt,
  Archive,
  Settings,
  Users,
  UserCircle,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { Company } from "@/types";

const navigation = [
  { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { name: "Clients", href: "/customers", icon: Users },
  { name: "Soumissions", href: "/quotes", icon: FileText },
  { name: "Factures", href: "/invoices", icon: Receipt },
  { name: "Calendrier", href: "/schedule", icon: Calendar },
  { name: "Archives", href: "/archives", icon: Archive },
  { name: "Employés", href: "/employees", icon: UserCircle },
  { name: "Outillage", href: "/outillage", icon: Wrench },
  { name: "Paiements", href: "/payments", icon: CreditCard },
  { name: "Paramètres", href: "/settings", icon: Settings },
];

interface SidebarProps {
  company: Company;
  isDemo?: boolean;
}

export function Sidebar({ company, isDemo }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <>
      <div className="flex h-16 items-center gap-2 border-b px-6">
        {company.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logoUrl} alt={company.name} className="h-8 w-8 rounded-lg object-cover" />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-foreground"
            style={{ backgroundColor: company.primaryColor ?? undefined }}
          >
            <HardHat className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{company.name}</span>
          {isDemo && (
            <span className="block truncate text-[10px] text-amber-600">Compte de démonstration</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>

      <aside className="hidden w-64 flex-col border-r bg-background lg:flex">
        {navContent}
      </aside>
    </>
  );
}
