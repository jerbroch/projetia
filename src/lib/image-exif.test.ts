import { describe, expect, it } from "vitest";
import {
  dimensionsReduites,
  lireMetadonneesJpeg,
  pivoteDunQuartDeTour,
} from "./image-exif";

/**
 * Fabrique un vrai JPEG minimal portant un segment EXIF.
 *
 * Écrire ces octets à la main plutôt que d'embarquer une photo : le test dit
 * alors exactement ce qu'il éprouve, et couvre les deux boutismes — un iPhone
 * écrit en petit-boutiste, beaucoup de reflex en grand-boutiste, et se tromper
 * de sens fait lire une orientation 6 comme 1536.
 */
function jpegAvecExif(
  orientation: number,
  { petitBout = true, date }: { petitBout?: boolean; date?: string } = {},
): Uint8Array {
  const champs: Array<{ tag: number; type: number; nombre: number; valeur: number }> = [
    { tag: 0x0112, type: 3, nombre: 1, valeur: orientation },
  ];

  const octetsDate = date ? new TextEncoder().encode(date + "\0") : null;
  // Le sous-répertoire EXIF suit IFD0 ; on calcule son décalage après coup.
  if (octetsDate) champs.push({ tag: 0x8769, type: 4, nombre: 1, valeur: 0 });

  const tailleIfd0 = 2 + champs.length * 12 + 4;
  const decalageSousIfd = 8 + tailleIfd0;
  if (octetsDate) champs[1].valeur = decalageSousIfd;

  const tailleSousIfd = octetsDate ? 2 + 12 + 4 : 0;
  const decalageDate = decalageSousIfd + tailleSousIfd;
  const tiff = new Uint8Array(decalageDate + (octetsDate?.length ?? 0));
  const v = new DataView(tiff.buffer);

  v.setUint16(0, petitBout ? 0x4949 : 0x4d4d);
  v.setUint16(2, 42, petitBout);
  v.setUint32(4, 8, petitBout);

  v.setUint16(8, champs.length, petitBout);
  champs.forEach((c, i) => {
    const p = 10 + i * 12;
    v.setUint16(p, c.tag, petitBout);
    v.setUint16(p + 2, c.type, petitBout);
    v.setUint32(p + 4, c.nombre, petitBout);
    if (c.type === 3) v.setUint16(p + 8, c.valeur, petitBout);
    else v.setUint32(p + 8, c.valeur, petitBout);
  });
  v.setUint32(10 + champs.length * 12, 0, petitBout);

  if (octetsDate) {
    v.setUint16(decalageSousIfd, 1, petitBout);
    v.setUint16(decalageSousIfd + 2, 0x9003, petitBout);
    v.setUint16(decalageSousIfd + 4, 2, petitBout);
    v.setUint32(decalageSousIfd + 6, octetsDate.length, petitBout);
    v.setUint32(decalageSousIfd + 10, decalageDate, petitBout);
    v.setUint32(decalageSousIfd + 14, 0, petitBout);
    tiff.set(octetsDate, decalageDate);
  }

  const entete = new TextEncoder().encode("Exif\0\0");
  const app1 = entete.length + tiff.length;
  const sortie = new Uint8Array(2 + 2 + 2 + app1);
  const vs = new DataView(sortie.buffer);
  vs.setUint16(0, 0xffd8);          // début de JPEG
  vs.setUint16(2, 0xffe1);          // APP1
  vs.setUint16(4, 2 + app1);        // taille du segment
  sortie.set(entete, 6);
  sortie.set(tiff, 6 + entete.length);
  return sortie;
}

