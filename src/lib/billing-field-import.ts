/**
 * Déversement des saisies terrain dans la feuille de facturation.
 *
 * Les heures et les matériaux dormaient dans field_hours et field_materials :
 * la facturation ne les lisait jamais, et l'employeur retapait un taux et un
 * nombre de travailleurs à la main pendant que les vraies heures étaient là.
 *
 * Trois règles gouvernent ce module, et chacune répond à une question posée :
 *
 *   • Le prix vient du GABARIT de main-d'œuvre (`bill_rate`), pas de la fiche
 *     employé. `employees.hourly_rate` ne dit pas s'il s'agit du salaire versé
 *     ou du taux refacturé ; le gabarit, lui, distingue déjà `cost_per_hr` de
 *     `bill_rate`.
 *
 *   • Une ligne retouchée à la main n'est JAMAIS écrasée en silence. On la
 *     signale, et c'est l'employeur qui tranche.
 *
 *   • Un matériau absent du catalogue entre quand même, à prix zéro et
 *     signalé. Le laisser dehors ferait facturer un chantier en oubliant du
 *     matériel ; lui inventer un prix serait pire.
 */

export interface HeureTerrain {
  id: string;
  employeeId: string;
  employeeName: string;
  hours: number;
  laborType?: string | null;
}

export interface MateriauTerrain {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  catalogItemId?: string | null;
}

export interface GabaritMainOeuvre {
  id: string;
  name: string;
  billRate: number;
}

export interface LigneExistante {
  id: string;
  sourceKind?: string | null;
  sourceIds?: string[] | null;
  manuallyEdited?: boolean | null;
  description: string;
}

export interface LigneProposee {
  lineType: "labor" | "material";
  description: string;
  quantity: number;
  unitSellPrice: number;
  sourceKind: "field_hours" | "field_material";
  sourceIds: string[];
  /** Gabarit appliqué à une ligne de main-d'œuvre, pour pouvoir le changer. */
  laborTemplateId?: string | null;
  /** Vrai quand aucun prix n'a pu être déterminé — à saisir avant d'envoyer. */
  prixAsaisir: boolean;
}

