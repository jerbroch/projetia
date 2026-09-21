import Link from "next/link";
import { ArrowRight, ChevronRight, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { buildScheduleEventLink } from "@/lib/schedule-utils";
import { heureCourte, initialesDe } from "@/lib/tableau-de-bord-journee";
import { cn } from "@/lib/utils";
import type { ScheduleEvent } from "@/types";

/**
 * LES TRAVAUX DU JOUR — l'heure, le client, ce qu'on fait, qui y va.
 *
 * C'est la liste qu'un répartiteur relit dix fois dans la journée. Elle est
 * donc dense et ordonnée par l'heure, pas par importance supposée.
 *
 * SUR TÉLÉPHONE, LE TABLEAU DEVIENT DES CARTES. Cinq colonnes sur 390 px
 * donneraient des mots coupés en deux ; on empile l'heure et le statut, puis
 * le client et l'équipe. C'est la même information, lisible.
 */

interface TravauxDuJourProps {
  travaux: ScheduleEvent[];
  /** Ligne mise en avant si elle est en cours, comme sur la référence. */
  className?: string;
}

/**
 * LE LIEU, COURT. L'adresse complète ne tient pas dans une colonne de
 * tableau ; la référence n'affiche d'ailleurs que la municipalité. On prend
 * le dernier segment significatif de l'adresse, et rien si elle est absente.
 */
function villeDe(job: ScheduleEvent): string | null {
  const brut = job.jobSiteAddress?.trim() || job.location?.trim();
  if (!brut) return null;
  const parts = brut.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : brut;
}

/** Les pastilles d'équipe, deux lettres chacune. */
function Equipe({ noms }: { noms: string[] }) {
  if (noms.length === 0) {
    return <span className="text-[13px] text-muted-foreground">Non assigné</span>;
  }
  return (
    <span className="flex -space-x-1.5">
      {noms.slice(0, 3).map((nom, i) => (
        <span
          key={`${nom}-${i}`}
          title={nom}
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-semibold text-petrole"
        >
          {initialesDe(nom)}
        </span>
      ))}
      {noms.length > 3 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground">
          +{noms.length - 3}
        </span>
      )}
    </span>
  );
}

export function TravauxDuJour({ travaux, className }: TravauxDuJourProps) {
  return (
    <section
      className={cn("rounded-xl border border-border bg-card shadow-carte", className)}
      aria-labelledby="titre-travaux-du-jour"
    >
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <h2 id="titre-travaux-du-jour" className="text-lg font-semibold text-foreground">
          Les travaux du jour
        </h2>
        <Link
          href="/schedule"
          className="flex shrink-0 items-center gap-1 rounded-md text-sm font-medium text-accent-encre transition-colors duration-normal hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          Voir tout
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>

      {travaux.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">
          Rien de planifié aujourd&apos;hui.
        </p>
      ) : (
        <>
          {/* ───────── Ordinateur : un tableau ───────── */}
          {/*
            LES LARGEURS SONT FIXÉES, pas laissées au navigateur.
            En `auto`, « Charpenterie Bellevue » se cassait sur trois lignes
            pendant que la description gardait de la place qu'elle
            n'utilisait pas. L'heure et le statut ont une taille connue ; la
            description prend ce qui reste.
          */}
          <table className="hidden w-full table-fixed md:table">
            <colgroup>
              <col className="w-[64px]" />
              <col className="w-[23%]" />
              <col />
              <col className="w-[76px]" />
              <col className="w-[104px]" />
              <col className="w-[36px]" />
            </colgroup>
            <thead>
              <tr className="border-y border-border text-left">
                {["Heure", "Client / Lieu", "Description", "Équipe", "Statut"].map((t) => (
                  <th
                    key={t}
                    scope="col"
                    className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:pl-5"
                  >
                    {t}
                  </th>
                ))}
                <th scope="col" className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {travaux.map((job) => {
                const enCours = job.status === "in-progress" || job.status === "en-route";
                const lieu = villeDe(job);
                return (
                  <tr key={job.id} className="group transition-colors hover:bg-secondary/40">
                    <td className="relative py-3 pl-5 pr-3 align-middle">
                      {/*
                        LE TRAIT VERT DE LA RÉFÉRENCE ne décore pas : il marque
                        la ligne où quelqu'un travaille en ce moment.
                      */}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-y-2 left-0 w-[3px] rounded-r-full",
                          enCours ? "bg-succes" : "bg-info/40",
                        )}
                      />
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {heureCourte(job.start)}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle text-sm font-medium text-foreground">
                      <span className="line-clamp-1 block">{job.customerName ?? "Client"}</span>
                      {/*
                        LE LIEU SOUS LE CLIENT — il n'apparaît que s'il
                        existe vraiment. Une ligne « lieu à confirmer » sous
                        chaque travail ferait du bruit sans rien apprendre.
                      */}
                      {lieu && (
                        <span className="mt-0.5 flex items-center gap-1 text-[12px] font-normal text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="line-clamp-1">{lieu}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle text-sm text-muted-foreground">
                      <span className="line-clamp-1">{job.title}</span>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <Equipe noms={job.employeeNames} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="pr-4 align-middle">
                      <Link
                        href={buildScheduleEventLink({ id: job.id, start: job.start })}
                        aria-label={`Ouvrir ${job.title}`}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ───────── Téléphone : des cartes ───────── */}
          <ul className="divide-y divide-border border-t border-border md:hidden">
            {travaux.map((job) => (
              <li key={job.id}>
                <Link
                  href={buildScheduleEventLink({ id: job.id, start: job.start })}
                  className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {heureCourte(job.start)}
                      </span>
                      <StatusBadge status={job.status} />
                    </span>
                    <span className="mt-1 block text-sm font-medium text-foreground">
                      {job.customerName ?? "Client"}
                    </span>
                    {villeDe(job) && (
                      <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="line-clamp-1">{villeDe(job)}</span>
                      </span>
                    )}
                    <span className="mt-0.5 line-clamp-1 block text-[13px] text-muted-foreground">
                      {job.title}
                    </span>
                    <span className="mt-2 block">
                      <Equipe noms={job.employeeNames} />
                    </span>
                  </span>
                  <ChevronRight
                    className="mt-1 h-4 w-4 shrink-0 self-center text-muted-foreground/60"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
