import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { buildScheduleEventLink } from "@/lib/schedule-utils";
import { initialesDe } from "@/lib/tableau-de-bord-journee";
import { cn } from "@/lib/utils";
import type { ActiveFieldWorker } from "@/lib/field-workers";

/**
 * SUR LE TERRAIN — qui est dehors, et où.
 *
 * Trois cartes côte à côte, un visage par personne. C'est la question qu'on
 * pose au téléphone vingt fois par jour : « Marc est où, là ? »
 *
 * LA PASTILLE DE COULEUR DIT L'ÉTAT, et le texte le répète. Sur un écran au
 * soleil, la couleur seule ne passe pas ; et un daltonien lit le texte.
 */

const ETAT: Record<string, { teinte: string; mot: string }> = {
  "in-progress": { teinte: "bg-succes", mot: "En intervention" },
  "en-route": { teinte: "bg-info", mot: "En route" },
  scheduled: { teinte: "bg-neutre", mot: "Planifié" },
};

interface SurLeTerrainProps {
  travailleurs: ActiveFieldWorker[];
  /** Ceux qui n'ont aucun call actif — disponibles pour un appel. */
  disponibles: { id: string; nom: string }[];
}

export function SurLeTerrain({ travailleurs, disponibles }: SurLeTerrainProps) {
  const rien = travailleurs.length === 0 && disponibles.length === 0;

  return (
    <section
      className="rounded-2xl border border-border bg-card shadow-sm"
      aria-labelledby="titre-sur-le-terrain"
    >
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <h2 id="titre-sur-le-terrain" className="text-lg font-semibold text-foreground">
          Sur le terrain
        </h2>
        <Link
          href="/employees"
          className="flex shrink-0 items-center gap-1 rounded-md text-sm font-medium text-accent-encre transition-colors duration-normal hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          Voir toute l&apos;équipe
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>

      {rien ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">
          Personne n&apos;est sur le terrain en ce moment.
        </p>
      ) : (
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
          {travailleurs.map((t) => {
            const etat = ETAT[t.status] ?? ETAT.scheduled;
            return (
              <Link
                key={`${t.employeeId}-${t.jobId}`}
                href={buildScheduleEventLink({ id: t.jobId, start: t.start })}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border px-3.5 py-3",
                  "transition-colors duration-normal hover:bg-secondary/40 motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-petrole">
                  {initialesDe(t.employeeName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {t.employeeName}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", etat.teinte)} />
                    {etat.mot}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                    {t.customerName}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
              </Link>
            );
          })}

          {disponibles.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-petrole">
                {initialesDe(d.nom)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{d.nom}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-succes" />
                  Disponible
                </span>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">
                  Disponible pour un appel
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
