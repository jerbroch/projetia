import Link from "next/link";
import { ArrowRight, ChevronRight, Wrench } from "lucide-react";
import { EtatDetenteur } from "@/components/outillage/etat-detenteur";
import { libelleRetour } from "@/lib/terrain-aujourdhui";
import { cn } from "@/lib/utils";
import type { ToolListItem } from "@/types";

/**
 * MES OUTILS, EN APERÇU — deux lignes, pas l'inventaire.
 *
 * L'écran Aujourd'hui répond à « ma journée ». Les outils y ont leur place
 * parce qu'on les charge dans le camion le matin, pas parce qu'on veut les
 * gérer ici : deux au plus, et un lien vers l'écran qui fait le reste.
 */
export function FieldApercuOutils({
  outils,
  employeId,
}: {
  outils: ToolListItem[];
  employeId: string;
}) {
  if (outils.length === 0) return null;

  return (
    <section aria-labelledby="titre-apercu-outils">
      <header className="mb-2 flex items-center justify-between gap-3">
        <h2 id="titre-apercu-outils" className="text-[17px] font-semibold text-foreground">
          Mes outils
        </h2>
        <Link
          href="/terrain/outils"
          className="flex shrink-0 items-center gap-1 rounded-md text-[13px] font-medium text-accent-encre focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole"
        >
          Voir tout
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </header>

      <ul className="space-y-2">
        {outils.slice(0, 2).map((outil) => (
          <li key={outil.id}>
            <Link
              href="/terrain/outils"
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm",
                "transition-colors duration-normal hover:bg-secondary/30 motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2",
              )}
            >
              {/* Pas de photo : le modèle de données n'en porte aucune. */}
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-petrole">
                <Wrench className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-foreground">
                  {outil.name}
                </span>
                <span className="mt-1 block">
                  <EtatDetenteur outil={outil} employeId={employeId} compact />
                </span>
                <span
                  className={cn(
                    "mt-1 block text-[12px]",
                    (outil.daysOverdue ?? 0) > 0
                      ? "font-medium text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {libelleRetour(outil)}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
