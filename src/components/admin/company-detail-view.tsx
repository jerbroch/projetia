import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import type {
  CompanySubscription,
  CompanyUsageStats,
  PlatformCompanySummary,
  PlatformFeedback,
} from "@/types/platform";
import { AT_RISK_REASON_LABELS } from "@/lib/platform/labels";
import { accessTypeLabel } from "@/lib/access-control";
import { formatDate } from "@/lib/utils";

interface CompanyDetailViewProps {
  company: PlatformCompanySummary;
  stats: CompanyUsageStats;
  subscriptions: CompanySubscription[];
  feedback: PlatformFeedback[];
  atRiskReasons?: string[];
}

export function CompanyDetailView({
  company,
  stats,
  subscriptions,
  feedback,
  atRiskReasons = [],
}: CompanyDetailViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        {company.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logoUrl}
            alt={company.name}
            className="h-16 w-16 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-xl font-bold text-primary">
            {company.name.charAt(0)}
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold">{company.name}</h2>
          <p className="text-sm text-muted-foreground">
            Inscrite le {formatDate(company.createdAt)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge status={company.subscriptionStatus} />
            <span className="rounded bg-muted px-2 py-0.5 text-xs">
              {accessTypeLabel(company.accessType)}
            </span>
            {company.isBeta && (
              <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-800">
                Bêta
              </span>
            )}
            {company.planName && (
              <span className="rounded bg-muted px-2 py-0.5 text-xs">{company.planName}</span>
            )}
          </div>
        </div>
      </div>

      {atRiskReasons.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-900">Signaux à risque</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc text-sm text-amber-900">
              {atRiskReasons.map((r) => (
                <li key={r}>{AT_RISK_REASON_LABELS[r as keyof typeof AT_RISK_REASON_LABELS] ?? r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Accès & abonnement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Type d&apos;accès : {accessTypeLabel(company.accessType)}</p>
            <p>Statut : {company.subscriptionStatus}</p>
            {company.promoCode && (
              <p>
                Code promo : {company.promoCode}
                {company.promoCodeUsedAt &&
                  ` (${formatDate(company.promoCodeUsedAt)})`}
              </p>
            )}
            {company.accessGrantedAt && (
              <p>Accès depuis : {formatDate(company.accessGrantedAt)}</p>
            )}
            {company.subscriptionStartedAt && (
              <p>Début abonnement : {formatDate(company.subscriptionStartedAt)}</p>
            )}
            {company.subscriptionEndsAt && (
              <p>Fin abonnement : {formatDate(company.subscriptionEndsAt)}</p>
            )}
            {company.pendingPlan && (
              <p className="text-muted-foreground">
                Plan en attente de paiement : {company.pendingPlan}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Propriétaire : {company.ownerName ?? "—"}</p>
            <p>Courriel : {company.ownerEmail ?? company.email ?? "—"}</p>
            <p>Téléphone : {company.phone ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Utilisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Dernière connexion : {stats.lastLogin ? formatDate(stats.lastLogin) : "—"}</p>
            <p>Utilisateurs actifs : {stats.activeUsers}</p>
            <p>Clients : {stats.clientsCount}</p>
            <p>Appels / demandes : {stats.callsCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Activité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Soumissions créées : {stats.quotesCreated}</p>
            <p>Soumissions envoyées : {stats.quotesSent}</p>
            <p>Factures : {stats.invoicesCount}</p>
            <p>Activité 7 j : {stats.activity7d}</p>
            <p>Activité 30 j : {stats.activity30d}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique d&apos;abonnement</CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun abonnement enregistré.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {subscriptions.map((sub) => (
                <li key={sub.id} className="rounded border p-3">
                  <p className="font-medium">{sub.planName ?? "Plan"} — {sub.status}</p>
                  <p className="text-muted-foreground">
                    {(sub.planAmountCents / 100).toFixed(2)} {sub.currency.toUpperCase()}/mois
                  </p>
                  {sub.currentPeriodEnd && (
                    <p className="text-xs text-muted-foreground">
                      Période jusqu&apos;au {formatDate(sub.currentPeriodEnd)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commentaires envoyés</CardTitle>
        </CardHeader>
        <CardContent>
          {feedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun commentaire.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {feedback.map((f) => (
                <li key={f.id} className="rounded border p-3">
                  <p className="font-medium">{f.title}</p>
                  <p className="text-muted-foreground">{f.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(f.createdAt)} · {f.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
