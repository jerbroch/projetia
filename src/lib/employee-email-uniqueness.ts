/**
 * Un courriel ne sert qu'à un employé par entreprise.
 *
 * Rien ne l'empêchait, et ça se voit en production : cinq employés partageaient
 * l'adresse de l'administrateur, deux autres se partageaient la même boîte.
 *
 * Ce n'est pas un détail de propreté. Le courriel est la CLÉ D'IDENTITÉ du
 * parcours d'invitation : `inviteUserByEmail` crée un compte par adresse. Deux
 * employés qui partagent une adresse ne peuvent pas avoir deux accès — le
 * second échoue sur « un compte existe déjà », et si le premier a accepté,
 * l'employé lié au compte est celui que la base a rattaché en premier, ce que
 * personne ne contrôle.
 */

export interface EmployeeEmailRow {
  id: string;
  email?: string | null;
}

/** Normalisation utilisée pour la comparaison : casse et espaces ignorés. */
export function normaliserCourriel(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Message de refus, ou `null` si l'adresse est libre.
 *
 * Une adresse vide est toujours acceptée : beaucoup d'employés de chantier
 * n'en ont pas, et rien ne les oblige à en avoir tant qu'on ne leur donne pas
 * d'accès à l'application.
 */
export function refusCourrielEnDouble(
  email: string | null | undefined,
  autres: EmployeeEmailRow[],
  employeIdCourant?: string,
): string | null {
  const cible = normaliserCourriel(email);
  if (!cible) return null;

  const collision = autres.find(
    (e) => e.id !== employeIdCourant && normaliserCourriel(e.email) === cible,
  );
  if (!collision) return null;

  return "Ce courriel est déjà utilisé par un autre employé. Chaque employé doit avoir sa propre adresse, sinon l'invitation à l'application ne peut pas les distinguer.";
}

/**
 * Groupes d'employés partageant une même adresse, pour le nettoyage.
 *
 * Rend les groupes de deux et plus, adresse normalisée en clé.
 */
export function grouperDoublons(
  employes: EmployeeEmailRow[],
): { email: string; ids: string[] }[] {
  const par = new Map<string, string[]>();
  for (const e of employes) {
    const cle = normaliserCourriel(e.email);
    if (!cle) continue;
    par.set(cle, [...(par.get(cle) ?? []), e.id]);
  }
  return [...par.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([email, ids]) => ({ email, ids }));
}
