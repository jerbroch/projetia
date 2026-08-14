"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Building2,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  Lightbulb,
  Map,
  MessageSquare,
  Shield,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

const adminNav = [
  { name: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
  { name: "Alertes", href: "/admin/alerts", icon: AlertTriangle },
  { name: "Entreprises", href: "/admin/companies", icon: Building2 },
  { name: "Comptes test", href: "/admin/test-users", icon: FlaskConical },
  { name: "Abonnements", href: "/admin/subscriptions", icon: CreditCard },
  { name: "Revenus", href: "/admin/revenue", icon: TrendingUp },
  { name: "À risque", href: "/admin/at-risk", icon: Shield },
  { name: "Activité", href: "/admin/activity", icon: Activity },
  { name: "Commentaires", href: "/admin/feedback", icon: MessageSquare },
  { name: "Améliorations", href: "/admin/improvements", icon: Lightbulb },
  { name: "Feuille de route", href: "/admin/roadmap", icon: Map },
];

interface AdminSidebarProps {
  unreadAlerts?: number;
}

export function AdminSidebar({ unreadAlerts = 0 }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r bg-background">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Shield className="h-5 w-5 text-primary" />
        <div>
          <span className="block text-sm font-bold">Super Admin</span>
          <span className="block text-[10px] text-muted-foreground">Construction iOS</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {adminNav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));
          const showBadge = item.href === "/admin/alerts" && unreadAlerts > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                {item.name}
              </span>
              {showBadge && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {unreadAlerts > 99 ? "99+" : unreadAlerts}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <Button asChild variant="outline" className="w-full">
          <Link href="/dashboard">
            <Building2 className="h-4 w-4" />
            Retour à mon entreprise
          </Link>
        </Button>
      </div>
    </aside>
  );
}

interface AdminLayoutShellProps {
  children: React.ReactNode;
  user: User;
  unreadAlerts?: number;
  title: string;
  description?: string;
}

export function AdminLayoutShell({
  children,
  user: _user,
  unreadAlerts,
  title,
  description,
}: AdminLayoutShellProps) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar unreadAlerts={unreadAlerts} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-6">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard">
                <Building2 className="h-4 w-4" />
                Retour à mon entreprise
              </Link>
            </Button>
            <div className="text-right text-sm">
              <p className="font-medium">Super Admin</p>
              <p className="text-xs text-muted-foreground">Super administrateur</p>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
