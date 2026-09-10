import type {
  QuoteCostEstimation,
  QuoteFeeLine,
  QuoteLaborLine,
  QuoteMaterialLine,
} from "@/types";
import { FEE_TYPE_LABELS, getLaborLineDisplayLabel } from "@/lib/quote-cost-utils";

/**
 * DE L'ESTIMATION DE COÛT AUX LIGNES DE VERSION.
 *
 * L'éditeur donne déjà à chaque ligne un identifiant stable (`ql-…`, `qm-…`,
 * `qf-…`) qui traverse les sauvegardes : écrit dans `cost_estimation`, relu par
 * `mapCostEstimationFromDb`, conservé par `normalizeCostEstimation`. C'est lui
 * qui porte l'identité d'un ouvrage d'une révision à l'autre.
 *
 * Ce module ne touche pas la base. Il dit seulement ce que la version courante
 * DEVRAIT contenir. L'écriture, elle, est dans `quote-versioning-write.ts`.
 */

export type TypeDeLigne = "labor" | "material" | "fee";
export type SourceDeLigne = "manual" | "catalog";

export interface LigneVoulue {
  /** L'identifiant que l'éditeur porte déjà. Le point de jonction. */
  clientLineId: string;
  sortOrder: number;
  lineType: TypeDeLigne;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number;
  laborHours: number | null;
  laborTypeSnapshot: string | null;
  catalogItemId: string | null;
  source: SourceDeLigne;
}

/**
 * Une ligne sans identifiant ne pourra jamais recevoir d'heures : elle
 * créerait une identité que personne ne retrouverait. On échoue tout de
 * suite, en nommant la ligne, plutôt que d'en inventer une.
 */
function exigerIdentifiant(id: unknown, ou: string): string {
  const v = typeof id === "string" ? id.trim() : "";
  if (!v) {
    throw new Error(
      `Ligne sans identifiant (${ou}). Le versionnage ne peut pas la rattacher.`
    );
  }
  return v;
}

function ligneMainDoeuvre(line: QuoteLaborLine, sortOrder: number): LigneVoulue {
  const libelle = getLaborLineDisplayLabel(line);
  // Les heures d'un ouvrage sont celles de TOUS ses travailleurs : c'est ce
  // que le terrain saisira en face. `hours` seul décrirait un seul homme et
  // ferait paraître chaque chantier en dépassement.
  const heures = (Number(line.hours) || 0) * (Number(line.workerCount) || 1);
  return {
    clientLineId: exigerIdentifiant(line.id, `main-d'œuvre « ${libelle} »`),
    sortOrder,
    lineType: "labor",
    description: libelle,
    quantity: heures,
    unit: "h",
    unitPrice: Number(line.hourlyRate) || 0,
    amount: Number(line.total) || 0,
    laborHours: heures,
    laborTypeSnapshot: libelle,
    catalogItemId: null,
    // Le gabarit de taux d'où vient `hourlyRate` n'est pas retenu par
    // l'éditeur : voir la dette « labor_rate_id nul » au journal.
    source: "manual",
  };
}

function ligneMateriau(line: QuoteMaterialLine, sortOrder: number): LigneVoulue {
  const nom = String(line.name ?? "").trim();
  const catalogItemId = line.catalogItemId?.trim() || null;
  return {
    clientLineId: exigerIdentifiant(line.id, `matériau « ${nom || "sans nom"} »`),
    sortOrder,
    lineType: "material",
    description: nom || "Matériau",
    quantity: Number(line.quantity) || 0,
    unit: String(line.unit ?? "unité"),
    unitPrice: Number(line.salePrice) || 0,
    amount: Number(line.total) || 0,
    laborHours: null,
    laborTypeSnapshot: null,
    catalogItemId,
    // Provenance du chiffre : le catalogue quand la ligne en vient, la main
    // de l'entrepreneur sinon. C'est ce qui distinguera plus tard un prix
    // qu'on peut rafraîchir d'un prix qu'on ne doit pas toucher.
    source: catalogItemId ? "catalog" : "manual",
  };
}

function ligneFrais(line: QuoteFeeLine, sortOrder: number): LigneVoulue {
  const texte = String(line.description ?? "").trim();
  const libelle = texte || FEE_TYPE_LABELS[line.feeType] || "Frais";
  return {
    clientLineId: exigerIdentifiant(line.id, `frais « ${libelle} »`),
    sortOrder,
    lineType: "fee",
    description: libelle,
    quantity: Number(line.quantity) || 0,
    unit: null,
    unitPrice: Number(line.price) || 0,
    amount: Number(line.total) || 0,
    laborHours: null,
    laborTypeSnapshot: null,
    catalogItemId: null,
    source: "manual",
  };
}

/**
 * Ce que la version courante devrait contenir, dans l'ordre où l'entrepreneur
 * l'a saisi : main-d'œuvre, puis matériaux, puis frais.
 *
 * Une soumission sans estimation rend une liste vide — et non une ligne
 * fabriquée depuis le titre. Une version à zéro ligne est honnête ; une ligne
 * inventée prétendrait connaître une structure qui n'a jamais été saisie.
 */
export function lignesVoulues(estimation?: QuoteCostEstimation | null): LigneVoulue[] {
  if (!estimation || typeof estimation !== "object") return [];

  const lignes: LigneVoulue[] = [];
  let ordre = 0;

  for (const l of Array.isArray(estimation.labor) ? estimation.labor : []) {
    lignes.push(ligneMainDoeuvre(l, ordre++));
  }
  for (const m of Array.isArray(estimation.materials) ? estimation.materials : []) {
    lignes.push(ligneMateriau(m, ordre++));
  }
  for (const f of Array.isArray(estimation.fees) ? estimation.fees : []) {
    lignes.push(ligneFrais(f, ordre++));
  }

  const vus = new Set<string>();
  for (const l of lignes) {
    if (vus.has(l.clientLineId)) {
      throw new Error(
        `Identifiant de ligne en double : ${l.clientLineId}. ` +
          `Deux ouvrages partageraient la même identité.`
      );
    }
    vus.add(l.clientLineId);
  }

  return lignes;
}

export interface PlanDEcriture {
  /** Lignes dont l'identité existe déjà : on la reprend, jamais on la refait. */
  aReprendre: Array<{ ligne: LigneVoulue; quoteLineItemId: string }>;
  /** Lignes neuves : identité à créer. */
  aCreer: LigneVoulue[];
  /** Identités qui ne sont plus dans la version : leur état de ligne s'efface,
   *  l'identité elle-même reste en base. */
  aRetirer: string[];
}

/**
 * Confronte ce qu'on veut à ce qui existe. Le rattachement du terrain dépend
 * entièrement de ceci : une ligne conservée doit ressortir dans `aReprendre`,
 * jamais dans `aCreer`.
 */
export function planifier(
  voulues: LigneVoulue[],
  existantes: Array<{ id: string; clientLineId: string }>
): PlanDEcriture {
  const parClientId = new Map(existantes.map((e) => [e.clientLineId, e.id]));

  const aReprendre: PlanDEcriture["aReprendre"] = [];
  const aCreer: LigneVoulue[] = [];
  const gardes = new Set<string>();

  for (const ligne of voulues) {
    const existant = parClientId.get(ligne.clientLineId);
    if (existant) {
      aReprendre.push({ ligne, quoteLineItemId: existant });
      gardes.add(existant);
    } else {
      aCreer.push(ligne);
    }
  }

  return {
    aReprendre,
    aCreer,
    aRetirer: existantes.map((e) => e.id).filter((id) => !gardes.has(id)),
  };
}