function arrondi(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Une ligne de main-d'œuvre PAR EMPLOYÉ, pas une ligne globale.
 *
 * Regrouper toutes les heures en une seule ligne ferait disparaître qui a
 * travaillé, et rendrait impossible de corriger la part d'un seul gars.
 */
export function lignesDeMainOeuvre(
  heures: HeureTerrain[],
  gabarit: GabaritMainOeuvre | null,
): LigneProposee[] {
  const par = new Map<string, { nom: string; heures: number; ids: string[] }>();
  for (const h of heures) {
    if (h.hours <= 0) continue;
    const e = par.get(h.employeeId) ?? { nom: h.employeeName, heures: 0, ids: [] };
    e.heures += h.hours;
    e.ids.push(h.id);
    par.set(h.employeeId, e);
  }
  return [...par.values()]
    .map((e) => ({
      lineType: "labor" as const,
      description: gabarit ? `${e.nom} — ${gabarit.name}` : e.nom,
      quantity: arrondi(e.heures),
      unitSellPrice: gabarit?.billRate ?? 0,
      sourceKind: "field_hours" as const,
      sourceIds: e.ids,
      laborTemplateId: gabarit?.id ?? null,
      prixAsaisir: !gabarit || gabarit.billRate <= 0,
    }))
    .sort((a, b) => a.description.localeCompare(b.description, "fr"));
}

/**
 * Une ligne par matériau saisi.
 *
 * Un matériau hors catalogue n'a pas de prix : il entre à zéro, marqué
 * `prixAsaisir`. Le supprimer silencieusement ferait facturer un chantier en
 * oubliant du matériel — c'est l'erreur qui coûte cher.
 */
export function lignesDeMateriaux(
  materiaux: MateriauTerrain[],
  prixParCatalogue: Record<string, number>,
): LigneProposee[] {
  const par = new Map<string, { nom: string; qte: number; ids: string[]; prix: number; horsCatalogue: boolean }>();
  for (const m of materiaux) {
    if (m.quantity <= 0) continue;
    const cle = m.catalogItemId ?? `libre:${m.name.trim().toLowerCase()}`;
    const prix = m.catalogItemId ? (prixParCatalogue[m.catalogItemId] ?? 0) : 0;
    const e = par.get(cle) ?? {
      nom: m.name,
      qte: 0,
      ids: [],
      prix,
      horsCatalogue: !m.catalogItemId || prixParCatalogue[m.catalogItemId] === undefined,
    };
    e.qte += m.quantity;
    e.ids.push(m.id);
    par.set(cle, e);
  }
  return [...par.values()]
    .map((e) => ({
      lineType: "material" as const,
      description: e.horsCatalogue ? `${e.nom} (hors catalogue)` : e.nom,
      quantity: arrondi(e.qte),
      unitSellPrice: e.prix,
      sourceKind: "field_material" as const,
      sourceIds: e.ids,
      prixAsaisir: e.horsCatalogue || e.prix <= 0,
    }))
    .sort((a, b) => a.description.localeCompare(b.description, "fr"));
}

/** Saisies terrain qu'aucune ligne de la feuille ne représente encore. */
export function saisiesNonImportees(
  lignes: LigneExistante[],
  heures: HeureTerrain[],
  materiaux: MateriauTerrain[],
): { heures: HeureTerrain[]; materiaux: MateriauTerrain[] } {
  const connus = new Set(lignes.flatMap((l) => l.sourceIds ?? []));
  return {
    heures: heures.filter((h) => !connus.has(h.id)),
    materiaux: materiaux.filter((m) => !connus.has(m.id)),
  };
}

/**
 * Lignes importées que l'employeur a retouchées.
 *
 * Ce sont celles qu'un réimport détruirait. On les nomme AVANT d'écraser :
 * refaire une correction qu'on croyait acquise est la pire des surprises.
 */
export function lignesQueLImportEcraserait(lignes: LigneExistante[]): LigneExistante[] {
  return lignes.filter((l) => l.sourceKind && l.manuallyEdited);
}

export interface ResumeHeures {
  prevu: number;
  reel: number;
  ecart: number;
  /** Heures saisies après le dernier import — jamais facturées si on les ignore. */
  nonImportees: number;
}

/**
 * Le bandeau de tête : prévu, réel, écart, et ce qui est arrivé en retard.
 */
export function resumeDesHeures(
  prevu: number,
  heures: HeureTerrain[],
  lignes: LigneExistante[],
): ResumeHeures {
  const reel = heures.reduce((s, h) => s + h.hours, 0);
  const connus = new Set(lignes.flatMap((l) => l.sourceIds ?? []));
  const nonImportees = heures.filter((h) => !connus.has(h.id)).reduce((s, h) => s + h.hours, 0);
  return {
    prevu: arrondi(prevu),
    reel: arrondi(reel),
    ecart: arrondi(reel - prevu),
    nonImportees: arrondi(nonImportees),
  };
}

/**
 * Nouveau prix d'une ligne quand on lui applique un autre gabarit.
 *
 * Changer de gabarit est une DÉCISION DE BUREAU : c'est en facturant qu'on
 * tranche entre régulier et temps supplémentaire, pas au moment où le gars
 * saisit ses heures. Le nombre d'heures ne bouge pas — seul le taux change.
 */
export function ligneAvecAutreGabarit(
  quantity: number,
  gabarit: GabaritMainOeuvre | null,
): { unitSellPrice: number; lineTotal: number; prixAsaisir: boolean } {
  const taux = gabarit?.billRate ?? 0;
  return {
    unitSellPrice: taux,
    lineTotal: Math.round(quantity * taux * 100) / 100,
    prixAsaisir: taux <= 0,
  };
}
