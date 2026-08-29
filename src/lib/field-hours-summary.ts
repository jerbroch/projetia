/**
 * Cumuls des heures saisies sur le terrain.
 *
 * Les heures atterrissaient dans `field_hours` et n'en ressortaient jamais :
 * l'unique lecture du code était le récapitulatif que l'employé voit sur son
 * propre chantier. Aucun total, nulle part, pour l'employeur.
 *
 * Ce module ne fait que regrouper. Il ne multiplie RIEN par un taux horaire :
 * `employees.hourly_rate` ne dit pas s'il s'agit du salaire versé ou du taux
 * refacturé au client, et les deux diffèrent d'un facteur important en
 * construction — charges, CNESST, temps supplémentaire. Afficher un montant
 * tiré de ce champ donnerait un chiffre faux avec l'autorité d'un chiffre
 * juste. Les heures, elles, sont vraies.
 */

export interface LigneHeures {
  employeeId: string;
  employeeName: string;
  scheduledJobId: string;
  jobLabel: string;
  /** AAAA-MM-JJ */
  workDate: string;
  hours: number;
}

export interface TotalParEmploye {
  employeeId: string;
  employeeName: string;
  hours: number;
  jours: number;
}

export interface TotalParChantier {
  scheduledJobId: string;
  jobLabel: string;
  hours: number;
  employes: number;
}

export interface TotalParSemaine {
  /** Lundi de la semaine, AAAA-MM-JJ. */
  debut: string;
  hours: number;
}

/** Arrondi au centième — les heures sont saisies en NUMERIC(5,2). */
function arrondi(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Lundi de la semaine contenant cette date.
 *
 * Les composantes sont lues à la main plutôt que par `new Date(chaîne)` : ce
 * dernier interprète « 2026-08-29 » en UTC et décale d'un jour dès qu'on est à
 * l'ouest de Greenwich — une heure du dimanche soir basculerait dans la
 * mauvaise semaine.
 */
export function debutDeSemaine(dateISO: string): string {
  const [a, m, j] = dateISO.split("-").map(Number);
  const d = new Date(a, (m ?? 1) - 1, j ?? 1);
  // getDay() : 0 = dimanche. On veut le lundi comme premier jour.
  const decalage = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - decalage);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function totalGeneral(lignes: LigneHeures[]): number {
  return arrondi(lignes.reduce((somme, l) => somme + l.hours, 0));
}

export function totalParEmploye(lignes: LigneHeures[]): TotalParEmploye[] {
  const par = new Map<string, { nom: string; heures: number; jours: Set<string> }>();
  for (const l of lignes) {
    const e = par.get(l.employeeId) ?? { nom: l.employeeName, heures: 0, jours: new Set<string>() };
    e.heures += l.hours;
    e.jours.add(l.workDate);
    par.set(l.employeeId, e);
  }
  return [...par.entries()]
    .map(([employeeId, e]) => ({
      employeeId,
      employeeName: e.nom,
      hours: arrondi(e.heures),
      jours: e.jours.size,
    }))
    .sort((a, b) => b.hours - a.hours || a.employeeName.localeCompare(b.employeeName, "fr"));
}

export function totalParChantier(lignes: LigneHeures[]): TotalParChantier[] {
  const par = new Map<string, { libelle: string; heures: number; employes: Set<string> }>();
  for (const l of lignes) {
    const c =
      par.get(l.scheduledJobId) ?? { libelle: l.jobLabel, heures: 0, employes: new Set<string>() };
    c.heures += l.hours;
    c.employes.add(l.employeeId);
    par.set(l.scheduledJobId, c);
  }
  return [...par.entries()]
    .map(([scheduledJobId, c]) => ({
      scheduledJobId,
      jobLabel: c.libelle,
      hours: arrondi(c.heures),
      employes: c.employes.size,
    }))
    .sort((a, b) => b.hours - a.hours || a.jobLabel.localeCompare(b.jobLabel, "fr"));
}

/** Semaines du lundi, de la plus récente à la plus ancienne. */
export function totalParSemaine(lignes: LigneHeures[]): TotalParSemaine[] {
  const par = new Map<string, number>();
  for (const l of lignes) {
    const debut = debutDeSemaine(l.workDate);
    par.set(debut, (par.get(debut) ?? 0) + l.hours);
  }
  return [...par.entries()]
    .map(([debut, heures]) => ({ debut, hours: arrondi(heures) }))
    .sort((a, b) => b.debut.localeCompare(a.debut));
}

/** Heures d'UN employé, semaine par semaine. */
export function semainesDeLEmploye(lignes: LigneHeures[], employeeId: string): TotalParSemaine[] {
  return totalParSemaine(lignes.filter((l) => l.employeeId === employeeId));
}
