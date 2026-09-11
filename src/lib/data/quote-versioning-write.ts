import type { createClient } from "@/lib/supabase/server";
import type { QuoteCostEstimation } from "@/types";
import { lignesVoulues, planifier, type LigneVoulue } from "@/lib/quotes/versionnage";
import { mapCostEstimationFromDb } from "@/lib/quote-cost-utils";
import { noterEchecDEcriture } from "@/lib/data/echecs-decriture";

/**
 * ALIMENTER LES TABLES DE VERSIONNAGE À CHAQUE SAUVEGARDE.
 *
 * S'ajoute au comportement existant, ne le remplace pas : `quotes.line_items`
 * et `quotes.cost_estimation` continuent d'être écrits exactement comme avant.
 *
 * NON BLOQUANT, MAIS PAS SILENCIEUX. Une soumission ne doit jamais échouer
 * parce que le versionnage a raté — le client Supabase ne sait pas faire de
 * transaction sur plusieurs instructions, donc les deux écritures ne peuvent
 * pas être atomiques sans passer par une fonction Postgres. Mais un échec
 * journalisé dans les logs du serveur n'est jamais lu : chaque échec s'inscrit
 * dans `write_failures`, qui se consulte.
 */

export type OperationDeSauvegarde = "create" | "update" | "duplicate";

export interface ResultatVersionnage {
  ok: boolean;
  /** Renseigné quand l'écriture a eu lieu. */
  quoteVersionId?: string;
  reprises?: number;
  creees?: number;
  retirees?: number;
  /** Renseigné quand on a délibérément ne rien fait. */
  ignore?: string;
  erreur?: string;
}

/** Le client tel que le construit `@/lib/supabase/server` — même typage que
 *  partout ailleurs dans tenant-data, pour que les tables soient connues. */
type Client = Awaited<ReturnType<typeof createClient>>;

interface Parametres {
  companyId: string;
  quoteId: string;
  estimation?: QuoteCostEstimation | null;
  operation: OperationDeSauvegarde;
  /** Pour une duplication : la soumission d'origine, dont on hérite l'ascendance. */
  copieDeQuoteId?: string;
}

/** Les colonnes de preuve restent nulles : la finalisation n'existe pas encore. */
function rangeeDeVersion(ligne: LigneVoulue, quoteVersionId: string, quoteLineItemId: string, companyId: string) {
  return {
    quote_version_id: quoteVersionId,
    quote_line_item_id: quoteLineItemId,
    company_id: companyId,
    sort_order: ligne.sortOrder,
    line_type: ligne.lineType,
    description: ligne.description,
    quantity: ligne.quantity,
    unit: ligne.unit,
    unit_price: ligne.unitPrice,
    amount: ligne.amount,
    labor_hours: ligne.laborHours,
    labor_rate_id: null,
    labor_type_snapshot: ligne.laborTypeSnapshot,
    catalog_item_id: ligne.catalogItemId,
    source: ligne.source,
  };
}

/**
 * Enregistre l'échec là où il se verra. Si même ça échoue, on ne fait rien de
 * plus : la sauvegarde de la soumission, elle, a réussi et c'est ce qui compte.
 */
async function noterEchec(
  supabase: Client,
  companyId: string,
  quoteId: string,
  operation: OperationDeSauvegarde,
  erreur: string
): Promise<void> {
  await noterEchecDEcriture(supabase as never, {
    companyId,
    quoteId,
    domain: "versioning",
    operation,
    erreur,
  });
}

