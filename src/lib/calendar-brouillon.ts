import {
  CALENDAR_END_HOUR,
  MIN_JOB_MINUTES,
  clampMinutes,
  minutesToTimeValue,
  snapMinutes,
  SNAP_MINUTES,
} from "@/lib/calendar-utils";
import type { ApercuPlage } from "@/lib/calendar-drag-preview";

/**
 * LE RECTANGLE QU'ON POSE AVANT DE REMPLIR QUOI QUE CE SOIT.
 *
 * Cliquer sur l'horaire ouvrait le formulaire complet, avec un bloc de deux
 * heures déjà décidé à l'aveugle. Choisir sa plage demandait donc d'ouvrir le
 * call en entier, de corriger deux champs d'heure, puis d'enregistrer — trente
 * secondes pour le geste le plus fréquent du calendrier.
 *
 * Le brouillon est le même objet qu'un call en cours de glissement : une plage
 * de minutes. Les mêmes fonctions d'aperçu le déplacent et l'étirent, donc ce
 * qu'on voit pendant le geste est exactement ce qui sera enregistré — un
 * aperçu qui ment ferait sauter le bloc au relâchement.
 */

/** Deux heures : la durée d'un appel de service ordinaire. */
export const DUREE_BROUILLON_PAR_DEFAUT = 120;

/**
 * La plage posée au premier contact.
 *
 * Bornée à la fin de la journée affichée : un clic à 21 h 30 donnerait sinon un
 * rectangle qui déborde de la grille et qu'on ne peut plus attraper.
 */
export function creerBrouillon(
  startMinutes: number,
  duree = DUREE_BROUILLON_PAR_DEFAUT,
): ApercuPlage {
  const finDeJournee = CALENDAR_END_HOUR * 60;
  const debut = clampMinutes(snapMinutes(startMinutes));

  // Si la place manque devant, on recule le début plutôt que d'écraser la
  // durée : un rectangle de dix minutes ne se saisit pas.
  if (debut + duree > finDeJournee) {
    const reculDebut = clampMinutes(finDeJournee - duree);
    return {
      startMinutes: reculDebut,
      endMinutes: Math.max(reculDebut + MIN_JOB_MINUTES, finDeJournee),
    };
  }

  return { startMinutes: debut, endMinutes: debut + duree };
}

/** « 9:00 – 11:00 », affiché pendant le geste. */
export function libelleBrouillon(plage: ApercuPlage): string {
  return `${minutesToTimeValue(plage.startMinutes)} – ${minutesToTimeValue(plage.endMinutes)}`;
}

/** La durée, pour l'annoncer sans faire compter l'utilisateur. */
export function dureeLisible(plage: ApercuPlage): string {
  const minutes = Math.max(0, plage.endMinutes - plage.startMinutes);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m}`;
  if (h) return `${h} h`;
  return `${m} min`;
}

/**
 * La plage définie par un GLISSEMENT : on appuie à un endroit, on tire, on
 * relâche.
 *
 * L'ancre est le point d'appui, jamais le début : tirer vers la gauche est un
 * geste aussi naturel que tirer vers la droite, et obliger à commencer par le
 * début du call ferait rater la moitié des tentatives.
 *
 * La durée minimale est garantie DANS LE SENS DU GESTE. Sans cela, un
 * glissement de dix minutes vers la gauche produirait une plage étendue vers
 * la droite : le rectangle partirait à l'opposé du doigt.
 */
export function brouillonDepuisGlissement(
  ancreMinutes: number,
  curseurMinutes: number,
): ApercuPlage {
  const ancre = clampMinutes(snapMinutes(ancreMinutes));
  const curseur = clampMinutes(snapMinutes(curseurMinutes));
  const versLaGauche = curseur < ancre;

  let debut = Math.min(ancre, curseur);
  let fin = Math.max(ancre, curseur);

  if (fin - debut < MIN_JOB_MINUTES) {
    if (versLaGauche) {
      debut = clampMinutes(fin - MIN_JOB_MINUTES);
      // La journée butait à gauche : on repart vers la droite, faute de place.
      if (fin - debut < MIN_JOB_MINUTES) fin = clampMinutes(debut + MIN_JOB_MINUTES);
    } else {
      fin = clampMinutes(debut + MIN_JOB_MINUTES);
      if (fin - debut < MIN_JOB_MINUTES) debut = clampMinutes(fin - MIN_JOB_MINUTES);
    }
  }

  return { startMinutes: debut, endMinutes: fin };
}

/** Le glissement a-t-il dépassé la simple imprécision du clic ? */
export function glissementSignificatif(ancreMinutes: number, curseurMinutes: number): boolean {
  return Math.abs(curseurMinutes - ancreMinutes) >= SNAP_MINUTES;
}
