"use client";

import { lireMetadonneesJpeg, dimensionsReduites } from "@/lib/image-exif";
import { COTE_LONG_PHOTO, estUneImage } from "@/lib/pieces-jointes";

/**
 * Réduit une photo AVANT de l'envoyer.
 *
 * Côté navigateur, jamais côté serveur : un téléphone sur un chantier a du
 * réseau médiocre. Envoyer 4 Mo pour les réduire ensuite fait échouer le
 * téléversement et brûle les données de l'employé.
 *
 * L'ORIENTATION EST RÉGLÉE PAR LE NAVIGATEUR, PAS PAR NOUS. On dessine depuis
 * un `<img>`, qui applique l'orientation EXIF tout seul depuis Safari 13.4 et
 * Chrome 81 — `image-orientation: from-image` est la valeur par défaut en CSS.
 * `createImageBitmap`, lui, ne l'applique PAS sans option explicite, et c'est
 * l'erreur classique qui fait sortir les photos couchées.
 *
 * TOUT ÉCHEC REND LE FICHIER D'ORIGINE. Chrome ne sait pas décoder le HEIC ;
 * un canvas peut être refusé faute de mémoire sur un vieux téléphone. Dans ces
 * cas-là, mieux vaut téléverser 2 Mo que perdre la photo.
 */
export interface PhotoCompressee {
  fichier: File;
  /** Moment de la prise lu dans l'EXIF, avant que le canvas ne l'efface. */
  priseLe: string | null;
  /** Faux quand la compression a échoué et que l'original part tel quel. */
  compressee: boolean;
}

export async function compresserSiPhoto(
  fichier: File,
  cotePlusLong = COTE_LONG_PHOTO,
): Promise<PhotoCompressee> {
  // Le moment de la prise se lit AVANT le canvas, qui efface toutes les
  // métadonnées — y compris la position GPS, et c'est très bien ainsi.
  let priseLe: string | null = null;
  if (fichier.type === "image/jpeg") {
    try {
      priseLe = lireMetadonneesJpeg(await fichier.arrayBuffer()).priseLe;
    } catch {
      priseLe = null;
    }
  }

  if (!estUneImage(fichier.type)) {
    return { fichier, priseLe, compressee: false };
  }

  try {
    const image = await chargerImage(fichier);
    const { largeur, hauteur } = dimensionsReduites(
      image.naturalWidth,
      image.naturalHeight,
      cotePlusLong,
    );
    if (largeur === 0 || hauteur === 0) {
      return { fichier, priseLe, compressee: false };
    }

    const toile = document.createElement("canvas");
    toile.width = largeur;
    toile.height = hauteur;
    const ctx = toile.getContext("2d");
    if (!ctx) return { fichier, priseLe, compressee: false };
    ctx.drawImage(image, 0, 0, largeur, hauteur);
    URL.revokeObjectURL(image.src);

    // WebP d'abord, JPEG en repli : un très vieux navigateur qui ne connaît
    // pas le WebP rendrait un PNG énorme sans le dire.
    const blob =
      (await versBlob(toile, "image/webp", 0.8)) ?? (await versBlob(toile, "image/jpeg", 0.82));
    if (!blob) return { fichier, priseLe, compressee: false };

    // Une photo déjà petite ne doit pas GROSSIR au passage.
    if (blob.size >= fichier.size) {
      return { fichier, priseLe, compressee: false };
    }

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const nom = fichier.name.replace(/\.[^.]+$/, "") + "." + ext;
    return {
      fichier: new File([blob], nom, { type: blob.type, lastModified: fichier.lastModified }),
      priseLe,
      compressee: true,
    };
  } catch {
    // HEIC sur Chrome, mémoire insuffisante, image corrompue : on garde
    // l'original plutôt que de perdre la photo.
    return { fichier, priseLe, compressee: false };
  }
}

function chargerImage(fichier: File): Promise<HTMLImageElement> {
  return new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => resoudre(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rejeter(new Error("image illisible"));
    };
    img.src = url;
  });
}

function versBlob(toile: HTMLCanvasElement, type: string, qualite: number): Promise<Blob | null> {
  return new Promise((resoudre) => {
    toile.toBlob((b) => resoudre(b && b.type === type ? b : null), type, qualite);
  });
}
