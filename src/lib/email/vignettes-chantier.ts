import sharp from "sharp";

/**
 * VIGNETTES DES PHOTOS DE CHANTIER, POUR LE COURRIEL DE FACTURE.
 *
 * Une facture accompagnée des photos du travail ne se conteste pas. Encore
 * faut-il que le client les VOIE, sans cliquer et sans que son logiciel les
 * bloque. Trois contraintes, incompatibles avec les solutions évidentes :
 *
 *   • Outlook bloque les images DISTANTES par défaut. Un `<img src="https://…">`
 *     donne des cases vides.
 *   • Gmail tronque un courriel dont le HTML dépasse 102 Ko. Six photos en
 *     base64 dans le corps pèsent 174 Ko : le courriel est coupé en deux.
 *   • Le WebP, format dans lequel l'application stocke les photos, n'est pas
 *     lu par Outlook pour Windows.
 *
 * La réponse aux trois : des IMAGES LIÉES par `content_id`. L'image voyage avec
 * le courriel — Outlook l'affiche, puisqu'elle n'est pas distante — et le corps
 * HTML ne contient qu'une balise de 171 octets. Vingt vignettes ajoutent
 * 3,4 Ko à un HTML qui en fait 10 : on reste à 89 Ko du seuil de Gmail.
 *
 * Et la conversion en JPEG règle le troisième point.
 */

/** Côté long d'une vignette. Mesuré : 22 à 32 Ko sur de vraies photos. */
export const LARGEUR_VIGNETTE = 480;

/** Compromis poids / lisibilité, mesuré lui aussi. */
export const QUALITE_VIGNETTE = 72;

/**
 * Plafond de sécurité sur le poids total des vignettes d'un courriel.
 *
 * Resend accepte 40 Mo ; ce n'est pas la vraie limite. Celle-ci est le forfait
 * de données d'un client qui ouvre sa facture sur son téléphone. Vingt
 * vignettes pèsent environ 600 Ko : on s'arrête bien avant que ça devienne
 * impoli.
 */
export const POIDS_MAX_VIGNETTES = 3 * 1024 * 1024;

export interface VignetteCourriel {
  /** Référencée dans le HTML par `<img src="cid:…">`. */
  contentId: string;
  filename: string;
  /** JPEG encodé en base64, prêt pour Resend. */
  contenuBase64: string;
  /** Décrit la photo quand elle ne s'affiche pas. */
  alt: string;
  /** Lien vers la pleine taille, pour qui veut regarder de près. */
  urlPleineTaille: string | null;
  octets: number;
}

export interface PhotoSource {
  id: string;
  fileName: string;
  mimeType: string;
  /** Les octets d'origine, tels que stockés. */
  donnees: Buffer;
  /** Moment de la prise, lu dans l'EXIF au téléversement. */
  priseLe?: string | null;
  urlPleineTaille?: string | null;
}

/** Ce qui peut devenir une vignette. Un PDF n'en est pas une. */
export function estPhotoAffichable(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/webp"].includes(mimeType);
}

function texteAlternatif(photo: PhotoSource, rang: number): string {
  const date = photo.priseLe ? new Date(photo.priseLe) : null;
  const jour =
    date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeZone: "America/Montreal" }).format(date)
      : null;
  return jour ? `Photo ${rang} du chantier, prise le ${jour}` : `Photo ${rang} du chantier`;
}

/**
 * Fabrique les vignettes, dans l'ordre reçu, en s'arrêtant au plafond de poids.
 *
 * UNE PHOTO ILLISIBLE NE FAIT PAS ÉCHOUER L'ENVOI. Elle est simplement omise :
 * mieux vaut une facture avec cinq photos sur six qu'une facture qui ne part
 * pas. C'est la même règle que la compression côté navigateur.
 */
export async function fabriquerVignettes(photos: PhotoSource[]): Promise<VignetteCourriel[]> {
  const vignettes: VignetteCourriel[] = [];
  let poids = 0;

  for (const [index, photo] of photos.entries()) {
    if (!estPhotoAffichable(photo.mimeType)) continue;

    try {
      const jpeg = await sharp(photo.donnees)
        .rotate() // respecte l'orientation EXIF plutôt que de coucher la photo
        .resize({ width: LARGEUR_VIGNETTE, withoutEnlargement: true })
        .jpeg({ quality: QUALITE_VIGNETTE, mozjpeg: true })
        .toBuffer();

      if (poids + jpeg.length > POIDS_MAX_VIGNETTES) break;
      poids += jpeg.length;

      vignettes.push({
        contentId: `photo-${index + 1}`,
        filename: `photo-${index + 1}.jpg`,
        contenuBase64: jpeg.toString("base64"),
        alt: texteAlternatif(photo, vignettes.length + 1),
        urlPleineTaille: photo.urlPleineTaille ?? null,
        octets: jpeg.length,
      });
    } catch {
      // Fichier corrompu, format inattendu : on passe. Voir plus haut.
      continue;
    }
  }

  return vignettes;
}
