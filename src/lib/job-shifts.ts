/**
 * Plages horaires par employé sur un call.
 *
 * Un call porte une plage unique (`start`/`end`) que tous les employés
 * assignés partageaient. Ce module ajoute la notion de plage individuelle,
 * sans jamais rendre l'ancienne obligatoire.
 *
 * La règle centrale est le REPLI : un employé sans plage propre garde celle du
 * call. C'est ce qui permet à tous les calls existants de continuer à se
 * comporter exactement comme avant, sans remplissage rétroactif — qui aurait
 * consisté à inventer une planification que personne n'a saisie.
 */

export interface JobShift {
  id: string;
  scheduledJobId: string;
  employeeId: string;
  /** ISO */
  startAt: string;
  /** ISO */
  endAt: string;
}

export interface PlageEffective {
  employeeId: string;
  start: string;
  end: string;
  /** Vrai quand la plage vient du call faute de plage individuelle. */
  heriteeDuCall: boolean;
}

/** Durée en heures, arrondie au centième. */
export function dureeEnHeures(start: string, end: string): number {
  const debut = Date.parse(start);
  const fin = Date.parse(end);
  if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin <= debut) return 0;
  return Math.round(((fin - debut) / 3_600_000) * 100) / 100;
}

/**
 * Plage d'un employé sur un call : la sienne, ou celle du call à défaut.
 */
export function plageDeLEmploye(
  employeeId: string,
  shifts: JobShift[],
  callStart: string,
  callEnd: string,
): PlageEffective {
  const sienne = shifts.find((s) => s.employeeId === employeeId);
  if (sienne) {
    return {
      employeeId,
      start: sienne.startAt,
      end: sienne.endAt,
      heriteeDuCall: false,
    };
  }
  return { employeeId, start: callStart, end: callEnd, heriteeDuCall: true };
}

/**
 * Plages de tous les employés assignés, dans l'ordre chronologique.
 *
 * Sert à l'employé sur /terrain : la sienne en tête, puis les autres, pour
 * qu'il sache qui arrive quand sur son chantier.
 */
export function plagesDuCall(
  employeeIds: string[],
  shifts: JobShift[],
  callStart: string,
  callEnd: string,
): PlageEffective[] {
  return employeeIds
    .map((id) => plageDeLEmploye(id, shifts, callStart, callEnd))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Heures prévues d'un employé sur un call. */
export function heuresPrevues(
  employeeId: string,
  shifts: JobShift[],
  callStart: string,
  callEnd: string,
): number {
  const p = plageDeLEmploye(employeeId, shifts, callStart, callEnd);
  return dureeEnHeures(p.start, p.end);
}

/**
 * Décale une plage du même écart qu'un call déplacé.
 *
 * Effacer les plages au moindre déplacement serait punitif : on retracerait
 * tout pour un call repoussé d'une heure. En décalant, un gars à 8 h et un
 * autre à 13 h restent à cinq heures d'écart, ce qui était l'intention.
 */
export function decalerPlage(shift: JobShift, decalageMs: number): JobShift {
  return {
    ...shift,
    startAt: new Date(Date.parse(shift.startAt) + decalageMs).toISOString(),
    endAt: new Date(Date.parse(shift.endAt) + decalageMs).toISOString(),
  };
}

/** Écart, en millisecondes, entre l'ancien et le nouveau début d'un call. */
export function decalageDuCall(ancienStart: string, nouveauStart: string): number {
  const a = Date.parse(ancienStart);
  const n = Date.parse(nouveauStart);
  if (!Number.isFinite(a) || !Number.isFinite(n)) return 0;
  return n - a;
}

/**
 * Une plage tracée doit-elle être refusée ?
 *
 * On borne à la plage du call : un rectangle qui déborde du chantier n'a pas
 * de sens, et laisserait croire à des heures planifiées hors du travail prévu.
 * Rend `null` quand tout va bien.
 */
export function refusDePlage(
  start: string,
  end: string,
  callStart: string,
  callEnd: string,
): string | null {
  const d = Date.parse(start);
  const f = Date.parse(end);
  if (!Number.isFinite(d) || !Number.isFinite(f)) return "Plage horaire illisible.";
  if (f <= d) return "La fin doit venir après le début.";

  const cd = Date.parse(callStart);
  const cf = Date.parse(callEnd);
  if (!Number.isFinite(cd) || !Number.isFinite(cf)) return null;

  if (d < cd || f > cf) {
    return "La plage doit rester à l'intérieur des heures du call.";
  }
  return null;
}
