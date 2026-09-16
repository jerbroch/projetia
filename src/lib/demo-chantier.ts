/**
 * LE CHANTIER DE LA DÉMONSTRATION — les chiffres, une seule fois.
 *
 * Deux salles de bain à Lévis, suivies de la soumission au paiement. Ces
 * lignes alimentent la démo interactive ET le chiffre annoncé en haut de la
 * page d'accueil.
 *
 * ELLES VIVENT ICI PARCE QUE LE CHIFFRE NE DOIT EXISTER QU'UNE FOIS. La page
 * d'accueil annonce l'écart entre le prix soumis et la facture réelle ; la
 * démo le démontre ligne par ligne. Recopier le montant dans la page, c'était
 * accepter qu'il devienne faux le jour où une ligne bouge — et une page
 * d'accueil qui annonce un montant que sa propre démonstration contredit se
 * paie plus cher que n'importe quel bogue.
 *
 * Les totaux sont CALCULÉS à partir des lignes, jamais écrits à la main.
 */

export const TPS = 0.05;
export const TVQ = 0.09975;

export const cents = (n: number) => Math.round(n * 100) / 100;

/** Montant en dollars canadiens, écrit à la québécoise. */
export function argent(n: number): string {
  return `${n.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

export interface Ligne {
  d: string;
  q: number;
  unite?: string;
  p: number;
  /** Ajouté au chantier par l'employé — souligné dans la facture. */
  terrain?: boolean;
}

export const somme = (lignes: readonly Ligne[]) =>
  cents(lignes.reduce((s, l) => s + l.q * l.p, 0));

export function totaux(sousTotal: number) {
  const tps = cents(sousTotal * TPS);
  const tvq = cents(sousTotal * TVQ);
  return { sousTotal, tps, tvq, total: cents(sousTotal + tps + tvq) };
}

export const MO_PREVUE: Ligne[] = [
  { d: "Compagnon", q: 24, unite: "h", p: 125 },
  { d: "Apprenti", q: 24, unite: "h", p: 85 },
];

export const MATERIAUX: Ligne[] = [
  { d: "Chauffe-eau 60 gal Giant", q: 1, p: 1245 },
  { d: "Tuyau PEX ½ po — rouleau 100 pi", q: 2, p: 89.5 },
  { d: "Raccords PEX sertis", q: 24, p: 3.75 },
  { d: "Robinetterie Moen", q: 2, p: 389 },
  { d: "Drain de douche ABS", q: 2, p: 62 },
  { d: "Valve d'arrêt ¼ tour", q: 6, p: 18.5 },
];

export const MO_REELLE: Ligne[] = [
  { d: "Compagnon", q: 27.5, unite: "h", p: 125 },
  { d: "Apprenti", q: 26, unite: "h", p: 85 },
];

export const COUDE: Ligne = { d: "Coude ½ po", q: 4, p: 9.5, terrain: true };

export const SOUMISSION = totaux(cents(somme(MO_PREVUE) + somme(MATERIAUX)));
export const DEPOT = cents(SOUMISSION.total * 0.3);
export const FACTURE = totaux(cents(somme(MO_REELLE) + somme([...MATERIAUX, COUDE])));

/** L'écart entre le prix soumis et la facture réelle. Le chiffre de la page. */
export const GAIN = cents(FACTURE.total - SOUMISSION.total);

export const SOLDE = cents(FACTURE.total - DEPOT);

/** Les écarts, en clair, pour la prose qui les décrit. */
export const ECARTS = {
  heuresCompagnon: cents(MO_REELLE[0].q - MO_PREVUE[0].q),
  heuresApprenti: cents(MO_REELLE[1].q - MO_PREVUE[1].q),
  coudes: COUDE.q,
} as const;
