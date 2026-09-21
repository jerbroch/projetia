import Link from "next/link";
import { Suspense } from "react";
import {
  Calendar,
  HardHat,
  MapPin,
  Receipt,
  Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { CarteRevenus } from "@/components/dashboard/carte-revenus";
import { PastilleDate, SectionTableau } from "@/components/dashboard/section-tableau";
import { BandeauArchitectural } from "@/components/dashboard/bandeau-architectural";
import { BandeIndicateurs } from "@/components/dashboard/bande-indicateurs";
import { TravauxDuJour } from "@/components/dashboard/travaux-du-jour";
import { AFaireAvancer, construireChosesAFaire } from "@/components/dashboard/a-faire-avancer";
import { SurLeTerrain } from "@/components/dashboard/sur-le-terrain";
import { SqueletteTableau } from "@/components/dashboard/squelette-tableau";
import { formatCurrency, formatDate, formatTimeRange } from "@/lib/utils";
import { jourEtMois } from "@/lib/dates-francais";
import {
  getDashboardStats,
  getEmployees,
  getInvoices,
  getQuotes,
  getScheduleEvents,
} from "@/lib/data/tenant-data";
import { getJobBillingSheet } from "@/lib/data/billing-data";
import { getActiveFieldWorkers } from "@/lib/field-workers";
import { filterPendingReviewJobs, canApproveBilling } from "@/lib/job-workflow";
import { DashboardReviewSection } from "@/components/dashboard/dashboard-review-section";
import { requireTenantContext } from "@/lib/session";
import { buildScheduleEventLink } from "@/lib/schedule-utils";
import {
  aFacturer,
  aPlanifier,
  equipesActives,
  outilsEnRetard,
  travauxDuJour,
} from "@/lib/tableau-de-bord-journee";
import { getToolsWithDetails } from "@/lib/data/tools-data";
import { bandeauDisponible } from "@/lib/ressource-publique";


/**
 * LES DÉCOMPTES S'ÉCRIVENT SUR DEUX CHIFFRES — « 08 », pas « 8 ».
 *
 * C'est la référence, et ce n'est pas qu'une coquetterie : quatre compteurs
 * alignés dont l'un passe de 9 à 10 déplacent la ligne de base du regard.
 * Deux chiffres fixent la largeur. Au-delà de 99, on écrit le nombre entier
 * plutôt que de le tronquer.
 */
function deuxChiffres(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Le montant sans les cents : « 12 450 $ ». Un indicateur se lit, il ne se vérifie pas. */
function montantCourt(montant: number): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(montant);
}

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

  return (
    <DashboardLayout
      title="Tableau de bord"
      description="Aperçu de votre entreprise de construction"
      company={ctx.company}
      user={ctx.user}
      isDemo={ctx.isDemo}
    >
      <div className="mx-auto w-full max-w-[1600px] space-y-4">
        <Suspense fallback={<SqueletteTableau />}>
          <CorpsTableauDeBord />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}

async function CorpsTableauDeBord() {
  const ctx = await requireTenantContext();
  const [stats, scheduleEvents, invoices, quotes, employees] = await Promise.all([
    getDashboardStats(ctx.company.id, ctx.isDemo),
    getScheduleEvents(ctx.company.id, ctx.isDemo),
    getInvoices(ctx.company.id, ctx.isDemo),
    getQuotes(ctx.company.id, ctx.isDemo),
    getEmployees(ctx.company.id, ctx.isDemo),
  ]);

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

  /*
   * LES CHIFFRES DE LA JOURNÉE, TOUS TIRÉS DE DONNÉES EXISTANTES.
   * Aucun n'est estimé : là où la donnée manquerait, le compteur ne serait
   * pas affiché plutôt que rempli d'une valeur plausible.
   */
  const duJour = travauxDuJour(scheduleEvents);
  const equipes = equipesActives(scheduleEvents);
  const devisAPlanifier = aPlanifier(quotes, scheduleEvents);
  const travauxAFacturer = aFacturer(scheduleEvents);

  /*
   * LE MONTANT À FACTURER — la somme des fiches des travaux prêts.
   *
   * Il n'existe nulle part ailleurs : `ScheduleEvent` ne porte pas de total,
   * seule la fiche de facturation en a un. On les lit donc, plafonnées, et
   * uniquement pour qui a le droit d'approuver la facturation. Sans ce
   * droit, ou sans fiche, la valeur reste `null` et la carte affiche le
   * décompte plutôt qu'un montant inventé.
   */
  let montantAFacturer: number | null = null;
  if (showReviewSection) {
    const fiches = await Promise.all(
      travauxAFacturer.slice(0, 12).map((job) => getJobBillingSheet(ctx.company.id, job.id))
    );
    const connues = fiches.filter((f): f is NonNullable<typeof f> => f !== null);
    if (connues.length > 0) {
      montantAFacturer = connues.reduce((somme, f) => somme + f.total, 0);
    }
  }

  // Les outils en retard : la même lecture que l'écran Outillage, pas un
  // second inventaire.
  const outils = await getToolsWithDetails(ctx.company.id, ctx.isDemo, employees);
  const enRetard = outilsEnRetard(outils);

  const travailleursDehors = getActiveFieldWorkers(scheduleEvents);
  const occupes = new Set(travailleursDehors.map((t) => t.employeeId));
  const disponibles = employees
    .filter((e) => e.status === "active" && !occupes.has(e.id))
    .slice(0, 3)
    .map((e) => ({ id: e.id, nom: `${e.firstName} ${e.lastName}`.trim() }));

  const upcomingEvents = scheduleEvents.filter((e) => e.status === "scheduled").slice(0, 4);
  const recentInvoices = invoices.slice(0, 4);
  const isEmpty = !ctx.isDemo && customersCountIsZero(stats);


  return (
    <>
        {isEmpty ? (
          <EmptyState
            title="Bienvenue sur Construction iOS!"
            description="Commencez par ajouter vos clients, employés et travaux planifiés depuis le menu."
          />
        ) : (
          <>
            {/* ───────── Le bandeau ───────── */}
            {/*
              LES CHEMINS NE SONT PASSÉS QUE SI LES FICHIERS EXISTENT.
              Pointer vers une image absente ferait afficher l'icône d'image
              cassée ; ici le bandeau retombe proprement sur son aplat.
            */}
            <BandeauArchitectural
              titre="Tout est prêt pour une grande journée."
              sousTitre="Vos équipes, vos chantiers, vos priorités."
              image={bandeauDisponible("large")}
              imageMobile={bandeauDisponible("mobile")}
              action={{ libelle: "Planifier un travail", href: "/schedule" }}
            />

            {/* ───────── Les quatre chiffres de la journée ───────── */}
            <BandeIndicateurs
              indicateurs={[
                {
                  icone: HardHat,
                  valeur: deuxChiffres(duJour.length),
                  libelle: "Travaux aujourd'hui",
                  href: "/schedule",
                },
                {
                  icone: Users,
                  valeur: deuxChiffres(equipes),
                  libelle: "Équipes sur le terrain",
                  href: "/schedule",
                },
                {
                  icone: Calendar,
                  valeur: deuxChiffres(devisAPlanifier.length),
                  libelle: "Soumissions à relancer",
                  href: "/quotes?statut=accepted",
                  attire: devisAPlanifier.length > 0,
                },
                /*
                  LE QUATRIÈME PORTE UN MONTANT, comme sur la référence —
                  mais seulement quand l'utilisateur a le droit de voir la
                  facturation ET que les fiches existent. Sinon il porte le
                  décompte : un « 0 $ » affiché faute de donnée serait un
                  chiffre faux, pas une valeur par défaut.
                */
                montantAFacturer !== null
                  ? {
                      icone: Receipt,
                      valeur: montantCourt(montantAFacturer),
                      libelle: "À facturer",
                      href: "/reviews",
                      attire: montantAFacturer > 0,
                    }
                  : {
                      icone: Receipt,
                      valeur: deuxChiffres(travauxAFacturer.length),
                      libelle: "Travaux à facturer",
                      href: "/reviews",
                      attire: travauxAFacturer.length > 0,
                    },
              ]}
            />

            {/* ───────── À faire en priorité, avant les travaux ───────── */}
            <AFaireAvancer
              choses={construireChosesAFaire({
                aPlanifier: devisAPlanifier.length,
                aFacturer: travauxAFacturer.length,
                outilsEnRetard: enRetard.length,
              })}
            />

            {/* ───────── Travaux du jour · Équipe sur le terrain ───────── */}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
              <TravauxDuJour travaux={duJour} />
              <SurLeTerrain travailleurs={travailleursDehors} disponibles={disponibles} />
            </div>

            {/*
              ───────── Ce qui attend une vérification ─────────

              LA BANDE « Travailleurs sur le terrain » ET LA CARTE « Travaux
              en cours » ONT DISPARU. Toutes deux disaient ce que la section
              « Sur le terrain » dit maintenant, plus haut et mieux : qui est
              dehors, où, et dans quel état. Trois endroits pour une même
              réponse, c'est deux de trop — et c'est ainsi qu'on finit par en
              corriger un seul le jour où la règle change.

              La vérification, elle, reste : elle porte des actions
              d'approbation qu'aucune autre section ne remplace.
            */}
            <DashboardReviewSection
              pendingJobs={pendingReviewJobs}
              billingTotals={billingTotals}
              showSection={showReviewSection}
            />

            {/*
              ───────── Les revenus ─────────

              LA MAQUETTE NE LES MONTRE PAS, et ce n'est pas une raison pour
              les faire disparaître : `totalRevenue` ne s'affiche sur AUCUN
              autre écran de l'application. Les retirer d'ici, c'était les
              retirer tout court.

              Ils descendent en revanche sous la journée : c'est un chiffre
              qu'on regarde une fois par mois, pas à 6 h 30 devant son café.
              Ils voisinent maintenant les factures, dont ils sont la somme.
            */}
            <CarteRevenus montant={formatCurrency(stats.totalRevenue)} />

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
