import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { ActivityLogTable } from "@/components/admin/activity-log-table";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";
import { getAdminActivityLog, getUnreadAlertCount } from "@/lib/data/platform-data";

interface PageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function AdminActivityPage({ searchParams }: PageProps) {
  const { q, type } = await searchParams;
  const user = await requireSuperAdminUser();
  const [entries, unreadAlerts] = await Promise.all([
    getAdminActivityLog({ search: q, eventType: type, limit: 200 }),
    getUnreadAlertCount(),
  ]);

  return (
    <AdminLayoutShell
      user={user}
      unreadAlerts={unreadAlerts}
      title="Journal d'activité admin"
      description="Événements plateforme avec recherche et filtres"
    >
      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Rechercher..."
          className="rounded-md border px-3 py-2 text-sm"
        />
        <select
          name="type"
          defaultValue={type ?? ""}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Tous les types</option>
          <option value="company_created">Entreprise créée</option>
          <option value="subscription_activated">Abonnement activé</option>
          <option value="payment_failed">Paiement échoué</option>
          <option value="feedback_sent">Commentaire envoyé</option>
          <option value="feedback_treated">Commentaire traité</option>
        </select>
        <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
          Filtrer
        </button>
      </form>
      <ActivityLogTable entries={entries} />
    </AdminLayoutShell>
  );
}
