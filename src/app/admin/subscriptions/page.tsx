import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";
import {
  getCompanySubscriptions,
  getPlatformCompanies,
  getUnreadAlertCount,
} from "@/lib/data/platform-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  etatStripeDepuisEnvironnement,
  messageAucunAbonne,
} from "@/lib/billing/etat-stripe";
import { StatusBadge } from "@/components/shared/status-badge";

export default async function AdminSubscriptionsPage() {
  const user = await requireSuperAdminUser();
  const [subscriptions, companies, unreadAlerts] = await Promise.all([
    getCompanySubscriptions(),
    getPlatformCompanies(),
    getUnreadAlertCount(),
  ]);

  // Zéro abonné et Stripe débranché sont deux situations différentes. On les
  // distingue, et on dit combien d'entreprises sont en beta ou en essai — sans
  // ce chiffre, « aucun abonné » ressemble à une panne.
  const etatStripe = etatStripeDepuisEnvironnement();
  const comptes = {
    beta: companies.filter((c) => c.accessType === "beta" || c.isBeta).length,
    essai: companies.filter((c) => c.subscriptionStatus === "trial").length,
  };

  const companyNames = new Map(companies.map((c) => [c.id, c.name]));

  return (
    <AdminLayoutShell
      user={user}
      unreadAlerts={unreadAlerts}
      title="Abonnements"
      description="Abonnements enregistrés (données réelles uniquement)"
    >
      {subscriptions.length === 0 ? (
        <div className="space-y-2">
          {/*
            L'ancien message accusait Stripe dès que la liste était vide, sans
            rien vérifier — et la liste lisait une table que rien ne remplit.
            Il aurait dit « connectez Stripe » avec cent abonnés payants.
          */}
          <p className="text-sm text-muted-foreground">
            {messageAucunAbonne(etatStripe, comptes)}
          </p>
          {!etatStripe.pretAEncaisser && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Tant que ce point n&apos;est pas réglé, aucun abonnement ne pourra être enregistré.
            </p>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Période</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((sub) => (
              <TableRow key={sub.id}>
                <TableCell>{companyNames.get(sub.companyId) ?? sub.companyId}</TableCell>
                <TableCell>{sub.planName ?? "—"}</TableCell>
                <TableCell>{formatCurrency(sub.planAmountCents / 100)}</TableCell>
                <TableCell>
                  <StatusBadge status={sub.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {sub.currentPeriodStart && sub.currentPeriodEnd
                    ? `${formatDate(sub.currentPeriodStart)} → ${formatDate(sub.currentPeriodEnd)}`
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AdminLayoutShell>
  );
}
