"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Plus, X } from "lucide-react";
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
import { minutesToTimeValue } from "@/lib/calendar-utils";

/**
 * LE RECTANGLE QU'ON GLISSE AVANT D'OUVRIR QUOI QUE CE SOIT.
 *
 * Choisir une plage demandait d'ouvrir le call en entier, de corriger deux
 * champs d'heure et d'enregistrer. Le geste le plus fréquent du calendrier
 * prenait trente secondes.
 *
 * Ici : on tire une plage sur la ligne d'un employé, elle s'affiche avec son
 * début et sa fin, on confirme. Le formulaire s'ouvre alors déjà rempli.
 *
 * Les CALCULS sont ceux des calls existants : `apercuDeplacement` et les deux
 * redimensionnements. Un calcul séparé finirait par diverger, et l'aperçu
 * mentirait sur ce qui va être enregistré.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI CE COMPOSANT ARRÊTE LES CLICS.
 *
 * La ligne du calendrier crée une sélection sur `click`. Ce rectangle est un
 * ENFANT de cette ligne : tout clic reçu ici remontait jusqu'à elle. Fermer
 * avec le X effaçait donc la sélection, puis le même clic — en remontant — en
 * recréait une aussitôt à l'endroit du bouton. Le X paraissait ne rien faire.
 *
 * On arrête donc le clic à la racine du rectangle, pas seulement sur le
 * panneau d'actions : n'importe quel enfant ajouté plus tard hériterait
 * sinon du même défaut, sans que personne ne comprenne pourquoi.
 * ─────────────────────────────────────────────────────────────────────────
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
  /** Vrai tant que le doigt ou la souris trace encore la plage sur la grille. */
  enTrace?: boolean;
  onPlageChange: (plage: ApercuPlage) => void;
  onConfirmer: () => void;
  onAnnuler: () => void;
}

type Geste = { mode: "move" | "resize" | "resize-start"; startX: number; plage: ApercuPlage; ecartDeSaisie: number };

