/**
 * Lignes qui partiraient à 0 $ sur la facture.
 *
 * Un zéro est parfois voulu — matériel fourni par le client, reprise sous
 * garantie, extra offert. Bloquer l'émission serait donc pénible. Mais un zéro
 * oublié, lui, se voit chez le client : douze paquets de bardeau facturés
 * zéro dollar.
 *
 * D'où une confirmation, et non un blocage : elle NOMME ce qui part à zéro, et
 * dit ce que ça représente. « Des lignes sont à 0 $ » n'apprend rien ; « douze
 * paquets de bardeau » se reconnaît d'un coup d'œil.
 */

export interface LigneFacturable {
  description: string;
  quantity: number;
  unitSellPrice: number;
  lineTotal: number;
  lineType?: string;
}

export interface LignesAZero {
  lignes: LigneFacturable[];
  /** Ce que la facture porte au total, pour situer ce qui manque. */
  totalFacture: number;
}

export function lignesAZero(lignes: readonly LigneFacturable[]): LigneFacturable[] {
  return lignes.filter((l) => (l.unitSellPrice ?? 0) <= 0 && (l.lineTotal ?? 0) <= 0);
}

/** Quantité écrite lisiblement : « 12 » et non « 12.00 ». */
function quantite(n: number): string {
  return n.toLocaleString("fr-CA", { maximumFractionDigits: 2 });
}

/**
 * Message de confirmation, ou `null` si rien ne part à zéro.
 *
 * Nomme au plus quatre lignes : au-delà, la liste devient un mur qu'on ne lit
 * plus, et le compte suffit à faire réfléchir.
 */
export function messageLignesAZero(
  lignes: readonly LigneFacturable[],
  totalFacture: number,
): string | null {
  const zero = lignesAZero(lignes);
  if (zero.length === 0) return null;

  const montre = zero.slice(0, 4);
  const nommees = montre
    .map((l) => `« ${l.description} » (${quantite(l.quantity)})`)
    .join(", ");
  const reste = zero.length - montre.length;
  const suite = reste > 0 ? `, et ${reste} autre${reste > 1 ? "s" : ""}` : "";

  const total = totalFacture.toLocaleString("fr-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const seule = zero.length === 1;
  const tete = seule
    ? "Une ligne partira à 0 $ sur la facture"
    : `${zero.length} lignes partiront à 0 $ sur la facture`;
  const rien = seule ? "Elle n'ajoute rien" : "Elles n'ajoutent rien";
  const prix = seule ? "entrez son prix" : "entrez leur prix";

  return `${tete} : ${nommees}${suite}. ${rien} au total de ${total} $. C'est voulu si le matériel est fourni par le client, sous garantie ou offert — sinon, ${prix} avant d'émettre.`;
}
