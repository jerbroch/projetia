import {
  CALENDAR_START_HOUR,
  HOUR_WIDTH,
  MIN_JOB_MINUTES,
  clampMinutes,
  snapMinutes,
} from "@/lib/calendar-utils";

/**
 * Aperçu d'un bloc pendant qu'on le tire.
 *
 * Le redimensionnement ne donnait aucun retour visuel : l'état du geste vivait
 * dans un `useRef`, et muter une référence ne déclenche aucun rendu. Le bloc ne
 * pouvait donc pas bouger avant le relâchement — on tirait à l'aveugle, sans
 * savoir à quelle heure on était rendu.
 *
 * Le calcul est isolé ici pour qu'il soit vérifiable sans navigateur, et
 * surtout pour qu'il donne EXACTEMENT le même résultat que l'enregistrement :
 * un aperçu qui ne correspond pas à ce qui sera écrit ferait sauter le bloc au
 * relâchement, ce qui est pire que pas d'aperçu du tout.
 */

export interface ApercuPlage {
  startMinutes: number;
  endMinutes: number;
}

/** Pixels parcourus → minutes, au pas de quinze minutes. */
export function pixelsEnMinutes(deltaPx: number): number {
  return snapMinutes((deltaPx / HOUR_WIDTH) * 60);
}

/**
 * Nouvelle fin pendant un redimensionnement.
 *
 * Reproduit la borne de `resizeEventEnd` : jamais moins de MIN_JOB_MINUTES, et
 * jamais hors de la journée affichée. Sans cette borne, tirer vers la gauche
 * dessinerait un bloc de largeur négative pendant le geste, puis sauterait à la
 * durée minimale au relâchement.
 */
export function apercuRedimensionnement(
  startMinutes: number,
  endMinutes: number,
  deltaPx: number,
): ApercuPlage {
  const fin = clampMinutes(
    Math.max(startMinutes + MIN_JOB_MINUTES, endMinutes + pixelsEnMinutes(deltaPx)),
  );
  return { startMinutes, endMinutes: fin };
}

/**
 * Nouveau début pendant un redimensionnement par la GAUCHE.
 *
 * La fin sert de point fixe. Le début ne peut pas s'en approcher à moins de
 * MIN_JOB_MINUTES, sinon tirer trop loin vers la droite dessinerait un bloc
 * inversé pendant le geste.
 */
export function apercuRedimensionnementDebut(
  startMinutes: number,
  endMinutes: number,
  deltaPx: number,
): ApercuPlage {
  const debut = clampMinutes(
    Math.min(endMinutes - MIN_JOB_MINUTES, startMinutes + pixelsEnMinutes(deltaPx)),
  );
  return { startMinutes: debut, endMinutes };
}

/**
 * Nouvelle plage pendant un déplacement.
 *
 * Le début se cale sur la position du curseur — c'est ce que fait
 * l'enregistrement — et la durée est conservée.
 */
export function apercuDeplacement(
  startMinutes: number,
  endMinutes: number,
  minutesSousLeCurseur: number,
): ApercuPlage {
  const duree = Math.max(MIN_JOB_MINUTES, endMinutes - startMinutes);
  const debut = clampMinutes(minutesSousLeCurseur);
  return { startMinutes: debut, endMinutes: debut + duree };
}

/** Largeur en pixels d'une plage exprimée en minutes. */
export function largeurEnPixels(plage: ApercuPlage): number {
  return Math.max(8, ((plage.endMinutes - plage.startMinutes) / 60) * HOUR_WIDTH);
}

/** Position gauche, en pixels, d'un début exprimé en minutes du jour. */
export function gaucheEnPixels(startMinutes: number): number {
  return ((startMinutes - CALENDAR_START_HOUR * 60) / 60) * HOUR_WIDTH;
}
