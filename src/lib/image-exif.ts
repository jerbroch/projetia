/**
 * Lecture des métadonnées EXIF d'une photo, avant compression.
 *
 * DEUX CHOSES SEULEMENT NOUS INTÉRESSENT : l'orientation et le moment de la
 * prise. Le reste — et surtout la position GPS — est volontairement ignoré et
 * disparaît au passage par le canvas. On n'envoie pas les coordonnées du
 * domicile d'un client dans un courriel.
 *
 * POURQUOI LIRE L'ORIENTATION SI LE NAVIGATEUR L'APPLIQUE DÉJÀ ?
 * Un `<img>` applique l'orientation EXIF tout seul depuis 2020 (Safari 13.4,
 * Chrome 81) : `image-orientation: from-image` est la valeur par défaut en CSS.
 * C'est ce mécanisme-là qu'on utilise pour dessiner, et non `createImageBitmap`,
 * qui lui ne l'applique PAS sans option explicite.
 *
 * On lit quand même l'orientation pour une raison précise : savoir si la photo
 * est pivotée d'un quart de tour, car dans ce cas la largeur et la hauteur
 * s'échangent, et le calcul de redimensionnement doit le savoir AVANT de
 * dessiner. C'est exactement là que les photos de chantier ressortent couchées.
 */

/** Orientation EXIF : 1 = droite, 6 et 8 = quart de tour, 3 = tête en bas. */
export type OrientationExif = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Les orientations qui échangent largeur et hauteur. */
const QUART_DE_TOUR: ReadonlySet<number> = new Set([5, 6, 7, 8]);

export function pivoteDunQuartDeTour(orientation: number | null | undefined): boolean {
  return orientation != null && QUART_DE_TOUR.has(orientation);
}

export interface MetadonneesPhoto {
  orientation: OrientationExif | null;
  /** Moment de la prise, en ISO. `null` si absent ou illisible. */
  priseLe: string | null;
}

const MARQUEUR_JPEG = 0xffd8;
const APP1 = 0xffe1;
const TAG_ORIENTATION = 0x0112;
const TAG_DATE_ORIGINALE = 0x9003;
const TAG_SOUS_IFD_EXIF = 0x8769;

/**
 * Lit les métadonnées d'un JPEG. Rend des valeurs nulles sur tout ce qui n'est
 * pas un JPEG lisible — un PNG, un HEIC, un fichier tronqué — plutôt que de
 * lever : une photo dont on ne sait rien reste une photo valable.
 */
export function lireMetadonneesJpeg(octets: ArrayBuffer | Uint8Array): MetadonneesPhoto {
  const vide: MetadonneesPhoto = { orientation: null, priseLe: null };
  const buf = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  if (buf.byteLength < 4) return vide;

  const vue = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (vue.getUint16(0) !== MARQUEUR_JPEG) return vide;

  // Parcours des segments jusqu'à APP1, qui porte l'EXIF.
  let pos = 2;
  while (pos + 4 <= buf.byteLength) {
    const marqueur = vue.getUint16(pos);
    if ((marqueur & 0xff00) !== 0xff00) return vide;
    const taille = vue.getUint16(pos + 2);
    if (taille < 2) return vide;

    if (marqueur === APP1) {
      const debut = pos + 4;
      // « Exif\0\0 »
      if (debut + 6 > buf.byteLength) return vide;
      const entete = String.fromCharCode(...buf.subarray(debut, debut + 4));
      if (entete !== "Exif") return vide;
      return lireTiff(vue, debut + 6, buf.byteLength);
    }

    pos += 2 + taille;
  }
  return vide;
}

