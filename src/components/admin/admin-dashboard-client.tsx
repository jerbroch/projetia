"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CreditCard,
  Lightbulb,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { AdminAlert, AdminDashboardSummary } from "@/types/platform";
import { ALERT_TYPE_LABELS } from "@/lib/platform/labels";

interface AdminDashboardClientProps {
  summary: AdminDashboardSummary;
  recentAlerts: AdminAlert[];
}

export function AdminDashboardClient({ summary, recentAlerts }: AdminDashboardClientProps) {
  const { metrics } = summary;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Entreprises payantes"
          value={summary.payingCompanies}
          icon={Building2}
          href="/admin/companies"
        />
        <StatCard
          title="MRR"
          value={metrics.available ? formatCurrency(metrics.mrr) : "—"}
          description={metrics.available ? undefined : "Données non disponibles"}
          icon={TrendingUp}
          href="/admin/revenue"
        />
        <StatCard
          title="À risque"
          value={summary.atRiskCount}
          icon={AlertTriangle}
          href="/admin/at-risk"
        />
        <StatCard
          title="Commentaires"
          value={summary.newFeedbackCount}
          icon={MessageSquare}
          href="/admin/feedback"
        />
        <StatCard
          title="Paiements échoués"
          value={summary.failedPaymentsCount}
          icon={CreditCard}
          href="/admin/alerts"
        />
        <StatCard
          title="Alertes non lues"
          value={summary.unreadAlerts}
          icon={Lightbulb}
          href="/admin/alerts"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[
            { href: "/admin/feedback", label: "Nouveaux commentaires" },
            { href: "/admin/at-risk", label: "Clients à risque" },
            { href: "/admin/subscriptions", label: "Nouveaux abonnements" },
            { href: "/admin/alerts?type=failed_payment", label: "Paiements échoués" },
            { href: "/admin/companies", label: "Entreprises" },
            { href: "/admin/revenue", label: "Revenus" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              {action.label}
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Alertes récentes</CardTitle>
          <Link href="/admin/alerts" className="text-sm text-primary hover:underline">
            Voir tout
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune alerte.</p>
          ) : (
            recentAlerts.slice(0, 8).map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {ALERT_TYPE_LABELS[alert.alertType]} — {alert.title}
                  </p>
                  <p className="text-muted-foreground">{alert.description}</p>
                  {alert.companyName && (
                    <p className="text-xs text-muted-foreground">{alert.companyName}</p>
                  )}
                </div>
                {!alert.readAt && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                    Non lu
                  </span>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
