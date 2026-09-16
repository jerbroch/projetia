import { cn } from "@/lib/utils";

/**
 * LA MARQUE CONSTRUCTION iOS — une maison tracée, pas un pictogramme plein.
 *
 * Le toit et les murs sont dessinés au trait, comme une élévation sur un
 * plan : c'est la même grammaire que le motif architectural du bas du menu et
 * que le plan de la page de connexion. Un logo plein aurait fait un bloc de
 * couleur sans rapport avec le reste.
 *
 * En SVG et non en image : il suit la couleur qu'on lui donne, reste net à
 * toutes les tailles, et pèse quelques centaines d'octets.
 */
export function MarqueConstructionIos({
  className,
  taille = 32,
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
      {/* Le toit, trait épais — c'est lui qu'on reconnaît de loin. */}
      <path
        d="M3 15.5 L16 4 L29 15.5"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Les murs, plus fins : ils portent sans crier. */}
      <path
        d="M6.5 14.5 V27 H25.5 V14.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* L'ouverture, qui donne l'échelle. */}
      <path
        d="M13 27 V19.5 H19 V27"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