async function ecrire(supabase: Client, p: Parametres): Promise<ResultatVersionnage> {
  const voulues = lignesVoulues(p.estimation);

  // 1. La version courante. La plus récente fait foi.
  const { data: versions, error: eVersions } = await supabase
    .from("quote_versions")
    .select("id, status, version_number")
    .eq("quote_id", p.quoteId)
    .order("version_number", { ascending: false })
    .limit(1);
  if (eVersions) throw new Error(`lecture des versions : ${eVersions.message}`);

  let version = versions?.[0] as { id: string; status: string; version_number: number } | undefined;

  if (!version) {
    const { data, error } = await supabase
      .from("quote_versions")
      .insert({
        quote_id: p.quoteId,
        company_id: p.companyId,
        version_number: 1,
        status: "draft",
      })
      .select("id, status, version_number")
      .single();
    if (error) throw new Error(`création de la version 1 : ${error.message}`);
    version = data as { id: string; status: string; version_number: number };
  } else if (version.status !== "draft") {
    // Le déclencheur refuserait l'écriture, et il aurait raison : une version
    // sortie de draft est figée. Créer la suivante est le travail de la
    // finalisation, qui n'existe pas encore. On ne fait rien, et on le dit.
    return { ok: true, ignore: `version ${version.version_number} au statut ${version.status}` };
  }

  // 2. Les identités déjà en place pour cette soumission.
  const { data: items, error: eItems } = await supabase
    .from("quote_line_items")
    .select("id, client_line_id")
    .eq("quote_id", p.quoteId);
  if (eItems) throw new Error(`lecture des identités : ${eItems.message}`);

  const existantes = (items ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    clientLineId: String((r as { client_line_id: string }).client_line_id),
  }));

  const plan = planifier(voulues, existantes);

  // 3. Pour une duplication : l'ascendance. On crée de NOUVELLES identités qui
  //    pointent vers les anciennes — jamais un partage. Deux soumissions qui
  //    se partageraient un quote_line_item feraient remonter les heures d'un
  //    chantier dans les statistiques d'un autre.
  let ascendance = new Map<string, string>();
  if (p.copieDeQuoteId) {
    const { data: source } = await supabase
      .from("quote_line_items")
      .select("id, client_line_id")
      .eq("quote_id", p.copieDeQuoteId);
    ascendance = new Map(
      (source ?? []).map((r) => [
        String((r as { client_line_id: string }).client_line_id),
        String((r as { id: string }).id),
      ])
    );
  }

  // 4. Les identités neuves.
  const parClientId = new Map(plan.aReprendre.map((r) => [r.ligne.clientLineId, r.quoteLineItemId]));
  if (plan.aCreer.length) {
    const { data, error } = await supabase
      .from("quote_line_items")
      .insert(
        plan.aCreer.map((l) => ({
          quote_id: p.quoteId,
          company_id: p.companyId,
          client_line_id: l.clientLineId,
          copied_from_quote_line_item_id: ascendance.get(l.clientLineId) ?? null,
        }))
      )
      .select("id, client_line_id");
    if (error) throw new Error(`création des identités : ${error.message}`);
    for (const r of data ?? []) {
      parClientId.set(
        String((r as { client_line_id: string }).client_line_id),
        String((r as { id: string }).id)
      );
    }
  }

  // 5. L'état des lignes dans cette version. `upsert` sur la contrainte
  //    (quote_version_id, quote_line_item_id) : une ligne conservée est mise à
  //    jour en place, elle ne perd jamais son identité.
  if (voulues.length) {
    const rangees = voulues.map((l) =>
      rangeeDeVersion(l, version!.id, parClientId.get(l.clientLineId)!, p.companyId)
    );
    const { error } = await supabase
      .from("quote_line_versions")
      .upsert(rangees, { onConflict: "quote_version_id,quote_line_item_id" });
    if (error) throw new Error(`écriture des lignes : ${error.message}`);
  }

  // 6. Les lignes retirées disparaissent de la version courante. Leur identité
  //    reste en base : des heures peuvent déjà y pointer.
  if (plan.aRetirer.length) {
    const { error } = await supabase
      .from("quote_line_versions")
      .delete()
      .eq("quote_version_id", version.id)
      .in("quote_line_item_id", plan.aRetirer);
    if (error) throw new Error(`retrait des lignes : ${error.message}`);
  }

  return {
    ok: true,
    quoteVersionId: version.id,
    reprises: plan.aReprendre.length,
    creees: plan.aCreer.length,
    retirees: plan.aRetirer.length,
  };
}

/**
 * Point d'entrée. Ne lève jamais : la sauvegarde de la soumission a déjà eu
 * lieu et ne doit pas être défaite par ce qui suit.
 */
export async function ecrireVersionCourante(
  supabase: Client,
  p: Parametres
): Promise<ResultatVersionnage> {
  try {
    return await ecrire(supabase, p);
  } catch (e) {
    const erreur = e instanceof Error ? e.message : String(e);
    await noterEchec(supabase, p.companyId, p.quoteId, p.operation, erreur);
    return { ok: false, erreur };
  }
}

/** Lit l'estimation telle qu'elle vient d'être écrite en base. */
export function estimationDepuisRangee(row: unknown): QuoteCostEstimation | undefined {
  const r = row as { cost_estimation?: unknown } | null;
  return mapCostEstimationFromDb(r?.cost_estimation);
}
