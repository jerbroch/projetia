"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * LE LOGO QUI SE CONSTRUIT — le geste central de « du plan au chantier ».
 *
 * Le casque n'apparaît pas : il se dessine. Trois temps, pris à la façon dont
 * on lit un plan puis dont on bâtit ce qu'il décrit :
 *
 *  1. Les traits de construction — les lignes de repère qu'un dessinateur
 *     pose avant la forme. Elles se tracent, fines et orange.
 *  2. Le contour du casque suit ces traits, comme si on le passait à l'encre.
 *  3. La forme se remplit, les traits de repère s'effacent : le plan est
 *     devenu l'objet.
 *
 * C'EST DU SVG ANIMÉ PAR `stroke-dashoffset`, rien d'autre. Pas de
 * bibliothèque, pas de canvas, pas d'image : quelques kilo-octets, et le
 * tracé progressif n'est possible que comme ça.
 *
 * `prefers-reduced-motion` affiche directement le troisième temps — le logo
 * fini, plein, lisible. Couper l'animation ne doit jamais couper le contenu.
 */

export interface LogoQuiSeConstruitProps {
  className?: string;
  /** Côté du carré, en pixels. */
  taille?: number;
  /** Retarde le départ, pour s'enchaîner après d'autres éléments. */
  delaiMs?: number;
}

type Temps = "repere" | "contour" | "plein";

export function LogoQuiSeConstruit({
  className,
  taille = 56,
  delaiMs = 0,
}: LogoQuiSeConstruitProps) {
  const [temps, setTemps] = useState<Temps>("repere");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTemps("plein");
      return;
    }
    const t1 = window.setTimeout(() => setTemps("contour"), delaiMs + 420);
    const t2 = window.setTimeout(() => setTemps("plein"), delaiMs + 1150);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [delaiMs]);

  const contourTrace = temps !== "repere";
  const plein = temps === "plein";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-2xl transition-colors duration-500",
        plein ? "bg-primary" : "bg-primary/10",
        className,
      )}
      style={{ width: taille, height: taille }}
      // Le logo est décoratif ici : le nom de l'entreprise est écrit à côté.
      aria-hidden
    >
      <svg viewBox="0 0 48 48" width={taille * 0.62} height={taille * 0.62} fill="none">
        {/* 1. Les traits de repère du dessinateur. */}
        <g
          stroke="hsl(var(--primary))"
          strokeWidth="0.75"
          opacity={temps === "repere" ? 0.9 : 0}
          className="transition-opacity duration-500"
        >
          <path d="M4 32 H44" strokeDasharray="3 3" />
          <path d="M24 6 V42" strokeDasharray="3 3" />
          <circle cx="24" cy="32" r="17" strokeDasharray="4 4" />
        </g>

        {/* 2. Le contour du casque, tracé. */}
        <g
          stroke={plein ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))"}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-colors duration-500"
          style={{
            strokeDasharray: 120,
            strokeDashoffset: contourTrace ? 0 : 120,
            transition: "stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1), stroke 500ms",
          }}
        >
          {/* La coque. */}
          <path d="M9 31 A15 15 0 0 1 39 31" />
          {/* La visière. */}
          <path d="M5 31 H43" />
        </g>

        {/* 3. Le remplissage : le plan est devenu l'objet. */}
        <g
          fill="hsl(var(--primary-foreground))"
          opacity={plein ? 1 : 0}
          className="transition-opacity duration-500"
        >
          <path d="M20 17 h8 v14 h-8 z" />
        </g>
      </svg>
    </span>
  );
}
