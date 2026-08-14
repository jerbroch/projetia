import Link from "next/link";
import {
  Calendar,
  DollarSign,
  FileText,
  HardHat,
  MapPin,
  TrendingUp,
  Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatTimeRange } from "@/lib/utils";
import { getDashboardStats, getInvoices, getScheduleEvents } from "@/lib/data/tenant-data";
import { getJobBillingSheet } from "@/lib/data/billing-data";
import { getActiveFieldJobs } from "@/lib/field-workers";
import { filterPendingReviewJobs, canApproveBilling } from "@/lib/job-workflow";
import { DashboardReviewSection } from "@/components/dashboard/dashboard-review-section";
import { requireTenantContext } from "@/lib/session";
import { buildScheduleEventLink } from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";

const interactiveRowClassName =
  "flex items-start justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function DashboardPage() {
  const ctx = await requireTenantContext();
  const [stats, scheduleEvents, invoices] = await Promise.all([
    getDashboardStats(ctx.company.id, ctx.isDemo),
    getScheduleEvents(ctx.company.id, ctx.isDemo),
    getInvoices(ctx.company.id, ctx.isDemo),
  ]);

  const activeFieldJobs = getActiveFieldJobs(scheduleEvents);
  const pendingReviewJobs = filterPendingReviewJobs(scheduleEvents);
  const showReviewSection = canApproveBilling(ctx.membershipRole);

  const billingTotals: Record<string, number> = {};
  if (!ctx.isDemo && showReviewSection) {
    await Promise.all(
      pendingReviewJobs.slice(0, 10).map(async (job) => {
        const sheet = await getJobBillingSheet(ctx.company.id, job.id);
        if (sheet) billingTotals[job.id] = sheet.total;
      })
    );
  }

  const upcomingEvents = scheduleEvents
    .filter((e) => e.status === "scheduled")
    .slice(0, 4);

  const recentInvoices = invoices.slice(0, 4);
  const isEmpty = !ctx.isDemo && customersCountIsZero(stats);

  return (
    <DashboardLayout
      title="Tableau de bord"
      description="Aperçu de votre entreprise de construction"
      company={ctx.company}
      user={ctx.user}
      isDemo={ctx.isDemo}
    >
      <div className="space-y-6">
        {isEmpty ? (
          <EmptyState
            title="Bienvenue sur ConstructionIOS!"
            description="Commencez par ajouter vos clients, employés et travaux planifiés depuis le menu."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard
                title="Revenus totaux"
                value={formatCurrency(stats.totalRevenue)}
                icon={DollarSign}
                href="/invoices"
                trend={ctx.isDemo ? { value: 12.5, label: "du mois dernier" } : undefined}
              />
              <StatCard
                title="Projets actifs"
                value={stats.activeProjects}
                icon={HardHat}
                href="/schedule"
              />
              <StatCard
                title="Clients"
                value={stats.totalCustomers}
                icon={Users}
                href="/customers"
                trend={ctx.isDemo ? { value: 8, label: "nouveaux ce mois" } : undefined}
              />
              <StatCard
                title="Factures en attente"
                value={stats.pendingInvoices}
                icon={FileText}
                href="/invoices"
              />
              <StatCard
                title="Travaux à venir"
                value={stats.upcomingJobs}
                icon={Calendar}
                href="/schedule"
              />
              <StatCard
                title="Travailleurs sur le terrain"
                value={stats.employeesOnSite}
                icon={TrendingUp}
                href="/schedule"
              />
            </div>

            <Card>
              <CardHeader>
                <Link
                  href="/schedule"
                  className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CardTitle className="transition-colors group-hover:text-primary">
                    Travaux en cours
                  </CardTitle>
                  <CardDescription>
                    Employés actuellement assignés à des appels actifs
                  </CardDescription>
                </Link>
              </CardHeader>
              <CardContent>
                {activeFieldJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun travailleur actuellement sur le terrain.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activeFieldJobs.map((job) => (
                      <Link
                        key={job.jobId}
                        href={buildScheduleEventLink({ id: job.jobId, start: job.start })}
                        className={cn(interactiveRowClassName, "cursor-pointer")}
                        aria-label={`Ouvrir ${job.title} dans le calendrier`}
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{job.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {job.employeeNames.join(", ")}
                          </p>
                          <p className="text-xs text-muted-foreground">{job.customerName}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {job.address}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(job.start)} · {formatTimeRange(job.start, job.end)}
                          </p>
                        </div>
                        <StatusBadge status={job.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <DashboardReviewSection
              pendingJobs={pendingReviewJobs}
              billingTotals={billingTotals}
              showSection={showReviewSection}
            />

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <Link
                    href="/schedule"
                    className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <CardTitle className="transition-colors group-hover:text-primary">
                      Calendrier à venir
                    </CardTitle>
                    <CardDescription>Travaux et rendez-vous cette semaine</CardDescription>
                  </Link>
                </CardHeader>
                <CardContent>
                  {upcomingEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun travail planifié.</p>
                  ) : (
                    <div className="space-y-4">
                      {upcomingEvents.map((event) => (
                        <Link
                          key={event.id}
                          href={buildScheduleEventLink(event)}
                          className={cn(interactiveRowClassName, "cursor-pointer")}
                          aria-label={`Ouvrir ${event.title} dans le calendrier`}
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{event.title}</p>
                            <p className="text-xs text-muted-foreground">{event.location}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(event.start)} · {event.employeeNames.join(", ")}
                            </p>
                          </div>
                          <StatusBadge status={event.status} />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Link
                    href="/invoices"
                    className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <CardTitle className="transition-colors group-hover:text-primary">
                      Factures récentes
                    </CardTitle>
                    <CardDescription>Dernière activité de facturation</CardDescription>
                  </Link>
                </CardHeader>
                <CardContent>
                  {recentInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune facture pour le moment.</p>
                  ) : (
                    <div className="space-y-4">
                      {recentInvoices.map((invoice) => (
                        <Link
                          key={invoice.id}
                          href={`/invoices?invoice=${invoice.id}`}
                          className={cn(
                            interactiveRowClassName,
                            "items-center cursor-pointer"
                          )}
                          aria-label={`Voir la facture ${invoice.invoiceNumber}`}
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-muted-foreground">{invoice.customerName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{formatCurrency(invoice.amount)}</p>
                            <StatusBadge status={invoice.status} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function customersCountIsZero(stats: { totalCustomers: number; totalRevenue: number }) {
  return stats.totalCustomers === 0 && stats.totalRevenue === 0;
}
