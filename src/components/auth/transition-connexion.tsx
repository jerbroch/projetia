"use client";

import { useEffect, useState } from "react";
import { HardHat } from "lucide-react";
import { PlanArchitectural } from "@/components/brand/plan-architectural";

/**
 * CE QU'ON VOIT ENTRE LA CONNEXION ET LE TABLEAU DE BORD.
 *
 * Elle n'apparaît QUE lorsque Supabase a confirmé l'authentification : le
 * composant n'est monté qu'après un `loginAction` qui a rendu une destination.
 * Un mot de passe refusé, un compte non confirmé ou une coupure réseau ne la
 * font jamais paraître — il n'y a pas de chemin qui le permette.
 *
 * ELLE NE RALENTIT RIEN. La navigation est lancée EN MÊME TEMPS que
 * l'animation, pas après : Next charge le tableau de bord pendant que les
 * lignes se tracent. La durée visible est celle du chargement réel, bornée à
 * ~1,2 s — pas un délai ajouté pour faire joli.
 *
 * `prefers-reduced-motion` la réduit à un simple voile : le message reste,
 * les tracés ne bougent plus.
 */

export interface TransitionConnexionProps {
  /** Appelée dès que le rideau est posé : c'est là qu'on navigue. */
  onPret: () => void;
}

export function TransitionConnexion({ onPret }: TransitionConnexionProps) {
  const [etape, setEtape] = useState<"grille" | "logo" | "message">("grille");

  useEffect(() => {
    // La navigation part TOUT DE SUITE. L'animation l'accompagne ; elle ne
    // la précède pas, sinon on ferait attendre pour rien.
    onPret();

    const t1 = window.setTimeout(() => setEtape("logo"), 220);
    const t2 = window.setTimeout(() => setEtape("message"), 520);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onPret]);

  return (
    <div
      // `alert` : un lecteur d'écran doit annoncer ce qui se passe, pas
      // laisser l'utilisateur devant un écran qui a changé sans un mot.
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[hsl(var(--plan-fond))]"
      style={{ animation: "plan-apparaitre 180ms ease-out both" }}
    >
      <PlanArchitectural pas={28} />

      {/* Le voile pose le texte sur du net. Il est OPAQUE AU CENTRE et
          transparent sur les bords — dans l'autre sens, les traits du plan
          passaient sous « Préparation de votre espace de travail… » et le
          rendaient illisible pendant toute l'animation. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--plan-fond))_0%,hsl(var(--plan-fond)/0.85)_45%,transparent_80%)]" />

      <div className="relative flex flex-col items-center gap-5 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_0_60px_-12px_hsl(var(--plan-accent))]"
          style={{
            animation:
              etape === "grille"
                ? "plan-apparaitre 260ms ease-out both"
                : "plan-monter 420ms cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          <HardHat className="h-10 w-10" aria-hidden />
        </div>

        <div className="h-6">
          {etape === "message" && (
            <p
              className="text-sm font-medium tracking-wide text-[hsl(var(--plan-trait))]"
              style={{ animation: "plan-monter 360ms ease-out both" }}
            >
              Préparation de votre espace de travail…
            </p>
          )}
        </div>

        {/* La ligne orange qui « construit » : la signature réutilisable. */}
        <div className="h-px w-56 overflow-hidden bg-[hsl(var(--plan-ligne)/0.25)]">
          <div className="h-full w-full origin-left bg-[hsl(var(--plan-accent))] transition-transform duration-[900ms] ease-out"
            style={{ transform: etape === "grille" ? "scaleX(0)" : "scaleX(1)" }}
          />
        </div>
      </div>
    </div>
  );
}
