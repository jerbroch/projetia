import { cn } from "@/lib/utils";

/**
 * LA MARQUE DU MENU — trois volumes d'immeuble au trait.
 *
 * La maison tracée de `MarqueConstructionIos` reste la marque de
 * l'application. Ici, dans l'en-tête du menu, la référence visuelle montre
 * autre chose : une silhouette d'immeuble à étages, en blanc, avec des
 * fenêtres régulières. C'est ce que fabrique un entrepreneur commercial —
 * une maison dit « résidentiel », et l'écran s'adresse aux deux.
 *
 * EN SVG, comme le reste de la grammaire : il suit la couleur qu'on lui
 * donne, reste net à toutes les tailles, et pèse quelques centaines d'octets.
 */
export function MarqueImmeuble({
  className,
  taille = 30,
}: {
  className?: string;
  taille?: number;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={taille}
      height={taille}
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {/* La tour de gauche, la plus haute : c'est elle qu'on lit en premier. */}
      <path
        d="M4 29 V11 L11 7 V29"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      {/* Le corps central, plus large et plus bas. */}
      <path d="M11 29 V13 H21 V29" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      {/* L'aile de droite, qui ferme la composition. */}
      <path d="M21 29 V18 H28 V29" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />

      {/* Les fenêtres : deux rangées suffisent à dire « étages ». */}
      <g stroke="currentColor" strokeWidth="1.2" opacity="0.75" strokeLinecap="round">
        <path d="M6.5 15 H8.5 M6.5 19.5 H8.5 M6.5 24 H8.5" />
        <path d="M14 17 H18 M14 21.5 H18 M14 26 H18" />
        <path d="M23.5 22 H25.5 M23.5 26 H25.5" />
      </g>

      {/* Le sol, un trait net sous les trois volumes. */}
      <path d="M2 29 H30" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
