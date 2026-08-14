import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { DollarSign, TrendingDown, TrendingUp, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { SaasMetrics } from "@/types/platform";

interface RevenueDashboardProps {
  metrics: SaasMetrics;
}

export function RevenueDashboard({ metrics }: RevenueDashboardProps) {
  if (!metrics.available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenus SaaS</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Données d&apos;abonnement non disponibles. Connectez Stripe et enregistrez les
            abonnements dans <code className="text-xs">company_subscriptions</code> pour voir
            les métriques réelles.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="MRR" value={formatCurrency(metrics.mrr)} icon={DollarSign} />
        <StatCard title="ARR" value={formatCurrency(metrics.arr)} icon={TrendingUp} />
        <StatCard title="ARPU" value={formatCurrency(metrics.arpu)} icon={Users} />
        <StatCard
          title="Entreprises payantes"
          value={metrics.payingCompanies}
          icon={Users}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Nouveau MRR" value={formatCurrency(metrics.newMrr)} icon={TrendingUp} />
        <StatCard title="MRR perdu" value={formatCurrency(metrics.lostMrr)} icon={TrendingDown} />
        <StatCard
          title="Taux de désabonnement"
          value={`${metrics.churnRate.toFixed(1)} %`}
          icon={TrendingDown}
        />
        <StatCard title="Nouveaux abonnements" value={metrics.newSubscriptions} icon={TrendingUp} />
        <StatCard title="Annulations" value={metrics.cancellations} icon={TrendingDown} />
        <StatCard
          title="Conversions essai"
          value={metrics.trialConversions}
          icon={TrendingUp}
        />
      </div>
    </div>
  );
}
