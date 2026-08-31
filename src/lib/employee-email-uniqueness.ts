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
  /** Pour nommer le porteur dans le refus : « déjà utilisé » sans dire par qui
   *  oblige à ouvrir les fiches une par une pour retrouver le coupable. */
  firstName?: string | null;
  lastName?: string | null;
  archivedAt?: string | null;
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
function nomComplet(e: EmployeeEmailRow): string {
  const nom = [e.firstName, e.lastName].filter(Boolean).join(" ").trim();
  return nom || "un autre employé";
}

/**
 * L'employé COURANT qui détient déjà cette adresse, s'il y en a un.
 *
 * Sépare « qui bloque » de « quoi dire » : le transfert a besoin de
 * l'identifiant, le refus a besoin du nom.
 */
export function trouverPorteur(
  email: string | null | undefined,
  autres: EmployeeEmailRow[],
  employeIdCourant?: string,
): EmployeeEmailRow | null {
  const cible = normaliserCourriel(email);
  if (!cible) return null;
  return (
    autres.find(
      (e) =>
        e.id !== employeIdCourant &&
        !e.archivedAt &&
        normaliserCourriel(e.email) === cible,
    ) ?? null
  );
}

export function refusCourrielEnDouble(
  email: string | null | undefined,
  autres: EmployeeEmailRow[],
  employeIdCourant?: string,
): string | null {
  const cible = normaliserCourriel(email);
  if (!cible) return null;

  // Un employé ARCHIVÉ ne retient pas son adresse : il a quitté l'entreprise,
  // et une fiche créée par erreur puis archivée ne doit pas empêcher de la
  // refaire. L'index en base applique la même règle — les deux doivent
  // coïncider, sinon on refuse ici ce que la base accepterait, ou l'inverse.
  const collision = autres.find(
    (e) =>
      e.id !== employeIdCourant &&
      !e.archivedAt &&
      normaliserCourriel(e.email) === cible,
  );
  if (!collision) return null;

  return (
    `Ce courriel est déjà utilisé par ${nomComplet(collision)}. ` +
    "Chaque employé doit avoir sa propre adresse, sinon l'invitation à " +
    "l'application ne peut pas les distinguer."
  );
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