describe("lireMetadonneesJpeg — orientation", () => {
  it("lit les huit orientations, en petit-boutiste", () => {
    // Un iPhone écrit en petit-boutiste. L'orientation 6 — quart de tour — est
    // celle de toute photo prise en tenant le téléphone droit.
    for (let o = 1; o <= 8; o += 1) {
      expect(lireMetadonneesJpeg(jpegAvecExif(o)).orientation).toBe(o);
    }
  });

  it("lit aussi en grand-boutiste", () => {
    // Se tromper de boutisme fait lire une orientation 6 comme 1536.
    for (let o = 1; o <= 8; o += 1) {
      expect(lireMetadonneesJpeg(jpegAvecExif(o, { petitBout: false })).orientation).toBe(o);
    }
  });

  it("refuse une orientation hors plage plutôt que de la propager", () => {
    expect(lireMetadonneesJpeg(jpegAvecExif(0)).orientation).toBeNull();
    expect(lireMetadonneesJpeg(jpegAvecExif(9)).orientation).toBeNull();
  });

  it("rend null sur ce qui n'est pas un JPEG", () => {
    // Un HEIC, un PNG, un PDF : on ne sait rien, et c'est acceptable.
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(lireMetadonneesJpeg(png)).toEqual({ orientation: null, priseLe: null });
    expect(lireMetadonneesJpeg(new Uint8Array([0xff, 0xd8]))).toEqual({
      orientation: null,
      priseLe: null,
    });
    expect(lireMetadonneesJpeg(new Uint8Array(0))).toEqual({ orientation: null, priseLe: null });
  });

  it("ne lève pas sur un fichier tronqué en plein EXIF", () => {
    const entier = jpegAvecExif(6);
    for (const coupe of [8, 14, 20, entier.length - 3]) {
      expect(() => lireMetadonneesJpeg(entier.subarray(0, coupe))).not.toThrow();
    }
  });
});

describe("lireMetadonneesJpeg — moment de la prise", () => {
  it("convertit le format EXIF, que Date ne comprend pas", () => {
    // « 2026:09:02 » n'est pas une date ISO : new Date() la rejette.
    const m = lireMetadonneesJpeg(jpegAvecExif(1, { date: "2026:09:02 14:30:00" }));
    expect(m.priseLe).not.toBeNull();
    expect(new Date(m.priseLe!).getFullYear()).toBe(2026);
    expect(new Date(m.priseLe!).getMonth()).toBe(8);
    expect(new Date(m.priseLe!).getDate()).toBe(2);
  });

  it("rend null quand la date est absente", () => {
    expect(lireMetadonneesJpeg(jpegAvecExif(1)).priseLe).toBeNull();
  });

  it("rend null sur une date illisible plutôt qu'une date fausse", () => {
    expect(lireMetadonneesJpeg(jpegAvecExif(1, { date: "pas une date" })).priseLe).toBeNull();
    expect(lireMetadonneesJpeg(jpegAvecExif(1, { date: "2026:13:45 99:99:99" })).priseLe).toBeNull();
  });
});

describe("pivoteDunQuartDeTour", () => {
  it("reconnaît les orientations qui échangent largeur et hauteur", () => {
    [5, 6, 7, 8].forEach((o) => expect(pivoteDunQuartDeTour(o)).toBe(true));
    [1, 2, 3, 4].forEach((o) => expect(pivoteDunQuartDeTour(o)).toBe(false));
  });

  it("ne pivote rien sans orientation connue", () => {
    expect(pivoteDunQuartDeTour(null)).toBe(false);
    expect(pivoteDunQuartDeTour(undefined)).toBe(false);
  });
});

describe("dimensionsReduites", () => {
  it("ramène une photo d'iPhone au côté long voulu", () => {
    // 4032×3024 est la sortie standard d'un iPhone.
    expect(dimensionsReduites(4032, 3024)).toEqual({ largeur: 1600, hauteur: 1200 });
  });

  it("traite le portrait comme le paysage", () => {
    expect(dimensionsReduites(3024, 4032)).toEqual({ largeur: 1200, hauteur: 1600 });
  });

  it("ne grossit jamais une petite image", () => {
    // Agrandir gonflerait le fichier sans ajouter un pixel d'information.
    expect(dimensionsReduites(800, 600)).toEqual({ largeur: 800, hauteur: 600 });
  });

  it("garde au moins un pixel sur un format très allongé", () => {
    const d = dimensionsReduites(20000, 3);
    expect(d.largeur).toBe(1600);
    expect(d.hauteur).toBeGreaterThanOrEqual(1);
  });

  it("rend zéro sur des dimensions vides sans lever", () => {
    expect(dimensionsReduites(0, 0)).toEqual({ largeur: 0, hauteur: 0 });
  });

  it("respecte un côté long différent", () => {
    expect(dimensionsReduites(4032, 3024, 800)).toEqual({ largeur: 800, hauteur: 600 });
  });
});
