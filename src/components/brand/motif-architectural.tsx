/**
 * LE MOTIF DU BAS DU MENU — une élévation au trait, très en retrait.
 *
 * C'est un dessin, pas une texture : des lignes de construction qui montent
 * depuis le pied du menu, comme une façade en cours de tracé. Il occupe
 * l'espace vide sous la navigation et s'arrête bien avant elle — un motif qui
 * remonte derrière les libellés les rend plus difficiles à lire sans rien
 * apporter.
 *
 * EN SVG, JAMAIS EN IMAGE DE FOND. Une capture posée en `background` serait
 * floue sur les écrans denses, impossible à teinter, et pèserait cent fois ce
 * fichier. Ici les traits suivent la couleur du menu et restent nets partout.
 *
 * `aria-hidden` : il ne dit rien qu'un lecteur d'écran doive entendre.
 */
export function MotifArchitectural({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      preserveAspectRatio="xMinYMax slice"
      className={className}
      aria-hidden
    >
      {/* Le corps principal du bâtiment. */}
      <g stroke="currentColor" strokeWidth="1" opacity="0.9">
        <path d="M18 176 V92 L64 62 L110 92 V176" />
        <path d="M18 92 H110" />
        <path d="M64 62 V176" />
        <path d="M18 122 H110" />
        <path d="M18 149 H110" />
      </g>

      {/* Une aile plus basse, décalée : deux volumes valent mieux qu'un. */}
      <g stroke="currentColor" strokeWidth="1" opacity="0.65">
        <path d="M124 176 V118 L166 96 L208 118 V176" />
        <path d="M124 118 H208" />
        <path d="M166 96 V176" />
        <path d="M124 147 H208" />
      </g>

      {/* Les lignes de fuite, qui donnent la profondeur d'une perspective. */}
      <g stroke="currentColor" strokeWidth="0.6" opacity="0.4">
        <path d="M110 92 L146 74" />
        <path d="M110 176 L146 158" />
        <path d="M146 74 V158" />
        <path d="M208 118 L232 106" />
      </g>

      {/* Une cote, le détail qui fait lire « plan » plutôt que « décor ». */}
      <g stroke="currentColor" strokeWidth="0.6" opacity="0.35">
        <path d="M18 182 H110" />
        <path d="M18 179 V185 M110 179 V185" />
      </g>
    </svg>
  );
}
