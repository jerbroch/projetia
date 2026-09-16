"use client";

import Link, { useLinkStatus } from "next/link";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * UNE ENTRÉE DE MENU QUI RÉPOND AU CLIC, PAS À L'ARRIVÉE.
 *
 * Sans cela, cliquer sur « Factures » ne produisait rien de visible pendant
 * tout le rendu serveur — cinq à sept dixièmes de seconde, mesurés — puis la
 * page changeait d'un coup. Rien ne disait que le clic avait porté, et sur un
 * chantier on retape.
 *
 * `useLinkStatus` dit si CETTE navigation est en cours. L'entrée cliquée
 * prend donc aussitôt le fond et le trait de l'entrée active, et sa roue
 * remplace son icône. C'est un constat, pas une promesse : si la navigation
 * échoue, l'état retombe de lui-même.
 *
 * `useLinkStatus` ne fonctionne que dans un descendant de `Link` — d'où ce
 * petit composant intérieur, qui n'existe que pour ça.
 */
function Interieur({
  nom,
  icone: Icone,
  actif,
}: {
  nom: string;
  icone: LucideIcon;
  actif: boolean;
}) {
  const { pending } = useLinkStatus();
  const enAvant = actif || pending;

  return (
    <>
      {enAvant && (
        <span
          aria-hidden
          className="absolute inset-y-[7px] -left-3 w-[3px] rounded-r-full bg-primary"
        />
      )}
      {pending && !actif ? (
        <Loader2
          className="h-[18px] w-[18px] shrink-0 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden
        />
      ) : (
        <Icone
          className={cn("h-[18px] w-[18px] shrink-0", enAvant && "text-primary")}
          aria-hidden
        />
      )}
      <span className={cn(pending && !actif && "text-petrole-foreground")}>{nom}</span>
    </>
  );
}

export interface EntreeMenuProps {
  nom: string;
  href: string;
  icone: LucideIcon;
  actif: boolean;
  onNavigue: () => void;
}

export function EntreeMenu({ nom, href, icone, actif, onNavigue }: EntreeMenuProps) {
  return (
    <Link
      href={href}
      onClick={onNavigue}
      aria-current={actif ? "page" : undefined}
      className={cn(
        /* 44 px au doigt, resserré dès qu'il y a une souris. */
        "relative flex min-h-[44px] items-center gap-3 rounded-md px-3 text-[0.9375rem]",
        "transition-colors duration-normal motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-petrole",
        "lg:min-h-0 lg:py-2.5",
        actif
          ? "bg-white/[0.08] font-semibold text-petrole-foreground"
          : "font-medium text-petrole-foreground/60 hover:bg-white/[0.04] hover:text-petrole-foreground",
      )}
    >
      <Interieur nom={nom} icone={icone} actif={actif} />
    </Link>
  );
}
