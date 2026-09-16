"use client";

import { useEffect, useState } from "react";
import { CalendarDays, FileText, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * LES LIGNES DU PLAN QUI DEVIENNENT DES CARTES D'INTERFACE.
 *
 * C'est la promesse du concept prise au mot : trois rectangles se tracent
 * comme des pièces sur un plan, puis se remplissent et deviennent trois
 * écrans de l'application — une soumission, un chantier au calendrier, une
 * facture. Le même trait sert deux fois, et c'est tout le propos.
 *
 * Ce ne sont pas des captures : ce sont trois objets réels du produit, réduits
 * à ce qu'on en reconnaît d'un coup d'œil. Rien d'inventé.
 *
 * Une seule fois, au chargement. Une transformation qui se rejoue en boucle
 * cesse d'être un geste et devient un clignotement.
 */

const CARTES = [
  {
    icone: FileText,
    titre: "SO-2026-0141",
    ligne: "Acceptée",
    accent: true,
    delai: 0,
  },
  {
    icone: CalendarDays,
    titre: "Mardi · 8 h – 12 h",
    ligne: "Marc T., Luc G.",
    accent: false,
    delai: 180,
  },
  {
    icone: Receipt,
    titre: "Facture FA-2026-0141",
    ligne: "Payée",
    accent: true,
    delai: 360,
  },
] as const;

export function LigneDevenueCarte() {
  const [devenue, setDevenue] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDevenue(true);
      return;
    }
    // Après le tracé du plan et l'arrivée du titre : la transformation est la
    // conclusion de la séquence, pas son ouverture.
    const t = window.setTimeout(() => setDevenue(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <ul
      data-testid="plan-devenu-application"
      className="mx-auto mt-14 grid max-w-3xl gap-3 sm:grid-cols-3"
    >
      {CARTES.map((c) => (
        <li
          key={c.titre}
          className={cn(
            "rounded-lg p-3 transition-all duration-700 ease-out",
            devenue
              ? // L'objet : rempli, posé, lisible.
                "translate-y-0 border border-[hsl(var(--plan-ligne)/0.4)] bg-[hsl(var(--plan-fond))]/85 opacity-100 shadow-lg backdrop-blur-sm"
              : // Le trait : un rectangle de plan, vide et en pointillé.
                "translate-y-2 border border-dashed border-[hsl(var(--plan-ligne)/0.6)] bg-transparent opacity-60",
          )}
          style={{ transitionDelay: `${c.delai}ms` }}
        >
          <div className="flex items-center gap-2">
            <c.icone
              className={cn(
                "h-4 w-4 transition-opacity duration-700",
                devenue ? "opacity-100 text-[hsl(var(--plan-accent))]" : "opacity-0",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "truncate text-xs font-medium transition-opacity duration-700",
                devenue ? "opacity-100 text-[hsl(var(--plan-trait))]" : "opacity-0",
              )}
            >
              {c.titre}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-[11px] transition-opacity duration-700 delay-150",
                devenue ? "opacity-100 text-[hsl(var(--plan-trait))]/70" : "opacity-0",
              )}
            >
              {c.ligne}
            </span>
            {c.accent && (
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full bg-emerald-400 transition-opacity duration-700 delay-300",
                  devenue ? "opacity-100" : "opacity-0",
                )}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
