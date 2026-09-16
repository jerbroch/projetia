import Link from "next/link";
import { Suspense } from "react";
import {
  Calendar,
  FileText,
  FolderOpen,
  HardHat,
  MapPin,
  Plus,
  Receipt,
  Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CarteRevenus } from "@/components/dashboard/carte-revenus";
import { BandeTerrain } from "@/components/dashboard/bande-terrain";
import { PastilleDate, SectionTableau } from "@/components/dashboard/section-tableau";
import { SqueletteTableau } from "@/components/dashboard/squelette-tableau";
import { formatCurrency, formatDate, formatTimeRange } from "@/lib/utils";
import { dateLongueFrancais, jourEtMois, prenomDe } from "@/lib/dates-francais";
import { getDashboardStats, getInvoices, getScheduleEvents } from "@/lib/data/tenant-data";
import { getJobBillingSheet } from "@/lib/data/billing-data";
import { getActiveFieldJobs } from "@/lib/field-workers";
import { filterPendingReviewJobs, canApproveBilling } from "@/lib/job-workflow";
import { DashboardReviewSection } from "@/components/dashboard/dashboard-review-section";
import { requireTenantContext } from "@/lib/session";
import { buildScheduleEventLink } from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";

const interactiveRowClassName =
  "flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors duration-normal hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

/**
 * LE CHÂSSIS PART SANS ATTENDRE LES CHIFFRES.
 *
 * La page attendait TOUT — contexte, horaire, clients, factures, fiches de
 * facturation — avant d'envoyer son premier octet. Mesuré : la page finissait
 * son travail de données en 290 ms, mais le premier octet n'arrivait qu'à
 * 570 ms, et pendant tout ce temps l'écran précédent restait figé.
 *
 * Le menu, l'en-tête et la salutation ne dépendent que du contexte : ils
 * partent dès qu'il est là. Le reste arrive en continu, derrière un squelette
 * qui a la forme de ce qu'il remplace.
 */