export function BlocBrouillon({
  plage,
  hauteur,
  top,
  decalageGauche = 0,
  minutesSousLeCurseur,
  enTrace = false,
  onPlageChange,
  onConfirmer,
  onAnnuler,
}: BlocBrouillonProps) {
  const geste = useRef<Geste | null>(null);
  const [enGeste, setEnGeste] = useState(false);

  /*
   * ÉCHAP ANNULE, DE PARTOUT.
   *
   * Posé sur le document et non sur le rectangle : celui-ci n'a pas le focus
   * après un glissement à la souris, et un `onKeyDown` local ne recevrait
   * jamais rien.
   */
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onAnnuler();
      }
    }
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [onAnnuler]);

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

  /** Les actions se retirent pendant qu'on trace ou qu'on déplace la plage. */
  const actionsVisibles = !enGeste && !enTrace;

  return (
    <div
      data-testid="bloc-brouillon"
      // `touch-none` : sans lui le doigt fait défiler la page au lieu de
      // glisser le rectangle.
      className={cn(
        // PAS d'`overflow-hidden` ICI : la carte d'actions est posée SOUS le
        // rectangle, donc hors de ses limites. Le rognage la faisait
        // disparaître à l'écran tout en la laissant dans le DOM avec une
        // boîte — assez pour qu'une épreuve la croie visible.
        "absolute z-40 touch-none select-none rounded-md",
        // LA SÉLECTION EST DISCRÈTE. L'orange de l'application signale ce qui
        // attend quelqu'un ; une plage qu'on est en train de choisir n'attend
        // personne. Le pétrole la pose sans crier.
        "border border-petrole/45 bg-petrole/[0.09] shadow-sm",
        "dark:border-petrole-foreground/30 dark:bg-petrole-foreground/[0.08]",
        enGeste && "border-petrole/70 bg-petrole/[0.14] ring-1 ring-petrole/30",
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
      // La racine arrête le clic : voir l'explication en tête de fichier.
      onClick={(e) => e.stopPropagation()}
    >
      <div className="pointer-events-none overflow-hidden rounded-md px-1.5 py-1">
        <p className="truncate text-[11px] font-semibold leading-tight text-petrole dark:text-petrole-foreground">
          {libelleBrouillon(plage)}
        </p>
        <p className="truncate text-[10px] leading-tight text-petrole/70 dark:text-petrole-foreground/70">
          {dureeLisible(plage)}
        </p>
      </div>

      {/* Les poignées : 24 px au doigt, comme celles des calls existants. */}
      <div
        data-handle="brouillon-debut"
        title="Reculer ou avancer le début"
        className="absolute bottom-0 left-0 top-0 w-2 cursor-ew-resize touch-none bg-petrole/25 [@media(pointer:coarse)]:w-6"
        onPointerDown={(e) => demarrer(e, "resize-start")}
        onPointerMove={bouger}
        onPointerUp={relacher}
        onPointerCancel={relacher}
      />
      <div
        data-handle="brouillon-fin"
        title="Allonger ou raccourcir la fin"
        className="absolute bottom-0 right-0 top-0 w-2 cursor-ew-resize touch-none bg-petrole/25 [@media(pointer:coarse)]:w-6"
        onPointerDown={(e) => demarrer(e, "resize")}
        onPointerMove={bouger}
        onPointerUp={relacher}
        onPointerCancel={relacher}
      />

      {actionsVisibles && <ActionsBrouillon plage={plage} onConfirmer={onConfirmer} onAnnuler={onAnnuler} />}
    </div>
  );
}

/**
 * LA PETITE CARTE D'ACTIONS, posée sous la plage.
 *
 * Sous, et non dessus : elle couvrirait la plage qu'on vient de choisir, et on
 * ne verrait plus ce qu'on valide.
 *
 * Elle ne porte que deux gestes — créer, renoncer. « Détails… » a été retiré :
 * il ouvrait le même formulaire que « Créer », au début choisi mais avec une
 * fin arbitraire de deux heures. Deux boutons pour le même écran, dont l'un
 * perdait la fin qu'on venait de tracer.
 */
function ActionsBrouillon({
  plage,
  onConfirmer,
  onAnnuler,
}: {
  plage: ApercuPlage;
  onConfirmer: () => void;
  onAnnuler: () => void;
}) {
  return (
    <div
      data-testid="brouillon-actions"
      className={cn(
        "absolute left-0 top-full z-50 mt-1 flex items-center gap-1 rounded-lg p-1",
        "border border-petrole/15 bg-background/95 shadow-flottant backdrop-blur-sm",
        /*
         * SUR TÉLÉPHONE, LA BARRE SE POSE EN BAS DE L'ÉCRAN.
         *
         * Ancrée au rectangle, elle sortait de l'écran dès que la plage
         * approchait du bord droit : la grille fait 720 px de large et défile,
         * le téléphone n'en montre que 390. « Créer » et le X devenaient
         * littéralement inatteignables — et le pouce doit pouvoir les toucher
         * sans qu'on fasse défiler pour les retrouver.
         */
        "max-sm:fixed max-sm:inset-x-auto max-sm:bottom-5 max-sm:left-1/2 max-sm:top-auto",
        "max-sm:mt-0 max-sm:-translate-x-1/2 max-sm:shadow-2xl",
      )}
      // Le pointeur ne doit pas non plus démarrer un déplacement du rectangle.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* L'heure écrite en toutes lettres, pour valider sans relire la grille. */}
      <span className="flex items-center gap-1 pl-1 pr-0.5 text-[11px] font-medium tabular-nums text-petrole dark:text-petrole-foreground">
        <Clock className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
        {minutesToTimeValue(plage.startMinutes)}
        <span className="opacity-50">–</span>
        {minutesToTimeValue(plage.endMinutes)}
      </span>

      <button
        type="button"
        data-testid="brouillon-creer"
        onClick={onConfirmer}
        className={cn(
          "flex h-8 items-center gap-1 rounded-md bg-petrole px-2.5 text-xs font-semibold text-petrole-foreground",
          "transition-colors duration-normal hover:bg-petrole-doux motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-1",
          "[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:px-3.5",
        )}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Créer
      </button>

      {/*
        LE X : 32 px à la souris, 44 px au doigt — la cible minimale qu'un
        pouce atteint sans viser.
      */}
      <button
        type="button"
        data-testid="brouillon-annuler"
        onClick={onAnnuler}
        aria-label="Annuler la sélection"
        title="Annuler la sélection (Échap)"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md border border-petrole/20 text-petrole",
          "transition-colors duration-normal hover:bg-petrole/10 motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-1",
          "dark:border-petrole-foreground/25 dark:text-petrole-foreground dark:hover:bg-petrole-foreground/10",
          "[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
        )}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
