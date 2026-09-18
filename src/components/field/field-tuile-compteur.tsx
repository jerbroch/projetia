import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * LE COMPTEUR DE LA JOURNÉE — deux chiffres, pas un tableau de bord.
 *
 * Un homme qui ouvre l'application dans son camion veut savoir combien
 * d'arrêts il a devant lui et s'il doit passer au dépôt. Deux tuiles, un
 * chiffre chacune, lisibles en diagonale.
 *
 * ELLE N'A L'AIR CLIQUABLE QUE SI ELLE L'EST : le survol et l'anneau de focus
 * n'apparaissent qu'avec un `href`.
 */
interface TuileCompteurProps {
  icone: LucideIcon;
  valeur: number;
  libelle: string;
  href?: string;
  /** Met le chiffre en orange : quelque chose attend cette personne. */
  attire?: boolean;
}

export function TuileCompteur({
  icone: Icone,
  valeur,
  libelle,
  href,
  attire = false,
}: TuileCompteurProps) {
  const contenu = (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border border-border bg-card p-3.5 shadow-sm",
        href &&
          "transition-colors duration-normal hover:bg-secondary/40 motion-reduce:transition-none",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            attire ? "bg-primary/15 text-accent-encre" : "bg-secondary text-petrole",
          )}
        >
          <Icone className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span
          className={cn(
            "text-2xl font-bold tabular-nums leading-none",
            attire ? "text-accent-encre" : "text-foreground",
          )}
        >
          {valeur}
        </span>
      </div>
      <span className="mt-2 text-[13px] leading-snug text-muted-foreground">{libelle}</span>
    </div>
  );

  if (!href) return contenu;

  return (
    <Link
      href={href}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2"
    >
      {contenu}
    </Link>
  );
}
