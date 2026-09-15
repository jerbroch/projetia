import { cn } from "@/lib/utils";

/**
 * LE PLAN ARCHITECTURAL — la signature visuelle de « du plan au chantier ».
 *
 * Une grille technique, quelques lignes de plan, des cotes et des repères :
 * ce qu'un entrepreneur reconnaît au premier coup d'œil parce qu'il en lit
 * toute la journée. Rien d'inventé, rien de décoratif pour décorer.
 *
 * TOUT EST EN SVG ET EN CSS. Pas de canvas, pas de vidéo, pas de bibliothèque
 * d'animation : le fichier pèse quelques kilo-octets et ne bloque pas le
 * rendu. C'est aussi ce qui permet aux lignes de se dessiner — un tracé SVG
 * s'anime par `stroke-dashoffset`, ce qu'aucune image ne sait faire.
 *
 * `prefers-reduced-motion` arrête tout : les lignes s'affichent alors
 * entièrement tracées, ce qui reste un beau plan — pas une page vide.
 */

export interface PlanArchitecturalProps {
  className?: string;
  /** Les lignes se dessinent à l'arrivée. Faux pour un fond immobile. */
  anime?: boolean;
  /** Densité de la grille, en pixels. */
  pas?: number;
  /**
   * `complet` : la grille, le bâtiment et les cotes — pour un volet qui n'a
   * que ça à porter.
   *
   * `grille` : la grille seule. À utiliser DERRIÈRE du texte. Les cotes d'un
   * plan sont des chiffres et des étiquettes : passées sous un formulaire,
   * elles ne se lisent pas comme un fond, elles se lisent comme du contenu —
   * « 13 400 » posé sous « Pas encore de compte? » est illisible pour les
   * deux.
   */
  variante?: "complet" | "grille";
}

export function PlanArchitectural({
  className,
  anime = true,
  pas = 32,
  variante = "complet",
}: PlanArchitecturalProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {/* La grille : deux dégradés répétés, moins coûteux qu'un SVG de milliers de traits. */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--plan-ligne)) 1px, transparent 1px)," +
            "linear-gradient(to bottom, hsl(var(--plan-ligne)) 1px, transparent 1px)",
          backgroundSize: `${pas}px ${pas}px`,
        }}
      />
      {/* Une grille plus large par-dessus : c'est ce décalage d'échelles qui
          fait lire « plan » plutôt que « papier quadrillé ». */}
      <div
        className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--plan-ligne)) 1px, transparent 1px)," +
            "linear-gradient(to bottom, hsl(var(--plan-ligne)) 1px, transparent 1px)",
          backgroundSize: `${pas * 5}px ${pas * 5}px`,
        }}
      />

      {variante === "complet" && (
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g
          className={cn("plan-trace", anime && "plan-trace--anime")}
          stroke="hsl(var(--plan-trait))"
          strokeWidth="1.25"
          strokeLinecap="square"
        >
          {/* Le contour d'un bâtiment, simplifié. */}
          <path d="M120 420 L120 190 L330 190 L330 130 L560 130 L560 420 Z" />
          {/* Refends intérieurs. */}
          <path d="M330 190 L330 420" />
          <path d="M120 300 L330 300" />
          <path d="M440 130 L440 420" />
          {/* Une ouverture, marquée comme sur un plan. */}
          <path d="M330 240 L330 275" strokeWidth="3" stroke="hsl(var(--plan-accent))" />
          <path d="M470 420 L520 420" strokeWidth="3" stroke="hsl(var(--plan-accent))" />
        </g>

        {/* Les cotes : ce sont elles qui font « technique » plutôt que « joli ». */}
        <g
          className={cn("plan-cote", anime && "plan-cote--anime")}
          stroke="hsl(var(--plan-trait))"
          strokeWidth="0.75"
          opacity="0.75"
        >
          <path d="M120 450 L560 450" />
          <path d="M120 443 L120 457" />
          <path d="M560 443 L560 457" />
          <path d="M590 130 L590 420" />
          <path d="M583 130 L597 130" />
          <path d="M583 420 L597 420" />
        </g>
        <g
          className={cn("plan-cote", anime && "plan-cote--anime")}
          fill="hsl(var(--plan-trait))"
          opacity="0.8"
          fontSize="11"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          <text x="315" y="468" textAnchor="middle">
            13 400
          </text>
          <text x="604" y="280" transform="rotate(90 604 280)" textAnchor="middle">
            8 850
          </text>
          <text x="134" y="182">
            N1
          </text>
          <text x="344" y="182">
            N2
          </text>
        </g>

        {/* Le repère de nord, qui n'existe que sur un plan. */}
        <g
          className={cn("plan-cote", anime && "plan-cote--anime")}
          stroke="hsl(var(--plan-trait))"
          strokeWidth="1"
          opacity="0.7"
        >
          <circle cx="700" cy="120" r="22" />
          <path d="M700 100 L700 140 M700 100 L693 112 M700 100 L707 112" />
        </g>
      </svg>
      )}
    </div>
  );
}
