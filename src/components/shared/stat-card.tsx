import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * L'INDICATEUR. Une étiquette, un chiffre, rien de plus à lire.
 *
 * LES CARTES S'ALIGNENT MÊME QUAND LES ÉTIQUETTES NE FONT PAS LA MÊME
 * LONGUEUR. « Travailleurs sur le terrain » passe sur deux lignes là où
 * « Clients » tient sur une : les chiffres se retrouvaient à des hauteurs
 * différentes d'une carte à l'autre, et une rangée d'indicateurs désalignés
 * se lit comme une erreur d'affichage. La grille étire les cartes d'une même
 * rangée à la même hauteur et `mt-auto` pousse le chiffre en bas : ils
 * s'alignent sans qu'on réserve de l'espace vide au-dessus.
 *
 * LE CHIFFRE EST EN CHIFFRES TABULAIRES : sans cela, un 1 est plus étroit
 * qu'un 8 et deux montants superposés ne s'alignent pas sur la virgule.
 *
 * ELLE N'A L'AIR CLIQUABLE QUE SI ELLE L'EST. Le survol, le curseur et
 * l'anneau de focus n'apparaissent qu'avec un `href` — une carte qui réagit
 * sans rien faire fait douter de tout le reste de l'écran.
 */
interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
  href?: string;
  ariaLabel?: string;
  /**
   * Met le chiffre en orange et pose une pastille dans le coin.
   *
   * L'ORANGE NE DIT QU'UNE CHOSE : « ceci attend quelqu'un ». Huit factures
   * en attente, ce sont huit sommes qu'on n'a pas reçues ; zéro n'appelle
   * aucune action, donc aucune couleur. L'accent perd tout son sens le jour
   * où il colore aussi ce qui va bien.
   */
  aAttirerLAttention?: boolean;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  href,
  ariaLabel,
  aAttirerLAttention = false,
}: StatCardProps) {
  const card = (
    <Card
      className={cn(
        "relative flex h-full flex-col p-4 sm:p-5",
        href &&
          "transition-[background-color,box-shadow] duration-normal hover:bg-secondary/50 hover:shadow-relief motion-reduce:transition-none",
        className,
      )}
    >
      {aAttirerLAttention && (
        <span
          aria-hidden
          className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary"
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <span className="mt-2.5 text-sm font-medium leading-snug text-muted-foreground">
        {title}
      </span>

      <div className="mt-auto pt-1.5">
        <div
          className={cn(
            "text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
            aAttirerLAttention && "text-accent-encre",
          )}
        >
          {value}
        </div>
        {description && (
          <p className="mt-1 text-xs leading-snug text-muted-foreground">{description}</p>
        )}
        {trend && (
          <p className={cn("mt-1 text-xs tabular-nums", trend.value >= 0 ? "text-succes" : "text-danger")}>
            {trend.value >= 0 ? "+" : ""}
            {trend.value} % {trend.label}
          </p>
        )}
      </div>
    </Card>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? title}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {card}
    </Link>
  );
}
