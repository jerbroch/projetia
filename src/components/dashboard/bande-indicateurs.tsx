import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * LES QUATRE CHIFFRES DE LA JOURNÉE, SUR UNE SEULE BANDE.
 *
 * Quatre cartes séparées les faisaient lire comme quatre sujets. Ils n'en
 * font qu'un : l'état de la journée. Une bande unique, des séparateurs fins,
 * et le regard les prend d'un coup.
 *
 * LA PASTILLE ORANGE NE DIT QU'UNE CHOSE : « ceci attend quelqu'un ». Deux
 * soumissions à planifier, ce sont deux clients qui patientent ; zéro n'appelle
 * aucune action, donc aucune couleur. L'accent perd son sens le jour où il
 * colore aussi ce qui va bien.
 */

export interface Indicateur {
  icone: LucideIcon;
  valeur: number;
  libelle: string;
  href: string;
  /** Pose la pastille orange quand la valeur appelle un geste. */
  attire?: boolean;
}

export function BandeIndicateurs({ indicateurs }: { indicateurs: Indicateur[] }) {
  return (
    <section
      aria-label="Indicateurs de la journée"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <ul className="grid grid-cols-2 divide-border sm:divide-x lg:grid-cols-4">
        {indicateurs.map(({ icone: Icone, valeur, libelle, href, attire }, i) => (
          <li
            key={libelle}
            className={cn(
              // Les séparateurs suivent la grille : en deux colonnes, seules
              // les lignes horizontales ont un sens ; en quatre, les verticales.
              i < indicateurs.length - 2 && "border-b border-border lg:border-b-0",
              i % 2 === 1 && "border-l border-border sm:border-l-0",
            )}
          >
            <Link
              href={href}
              className={cn(
                "flex items-center gap-3 px-4 py-4 sm:px-5",
                "transition-colors duration-normal hover:bg-secondary/40 motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                  "bg-secondary text-petrole",
                )}
              >
                <Icone className="h-5 w-5" aria-hidden />
              </span>

              <span className="min-w-0">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[1.75rem] font-bold leading-none tabular-nums text-foreground">
                    {valeur}
                  </span>
                  {attire && valeur > 0 && (
                    <span
                      aria-hidden
                      className="mb-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                    />
                  )}
                </span>
                {/*
                  LE LIBELLÉ PASSE À LA LIGNE PLUTÔT QUE DE SE COUPER.
                  Sur 390 px, « Travaux du jour » devenait « Travaux du j… » :
                  un compteur dont on ne lit pas le nom ne compte rien.
                */}
                <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">
                  {libelle}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
