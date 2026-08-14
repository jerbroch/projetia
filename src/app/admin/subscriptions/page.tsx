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
import { StatusBadge } from "@/components/shared/status-badge";

export default async function AdminSubscriptionsPage() {
  const user = await requireSuperAdminUser();
  const [subscriptions, companies, unreadAlerts] = await Promise.all([
    getCompanySubscriptions(),
    getPlatformCompanies(),
    getUnreadAlertCount(),
  ]);

  const companyNames = new Map(companies.map((c) => [c.id, c.name]));

  return (
    <AdminLayoutShell
      user={user}
      unreadAlerts={unreadAlerts}
      title="Abonnements"
      description="Abonnements enregistrés (données réelles uniquement)"
    >
      {subscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun abonnement enregistré. Les données apparaîtront lorsque Stripe sera connecté et
          que les abonnements seront synchronisés dans company_subscriptions.
        </p>
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
