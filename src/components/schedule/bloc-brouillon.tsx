"use client";

import { useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  apercuDeplacement,
  apercuRedimensionnement,
  apercuRedimensionnementDebut,
  gaucheEnPixels,
  largeurEnPixels,
  type ApercuPlage,
} from "@/lib/calendar-drag-preview";
import { dureeLisible, libelleBrouillon } from "@/lib/calendar-brouillon";

/**
 * LE RECTANGLE QU'ON GLISSE AVANT D'OUVRIR QUOI QUE CE SOIT.
 *
 * Choisir une plage demandait d'ouvrir le call en entier, de corriger deux
 * champs d'heure et d'enregistrer. Le geste le plus fréquent du calendrier
 * prenait trente secondes.
 *
 * Ici : on touche l'horaire, le rectangle apparaît, on le glisse ou on l'étire,
 * on confirme. Le formulaire complet reste accessible — mais après, et
 * seulement si on en a besoin.
 *
 * Les CALCULS sont ceux des calls existants : `apercuDeplacement` et les deux
 * redimensionnements. Un calcul séparé finirait par diverger, et l'aperçu
 * mentirait sur ce qui va être enregistré.
 */

export interface BlocBrouillonProps {
  plage: ApercuPlage;
  /** Hauteur de la voie, pour coller aux blocs voisins. */
  hauteur: number;
  top: number;
  /**
   * Décalage horizontal du jour visé. Nul en vue jour ; en vue semaine, la
   * position d'une heure est relative à SA colonne de jour.
   */
  decalageGauche?: number;
  /** Minutes sous le curseur, calculées par le calendrier (vue jour ou semaine). */
  minutesSousLeCurseur: (clientX: number) => number;
  onPlageChange: (plage: ApercuPlage) => void;
  onConfirmer: () => void;
  onDetails: () => void;
  onAnnuler: () => void;
}

type Geste = { mode: "move" | "resize" | "resize-start"; startX: number; plage: ApercuPlage; ecartDeSaisie: number };

export function BlocBrouillon({
  plage,
  hauteur,
  top,
  decalageGauche = 0,
  minutesSousLeCurseur,
  onPlageChange,
  onConfirmer,
  onDetails,
  onAnnuler,
}: BlocBrouillonProps) {
  const geste = useRef<Geste | null>(null);
  const [enGeste, setEnGeste] = useState(false);

  function demarrer(e: React.PointerEvent, mode: Geste["mode"]) {
    e.stopPropagation();
    e.preventDefault();
    const ecart = mode === "move" ? minutesSousLeCurseur(e.clientX) - plage.startMinutes : 0;
    geste.current = { mode, startX: e.clientX, plage, ecartDeSaisie: ecart };
    setEnGeste(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function bouger(e: React.PointerEvent) {
    const g = geste.current;
    if (!g) return;
    const delta = e.clientX - g.startX;
    if (g.mode === "move") {
      onPlageChange(
        apercuDeplacement(
          g.plage.startMinutes,
          g.plage.endMinutes,
          minutesSousLeCurseur(e.clientX),
          g.ecartDeSaisie,
        ),
      );
    } else if (g.mode === "resize") {
      onPlageChange(apercuRedimensionnement(g.plage.startMinutes, g.plage.endMinutes, delta));
    } else {
      onPlageChange(apercuRedimensionnementDebut(g.plage.startMinutes, g.plage.endMinutes, delta));
    }
  }

  function relacher() {
    geste.current = null;
    setEnGeste(false);
  }

  return (
    <div
      data-testid="bloc-brouillon"
      // `touch-none` : sans lui le doigt fait défiler la page au lieu de
      // glisser le rectangle.
      className={cn(
        "absolute z-40 touch-none select-none rounded-md border-2 border-dashed border-primary",
        "bg-primary/15 px-2 py-1 shadow-lg",
        enGeste && "border-solid ring-2 ring-primary/50",
      )}
      style={{
        left: decalageGauche + gaucheEnPixels(plage.startMinutes),
        width: largeurEnPixels(plage),
        top,
        height: hauteur,
      }}
      onPointerDown={(e) => demarrer(e, "move")}
      onPointerMove={bouger}
      onPointerUp={relacher}
      onPointerCancel={relacher}
    >
      <p className="pointer-events-none truncate text-[11px] font-bold leading-tight text-primary">
        {libelleBrouillon(plage)}
      </p>
      <p className="pointer-events-none truncate text-[10px] leading-tight text-primary/80">
        {dureeLisible(plage)}
      </p>

      {/* Les poignées : 24 px au doigt, comme celles des calls existants. */}
      <div
        data-handle="brouillon-debut"
        title="Reculer ou avancer le début"
        className="absolute bottom-0 left-0 top-0 w-2 cursor-ew-resize touch-none bg-primary/30 [@media(pointer:coarse)]:w-6"
        onPointerDown={(e) => demarrer(e, "resize-start")}
        onPointerMove={bouger}
        onPointerUp={relacher}
        onPointerCancel={relacher}
      />
      <div
        data-handle="brouillon-fin"
        title="Allonger ou raccourcir la fin"
        className="absolute bottom-0 right-0 top-0 w-2 cursor-ew-resize touch-none bg-primary/30 [@media(pointer:coarse)]:w-6"
        onPointerDown={(e) => demarrer(e, "resize")}
        onPointerMove={bouger}
        onPointerUp={relacher}
        onPointerCancel={relacher}
      />

      {/*
        La confirmation, posée SOUS le rectangle pour ne pas couvrir la plage
        qu'on vient de choisir. Elle disparaît pendant le geste : on ne vise
        pas un bouton qu'on est en train de déplacer.
      */}
      {!enGeste && (
        <div
          data-testid="brouillon-actions"
          className="absolute left-0 top-full z-50 mt-1 flex items-center gap-1 rounded-md border bg-background p-1 shadow-md"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onConfirmer}
            className="flex h-8 items-center gap-1 rounded bg-primary px-2 text-xs font-semibold text-primary-foreground"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Créer
          </button>
          <button
            type="button"
            onClick={onDetails}
            className="h-8 whitespace-nowrap rounded border px-2 text-xs"
          >
            Détails…
          </button>
          <button
            type="button"
            onClick={onAnnuler}
            aria-label="Annuler"
            className="flex h-8 w-8 items-center justify-center rounded border"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
