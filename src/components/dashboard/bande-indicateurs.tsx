import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * LES QUATRE INDICATEURS DE LA JOURNÉE.
 *
 * Composition de la référence : quatre cartes de MÊME HAUTEUR, alignées sur
 * une rangée. Dans chacune, une icône posée sur une petite surface teintée,
 * puis le libellé au-dessus de la valeur — le libellé se lit une fois, la
 * valeur se relit vingt fois par jour, et c'est elle qui porte le poids
 * typographique.
 *
 * LA HAUTEUR EST FIXÉE PAR `items-stretch` SUR LA GRILLE, pas par une
 * hauteur en dur : un libellé qui passe sur deux lignes sur un écran étroit
 * allonge les quatre cartes ensemble plutôt que d'en désaligner une.
 */

export interface Indicateur {
  icone: LucideIcon;
  /** Déjà formatée : « 08 » pour un décompte, « 12 450 $ » pour un montant. */
  valeur: string;
  libelle: string;
  href: string;
  /** Pose la pastille orange quand la valeur appelle un geste. */
  attire?: boolean;
}

export function BandeIndicateurs({ indicateurs }: { indicateurs: Indicateur[] }) {
  return (
    <section aria-label="Indicateurs de la journée">
      <ul className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
        {indicateurs.map(({ icone: Icone, valeur, libelle, href, attire }) => (
          <li key={libelle} className="flex">
            <Link
              href={href}
              className={cn(
                "flex w-full items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-4 shadow-carte sm:px-5",
                "transition-colors duration-normal hover:border-primary/40 motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
            >
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px]",
                  "bg-secondary text-petrole",
                )}
              >
                <Icone className="h-[22px] w-[22px]" aria-hidden />
              </span>

              <span className="min-w-0">
                {/*
                  LE LIBELLÉ PASSE À LA LIGNE PLUTÔT QUE DE SE COUPER.
                  Sur 390 px, « Soumissions à relancer » devenait
                  « Soumissions à rel… » : un compteur dont on ne lit pas le
                  nom ne compte rien.
                */}
                {/*
                  LA HAUTEUR DU LIBELLÉ EST RÉSERVÉE POUR DEUX LIGNES.

                  À 1280 px, « Soumissions à relancer » passe sur deux lignes
                  pendant que les trois autres tiennent sur une : les quatre
                  chiffres se retrouvaient sur deux hauteurs différentes. La
                  référence les aligne, et c'est ce qui rend la bande lisible
                  d'un seul regard.
                */}
                <span className="block min-h-[2.375rem] text-[13px] leading-snug text-muted-foreground">
                  {libelle}
                </span>
                <span className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-[1.625rem] font-extrabold leading-none tracking-tight tabular-nums text-foreground">
                    {valeur}
                  </span>
                  {attire && (
                    <span
                      aria-hidden
                      className="mb-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                    />
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
