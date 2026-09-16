import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/**
 * L'EN-TÊTE DES DEUX SECTIONS DU BAS : un titre, et le lien vers la page qui
 * porte tout le reste.
 *
 * Le lien est à droite, discret, avec une flèche : il annonce qu'il existe
 * plus que les quelques lignes montrées ici, sans concurrencer le titre.
 */
export function SectionTableau({
  titre,
  icone: Icone,
  lienHref,
  lienTexte,
  complement,
  children,
}: {
  titre: string;
  icone: LucideIcon;
  lienHref: string;
  lienTexte: string;
  /** Une information de plus, glissée sous le titre. */
  complement?: ReactNode;
  children: ReactNode;
}) {
  return (
    /*
     * `min-w-0` N'EST PAS DÉCORATIF ICI.
     *
     * Un enfant de grille — comme de flex — a `min-width: auto` : il refuse
     * de descendre sous la largeur de son contenu. Une carte contenant un
     * titre de soumission long faisait donc 535 px dans un écran de 390, et
     * `truncate` n'y pouvait rien : ce n'est pas le texte qui débordait,
     * c'est la carte qui ne rétrécissait pas.
     */
    <Card className="flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icone className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden />
          <h2 className="truncate text-base font-bold tracking-tight sm:text-lg">{titre}</h2>
        </div>
        <Link
          href={lienHref}
          className="group flex shrink-0 items-center gap-1.5 rounded-md text-sm font-medium text-accent-encre transition-colors duration-normal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none"
        >
          {lienTexte}
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-normal group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden
          />
        </Link>
      </div>
      {complement && <div className="mt-1 text-xs text-muted-foreground">{complement}</div>}
      <div className="mt-4 min-w-0 flex-1">{children}</div>
    </Card>
  );
}

/**
 * LA PASTILLE DE DATE des travaux à venir — « 21 » au-dessus de « SEP ».
 *
 * Le jour en gros et le mois en petit : c'est le jour qu'on cherche quand on
 * survole sa semaine, le mois ne sert qu'à lever le doute.
 */
export function PastilleDate({ jour, mois }: { jour: string; mois: string }) {
  return (
    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary leading-none">
      <span className="text-lg font-bold tabular-nums">{jour}</span>
      <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {mois}
      </span>
    </span>
  );
}