export default async function DashboardPage() {
  const ctx = await requireTenantContext();
  const prenom = prenomDe(ctx.user.name);

  return (
    <DashboardLayout
      title="Tableau de bord"
      description="Aperçu de votre entreprise de construction"
      company={ctx.company}
      user={ctx.user}
      isDemo={ctx.isDemo}
    >
      <div className="mx-auto w-full max-w-[1600px] space-y-5">
        <div>
          <p className="text-right text-sm text-muted-foreground">{dateLongueFrancais()}</p>

          <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
                {prenom ? `Bonjour ${prenom}` : "Bonjour"}
              </h1>
              <p className="mt-1 text-lg text-muted-foreground sm:text-xl">
                Votre entreprise, en un coup d&apos;œil.
              </p>
            </div>

            <Button asChild size="lg" className="shrink-0">
              <Link href="/quotes">
                <Plus className="h-4 w-4" aria-hidden />
                Nouvelle soumission
              </Link>
            </Button>
          </div>
        </div>

        <Suspense fallback={<SqueletteTableau />}>
          <CorpsTableauDeBord />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}

async function CorpsTableauDeBord() {
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

  const upcomingEvents = scheduleEvents.filter((e) => e.status === "scheduled").slice(0, 4);
  const recentInvoices = invoices.slice(0, 4);
  const isEmpty = !ctx.isDemo && customersCountIsZero(stats);

  /*
   * LA BANDE COMPACTE NE S'AFFICHE QU'À VIDE.
   *
   * Tant que personne n'est sur le terrain et que rien n'attend d'être
   * vérifié, deux grandes cartes vides ne disent rien que deux chiffres à
   * zéro ne diraient mieux dans une bande. Dès qu'il y a quelque chose, les
   * sections détaillées reprennent leur place — avec leurs liens, leurs
   * adresses et leurs actions. La nouvelle présentation ne rend rien
   * inaccessible.
   */
  const terrainEtVerificationSontVides =
    activeFieldJobs.length === 0 && (!showReviewSection || pendingReviewJobs.length === 0);

  return (
    <>
        {isEmpty ? (
          <EmptyState
            title="Bienvenue sur Construction iOS!"
            description="Commencez par ajouter vos clients, employés et travaux planifiés depuis le menu."
          />
        ) : (
          <>
            {/* ───────── Les indicateurs ───────── */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {/* Les revenus prennent toute la largeur tant qu'il n'y a pas
                  quatre colonnes : c'est le chiffre qu'on lit en premier. */}
              <div className="col-span-2 xl:col-span-1">
                <CarteRevenus montant={formatCurrency(stats.totalRevenue)} />
              </div>
              <StatCard
                title="Projets actifs"
                value={stats.activeProjects}
                icon={FolderOpen}
                href="/schedule"
              />
              <StatCard
                title="Clients"
                value={stats.totalCustomers}
                icon={Users}
                href="/customers"
              />
              {/*
                L'ORANGE SIGNALE CE QUI ATTEND QUELQU'UN, et rien d'autre. Une
                facture en attente est une somme qu'on n'a pas encore reçue ;
                zéro facture en attente n'appelle aucune action, donc aucune
                couleur.
              */}
              <StatCard
                title="Factures en attente"
                value={stats.pendingInvoices}
                icon={FileText}
                href="/invoices"
                aAttirerLAttention={stats.pendingInvoices > 0}
              />
            </div>

            {/* ───────── Terrain et vérification ───────── */}
            {terrainEtVerificationSontVides ? (
              <BandeTerrain
                terrain={{
                  libelle: "Travailleurs sur le terrain",
                  valeur: stats.employeesOnSite,
                  vide: "Aucun travailleur présentement sur le terrain.",
                  href: "/schedule",
                }}
                verifier={{
                  libelle: "Travaux à vérifier",
                  valeur: pendingReviewJobs.length,
                  vide: "Aucun travail à vérifier pour le moment.",
                  href: "/reviews",
                }}
              />
            ) : (
              <>
                {activeFieldJobs.length > 0 && (
                  <Card>
                    <CardHeader>
                      <Link
                        href="/schedule"
                        className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <CardTitle className="transition-colors group-hover:text-accent-encre">
                          Travaux en cours
                        </CardTitle>
                        <CardDescription>
                          Employés actuellement assignés à des appels actifs
                        </CardDescription>
                      </Link>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {activeFieldJobs.map((job) => (
                          <Link
                            key={job.jobId}
                            href={buildScheduleEventLink({ id: job.jobId, start: job.start })}
                            className={cn(interactiveRowClassName, "cursor-pointer")}
                            aria-label={`Ouvrir ${job.title} dans le calendrier`}
                          >
                            <div className="min-w-0 space-y-1">
                              <p className="text-sm font-medium">{job.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {job.employeeNames.join(", ")}
                              </p>
                              <p className="text-xs text-muted-foreground">{job.customerName}</p>
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
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
                    </CardContent>
                  </Card>
                )}

                <DashboardReviewSection
                  pendingJobs={pendingReviewJobs}
                  billingTotals={billingTotals}
                  showSection={showReviewSection}
                />
              </>
            )}

            {/* ───────── Le calendrier et les factures ───────── */}
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionTableau
                titre="Calendrier à venir"
                icone={Calendar}
                lienHref="/schedule"
                lienTexte="Voir le calendrier"
                /* « Travaux à venir » n'a plus sa carte : le compteur vit ici,
                   au-dessus de la liste qu'il compte. */
                complement={
                  stats.upcomingJobs > 0
                    ? `${stats.upcomingJobs} ${stats.upcomingJobs > 1 ? "travaux à venir" : "travail à venir"}`
                    : "Aucun travail à venir"
                }
              >
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun travail planifié.</p>
                ) : (
                  <ul className="space-y-1">
                    {upcomingEvents.map((event) => {
                      const { jour, mois } = jourEtMois(event.start);
                      return (
                        <li key={event.id} className="min-w-0">
                          <Link
                            href={buildScheduleEventLink(event)}
                            className="flex min-h-[44px] items-start gap-3.5 rounded-lg p-2.5 transition-colors duration-normal hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                            aria-label={`Ouvrir ${event.title} dans le calendrier`}
                          >
                            <PastilleDate jour={jour} mois={mois} />
                            <span className="min-w-0 flex-1">
                              {/* `min-w-0` sur le conteneur ET sur le titre :
                                  sans lui, un enfant flex refuse de rétrécir
                                  sous la largeur de son texte et `truncate`
                                  n'a aucun effet — le titre sortait de la
                                  carte sur téléphone. */}
                              <span className="flex min-w-0 items-start justify-between gap-2">
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                  {event.title}
                                </span>
                                <span className="shrink-0">
                                  <StatusBadge status={event.status} />
                                </span>
                              </span>
                              {event.location && (
                                <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                                  <span className="truncate">{event.location}</span>
                                </span>
                              )}
                              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                                {formatTimeRange(event.start, event.end)}
                              </span>
                              {event.employeeNames.length > 0 && (
                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                  {event.employeeNames.join(", ")}
                                </span>
                              )}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionTableau>

              <SectionTableau
                titre="Factures récentes"
                icone={Receipt}
                lienHref="/invoices"
                lienTexte="Tout voir"
              >
                {recentInvoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune facture pour le moment.</p>
                ) : (
                  <ul className="space-y-1">
                    {recentInvoices.map((invoice) => (
                      <li key={invoice.id} className="min-w-0">
                        <Link
                          href={`/invoices?invoice=${invoice.id}`}
                          className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg p-2.5 transition-colors duration-normal hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                          aria-label={`Voir la facture ${invoice.invoiceNumber}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                              {invoice.invoiceNumber}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {/* `createdAt` : la facture n'a pas de date
                                  d'émission distincte dans le modèle. */}
                              {invoice.customerName} · {formatDate(invoice.createdAt)}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            {/* Les montants s'alignent sur la virgule d'une
                                ligne à l'autre : c'est la colonne qu'on lit
                                verticalement. */}
                            <span className="text-sm font-semibold tabular-nums">
                              {formatCurrency(invoice.amount)}
                            </span>
                            <StatusBadge status={invoice.status} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionTableau>
            </div>
          </>
        )}
    </>
  );
}

function customersCountIsZero(stats: { totalCustomers: number; totalRevenue: number }) {
  return stats.totalCustomers === 0 && stats.totalRevenue === 0;
}