function lireTiff(vue: DataView, base: number, fin: number): MetadonneesPhoto {
  const vide: MetadonneesPhoto = { orientation: null, priseLe: null };
  if (base + 8 > fin) return vide;

  const ordre = vue.getUint16(base);
  // « II » = petit-boutiste (Intel), « MM » = grand-boutiste (Motorola).
  const petitBout = ordre === 0x4949;
  if (!petitBout && ordre !== 0x4d4d) return vide;
  if (vue.getUint16(base + 2, petitBout) !== 42) return vide;

  const decalageIfd0 = vue.getUint32(base + 4, petitBout);
  const champs = lireIfd(vue, base, base + decalageIfd0, petitBout, fin);
  if (!champs) return vide;

  let orientation: OrientationExif | null = null;
  const brut = champs.get(TAG_ORIENTATION);
  if (typeof brut === "number" && brut >= 1 && brut <= 8) {
    orientation = brut as OrientationExif;
  }

  // La date de prise vit dans le sous-répertoire EXIF, pas dans IFD0.
  let priseLe: string | null = null;
  const sous = champs.get(TAG_SOUS_IFD_EXIF);
  if (typeof sous === "number") {
    const champsExif = lireIfd(vue, base, base + sous, petitBout, fin);
    const date = champsExif?.get(TAG_DATE_ORIGINALE);
    if (typeof date === "string") priseLe = versIso(date);
  }

  return { orientation, priseLe };
}

function lireIfd(
  vue: DataView,
  base: number,
  pos: number,
  petitBout: boolean,
  fin: number,
): Map<number, number | string> | null {
  if (pos + 2 > fin) return null;
  const n = vue.getUint16(pos, petitBout);
  const champs = new Map<number, number | string>();

  for (let i = 0; i < n; i += 1) {
    const p = pos + 2 + i * 12;
    if (p + 12 > fin) break;

    const tag = vue.getUint16(p, petitBout);
    const type = vue.getUint16(p + 2, petitBout);
    const nombre = vue.getUint32(p + 4, petitBout);

    if (type === 3) {
      // SHORT : la valeur tient dans les quatre octets, cadrée à gauche.
      champs.set(tag, vue.getUint16(p + 8, petitBout));
    } else if (type === 4) {
      champs.set(tag, vue.getUint32(p + 8, petitBout));
    } else if (type === 2 && nombre > 1) {
      // ASCII : au-delà de quatre octets, la valeur est ailleurs.
      const depart = nombre <= 4 ? p + 8 : base + vue.getUint32(p + 8, petitBout);
      if (depart + nombre > fin) continue;
      let s = "";
      for (let k = 0; k < nombre - 1; k += 1) s += String.fromCharCode(vue.getUint8(depart + k));
      champs.set(tag, s);
    }
  }
  return champs;
}

/** « 2026:09:02 14:30:00 » — le format EXIF, que `new Date()` ne comprend pas. */
function versIso(exif: string): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(exif.trim());
  if (!m) return null;
  const [, a, mo, j, h, mi, s] = m;
  const d = new Date(`${a}-${mo}-${j}T${h}:${mi}:${s}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Dimensions après réduction, en conservant les proportions.
 *
 * `pivote` vient de l'orientation EXIF : un navigateur qui a déjà redressé la
 * photo rapporte des dimensions déjà échangées, mais un décodeur qui ne l'a pas
 * fait rapporte les dimensions brutes. Sans ce drapeau, une photo prise en
 * portrait sort à l'envers et déborde du cadre.
 */
export function dimensionsReduites(
  largeur: number,
  hauteur: number,
  cotePlusLong = 1600,
): { largeur: number; hauteur: number } {
  const l = Math.max(0, Math.round(largeur));
  const h = Math.max(0, Math.round(hauteur));
  if (l === 0 || h === 0) return { largeur: 0, hauteur: 0 };

  const plusLong = Math.max(l, h);
  if (plusLong <= cotePlusLong) return { largeur: l, hauteur: h };

  const facteur = cotePlusLong / plusLong;
  return {
    largeur: Math.max(1, Math.round(l * facteur)),
    hauteur: Math.max(1, Math.round(h * facteur)),
  };
}
